const express = require('express');
const router = express.Router();
const path = require('path');
const crypto = require('crypto');

// Import models
const adminModel = require('../models/admin');
const tokenModel = require('../models/token');
const logModel = require('../models/log');
const errorFilterModel = require('../models/errorFilter');
const authCookieModel = require('../models/authCookie');
const { getActiveCookiesCount, resetCookieRotation } = require('../services/cookieRotation');

// Import middleware creators
const { createAdminAuthMiddleware, createOwnerOnlyMiddleware } = require('../middleware/auth');
const { createLoggerMiddleware } = require('../middleware/logger');

// Create middleware instances
const adminAuth = createAdminAuthMiddleware(adminModel);
const ownerOnly = createOwnerOnlyMiddleware();
const logger = createLoggerMiddleware();

// Apply logger middleware to all admin routes
router.use(logger);


// Initialize owner account on startup
function initializeOwner() {
    const { ownerUser, ownerPassword } = require('../config/config').admin;
    adminModel.initializeOwner(ownerUser, ownerPassword);
}

// Call initialization
initializeOwner();

// Serve the admin panel
router.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Admin login
router.post('/login', async (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({
            error: 'Username and password are required'
        });
    }
    
    const { authenticated, reason, admin } = adminModel.authenticateAdmin(username, password);
    
    if (!authenticated) {
        return res.status(401).json({
            error: 'Authentication failed',
            message: reason || 'Invalid username or password'
        });
    }
    
    // Store admin ID in session
    req.session.adminId = admin.id;
    
    res.json({
        success: true,
        admin: {
            username: admin.username,
            isOwner: admin.isOwner
        }
    });
});

// Admin logout
router.post('/logout', (req, res) => {
    // Destroy the session
    req.session.destroy(err => {
        if (err) {
            console.error('Error destroying session:', err);
            return res.status(500).json({
                error: 'Logout failed',
                message: 'An error occurred during logout'
            });
        }
        
        res.json({ success: true });
    });
});

// Get current admin info
router.get('/me', adminAuth, (req, res) => {
    res.json({
        username: req.admin.username,
        isOwner: req.admin.isOwner
    });
});

// Token management routes
router.get('/tokens', adminAuth, (req, res) => {
    const tokens = tokenModel.getAllTokens();
    res.json(tokens);
});

router.post('/tokens', adminAuth, (req, res) => {
    const { name, description, expirationDate, rateLimit, queuePriority, premium } = req.body;
    
    if (!name) {
        return res.status(400).json({
            error: 'Token name is required'
        });
    }
    
    try {
        const token = tokenModel.createToken(
            name,
            description || '',
            expirationDate || null,
            rateLimit !== undefined ? rateLimit : true,
            queuePriority !== undefined ? queuePriority : false,
            premium !== undefined ? premium : false
        );
        
        res.status(201).json(token);
    } catch (error) {
        res.status(400).json({
            error: error.message
        });
    }
});

router.get('/tokens/:id', adminAuth, (req, res) => {
    const token = tokenModel.getTokenById(req.params.id);
    
    if (!token) {
        return res.status(404).json({
            error: 'Token not found'
        });
    }
    
    // Make sure usageCount and ipHistory are initialized if they don't exist yet
    if (!token.usageCount) {
        token.usageCount = 0;
    }
    
    if (!token.ipHistory) {
        token.ipHistory = [];
    }
    
    res.json(token);
});

router.put('/tokens/:id', adminAuth, (req, res) => {
    const { name, description, expirationDate, rateLimit, queuePriority, premium } = req.body;
    
    const updates = {};
    
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (expirationDate !== undefined) updates.expirationDate = expirationDate;
    if (rateLimit !== undefined) updates.rateLimit = rateLimit;
    if (queuePriority !== undefined) updates.queuePriority = queuePriority;
    if (premium !== undefined) updates.premium = premium;
    
    const updatedToken = tokenModel.updateToken(req.params.id, updates);
    
    if (!updatedToken) {
        return res.status(404).json({
            error: 'Token not found'
        });
    }
    
    res.json(updatedToken);
});

