/**
 * Authentication middleware for the API
 * Verifies that requests include a valid token
 */
const jwt = require('jsonwebtoken');

/**
 * Create authentication middleware
 * @param {Object} tokenModel - The token model for validating tokens
 * @returns {Function} The authentication middleware function
 */
function createAuthMiddleware(tokenModel) {
    return function authMiddleware(req, res, next) {
        // Skip authentication for admin routes and options requests
        if (req.path.startsWith('/admin') || req.method === 'OPTIONS') {
            return next();
        }
        
        // Get token from request
        const tokenValue = req.headers['x-api-token'];
        
        // If no token is provided, return 401
        if (!tokenValue) {
            console.log(`Auth middleware: No token provided for path ${req.path}`);
            return res.status(401).json({
                error: 'Authentication token is required',
                message: 'Please provide a valid token in the X-API-Token header'
            });
        }
        
        console.log(`Auth middleware: Validating token for path ${req.path}`);
        
        // Validate the token
        const validationResult = tokenModel.isTokenValid(tokenValue);
        const { valid, reason, token } = validationResult;
        
        if (!valid) {
            console.log(`Auth middleware: Token validation failed: ${reason}`);
            return res.status(401).json({
                error: 'Invalid authentication token',
                message: reason || 'The provided token is invalid or expired',
                details: 'Please check your token or create a new one in the admin panel'
            });
        }
        
        console.log(`Auth middleware: Token validated successfully for ${token.name}`);
        
        // Store token in request for use in other middleware
        req.token = token;
        
        next();
    };
}

/**
 * Create admin authentication middleware
 * @param {Object} adminModel - The admin model for authenticating admins
 * @returns {Function} The admin authentication middleware function
 */
function createAdminAuthMiddleware(adminModel) {
    return function adminAuthMiddleware(req, res, next) {
        // Skip authentication for login route and options requests
        if (req.path === '/admin/login' || req.method === 'OPTIONS') {
            return next();
        }
        
        // Check if user is logged in via session
        if (!req.session.adminId) {
            return res.status(401).json({
                error: 'Authentication required',
                message: 'Please log in to access this resource'
            });
        }
        
        try {
            // Get admin data from the session ID
            const admin = adminModel.getAdminById(req.session.adminId);
            
            if (!admin) {
                // Clear invalid session
                req.session.destroy();
                return res.status(401).json({
                    error: 'Admin account not found',
                    message: 'The admin account associated with this session no longer exists'
                });
            }
            
            // Store admin in request for use in other middleware
            req.admin = admin;
            
            next();
        } catch (error) {
            console.error('Admin authentication error:', error);
            return res.status(401).json({
                error: 'Authentication error',
                message: 'An error occurred during authentication'
            });
        }
    };
}

/**
 * Create owner-only middleware
 * @returns {Function} The owner-only middleware function
 */
function createOwnerOnlyMiddleware() {
    return function ownerOnlyMiddleware(req, res, next) {
        // Check if the user is authenticated and is an owner
        if (!req.admin || !req.admin.isOwner) {
            return res.status(403).json({
                error: 'Access denied',
                message: 'This resource is only accessible to the owner'
            });
        }
        
        next();
    };
}


module.exports = {
    createAuthMiddleware,
    createAdminAuthMiddleware,
    createOwnerOnlyMiddleware
};
