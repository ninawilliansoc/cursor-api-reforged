const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const config = require('../config/config');

// Path to the auth cookies storage file
const AUTH_COOKIES_FILE = path.join(__dirname, '../../data/authCookies.json');

// In-memory cache of auth cookies
let cookiesCache = null;

// Ensure the data directory exists
function ensureDataDirectory() {
    const dataDir = path.join(__dirname, '../../data');
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
    
    // Create empty auth cookies file if it doesn't exist
    if (!fs.existsSync(AUTH_COOKIES_FILE)) {
        fs.writeFileSync(AUTH_COOKIES_FILE, JSON.stringify([], null, 2));
    }
}

// Load auth cookies from file
function loadAuthCookies() {
    ensureDataDirectory();
    try {
        const data = fs.readFileSync(AUTH_COOKIES_FILE, 'utf8');
        cookiesCache = JSON.parse(data);
        return cookiesCache;
    } catch (error) {
        console.error('Error loading auth cookies:', error);
        cookiesCache = [];
        return [];
    }
}

// Save auth cookies to file
function saveAuthCookies(cookies) {
    ensureDataDirectory();
    try {
        fs.writeFileSync(AUTH_COOKIES_FILE, JSON.stringify(cookies, null, 2));
        cookiesCache = cookies; // Update the cache
        return true;
    } catch (error) {
        console.error('Error saving auth cookies:', error);
        return false;
    }
}

// Initialize the module - migrate existing cookies from config if any
function initialize() {
    // Load existing cookies from file first
    const cookies = loadAuthCookies();
    
    // If there are cookies in the environment variables, migrate them
    if (config.auth.cookies && config.auth.cookies.length > 0) {
        const existingValues = new Set(cookies.map(cookie => cookie.value));
        
        // Add any cookies from config that aren't already in the file
        const newCookies = config.auth.cookies.filter(cookieValue => !existingValues.has(cookieValue))
            .map(cookieValue => ({
                id: crypto.randomUUID(),
                name: `Migrated Cookie ${new Date().toISOString()}`,
                value: cookieValue,
                description: 'Migrated from environment variables',
                createdAt: new Date().toISOString(),
                active: true
            }));
        
        if (newCookies.length > 0) {
            saveAuthCookies([...cookies, ...newCookies]);
        }
    }
    
    return cookiesCache;
}

// Get all auth cookies
function getAllAuthCookies() {
    if (cookiesCache === null) {
        return loadAuthCookies();
    }
    return cookiesCache;
}

// Get all active auth cookies
function getAllActiveCookies() {
    const cookies = getAllAuthCookies();
    return cookies.filter(cookie => cookie.active);
}

// Get an auth cookie by its ID
function getAuthCookieById(id) {
    const cookies = getAllAuthCookies();
    return cookies.find(cookie => cookie.id === id);
}

// Create a new auth cookie
function createAuthCookie(name, value, description = '', active = true) {
    if (!name || !value) {
        throw new Error('Cookie name and value are required');
    }
    
    const cookies = getAllAuthCookies();
    
    // Check if a cookie with the same value already exists
    if (cookies.some(cookie => cookie.value === value)) {
        throw new Error('A cookie with this value already exists');
    }
    
    const newCookie = {
        id: crypto.randomUUID(),
        name,
        value,
        description,
        active,
        createdAt: new Date().toISOString()
    };
    
    cookies.push(newCookie);
    saveAuthCookies(cookies);
    
    return newCookie;
}

// Update an auth cookie
function updateAuthCookie(id, updates) {
    const cookies = getAllAuthCookies();
    const index = cookies.findIndex(cookie => cookie.id === id);
    
    if (index === -1) {
        return null;
    }
    
    // Don't allow updating the cookie value or creation date
    const { value, createdAt, id: cookieId, ...allowedUpdates } = updates;
    
    cookies[index] = {
        ...cookies[index],
        ...allowedUpdates,
        updatedAt: new Date().toISOString()
    };
    
    saveAuthCookies(cookies);
    return cookies[index];
}

// Delete an auth cookie
function deleteAuthCookie(id) {
    const cookies = getAllAuthCookies();
    const filteredCookies = cookies.filter(cookie => cookie.id !== id);
    
    if (filteredCookies.length === cookies.length) {
        return false; // No cookie was deleted
    }
    
    saveAuthCookies(filteredCookies);
    return true;
}

// Export auth cookies to JSON string
function exportAuthCookies() {
    const cookies = getAllAuthCookies();
    return JSON.stringify(cookies, null, 2);
}

// Import auth cookies from JSON string
function importAuthCookies(jsonString) {
    try {
        const cookies = JSON.parse(jsonString);
        
        // Validate the imported data
        if (!Array.isArray(cookies)) {
            throw new Error('Invalid auth cookie data: Expected an array');
        }
        
        // Check if each cookie has required fields
        cookies.forEach(cookie => {
            if (!cookie.id || !cookie.name || !cookie.value) {
                throw new Error('Invalid auth cookie data: Missing required fields');
            }
        });
        
        // Save the imported cookies
        saveAuthCookies(cookies);
        return { success: true, count: cookies.length };
    } catch (error) {
        console.error('Error importing auth cookies:', error);
        return { success: false, error: error.message };
    }
}

// Call initialize when the module is loaded
initialize();

module.exports = {
    createAuthCookie,
    getAllAuthCookies,
    getAllActiveCookies,
    getAuthCookieById,
    updateAuthCookie,
    deleteAuthCookie,
    exportAuthCookies,
    importAuthCookies
};
