/**
 * Queue service for handling high traffic situations
 * Implements a priority queue system where tokens with priority get faster processing
 */

// Queue configuration
const QUEUE_ACTIVATION_THRESHOLD = 10; // Number of concurrent requests to activate queue
const NORMAL_QUEUE_WAIT_TIME = 60 * 1000; // 1 minute in milliseconds
const EXTENDED_QUEUE_WAIT_TIME = 2 * 60 * 1000; // 2 minutes in milliseconds
const PRIORITY_QUEUE_WAIT_TIME = 5 * 1000; // 5 seconds in milliseconds

// Queue state
let isQueueActive = false;
let queueLength = 0;
let queueWaitTime = NORMAL_QUEUE_WAIT_TIME;
let activeRequests = 0;

// Request queue
// Format: { resolve: function, priority: boolean, timestamp: number }
const requestQueue = [];

/**
 * Process the next request in the queue
 */
function processNextInQueue() {
    if (requestQueue.length === 0) {
        return;
    }

    // Sort queue by priority (priority first) and then by timestamp (oldest first)
    requestQueue.sort((a, b) => {
        if (a.priority !== b.priority) {
            return a.priority ? -1 : 1;
        }
        return a.timestamp - b.timestamp;
    });

    const nextRequest = requestQueue.shift();
    queueLength = requestQueue.length;
    
    // Process the request
    nextRequest.resolve();
    
    // Check if we should deactivate the queue
    if (queueLength === 0 && activeRequests < QUEUE_ACTIVATION_THRESHOLD) {
        isQueueActive = false;
        queueWaitTime = NORMAL_QUEUE_WAIT_TIME;
    }
}

/**
 * Add a request to the queue
 * @param {boolean} priority - Whether this request has priority
 * @returns {Promise} A promise that resolves when the request can proceed
 */
function enqueueRequest(priority = false) {
    return new Promise(resolve => {
        const request = {
            resolve,
            priority,
            timestamp: Date.now()
        };
        
        requestQueue.push(request);
        queueLength = requestQueue.length;
        
        // If queue is getting longer, increase wait time
        if (queueLength > QUEUE_ACTIVATION_THRESHOLD * 2) {
            queueWaitTime = EXTENDED_QUEUE_WAIT_TIME;
        }
        
        // Schedule processing of this request
        const waitTime = priority ? PRIORITY_QUEUE_WAIT_TIME : queueWaitTime;
        setTimeout(() => {
            // Find the request in the queue and process it
            const index = requestQueue.findIndex(r => r === request);
            if (index !== -1) {
                requestQueue.splice(index, 1);
                queueLength = requestQueue.length;
                resolve();
            }
        }, waitTime);
    });
}

/**
 * Queue middleware factory
 * @param {Object} tokenModel - The token model for checking if a token has queue priority
 * @returns {Function} The queue middleware function
 */
function createQueueMiddleware(tokenModel) {
    return async function queueMiddleware(req, res, next) {
        // Increment active requests counter
        activeRequests++;
        
        // Add cleanup when the response is finished
        res.on('finish', () => {
            activeRequests--;
            
            // Process next request in queue if any
            if (isQueueActive && requestQueue.length > 0) {
                processNextInQueue();
            }
        });
        
        // Check if we should activate the queue
        if (activeRequests >= QUEUE_ACTIVATION_THRESHOLD) {
            isQueueActive = true;
        }
        
        // If queue is not active, proceed immediately
        if (!isQueueActive) {
            return next();
        }
        
        // Get token from request
        const tokenValue = req.headers['x-api-token'];
        let hasPriority = false;
        
        // Check if the token has queue priority
        if (tokenValue) {
            const { valid, token } = tokenModel.isTokenValid(tokenValue);
            if (valid && token.queuePriority) {
                hasPriority = true;
            }
        }
        
        try {
            // Add estimated wait time header
            const estimatedWaitTime = hasPriority ? PRIORITY_QUEUE_WAIT_TIME : queueWaitTime;
            res.setHeader('X-Queue-Estimated-Wait', Math.ceil(estimatedWaitTime / 1000));
            
            // Wait in queue
            await enqueueRequest(hasPriority);
            
            // Proceed to next middleware
            next();
        } catch (error) {
            console.error('Queue error:', error);
            next(error);
        }
    };
}

module.exports = {
    createQueueMiddleware,
    getQueueStatus: () => ({
        active: isQueueActive,
        length: queueLength,
        waitTime: queueWaitTime,
        activeRequests
    })
};