router.delete('/tokens/:id', adminAuth, (req, res) => {
    const success = tokenModel.deleteToken(req.params.id);
    
    if (!success) {
        return res.status(404).json({
            error: 'Token not found'
        });
    }
    
    res.json({ success: true });
});

// Export/Import routes
router.get('/export', adminAuth, ownerOnly, (req, res) => {
    const tokens = tokenModel.exportTokens();
    const admins = adminModel.exportAdmins();
    const authCookies = authCookieModel.exportAuthCookies();
    
    res.json({
        tokens: JSON.parse(tokens),
        admins: JSON.parse(admins),
        authCookies: JSON.parse(authCookies)
    });
});

// Logs routes (owner only)
router.get('/logs', adminAuth, ownerOnly, (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    
    // Extract filter parameters
    const filters = {};
    if (req.query.admin) filters.adminUsername = req.query.admin;
    if (req.query.action) filters.action = req.query.action;
    if (req.query.startDate) filters.startDate = req.query.startDate;
    if (req.query.endDate) filters.endDate = req.query.endDate;
    
    const result = logModel.getLogs(page, limit, filters);
    res.json(result);
});

// Export logs (owner only)
router.get('/logs/export', adminAuth, ownerOnly, (req, res) => {
    const format = req.query.format === 'csv' ? 'csv' : 'json';
    
    // Extract filter parameters
    const filters = {};
    if (req.query.admin) filters.adminUsername = req.query.admin;
    if (req.query.action) filters.action = req.query.action;
    if (req.query.startDate) filters.startDate = req.query.startDate;
    if (req.query.endDate) filters.endDate = req.query.endDate;
    
    const exportData = logModel.exportLogs(format, filters);
    
    if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename="admin-logs.csv"');
    } else {
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename="admin-logs.json"');
    }
    
    res.send(exportData);
});

router.post('/import', adminAuth, ownerOnly, (req, res) => {
    const { tokens, admins, authCookies } = req.body;
    
    if (!tokens && !admins && !authCookies) {
        return res.status(400).json({
            error: 'No data provided for import'
        });
    }
    
    const results = {
        tokens: tokens ? tokenModel.importTokens(JSON.stringify(tokens)) : { skipped: true },
        admins: admins ? adminModel.importAdmins(JSON.stringify(admins)) : { skipped: true },
        authCookies: authCookies ? authCookieModel.importAuthCookies(JSON.stringify(authCookies)) : { skipped: true }
    };
    
    if ((results.tokens.success || results.tokens.skipped) && 
        (results.admins.success || results.admins.skipped) &&
        (results.authCookies.success || results.authCookies.skipped)) {
        res.json({
            success: true,
            results
        });
    } else {
        res.status(400).json({
            success: false,
            results
        });
    }
});

// Admin management routes (owner only)
router.get('/admins', adminAuth, ownerOnly, (req, res) => {
    const admins = adminModel.getAllAdmins();
    res.json(admins);
});

router.post('/admins', adminAuth, ownerOnly, (req, res) => {
    const { username, password } = req.body;
    
    if (!username || !password) {
        return res.status(400).json({
            error: 'Username and password are required'
        });
    }
    
    try {
        const admin = adminModel.createAdmin(username, password);
        res.status(201).json(admin);
    } catch (error) {
        res.status(400).json({
            error: error.message
        });
    }
});

router.delete('/admins/:id', adminAuth, ownerOnly, (req, res) => {
    try {
        const success = adminModel.deleteAdmin(req.params.id);
        
        if (!success) {
            return res.status(404).json({
                error: 'Admin not found'
            });
        }
        
        res.json({ success: true });
    } catch (error) {
        res.status(400).json({
            error: error.message
        });
    }
});

// Error filter management routes (owner only)
router.get('/error-filters', adminAuth, ownerOnly, (req, res) => {
    const filters = errorFilterModel.getAllErrorFilters();
    res.json(filters);
});

