const fs = require('fs');
const path = require('path');

// Path to the logs storage file
const LOGS_FILE = path.join(__dirname, '../../data/logs.json');

// Ensure the data directory exists
function ensureDataDirectory() {
    const dataDir = path.join(__dirname, '../../data');
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
    
    // Create empty logs file if it doesn't exist
    if (!fs.existsSync(LOGS_FILE)) {
        fs.writeFileSync(LOGS_FILE, JSON.stringify([], null, 2));
    }
}

// Load logs from file
function loadLogs() {
    ensureDataDirectory();
    try {
        const data = fs.readFileSync(LOGS_FILE, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        console.error('Error loading logs:', error);
        return [];
    }
}

// Save logs to file
function saveLogs(logs) {
    ensureDataDirectory();
    try {
        fs.writeFileSync(LOGS_FILE, JSON.stringify(logs, null, 2));
        return true;
    } catch (error) {
        console.error('Error saving logs:', error);
        return false;
    }
}

// Create a new log entry
function createLog(adminUsername, action, details = {}) {
    const logs = loadLogs();
    
    const newLog = {
        id: Date.now().toString(),
        adminUsername,
        action,
        details,
        timestamp: new Date().toISOString()
    };
    
    logs.push(newLog);
    saveLogs(logs);
    
    // Also log to console
    console.log(`[ADMIN ACTION] ${adminUsername} - ${action}`, details);
    
    return newLog;
}

// Get all logs
function getAllLogs() {
    return loadLogs();
}

// Get logs with pagination
function getLogs(page = 1, limit = 20, filters = {}) {
    const logs = loadLogs();
    let filteredLogs = [...logs];
    
    // Apply filters
    if (filters.adminUsername) {
        filteredLogs = filteredLogs.filter(log => 
            log.adminUsername.toLowerCase().includes(filters.adminUsername.toLowerCase())
        );
    }
    
    if (filters.action) {
        filteredLogs = filteredLogs.filter(log => 
            log.action.toLowerCase().includes(filters.action.toLowerCase())
        );
    }
    
    if (filters.startDate) {
        const startDate = new Date(filters.startDate);
        filteredLogs = filteredLogs.filter(log => 
            new Date(log.timestamp) >= startDate
        );
    }
    
    if (filters.endDate) {
        const endDate = new Date(filters.endDate);
        endDate.setHours(23, 59, 59, 999);
        filteredLogs = filteredLogs.filter(log => 
            new Date(log.timestamp) <= endDate
        );
    }
    
    // Sort logs by timestamp (newest first)
    filteredLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    // Calculate pagination
    const startIndex = (page - 1) * limit;
    const endIndex = page * limit;
    const paginatedLogs = filteredLogs.slice(startIndex, endIndex);
    
    return {
        logs: paginatedLogs,
        total: filteredLogs.length,
        page,
        totalPages: Math.ceil(filteredLogs.length / limit),
        hasMore: endIndex < filteredLogs.length
    };
}

// Export logs to a readable format
function exportLogs(format = 'json', filters = {}) {
    let logs = loadLogs();
    
    // Apply filters if any
    if (filters.adminUsername) {
        logs = logs.filter(log => 
            log.adminUsername.toLowerCase().includes(filters.adminUsername.toLowerCase())
        );
    }
    
    if (filters.action) {
        logs = logs.filter(log => 
            log.action.toLowerCase().includes(filters.action.toLowerCase())
        );
    }
    
    if (filters.startDate) {
        const startDate = new Date(filters.startDate);
        logs = logs.filter(log => 
            new Date(log.timestamp) >= startDate
        );
    }
    
    if (filters.endDate) {
        const endDate = new Date(filters.endDate);
        endDate.setHours(23, 59, 59, 999);
        logs = logs.filter(log => 
            new Date(log.timestamp) <= endDate
        );
    }
    
    // Sort logs by timestamp (newest first)
    logs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    
    if (format === 'csv') {
        // Convert to CSV
        const headers = ['Timestamp', 'Admin', 'Action', 'Details'];
        const rows = logs.map(log => {
            const timestamp = new Date(log.timestamp).toLocaleString();
            const details = JSON.stringify(log.details).replace(/"/g, '""');
            return `"${timestamp}","${log.adminUsername}","${log.action}","${details}"`;
        });
        
        return [headers.join(','), ...rows].join('\n');
    } else {
        // Format JSON for readability
        const formattedLogs = logs.map(log => ({
            timestamp: new Date(log.timestamp).toLocaleString(),
            admin: log.adminUsername,
            action: log.action,
            details: log.details
        }));
        
        return JSON.stringify(formattedLogs, null, 2);
    }
}

module.exports = {
    createLog,
    getAllLogs,
    getLogs,
    exportLogs
};
