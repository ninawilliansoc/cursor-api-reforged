const express = require('express');
const router = express.Router();
const { fetch, ProxyAgent, Agent } = require('undici');

const { v4: uuidv4, v5: uuidv5 } = require('uuid');
const config = require('../config/config');
const $root = require('../proto/message.js');
const { generateCursorBody, chunkToUtf8String, generateHashed64Hex, generateCursorChecksum } = require('../utils/utils.js');
const { getNextCookie } = require('../services/cookieRotation');
const { handlePremiumResponse, createRequestFunction } = require('../services/errorFilterService');
const tokenModel = require('../models/token');

/**
 * Helper function to make a stream request with a specific auth token
 * @param {string} authToken - The authentication cookie to use
 * @param {string} model - The model to use for the request
 * @param {Array} messages - The messages to send
 * @returns {Promise<Response>} - The fetch response
 */
async function makeStreamRequest(authToken, model, messages) {
  const cursorChecksum = generateCursorChecksum(authToken.trim());
  const sessionid = uuidv5(authToken, uuidv5.DNS);
  const clientKey = generateHashed64Hex(authToken);
  const cursorClientVersion = "0.48.7";
  const cursorConfigVersion = uuidv4();
  
  const cursorBody = generateCursorBody(messages, model);
  const dispatcher = config.proxy.enabled
    ? new ProxyAgent(config.proxy.url, { allowH2: true })
    : new Agent({ allowH2: true });
    
  return await fetch('https://api2.cursor.sh/aiserver.v1.ChatService/StreamUnifiedChatWithTools', {
    method: 'POST',
    headers: {
      'authorization': `Bearer ${authToken}`,
      'connect-accept-encoding': 'gzip',
      'connect-content-encoding': 'gzip',
      'connect-protocol-version': '1',
      'content-type': 'application/connect+proto',
      'user-agent': 'connect-es/1.6.1',
      'x-amzn-trace-id': `Root=${uuidv4()}`,
      'x-client-key': clientKey,
      'x-cursor-checksum': cursorChecksum,
      'x-cursor-client-version': cursorClientVersion,
      'x-cursor-config-version': cursorConfigVersion,
      'x-cursor-timezone': 'Asia/Shanghai',
      'x-ghost-mode': 'true',
      'x-request-id': uuidv4(),
      'x-session-id': sessionid,
      'Host': 'api2.cursor.sh'
    },
    body: cursorBody,
    dispatcher: dispatcher,
    timeout: {
      connect: 5000,
      read: 30000
    }
  });
}

/**
 * Helper function to make a non-stream request with a specific auth token
 * @param {string} authToken - The authentication cookie to use
 * @param {string} model - The model to use for the request
 * @param {Array} messages - The messages to send
 * @returns {Promise<Response>} - The fetch response
 */
async function makeNonStreamRequest(authToken, model, messages) {
  // This is the same as makeStreamRequest since the API endpoint is the same
  return makeStreamRequest(authToken, model, messages);
}

/**
 * Format the response content with proper thinking tags
 * @param {string} content - The raw response content
 * @returns {string} - The formatted response content
 */
function formatResponseContent(content) {
  let thinkingStart = "<thinking>";
  let thinkingEnd = "</thinking>";
  let formattedContent = '';
  
  // Split the content by thinking and text parts
  const thinkingMatch = content.match(/<thinking>([\s\S]*?)<\/thinking>/);
  const thinking = thinkingMatch ? thinkingMatch[1] : '';
  const text = thinkingMatch ? content.replace(thinkingMatch[0], '') : content;
  
  if (thinking) {
    formattedContent += thinkingStart + "\n" + thinking + "\n" + thinkingEnd + "\n";
  }
  
  formattedContent += text;
  
  return formattedContent;
}

