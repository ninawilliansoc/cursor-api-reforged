const errorFilterModel = require('../models/errorFilter');
const { getNextCookie } = require('./cookieRotation');

/**
 * Maximum number of attempts to retry with different cookies before giving up
 */
const MAX_RETRY_ATTEMPTS = 20;

/**
 * Process a response for a premium token, checking for errors and rotating cookies if needed
 * @param {string} response - The response text to check for errors
 * @param {Function} requestFn - A function that makes the API request with a new cookie
 * @param {number} attempts - Current number of attempts (used for recursion)
 * @param {boolean} isPremium - Whether the token is premium or not
 * @returns {Promise<Object>} - The final response object after error handling
 */
async function handlePremiumResponse(response, requestFn, attempts = 0, isPremium = false) {
    // Check if the response contains any error patterns
    const errorFilter = errorFilterModel.checkForErrors(response);
    
    // If no error is found or we've reached the maximum retry attempts, return the current response
    if (!errorFilter || attempts >= MAX_RETRY_ATTEMPTS) {
        return { 
            response, 
            error: attempts >= MAX_RETRY_ATTEMPTS ? 'Maximum retry attempts reached' : null,
            filtered: !!errorFilter,
            attempts
        };
    }
    
    // Check which type of error was detected
    const isFreeRequestsLimitError = errorFilter.description === "Cursor free requests limit message";
    const isUnauthorizedError = errorFilter.description === "Cursor unauthorized request error";
    
    // For free requests limit errors, only rotate cookies if the token is premium
    // For unauthorized errors, always rotate cookies
    if (isFreeRequestsLimitError && !isPremium) {
        console.log('Free requests limit error detected, but token is not premium. Not rotating cookie.');
        return {
            response,
            error: null,
            filtered: false,
            attempts
        };
    }
    
    // Log the specific type of error detected
    if (isFreeRequestsLimitError) {
        console.log('Free requests limit error detected. Rotating cookie.');
    } else if (isUnauthorizedError) {
        console.log('Unauthorized request error detected. Rotating cookie.');
    }
    
    console.log(`Error detected: "${errorFilter.pattern}". Rotating cookie and retrying (attempt ${attempts + 1}/${MAX_RETRY_ATTEMPTS})`);
    
    // Get a new cookie and retry the request
    try {
        // Make a new request with the next cookie
        const newResponse = await requestFn();
        
        // Recursively check the new response
        return await handlePremiumResponse(newResponse, requestFn, attempts + 1, isPremium);
    } catch (error) {
        console.error('Error during cookie rotation retry:', error);
        return { 
            response, 
            error: error.message, 
            filtered: true,
            attempts
        };
    }
}

/**
 * Create a request function that can be used for retries with new cookies
 * @param {Function} requestCallback - A callback function that accepts a cookie and returns a Promise
 * @returns {Function} - A function that can be called to make a new request with the next cookie
 */
function createRequestFunction(requestCallback) {
    return async () => {
        const cookie = getNextCookie();
        if (!cookie) {
            throw new Error('No authentication cookies available');
        }
        return await requestCallback(cookie);
    };
}

module.exports = {
    handlePremiumResponse,
    createRequestFunction
};
