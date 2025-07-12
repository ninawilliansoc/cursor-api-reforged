const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Path to the admins storage file
const ADMINS_FILE = path.join(__dirname, '../../data/admins.json');

// Ensure the data directory exists
function ensureDataDirectory() {
    const dataDir = path.join(__dirname, '../../data');
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
    
    // Create empty admins file if it doesn't exist
    if (!fs.existsSync(ADMINS_FILE)) {
        fs.writeFileSync(ADMINS_FILE, JSON.stringify([], null, 2));
    }
}

// Load admins from file
function loadAdmins() {
    ensureDataDirectory();
    try {
        const data = fs.readFileSync(ADMINS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error loading admins:', error);
        return [];
    }
}

// Save admins to file
function saveAdmins(admins) {
    ensureDataDirectory();
    try {
        fs.writeFileSync(ADMINS_FILE, JSON.stringify(admins, null, 2));
        return true;
    } catch (error) {
        console.error('Error saving admins:', error);
        return false;
    }
}

// Hash a password
function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    return { hash, salt };
}

// Verify a password
function verifyPassword(password, hash, salt) {
    const verifyHash = crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
    return hash === verifyHash;
}

// Create a new admin
function createAdmin(username, password, isOwner = false) {
    if (!username || !password) {
        throw new Error('Username and password are required');
    }

    const admins = loadAdmins();
    
    // Check if username already exists
    if (admins.some(admin => admin.username === username)) {
        throw new Error('Username already exists');
    }
    
    const { hash, salt } = hashPassword(password);
    
    const newAdmin = {
        id: crypto.randomUUID(),
        username,
        hash,
        salt,
        isOwner,
        createdAt: new Date().toISOString()
    };
    
    admins.push(newAdmin);
    saveAdmins(admins);
    
    // Return admin without sensitive data
    const { hash: _, salt: __, ...adminData } = newAdmin;
    return adminData;
}

// Get all admins
function getAllAdmins() {
    const admins = loadAdmins();
    // Return admins without sensitive data
    return admins.map(({ hash, salt, ...admin }) => admin);
}

// Get an admin by username
function getAdminByUsername(username) {
    const admins = loadAdmins();
    return admins.find(admin => admin.username === username);
}

// Get an admin by ID
function getAdminById(id) {
    const admins = loadAdmins();
    const admin = admins.find(admin => admin.id === id);
    
    if (!admin) {
        return null;
    }
    
    // Return admin without sensitive data
    const { hash, salt, ...adminData } = admin;
    return adminData;
}

// Update an admin
function updateAdmin(id, updates) {
    const admins = loadAdmins();
    const index = admins.findIndex(admin => admin.id === id);
    
    if (index === -1) {
        return null;
    }
    
    // Don't allow updating sensitive fields directly
    const { hash, salt, isOwner, createdAt, id: adminId, ...allowedUpdates } = updates;
    
    // If password is being updated, hash it
    if (updates.password) {
        const passwordData = hashPassword(updates.password);
        allowedUpdates.hash = passwordData.hash;
        allowedUpdates.salt = passwordData.salt;
        delete allowedUpdates.password;
    }
    
    admins[index] = {
        ...admins[index],
        ...allowedUpdates,
        updatedAt: new Date().toISOString()
    };
    
    saveAdmins(admins);
    
    // Return updated admin without sensitive data
    const { hash: _, salt: __, ...adminData } = admins[index];
    return adminData;
}

// Delete an admin
function deleteAdmin(id) {
    const admins = loadAdmins();
    
    // Don't allow deleting owner
    const adminToDelete = admins.find(admin => admin.id === id);
    if (adminToDelete && adminToDelete.isOwner) {
        throw new Error('Cannot delete owner account');
    }
    
    const filteredAdmins = admins.filter(admin => admin.id !== id);
    
    if (filteredAdmins.length === admins.length) {
        return false; // No admin was deleted
    }
    
    saveAdmins(filteredAdmins);
    return true;
}

// Authenticate an admin
function authenticateAdmin(username, password) {
    const admin = getAdminByUsername(username);
    
    if (!admin) {
        return { authenticated: false, reason: 'Invalid username or password' };
    }
    
    if (!verifyPassword(password, admin.hash, admin.salt)) {
        return { authenticated: false, reason: 'Invalid username or password' };
    }
    
    // Return admin without sensitive data
    const { hash, salt, ...adminData } = admin;
    return { authenticated: true, admin: adminData };
}

// Initialize the owner account if it doesn't exist
function initializeOwner(username, password) {
    const admins = loadAdmins();
    
    // Check if any owner already exists
    const ownerExists = admins.some(admin => admin.isOwner);
    
    if (!ownerExists) {
        return createAdmin(username, password, true);
    }
    
    return null;
}

// Export admins to JSON string
function exportAdmins() {
    const admins = loadAdmins();
    return JSON.stringify(admins, null, 2);
}

// Import admins from JSON string
function importAdmins(jsonString) {
    try {
        const admins = JSON.parse(jsonString);
        
        // Validate the imported data
        if (!Array.isArray(admins)) {
            throw new Error('Invalid admin data: Expected an array');
        }
        
        // Check if each admin has required fields
        admins.forEach(admin => {
            if (!admin.id || !admin.username || !admin.hash || !admin.salt) {
                throw new Error('Invalid admin data: Missing required fields');
            }
        });
        
        // Ensure there is at least one owner
        const hasOwner = admins.some(admin => admin.isOwner);
        if (!hasOwner) {
            throw new Error('Invalid admin data: At least one admin must be an owner');
        }
        
        // Save the imported admins
        saveAdmins(admins);
        return { success: true, count: admins.length };
    } catch (error) {
        console.error('Error importing admins:', error);
        return { success: false, error: error.message };
    }
}

module.exports = {
    createAdmin,
    getAllAdmins,
    getAdminByUsername,
    getAdminById,
    updateAdmin,
    deleteAdmin,
    authenticateAdmin,
    initializeOwner,
    exportAdmins,
    importAdmins
};
