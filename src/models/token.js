const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Path to the tokens storage file
const TOKENS_FILE = path.join(__dirname, '../../data/tokens.json');

// Ensure the data directory exists
function ensureDataDirectory() {
    const dataDir = path.join(__dirname, '../../data');
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
    
    // Create empty tokens file if it doesn't exist
    if (!fs.existsSync(TOKENS_FILE)) {
        fs.writeFileSync(TOKENS_FILE, JSON.stringify([], null, 2));
    }
}

// Load tokens from file
function loadTokens() {
    ensureDataDirectory();
    try {
        const data = fs.readFileSync(TOKENS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error loading tokens:', error);
        return [];
    }
}

// Save tokens to file
function saveTokens(tokens) {
    ensureDataDirectory();
    try {
        fs.writeFileSync(TOKENS_FILE, JSON.stringify(tokens, null, 2));
        return true;
    } catch (error) {
        console.error('Error saving tokens:', error);
        return false;
    }
}

// Generate a unique token value
function generateTokenValue() {
    return crypto.randomBytes(32).toString('hex');
}

// Create a new token
function createToken(name, description = '', expirationDate = null, rateLimit = true, queuePriority = false, premium = false) {
    if (!name) {
        throw new Error('Token name is required');
    }

    const tokens = loadTokens();
    
    const newToken = {
        id: crypto.randomUUID(),
        name,
        description,
        expirationDate,
        rateLimit,
        queuePriority,
        premium,
        value: generateTokenValue(),
        createdAt: new Date().toISOString()
    };
    
    tokens.push(newToken);
    saveTokens(tokens);
    
    return newToken;
}

// Get all tokens
function getAllTokens() {
    return loadTokens();
}

// Get a token by its value
function getTokenByValue(value) {
    const tokens = loadTokens();
    return tokens.find(token => token.value === value);
}

// Get a token by its ID
function getTokenById(id) {
    const tokens = loadTokens();
    return tokens.find(token => token.id === id);
}

// Update a token
function updateToken(id, updates) {
    const tokens = loadTokens();
    const index = tokens.findIndex(token => token.id === id);
    
    if (index === -1) {
        return null;
    }
    
    // Don't allow updating the token value or creation date
    const { value, createdAt, id: tokenId, ...allowedUpdates } = updates;
    
    tokens[index] = {
        ...tokens[index],
        ...allowedUpdates,
        updatedAt: new Date().toISOString()
    };
    
    saveTokens(tokens);
    return tokens[index];
}

// Delete a token
function deleteToken(id) {
    const tokens = loadTokens();
    const filteredTokens = tokens.filter(token => token.id !== id);
    
    if (filteredTokens.length === tokens.length) {
        return false; // No token was deleted
    }
    
    saveTokens(filteredTokens);
    return true;
}

// Check if a token is valid
function isTokenValid(value) {
    if (!value) {
        console.log('Token validation failed: No token value provided');
        return { valid: false, reason: 'No token value provided' };
    }
    
    console.log(`Validating token: ${value.substring(0, 10)}...`);
    const token = getTokenByValue(value);
    
    if (!token) {
        console.log(`Token validation failed: Token with value ${value.substring(0, 10)}... not found in database`);
        return { valid: false, reason: 'Token not found' };
    }
    
    // Check if the token has expired
    if (token.expirationDate && new Date(token.expirationDate) < new Date()) {
        console.log(`Token validation failed: Token ${token.name} (${token.id}) has expired on ${token.expirationDate}`);
        return { valid: false, reason: 'Token has expired' };
    }
    
    console.log(`Token validation successful: ${token.name} (${token.id})`);
    return { valid: true, token };
}

// Export tokens to JSON string
function exportTokens() {
    const tokens = loadTokens();
    return JSON.stringify(tokens, null, 2);
}

// Import tokens from JSON string
function importTokens(jsonString) {
    try {
        const tokens = JSON.parse(jsonString);
        
        // Validate the imported data
        if (!Array.isArray(tokens)) {
            throw new Error('Invalid token data: Expected an array');
        }
        
        // Check if each token has required fields
        tokens.forEach(token => {
            if (!token.id || !token.name || !token.value) {
                throw new Error('Invalid token data: Missing required fields');
            }
        });
        
        // Save the imported tokens
        saveTokens(tokens);
        return { success: true, count: tokens.length };
    } catch (error) {
        console.error('Error importing tokens:', error);
        return { success: false, error: error.message };
    }
}

module.exports = {
    createToken,
    getAllTokens,
    getTokenByValue,
    getTokenById,
    updateToken,
    deleteToken,
    isTokenValid,
    exportTokens,
    importTokens
};