router.get("/models", async (req, res) => {
  try{
    // Get the next cookie from the rotation service
    let authToken = getNextCookie();
    
    // If no cookies are available in the rotation service, fall back to the authorization header
    if (!authToken) {
      console.log('No auth cookies available in rotation service, falling back to authorization header');
      let bearerToken = req.headers.authorization?.replace('Bearer ', '');
      if (!bearerToken) {
        return res.status(401).json({
          error: 'No authentication credentials provided',
          message: 'Please provide a valid token in the Authorization header using Bearer format or add auth cookies through the admin panel'
        });
      }
      
      authToken = bearerToken.split(',').map((key) => key.trim())[0];
      if (authToken && authToken.includes('%3A%3A')) {
        authToken = authToken.split('%3A%3A')[1];
      }
      else if (authToken && authToken.includes('::')) {
        authToken = authToken.split('::')[1];
      }
    }

    const cursorChecksum = req.headers['x-cursor-checksum'] 
      ?? generateCursorChecksum(authToken.trim());
    const cursorClientVersion = "0.48.7"

    const availableModelsResponse = await fetch("https://api2.cursor.sh/aiserver.v1.AiService/AvailableModels", {
      method: 'POST',
      headers: {
        'accept-encoding': 'gzip',
        'authorization': `Bearer ${authToken}`,
        'connect-protocol-version': '1',
        'content-type': 'application/proto',
        'user-agent': 'connect-es/1.6.1',
        'x-cursor-checksum': cursorChecksum,
        'x-cursor-client-version': cursorClientVersion,
        'x-cursor-config-version': uuidv4(),
        'x-cursor-timezone': 'Asia/Shanghai',
        'x-ghost-mode': 'true',
        'Host': 'api2.cursor.sh',
      },
    })
    const data = await availableModelsResponse.arrayBuffer();
    const buffer = Buffer.from(data);
    try{
      const models = $root.AvailableModelsResponse.decode(buffer).models;

      return res.json({
        object: "list",
        data: models.map(model => ({
          id: model.name,
          created: Date.now(),
          object: 'model',
          owned_by: 'cursor'
        }))
      })
    } catch (error) {
      const text = buffer.toString('utf-8');
      throw new Error(text);      
    }
  }
  catch (error) {
    console.error(error);
    return res.status(500).json({
      error: 'Internal server error',
    });
  }
})