router.post('/error-filters', adminAuth, ownerOnly, (req, res) => {
    const { pattern, description } = req.body;
    
    if (!pattern) {
        return res.status(400).json({
            error: 'Error pattern is required'
        });
    }
    
    try {
        // Validate the regex pattern
        new RegExp(pattern);
        
        const filter = errorFilterModel.createErrorFilter(pattern, description || '');
        res.status(201).json(filter);
    } catch (error) {
        res.status(400).json({
            error: error.message || 'Invalid regex pattern'
        });
    }
});

router.get('/error-filters/:id', adminAuth, ownerOnly, (req, res) => {
    const filter = errorFilterModel.getErrorFilterById(req.params.id);
    
    if (!filter) {
        return res.status(404).json({
            error: 'Error filter not found'
        });
    }
    
    res.json(filter);
});

router.put('/error-filters/:id', adminAuth, ownerOnly, (req, res) => {
    const { pattern, description } = req.body;
    
    const updates = {};
    
    if (pattern !== undefined) {
        try {
            // Validate the regex pattern
            new RegExp(pattern);
            updates.pattern = pattern;
        } catch (error) {
            return res.status(400).json({
                error: 'Invalid regex pattern'
            });
        }
    }
    
    if (description !== undefined) updates.description = description;
    
    const updatedFilter = errorFilterModel.updateErrorFilter(req.params.id, updates);
    
    if (!updatedFilter) {
        return res.status(404).json({
            error: 'Error filter not found'
        });
    }
    
    res.json(updatedFilter);
});

router.delete('/error-filters/:id', adminAuth, ownerOnly, (req, res) => {
    const success = errorFilterModel.deleteErrorFilter(req.params.id);
    
    if (!success) {
        return res.status(404).json({
            error: 'Error filter not found'
        });
    }
    
    res.json({ success: true });
});

// Auth Cookie management routes

// Auth Cookie Status Endpoints - These specific routes must come before parameterized routes
router.get('/auth-cookies/status', adminAuth, (req, res) => {
    const activeCookies = authCookieModel.getAllActiveCookies();
    const allCookies = authCookieModel.getAllAuthCookies();
    
    res.json({
        total: allCookies.length,
        active: activeCookies.length,
        inRotation: getActiveCookiesCount()
    });
});

router.post('/auth-cookies/reset-rotation', adminAuth, ownerOnly, (req, res) => {
    resetCookieRotation();
    res.json({ 
        success: true, 
        message: 'Cookie rotation index has been reset' 
    });
});

// Regular CRUD routes for auth cookies
router.get('/auth-cookies', adminAuth, (req, res) => {
    const authCookies = authCookieModel.getAllAuthCookies();
    res.json(authCookies);
});

router.post('/auth-cookies', adminAuth, (req, res) => {
    const { name, value, description, active } = req.body;
    
    if (!name || !value) {
        return res.status(400).json({
            error: 'Cookie name and value are required'
        });
    }
    
    try {
        const authCookie = authCookieModel.createAuthCookie(
            name,
            value,
            description || '',
            active !== undefined ? active : true
        );
        
        res.status(201).json(authCookie);
    } catch (error) {
        res.status(400).json({
            error: error.message
        });
    }
});

router.get('/auth-cookies/:id', adminAuth, (req, res) => {
    const authCookie = authCookieModel.getAuthCookieById(req.params.id);
    
    if (!authCookie) {
        return res.status(404).json({
            error: 'Auth cookie not found'
        });
    }
    
    res.json(authCookie);
});

router.put('/auth-cookies/:id', adminAuth, (req, res) => {
    const { name, description, active } = req.body;
    
    const updates = {};
    
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (active !== undefined) updates.active = active;
    
    const updatedAuthCookie = authCookieModel.updateAuthCookie(req.params.id, updates);
    
    if (!updatedAuthCookie) {
        return res.status(404).json({
            error: 'Auth cookie not found'
        });
    }
    
    res.json(updatedAuthCookie);
});

router.delete('/auth-cookies/:id', adminAuth, (req, res) => {
    const success = authCookieModel.deleteAuthCookie(req.params.id);
    
    if (!success) {
        return res.status(404).json({
            error: 'Auth cookie not found'
        });
    }
    
    res.json({ success: true });
});

// Function moved to auth.js middleware

module.exports = router;
