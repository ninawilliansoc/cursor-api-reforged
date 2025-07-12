/**
 * Admin action logger middleware
 * Records all admin actions with username, timestamp, and details
 */
const logModel = require('../models/log');

/**
 * Create admin logger middleware
 * @returns {Function} The logger middleware function
 */
function createLoggerMiddleware() {
    return function loggerMiddleware(req, res, next) {
        // Store the original res.json function
        const originalJson = res.json;
        
        // Override the res.json function to capture responses
        res.json = function(data) {
            // Only log if the request was successful (2xx status)
            if (res.statusCode >= 200 && res.statusCode < 300 && req.admin) {
                const adminUsername = req.admin.username;
                let action = '';
                let details = {};
                
                // Determine the action based on the request
                if (req.method === 'POST') {
                    if (req.path === '/admin/login') {
                        action = 'Login';
                    } else if (req.path === '/admin/logout') {
                        action = 'Logout';
                    } else if (req.path === '/admin/tokens') {
                        action = 'Create Token';
                        details = { tokenName: req.body.name };
                    } else if (req.path === '/admin/admins') {
                        action = 'Create Admin';
                        details = { adminUsername: req.body.username };
                    } else if (req.path === '/admin/import') {
                        action = 'Import Data';
                        details = { 
                            importedTokens: req.body.tokens ? true : false,
                            importedAdmins: req.body.admins ? true : false
                        };
                    }
                } else if (req.method === 'PUT') {
                    if (req.path.startsWith('/admin/tokens/')) {
                        action = 'Update Token';
                        details = { 
                            tokenId: req.params.id,
                            updates: { ...req.body }
                        };
                    }
                } else if (req.method === 'DELETE') {
                    if (req.path.startsWith('/admin/tokens/')) {
                        action = 'Delete Token';
                        details = { tokenId: req.params.id };
                    } else if (req.path.startsWith('/admin/admins/')) {
                        action = 'Delete Admin';
                        details = { adminId: req.params.id };
                    }
                } else if (req.method === 'GET') {
                    if (req.path === '/admin/export') {
                        action = 'Export Data';
                    }
                }
                
                // Log the action if we identified one
                if (action) {
                    logModel.createLog(adminUsername, action, details);
                }
            }
            
            // Call the original json function
            return originalJson.call(this, data);
        };
        
        next();
    };
}

module.exports = {
    createLoggerMiddleware
};
