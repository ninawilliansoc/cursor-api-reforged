const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Path to the error filters storage file
const ERROR_FILTERS_FILE = path.join(__dirname, '../../data/errorFilters.json');

// Ensure the data directory exists
function ensureDataDirectory() {
    const dataDir = path.join(__dirname, '../../data');
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
    
    // Create empty error filters file if it doesn't exist
    if (!fs.existsSync(ERROR_FILTERS_FILE)) {
        fs.writeFileSync(ERROR_FILTERS_FILE, JSON.stringify([], null, 2));
    }
}

// Load error filters from file
function loadErrorFilters() {
    ensureDataDirectory();
    try {
        const data = fs.readFileSync(ERROR_FILTERS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error loading error filters:', error);
        return [];
    }
}

// Save error filters to file
function saveErrorFilters(filters) {
    ensureDataDirectory();
    try {
        fs.writeFileSync(ERROR_FILTERS_FILE, JSON.stringify(filters, null, 2));
        return true;
    } catch (error) {
        console.error('Error saving error filters:', error);
        return false;
    }
}

// Create a new error filter
function createErrorFilter(pattern, description = '') {
    if (!pattern) {
        throw new Error('Error pattern is required');
    }

    const filters = loadErrorFilters();
    
    const newFilter = {
        id: crypto.randomUUID(),
        pattern,
        description,
        createdAt: new Date().toISOString()
    };
    
    filters.push(newFilter);
    saveErrorFilters(filters);
    
    return newFilter;
}

// Get all error filters
function getAllErrorFilters() {
    return loadErrorFilters();
}

// Get an error filter by its ID
function getErrorFilterById(id) {
    const filters = loadErrorFilters();
    return filters.find(filter => filter.id === id);
}

// Update an error filter
function updateErrorFilter(id, updates) {
    const filters = loadErrorFilters();
    const index = filters.findIndex(filter => filter.id === id);
    
    if (index === -1) {
        return null;
    }
    
    // Don't allow updating the creation date or ID
    const { createdAt, id: filterId, ...allowedUpdates } = updates;
    
    filters[index] = {
        ...filters[index],
        ...allowedUpdates,
        updatedAt: new Date().toISOString()
    };
    
    saveErrorFilters(filters);
    return filters[index];
}

// Delete an error filter
function deleteErrorFilter(id) {
    const filters = loadErrorFilters();
    const filteredFilters = filters.filter(filter => filter.id !== id);
    
    if (filteredFilters.length === filters.length) {
        return false; // No filter was deleted
    }
    
    saveErrorFilters(filteredFilters);
    return true;
}

// Check if a message contains any of the error patterns
function checkForErrors(message) {
    if (!message) return null;
    
    const filters = loadErrorFilters();
    
    for (const filter of filters) {
        try {
            const regex = new RegExp(filter.pattern, 'i');
            if (regex.test(message)) {
                return filter;
            }
        } catch (error) {
            console.error(`Invalid regex pattern in error filter ${filter.id}:`, error);
        }
    }
    
    return null;
}

module.exports = {
    createErrorFilter,
    getAllErrorFilters,
    getErrorFilterById,
    updateErrorFilter,
    deleteErrorFilter,
    checkForErrors
};
