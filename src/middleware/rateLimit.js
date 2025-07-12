/**
 * Rate limiting middleware for the API
 * Limits users to 3 requests per minute unless their token has rate limiting disabled
 */

// Store rate limit data in memory
// Format: { tokenValue: { requestCount: number, resetTime: timestamp } }
const rateLimitStore = new Map();

// Rate limit constants
const MAX_REQUESTS_PER_MINUTE = 3;
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute in milliseconds
const RATE_LIMIT_PENALTY = 5 * 60 * 1000; // 5 minutes in milliseconds

/**
 * Rate limiting middleware
 * @param {Object} tokenModel - The token model for checking if rate limiting is enabled for a token
 */
function createRateLimitMiddleware(tokenModel) {
    return function rateLimitMiddleware(req, res, next) {
        // Get token from request
        const tokenValue = req.headers['x-api-token'];
        
        // If no token is provided, proceed to the next middleware
        // (the auth middleware will handle this case)
        if (!tokenValue) {
            return next();
        }
        
        // Check if the token exists and if rate limiting is enabled for it
        const { valid, token } = tokenModel.isTokenValid(tokenValue);
        
        // If token is invalid, proceed to the next middleware
        // (the auth middleware will handle this case)
        if (!valid) {
            return next();
        }
        
        // If rate limiting is disabled for this token, skip rate limiting
        if (!token.rateLimit) {
            return next();
        }
        
        const now = Date.now();
        
        // Get rate limit data for this token
        let rateLimitData = rateLimitStore.get(tokenValue);
        
        // If no rate limit data exists, or the reset time has passed, create new rate limit data
        if (!rateLimitData || now > rateLimitData.resetTime) {
            rateLimitData = {
                requestCount: 0,
                resetTime: now + RATE_LIMIT_WINDOW
            };
            rateLimitStore.set(tokenValue, rateLimitData);
        }
        
        // Check if the token is in penalty mode
        if (rateLimitData.penaltyUntil && now < rateLimitData.penaltyUntil) {
            const remainingSeconds = Math.ceil((rateLimitData.penaltyUntil - now) / 1000);
            return res.status(429).json({
                error: 'RATE LIMIT DE 5 MINUTOS APLICADO, ESPERA 5 MINUTOS PARA VOLVER A UTILIZAR SOLICITUDES',
                retryAfter: remainingSeconds
            });
        }
        
        // Increment request count
        rateLimitData.requestCount++;
        
        // If the token has exceeded the rate limit, apply penalty
        if (rateLimitData.requestCount > MAX_REQUESTS_PER_MINUTE) {
            rateLimitData.penaltyUntil = now + RATE_LIMIT_PENALTY;
            return res.status(429).json({
                error: 'RATE LIMIT DE 5 MINUTOS APLICADO, ESPERA 5 MINUTOS PARA VOLVER A UTILIZAR SOLICITUDES',
                retryAfter: Math.ceil(RATE_LIMIT_PENALTY / 1000)
            });
        }
        
        // Add rate limit headers
        res.setHeader('X-RateLimit-Limit', MAX_REQUESTS_PER_MINUTE);
        res.setHeader('X-RateLimit-Remaining', MAX_REQUESTS_PER_MINUTE - rateLimitData.requestCount);
        res.setHeader('X-RateLimit-Reset', Math.ceil(rateLimitData.resetTime / 1000));
        
        next();
    };
}

module.exports = createRateLimitMiddleware;