router.post('/chat/completions', async (req, res) => {

  try {
    const { model, messages, stream = false } = req.body;
    
    // Check if the request has a valid API token
    let apiToken = null;
    let isPremium = false;
    
    // The token should already be validated by the auth middleware
    if (req.token) {
      apiToken = req.token;
      isPremium = apiToken.premium === true;
      console.log(`Using token from auth middleware: ${apiToken.name}`);
    }
    
    // Get the next cookie from the rotation service
    let authToken = getNextCookie();
    console.log(`Auth cookie from rotation service: ${authToken ? 'Found' : 'Not found'}`);
    
    // If no cookies are available in the rotation service, fall back to the authorization header
    if (!authToken) {
      console.log('No auth cookies available in rotation service, falling back to authorization header');
      let bearerToken = req.headers.authorization?.replace('Bearer ', '');
      if (!bearerToken) {
        console.log('No authorization header found');
        
        // Check if we have auth cookies in the environment variables but they weren't loaded properly
        if (config.auth.cookies && config.auth.cookies.length > 0) {
          console.log(`Found ${config.auth.cookies.length} cookies in config but they weren't loaded into the rotation service`);
          
          // Try to use one directly from config as a last resort
          authToken = config.auth.cookies[0];
          console.log(`Using first cookie from config: ${authToken ? 'Found' : 'Not found'}`);
        }
        
        if (!authToken) {
          return res.status(401).json({
            error: 'No authentication credentials provided',
            message: 'Please provide a valid token in the Authorization header using Bearer format or add auth cookies through the admin panel'
          });
        }
      } else {
        const keys = bearerToken.split(',').map((key) => key.trim());
        console.log(`Found ${keys.length} keys in authorization header`);
        // Randomly select one key to use
        authToken = keys[Math.floor(Math.random() * keys.length)];
      }
    }

    if (!messages || !Array.isArray(messages) || messages.length === 0 || !authToken) {
      return res.status(400).json({
        error: 'Invalid request. Messages should be a non-empty array and authorization is required',
      });
    }

    if (authToken && authToken.includes('%3A%3A')) {
      authToken = authToken.split('%3A%3A')[1];
    }
    else if (authToken && authToken.includes('::')) {
      authToken = authToken.split('::')[1];
    }

    const cursorChecksum = req.headers['x-cursor-checksum']
      ?? generateCursorChecksum(authToken.trim());

    const sessionid = uuidv5(authToken,  uuidv5.DNS);
    const clientKey = generateHashed64Hex(authToken)
    const cursorClientVersion = "0.48.7"
    const cursorConfigVersion = uuidv4();

    // Request the AvailableModels before StreamChat.
    const availableModelsResponse = fetch("https://api2.cursor.sh/aiserver.v1.AiService/AvailableModels", {
      method: 'POST',
      headers: {
        'accept-encoding': 'gzip',
        'authorization': `Bearer ${authToken}`,
        'connect-protocol-version': '1',
        'content-type': 'application/proto',
        'user-agent': 'connect-es/1.6.1',
        'x-amzn-trace-id': `Root=${uuidv4()}`,
        'x-client-key': clientKey,
        'x-cursor-checksum': cursorChecksum,
        'x-cursor-client-version': cursorClientVersion,
        'x-cursor-config-version': cursorConfigVersion,
        'x-cursor-timezone': 'Asia/Shanghai',
        'x-ghost-mode': 'true',
        "x-request-id": uuidv4(),
        "x-session-id": sessionid,
        'Host': 'api2.cursor.sh',
      },
    })
    
    const cursorBody = generateCursorBody(messages, model);
    const dispatcher = config.proxy.enabled
      ? new ProxyAgent(config.proxy.url, { allowH2: true })
      : new Agent({ allowH2: true });
    const response = await fetch('https://api2.cursor.sh/aiserver.v1.ChatService/StreamUnifiedChatWithTools', {
      method: 'POST',
      headers: {
        'authorization': `Bearer ${authToken}`,
        'connect-accept-encoding': 'gzip',
        'connect-content-encoding': 'gzip',
        'connect-protocol-version': '1',
        'content-type': 'application/connect+proto',
        'user-agent': 'connect-es/1.6.1',
        'x-amzn-trace-id': `Root=${uuidv4()}`,
        'x-client-key': clientKey,
        'x-cursor-checksum': cursorChecksum,
        'x-cursor-client-version': cursorClientVersion,
        'x-cursor-config-version': cursorConfigVersion,
        'x-cursor-timezone': 'Asia/Shanghai',
        'x-ghost-mode': 'true',
        'x-request-id': uuidv4(),
        'x-session-id': sessionid,
        'Host': 'api2.cursor.sh'
      },
      body: cursorBody,
      dispatcher: dispatcher,
      timeout: {
        connect: 5000,
        read: 30000
      }
    });

    if (response.status !== 200) {
      return res.status(response.status).json({ 
        error: response.statusText 
      });
    }

    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const responseId = `chatcmpl-${uuidv4()}`;

      try {
        // For premium tokens with error filtering in streaming mode
        if (isPremium) {
          // Create a buffer to collect all chunks for error checking
          let collectedContent = '';
          let chunks = [];
          
          // Collect all chunks first
          for await (const chunk of response.body) {
            chunks.push(chunk);
            const { thinking, text } = chunkToUtf8String(chunk);
            collectedContent += thinking + text;
          }
          
          // If we need to retry due to errors
          if (collectedContent.length > 0) {
            // Create a request function for retries
            const makeRequest = createRequestFunction(async (newAuthToken) => {
              // Create a new request with the new cookie
              const newResponse = await makeStreamRequest(newAuthToken, model, messages);
              
              // Collect all chunks from the new response
              let newCollectedContent = '';
              let newChunks = [];
              
              for await (const chunk of newResponse.body) {
                newChunks.push(chunk);
                const { thinking, text } = chunkToUtf8String(chunk);
                newCollectedContent += thinking + text;
              }
              
              return { content: newCollectedContent, chunks: newChunks };
            });
            
            // Handle premium response with error filtering
            const result = await handlePremiumResponse(
              collectedContent, 
              async () => {
                const retryResult = await makeRequest();
                return retryResult.content;
              }
            );
            
            // Use the final chunks (either original or from a successful retry)
            const finalChunks = result.filtered && result.attempts > 0 ? 
              result.response.chunks : chunks;
            
            // Stream the final chunks to the client
            let thinkingStart = "<thinking>";
            let thinkingEnd = "</thinking>";
            
            for (const chunk of finalChunks) {
              const { thinking, text } = chunkToUtf8String(chunk);
              let content = "";
              
              if (thinkingStart !== "" && thinking.length > 0) {
                content += thinkingStart + "\n";
                thinkingStart = "";
              }
              content += thinking;
              if (thinkingEnd !== "" && thinking.length === 0 && text.length !== 0 && thinkingStart === "") {
                content += "\n" + thinkingEnd + "\n";
                thinkingEnd = "";
              }
              
              content += text;
              
              if (content.length > 0) {
                res.write(
                  `data: ${JSON.stringify({
                    id: responseId,
                    object: 'chat.completion.chunk',
                    created: Math.floor(Date.now() / 1000),
                    model: model,
                    choices: [{
                      index: 0,
                      delta: {
                        content: content,
                      },
                    }],
                  })}\n\n`
                );
              }
            }
          }
        } else {
          // Regular streaming for non-premium tokens
          let thinkingStart = "<thinking>";
          let thinkingEnd = "</thinking>";
          for await (const chunk of response.body) {
            const { thinking, text } = chunkToUtf8String(chunk);
            let content = "";
  
            if (thinkingStart !== "" && thinking.length > 0) {
              content += thinkingStart + "\n";
              thinkingStart = "";
            }
            content += thinking;
            if (thinkingEnd !== "" && thinking.length === 0 && text.length !== 0 && thinkingStart === "") {
              content += "\n" + thinkingEnd + "\n";
              thinkingEnd = "";
            }
  
            content += text;
  
            if (content.length > 0) {
              res.write(
                `data: ${JSON.stringify({
                  id: responseId,
                  object: 'chat.completion.chunk',
                  created: Math.floor(Date.now() / 1000),
                  model: model,
                  choices: [{
                    index: 0,
                    delta: {
                      content: content,
                    },
                  }],
                })}\n\n`
              );
            }
          }
        }
      } catch (streamError) {
        console.error('Stream error:', streamError);
        if (streamError.name === 'TimeoutError') {
          res.write(`data: ${JSON.stringify({ error: 'Server response timeout' })}\n\n`);
        } else {
          res.write(`data: ${JSON.stringify({ error: 'Stream processing error' })}\n\n`);
        }
      } finally {
        res.write('data: [DONE]\n\n');
        res.end();
      }
    } else {
      // Non-streaming response
      try {
        if (isPremium) {
          // For premium tokens with error filtering
          let content = '';
          for await (const chunk of response.body) {
            const { thinking, text } = chunkToUtf8String(chunk);
            content += thinking + text;
          }
          
          // Create a request function for retries
          const makeRequest = createRequestFunction(async (newAuthToken) => {
            // Create a new request with the new cookie
            const newResponse = await makeNonStreamRequest(newAuthToken, model, messages);
            
            // Collect content from the new response
            let newContent = '';
            for await (const chunk of newResponse.body) {
              const { thinking, text } = chunkToUtf8String(chunk);
              newContent += thinking + text;
            }
            
            return newContent;
          });
          
          // Handle premium response with error filtering
          const result = await handlePremiumResponse(content, makeRequest);
          
          // Format the final response
          let formattedContent = formatResponseContent(result.response);
          
          return res.json({
            id: `chatcmpl-${uuidv4()}`,
            object: 'chat.completion',
            created: Math.floor(Date.now() / 1000),
            model: model,
            choices: [
              {
                index: 0,
                message: {
                  role: 'assistant',
                  content: formattedContent,
                },
                finish_reason: 'stop',
              },
            ],
            usage: {
              prompt_tokens: 0,
              completion_tokens: 0,
              total_tokens: 0,
            },
          });
        } else {
          // Regular non-streaming for non-premium tokens
          let thinkingStart = "<thinking>";
          let thinkingEnd = "</thinking>";
          let content = '';
          for await (const chunk of response.body) {
            const { thinking, text } = chunkToUtf8String(chunk);
            
            if (thinkingStart !== "" && thinking.length > 0) {
              content += thinkingStart + "\n";
              thinkingStart = "";
            }
            content += thinking;
            if (thinkingEnd !== "" && thinking.length === 0 && text.length !== 0 && thinkingStart === "") {
              content += "\n" + thinkingEnd + "\n";
              thinkingEnd = "";
            }
  
            content += text;
          }
  
          return res.json({
            id: `chatcmpl-${uuidv4()}`,
            object: 'chat.completion',
            created: Math.floor(Date.now() / 1000),
            model: model,
            choices: [
              {
                index: 0,
                message: {
                  role: 'assistant',
                  content: content,
                },
                finish_reason: 'stop',
              },
            ],
            usage: {
              prompt_tokens: 0,
              completion_tokens: 0,
              total_tokens: 0,
            },
          });
        }
      } catch (error) {
        console.error('Non-stream error:', error);
        if (error.name === 'TimeoutError') {
          return res.status(408).json({ error: 'Server response timeout' });
        }
        throw error;
      }
    }
  } catch (error) {
    console.error('Error:', error);
    if (!res.headersSent) {
      const errorMessage = {
        error: error.name === 'TimeoutError' ? 'Request timeout' : 'Internal server error'
      };

      if (req.body.stream) {
        res.write(`data: ${JSON.stringify(errorMessage)}\n\n`);
        return res.end();
      } else {
        return res.status(error.name === 'TimeoutError' ? 408 : 500).json(errorMessage);
      }
    }
  }
});

module.exports = router;
