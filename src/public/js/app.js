// DOM Elements
const loginSection = document.getElementById('loginSection');
const mainContent = document.getElementById('mainContent');
const loginForm = document.getElementById('loginForm');
const loginError = document.getElementById('loginError');
const userInfo = document.getElementById('userInfo');
const usernameSpan = document.getElementById('username');
const logoutBtn = document.getElementById('logoutBtn');
const authCookiesTab = document.getElementById('authCookiesTab');
const adminsTab = document.getElementById('adminsTab');
const errorFiltersTab = document.getElementById('errorFiltersTab');
const logsTab = document.getElementById('logsTab');
const exportImportTab = document.getElementById('exportImportTab');
const tabs = document.querySelectorAll('.tab');
const sections = document.querySelectorAll('.section:not(#loginSection)');
const tokensList = document.getElementById('tokensList');
const authCookiesList = document.getElementById('authCookiesList');
const adminsList = document.getElementById('adminsList');
const logsList = document.getElementById('logsList');
const logsPagination = document.getElementById('logsPagination');
const refreshLogsBtn = document.getElementById('refreshLogsBtn');
const exportLogsJsonBtn = document.getElementById('exportLogsJsonBtn');
const exportLogsCsvBtn = document.getElementById('exportLogsCsvBtn');
const filterAdmin = document.getElementById('filterAdmin');
const filterAction = document.getElementById('filterAction');
const filterStartDate = document.getElementById('filterStartDate');
const filterEndDate = document.getElementById('filterEndDate');
const applyFiltersBtn = document.getElementById('applyFiltersBtn');
const resetFiltersBtn = document.getElementById('resetFiltersBtn');
const createTokenBtn = document.getElementById('createTokenBtn');
const createAuthCookieBtn = document.getElementById('createAuthCookieBtn');
const createAdminBtn = document.getElementById('createAdminBtn');
const tokenModal = document.getElementById('tokenModal');
const authCookieModal = document.getElementById('authCookieModal');
const adminModal = document.getElementById('adminModal');
const tokenForm = document.getElementById('tokenForm');
const authCookieForm = document.getElementById('authCookieForm');
const adminForm = document.getElementById('adminForm');
const confirmModal = document.getElementById('confirmModal');
const confirmMessage = document.getElementById('confirmMessage');
const confirmYes = document.getElementById('confirmYes');
const confirmNo = document.getElementById('confirmNo');
const closeButtons = document.querySelectorAll('.close');
const cancelButtons = document.querySelectorAll('.cancel-btn');
const tokenModalTitle = document.getElementById('tokenModalTitle');
const authCookieModalTitle = document.getElementById('authCookieModalTitle');
const errorFiltersList = document.getElementById('errorFiltersList');
const createErrorFilterBtn = document.getElementById('createErrorFilterBtn');
const errorFilterModal = document.getElementById('errorFilterModal');
const errorFilterForm = document.getElementById('errorFilterForm');
const errorFilterModalTitle = document.getElementById('errorFilterModalTitle');
const exportDataBtn = document.getElementById('exportDataBtn');
const importDataBtn = document.getElementById('importDataBtn');
const exportResult = document.getElementById('exportResult');
const importResult = document.getElementById('importResult');
const importData = document.getElementById('importData');
const importTokens = document.getElementById('importTokens');
const importAdmins = document.getElementById('importAdmins');
const importAuthCookies = document.getElementById('importAuthCookies');
// Import file elements - will be initialized after DOM is loaded
let pasteTabBtn;
let fileTabBtn;
let pasteImportTab;
let fileImportTab;
let importFile;

// State
let currentUser = null;
let currentAction = null;
let currentItemId = null;
let currentLogsPage = 1;
let logsFilters = {};

// API Base URL
const API_BASE_URL = '/admin';

// Initialize the application
document.addEventListener('DOMContentLoaded', init);

function init() {
    // Check if user is already logged in
    checkAuthStatus();
    
    // Initialize import file elements
    initializeImportElements();
    
    // Set up event listeners
    setupEventListeners();
}

// Initialize import file elements
function initializeImportElements() {
    pasteTabBtn = document.getElementById('pasteTabBtn');
    fileTabBtn = document.getElementById('fileTabBtn');
    pasteImportTab = document.getElementById('pasteImportTab');
    fileImportTab = document.getElementById('fileImportTab');
    importFile = document.getElementById('importFile');
}

// Event listeners
function setupEventListeners() {
    // Login form
    loginForm.addEventListener('submit', handleLogin);
    
    // Logout button
    logoutBtn.addEventListener('click', handleLogout);
    
    // Tab navigation
    tabs.forEach(tab => {
        tab.addEventListener('click', handleTabClick);
    });
    
    // Create buttons
    createTokenBtn.addEventListener('click', () => openTokenModal());
    createAuthCookieBtn.addEventListener('click', () => openAuthCookieModal());
    createAdminBtn.addEventListener('click', () => openAdminModal());
    createErrorFilterBtn.addEventListener('click', () => openErrorFilterModal());
    
    // Logs buttons and filters
    if (refreshLogsBtn) {
        refreshLogsBtn.addEventListener('click', () => loadLogs());
    }
    
    if (exportLogsJsonBtn) {
        exportLogsJsonBtn.addEventListener('click', () => exportLogs('json'));
    }
    
    if (exportLogsCsvBtn) {
        exportLogsCsvBtn.addEventListener('click', () => exportLogs('csv'));
    }
    
    if (applyFiltersBtn) {
        applyFiltersBtn.addEventListener('click', applyLogsFilters);
    }
    
    if (resetFiltersBtn) {
        resetFiltersBtn.addEventListener('click', resetLogsFilters);
    }
    
    // Form submissions
    tokenForm.addEventListener('submit', handleTokenFormSubmit);
    authCookieForm.addEventListener('submit', handleAuthCookieFormSubmit);
    adminForm.addEventListener('submit', handleAdminFormSubmit);
    errorFilterForm.addEventListener('submit', handleErrorFilterFormSubmit);
    
    // Modal close buttons
    closeButtons.forEach(button => {
        button.addEventListener('click', closeAllModals);
    });
    
    // Cancel buttons
    cancelButtons.forEach(button => {
        button.addEventListener('click', closeAllModals);
    });
    
    // Confirm modal buttons
    confirmYes.addEventListener('click', handleConfirmAction);
    confirmNo.addEventListener('click', closeAllModals);
    
    // Export/Import buttons
    exportDataBtn.addEventListener('click', handleExportData);
    importDataBtn.addEventListener('click', handleImportData);
    
    // Auth Cookie Status buttons
    const resetCookieRotationBtn = document.getElementById('resetCookieRotationBtn');
    if (resetCookieRotationBtn) {
        resetCookieRotationBtn.addEventListener('click', resetCookieRotation);
    }
    
    // Import tabs (if they exist)
    if (pasteTabBtn && fileTabBtn) {
        pasteTabBtn.addEventListener('click', () => switchImportTab('paste'));
        fileTabBtn.addEventListener('click', () => switchImportTab('file'));
    }
}

// Switch between import tabs
function switchImportTab(tab) {
    if (!pasteTabBtn || !fileTabBtn || !pasteImportTab || !fileImportTab) return;
    
    if (tab === 'paste') {
        pasteTabBtn.classList.add('active');
        fileTabBtn.classList.remove('active');
        pasteImportTab.classList.add('active');
        fileImportTab.classList.remove('active');
    } else {
        pasteTabBtn.classList.remove('active');
        fileTabBtn.classList.add('active');
        pasteImportTab.classList.remove('active');
        fileImportTab.classList.add('active');
    }
}

// Authentication functions
async function checkAuthStatus() {
    try {
        const response = await fetch(`${API_BASE_URL}/me`, {
            credentials: 'same-origin' // Include cookies with the request
        });
        
        if (response.ok) {
            const userData = await response.json();
            setLoggedInState(userData);
            loadData();
        } else {
            setLoggedOutState();
        }
    } catch (error) {
        console.error('Error checking auth status:', error);
        setLoggedOutState();
    }
}

async function handleLogin(event) {
    event.preventDefault();
    
    const username = loginForm.username.value;
    const password = loginForm.password.value;
    
    if (!username || !password) {
        showLoginError('Please enter both username and password');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE_URL}/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ username, password }),
            credentials: 'same-origin' // Include cookies with the request
        });
        
        const data = await response.json();
        
        if (response.ok) {
            setLoggedInState(data.admin);
            loadData();
            showToast('Logged in successfully', 'success');
        } else {
            showLoginError(data.message || 'Login failed');
        }
    } catch (error) {
        console.error('Login error:', error);
        showLoginError('An error occurred during login');
    }
}

async function handleLogout() {
    try {
        await fetch(`${API_BASE_URL}/logout`, {
            method: 'POST',
            credentials: 'same-origin' // Include cookies with the request
        });
        
        setLoggedOutState();
        showToast('Logged out successfully', 'success');
    } catch (error) {
        console.error('Logout error:', error);
    }
}

function setLoggedInState(user) {
    currentUser = user;
    loginSection.classList.add('hidden');
    mainContent.classList.remove('hidden');
    usernameSpan.textContent = user.username;
    
    // Show admin, logs, and export/import tabs only for owner
    if (user.isOwner) {
        adminsTab.style.display = 'block';
        logsTab.style.display = 'block';
        exportImportTab.style.display = 'block';
    } else {
        adminsTab.style.display = 'none';
        logsTab.style.display = 'none';
        exportImportTab.style.display = 'none';
    }
}

function setLoggedOutState() {
    currentUser = null;
    loginSection.classList.remove('hidden');
    mainContent.classList.add('hidden');
    loginForm.reset();
    loginError.textContent = '';
}

function showLoginError(message) {
    loginError.textContent = message;
}

// Tab navigation
function handleTabClick(event) {
    event.preventDefault();
    
    const tabId = event.target.getAttribute('data-tab');
    
    // Update active tab
    tabs.forEach(tab => {
        if (tab.getAttribute('data-tab') === tabId) {
            tab.classList.add('active');
        } else {
            tab.classList.remove('active');
        }
    });
    
    // Show active section
    sections.forEach(section => {
        if (section.id === `${tabId}Section`) {
            section.classList.add('active');
            section.classList.remove('hidden');
        } else {
            section.classList.remove('active');
            section.classList.add('hidden');
        }
    });
}

// Data loading functions
async function loadData() {
    loadTokens();
    loadAuthCookies();
    
    if (currentUser && currentUser.isOwner) {
        loadAdmins();
        loadLogs();
        loadErrorFilters();
    }
}

async function loadTokens() {
    try {
        const response = await fetch(`${API_BASE_URL}/tokens`, {
            credentials: 'same-origin' // Include cookies with the request
        });
        
        if (response.ok) {
            const tokens = await response.json();
            renderTokens(tokens);
        } else {
            showToast('Failed to load tokens', 'error');
        }
    } catch (error) {
        console.error('Error loading tokens:', error);
        showToast('Error loading tokens', 'error');
    }
}

// Load auth cookies
async function loadAuthCookies() {
    try {
        // Load auth cookies
        const cookiesResponse = await fetch(`${API_BASE_URL}/auth-cookies`, {
            credentials: 'same-origin' // Include cookies with the request
        });
        
        // Load auth cookies status
        const statusResponse = await fetch(`${API_BASE_URL}/auth-cookies/status`, {
            credentials: 'same-origin' // Include cookies with the request
        });
        
        if (cookiesResponse.ok) {
            const authCookies = await cookiesResponse.json();
            renderAuthCookies(authCookies);
            
            // If status response is also successful, update the status display
            if (statusResponse.ok) {
                const statusData = await statusResponse.json();
                updateAuthCookieStatus(statusData);
            }
        } else {
            showToast('Failed to load auth cookies', 'error');
        }
    } catch (error) {
        console.error('Error loading auth cookies:', error);
        showToast('Error loading auth cookies', 'error');
    }
}

// Update auth cookie status display
function updateAuthCookieStatus(statusData) {
    const statusElement = document.getElementById('authCookieStatus');
    if (!statusElement) return;
    
    statusElement.innerHTML = `
        <div class="status-item">
            <span>Total Cookies:</span>
            <span class="status-value">${statusData.total}</span>
        </div>
        <div class="status-item">
            <span>Active Cookies:</span>
            <span class="status-value">${statusData.active}</span>
        </div>
        <div class="status-item">
            <span>In Rotation:</span>
            <span class="status-value">${statusData.inRotation}</span>
        </div>
    `;
}

// Reset cookie rotation
async function resetCookieRotation() {
    try {
        const response = await fetch(`${API_BASE_URL}/auth-cookies/reset-rotation`, {
            method: 'POST',
            credentials: 'same-origin' // Include cookies with the request
        });
        
        if (response.ok) {
            showToast('Cookie rotation reset successfully', 'success');
            loadAuthCookies(); // Reload to update status
        } else {
            showToast('Failed to reset cookie rotation', 'error');
        }
    } catch (error) {
        console.error('Error resetting cookie rotation:', error);
        showToast('Error resetting cookie rotation', 'error');
    }
}

// Render auth cookies
function renderAuthCookies(authCookies) {
    authCookiesList.innerHTML = '';
    
    if (authCookies.length === 0) {
        authCookiesList.innerHTML = '<tr><td colspan="5" class="text-center">No auth cookies found</td></tr>';
        return;
    }
    
    authCookies.forEach(cookie => {
        const row = document.createElement('tr');
        
        row.innerHTML = `
            <td>${escapeHtml(cookie.name)}</td>
            <td>${escapeHtml(cookie.description || '')}</td>
            <td>${cookie.active ? 'Yes' : 'No'}</td>
            <td>
                <div class="token-value">
                    <span class="token-mask">••••••••••••••••</span>
                    <button class="btn btn-sm btn-secondary show-cookie" data-cookie="${escapeHtml(cookie.value)}">Show</button>
                </div>
            </td>
            <td>
                <button class="btn btn-sm btn-secondary edit-auth-cookie" data-id="${cookie.id}">Edit</button>
                <button class="btn btn-sm btn-danger delete-auth-cookie" data-id="${cookie.id}">Delete</button>
            </td>
        `;
        
        // Add event listeners to buttons
        const showCookieBtn = row.querySelector('.show-cookie');
        const editCookieBtn = row.querySelector('.edit-auth-cookie');
        const deleteCookieBtn = row.querySelector('.delete-auth-cookie');
        
        showCookieBtn.addEventListener('click', (e) => {
            const cookieValue = e.target.getAttribute('data-cookie');
            const cookieMask = e.target.previousElementSibling;
            
            if (cookieMask.classList.contains('token-mask')) {
                cookieMask.textContent = cookieValue;
                cookieMask.classList.remove('token-mask');
                e.target.textContent = 'Hide';
            } else {
                cookieMask.textContent = '••••••••••••••••';
                cookieMask.classList.add('token-mask');
                e.target.textContent = 'Show';
            }
        });
        
        editCookieBtn.addEventListener('click', () => openAuthCookieModal(cookie));
        deleteCookieBtn.addEventListener('click', () => confirmDelete('auth-cookie', cookie.id, cookie.name));
        
        authCookiesList.appendChild(row);
    });
}

async function loadAdmins() {
    try {
        const response = await fetch(`${API_BASE_URL}/admins`, {
            credentials: 'same-origin' // Include cookies with the request
        });
        
        if (response.ok) {
            const admins = await response.json();
            renderAdmins(admins);
        } else {
            showToast('Failed to load admins', 'error');
        }
    } catch (error) {
        console.error('Error loading admins:', error);
        showToast('Error loading admins', 'error');
    }
}

// Load error filters
async function loadErrorFilters() {
    try {
        const response = await fetch(`${API_BASE_URL}/error-filters`, {
            credentials: 'same-origin' // Include cookies with the request
        });
        
        if (response.ok) {
            const filters = await response.json();
            renderErrorFilters(filters);
        } else {
            showToast('Failed to load error filters', 'error');
        }
    } catch (error) {
        console.error('Error loading error filters:', error);
        showToast('Error loading error filters', 'error');
    }
}

// Logs functions
async function loadLogs() {
    try {
        // Build query parameters
        const queryParams = new URLSearchParams({
            page: currentLogsPage,
            limit: 20
        });
        
        // Add filters if any
        if (logsFilters.adminUsername) queryParams.append('admin', logsFilters.adminUsername);
        if (logsFilters.action) queryParams.append('action', logsFilters.action);
        if (logsFilters.startDate) queryParams.append('startDate', logsFilters.startDate);
        if (logsFilters.endDate) queryParams.append('endDate', logsFilters.endDate);
        
        const response = await fetch(`${API_BASE_URL}/logs?${queryParams.toString()}`, {
            credentials: 'same-origin' // Include cookies with the request
        });
        
        if (response.ok) {
            const data = await response.json();
            renderLogs(data);
        } else {
            showToast('Failed to load logs', 'error');
        }
    } catch (error) {
        console.error('Error loading logs:', error);
        showToast('Error loading logs', 'error');
    }
}

function renderLogs(data) {
    logsList.innerHTML = '';
    
    if (data.logs.length === 0) {
        logsList.innerHTML = '<tr><td colspan="4" class="text-center">No logs found</td></tr>';
        return;
    }
    
    data.logs.forEach(log => {
        const row = document.createElement('tr');
        const timestamp = new Date(log.timestamp).toLocaleString();
        const detailsStr = JSON.stringify(log.details, null, 2);
        
        row.innerHTML = `
            <td>${timestamp}</td>
            <td>${escapeHtml(log.adminUsername)}</td>
            <td>${escapeHtml(log.action)}</td>
            <td><div class="log-details">${escapeHtml(detailsStr)}</div></td>
        `;
        
        // Add event listener to expand details
        const detailsDiv = row.querySelector('.log-details');
        detailsDiv.addEventListener('click', () => {
            detailsDiv.classList.toggle('expanded');
        });
        
        logsList.appendChild(row);
    });
    
    // Render pagination
    renderLogsPagination(data);
}

function renderLogsPagination(data) {
    logsPagination.innerHTML = '';
    
    if (data.totalPages <= 1) {
        return;
    }
    
    // Previous button
    const prevBtn = document.createElement('button');
    prevBtn.className = `pagination-btn ${data.page === 1 ? 'disabled' : ''}`;
    prevBtn.textContent = '← Previous';
    if (data.page > 1) {
        prevBtn.addEventListener('click', () => {
            currentLogsPage = data.page - 1;
            loadLogs();
        });
    }
    logsPagination.appendChild(prevBtn);
    
    // Page buttons
    const maxButtons = 5;
    const startPage = Math.max(1, data.page - Math.floor(maxButtons / 2));
    const endPage = Math.min(data.totalPages, startPage + maxButtons - 1);
    
    for (let i = startPage; i <= endPage; i++) {
        const pageBtn = document.createElement('button');
        pageBtn.className = `pagination-btn ${i === data.page ? 'active' : ''}`;
        pageBtn.textContent = i;
        pageBtn.addEventListener('click', () => {
            if (i !== data.page) {
                currentLogsPage = i;
                loadLogs();
            }
        });
        logsPagination.appendChild(pageBtn);
    }
    
    // Next button
    const nextBtn = document.createElement('button');
    nextBtn.className = `pagination-btn ${data.page === data.totalPages ? 'disabled' : ''}`;
    nextBtn.textContent = 'Next →';
    if (data.page < data.totalPages) {
        nextBtn.addEventListener('click', () => {
            currentLogsPage = data.page + 1;
            loadLogs();
        });
    }
    logsPagination.appendChild(nextBtn);
}

function applyLogsFilters() {
    logsFilters = {};
    
    if (filterAdmin.value) logsFilters.adminUsername = filterAdmin.value;
    if (filterAction.value) logsFilters.action = filterAction.value;
    if (filterStartDate.value) logsFilters.startDate = filterStartDate.value;
    if (filterEndDate.value) logsFilters.endDate = filterEndDate.value;
    
    currentLogsPage = 1; // Reset to first page
    loadLogs();
}

function resetLogsFilters() {
    filterAdmin.value = '';
    filterAction.value = '';
    filterStartDate.value = '';
    filterEndDate.value = '';
    
    logsFilters = {};
    currentLogsPage = 1;
    loadLogs();
}

async function exportLogs(format) {
    try {
        // Build query parameters
        const queryParams = new URLSearchParams({ format });
        
        // Add filters if any
        if (logsFilters.adminUsername) queryParams.append('admin', logsFilters.adminUsername);
        if (logsFilters.action) queryParams.append('action', logsFilters.action);
        if (logsFilters.startDate) queryParams.append('startDate', logsFilters.startDate);
        if (logsFilters.endDate) queryParams.append('endDate', logsFilters.endDate);
        
        // Create a download link
        const a = document.createElement('a');
        a.href = `${API_BASE_URL}/logs/export?${queryParams.toString()}`;
        a.download = `admin-logs-${new Date().toISOString().split('T')[0]}.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        showToast(`Logs exported as ${format.toUpperCase()} successfully`, 'success');
    } catch (error) {
        console.error(`Error exporting logs as ${format}:`, error);
        showToast(`Error exporting logs as ${format}`, 'error');
    }
}

// Export/Import functions
async function handleExportData() {
    try {
        const response = await fetch(`${API_BASE_URL}/export`, {
            credentials: 'same-origin' // Include cookies with the request
        });
        
        if (response.ok) {
            const data = await response.json();
            const exportText = JSON.stringify(data, null, 2);
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `cursor-proxy-export-${timestamp}.json`;
            
            // Display the exported data
            exportResult.innerHTML = `
                <p>Export successful! You can copy this data or download it as a file:</p>
                <pre>${exportText}</pre>
                <div class="export-actions">
                    <button id="copyExportBtn" class="btn btn-secondary">Copy to Clipboard</button>
                    <button id="downloadExportBtn" class="btn btn-primary">Download as File</button>
                </div>
            `;
            
            // Add copy to clipboard functionality
            document.getElementById('copyExportBtn').addEventListener('click', () => {
                navigator.clipboard.writeText(exportText)
                    .then(() => showToast('Exported data copied to clipboard', 'success'))
                    .catch(err => {
                        console.error('Failed to copy:', err);
                        showToast('Failed to copy to clipboard', 'error');
                    });
            });
            
            // Add download functionality
            document.getElementById('downloadExportBtn').addEventListener('click', () => {
                const blob = new Blob([exportText], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                URL.revokeObjectURL(url);
                showToast('File download started', 'success');
            });
            
            showToast('Data exported successfully', 'success');
        } else {
            const errorData = await response.json();
            showToast(errorData.error || 'Failed to export data', 'error');
        }
    } catch (error) {
        console.error('Error exporting data:', error);
        showToast('Error exporting data', 'error');
    }
}

async function handleImportData() {
    let jsonData = '';
    
    // Check if we're using file upload or paste
    if (fileImportTab && fileImportTab.classList.contains('active') && importFile && importFile.files.length > 0) {
        // Read from file
        try {
            const file = importFile.files[0];
            jsonData = await readFileAsText(file);
        } catch (error) {
            showToast('Error reading file: ' + error.message, 'error');
            return;
        }
    } else {
        // Read from textarea
        jsonData = importData.value.trim();
    }
    
    if (!jsonData) {
        showToast('Please enter JSON data or select a file to import', 'error');
        return;
    }
    
    try {
        // Parse the JSON to validate it
        const data = JSON.parse(jsonData);
        
        // Check if at least one option is selected
        if (!importTokens.checked && !importAdmins.checked && !importAuthCookies.checked) {
            showToast('Please select at least one data type to import', 'error');
            return;
        }
        
        // Prepare the import data
        const importPayload = {};
        if (importTokens.checked && data.tokens) {
            importPayload.tokens = data.tokens;
        }
        if (importAdmins.checked && data.admins) {
            importPayload.admins = data.admins;
        }
        if (importAuthCookies.checked && data.authCookies) {
            importPayload.authCookies = data.authCookies;
        }
        
        // Send the import request
        const response = await fetch(`${API_BASE_URL}/import`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(importPayload),
            credentials: 'same-origin' // Include cookies with the request
        });
        
        const responseData = await response.json();
        
        if (response.ok) {
            importResult.innerHTML = `
                <p>Import successful!</p>
                <ul>
                    ${importTokens.checked ? `<li>Tokens: ${responseData.results.tokens.skipped ? 'Skipped' : `${responseData.results.tokens.count} imported`}</li>` : ''}
                    ${importAdmins.checked ? `<li>Admins: ${responseData.results.admins.skipped ? 'Skipped' : `${responseData.results.admins.count} imported`}</li>` : ''}
                    ${importAuthCookies.checked ? `<li>Auth Cookies: ${responseData.results.authCookies.skipped ? 'Skipped' : `${responseData.results.authCookies.count} imported`}</li>` : ''}
                </ul>
            `;
            
            // Reload data
            loadData();
            
            // Reset file input
            if (importFile) {
                importFile.value = '';
            }
            
            showToast('Data imported successfully', 'success');
        } else {
            importResult.innerHTML = `
                <p>Import failed:</p>
                <ul>
                    ${responseData.results.tokens && !responseData.results.tokens.skipped ? `<li>Tokens: ${responseData.results.tokens.error || 'Unknown error'}</li>` : ''}
                    ${responseData.results.admins && !responseData.results.admins.skipped ? `<li>Admins: ${responseData.results.admins.error || 'Unknown error'}</li>` : ''}
                    ${responseData.results.authCookies && !responseData.results.authCookies.skipped ? `<li>Auth Cookies: ${responseData.results.authCookies.error || 'Unknown error'}</li>` : ''}
                </ul>
            `;
            
            showToast('Failed to import data', 'error');
        }
    } catch (error) {
        console.error('Error importing data:', error);
        importResult.innerHTML = `<p>Error parsing JSON: ${error.message}</p>`;
        showToast('Error importing data: Invalid JSON', 'error');
    }
}

// Helper function to read file as text
function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = event => resolve(event.target.result);
        reader.onerror = error => reject(error);
        reader.readAsText(file);
    });
}

// Rendering functions
function renderTokens(tokens) {
    tokensList.innerHTML = '';
    
    if (tokens.length === 0) {
        tokensList.innerHTML = '<tr><td colspan="9" class="text-center">No tokens found</td></tr>';
        return;
    }
    
    tokens.forEach(token => {
        const row = document.createElement('tr');
        
        // Initialize usageCount if it doesn't exist
        const usageCount = token.usageCount || 0;
        
        row.innerHTML = `
            <td>${escapeHtml(token.name)}</td>
            <td>${escapeHtml(token.description || '')}</td>
            <td>${token.expirationDate ? new Date(token.expirationDate).toLocaleDateString() : 'Never'}</td>
            <td>${token.rateLimit ? 'Yes' : 'No'}</td>
            <td>${token.queuePriority ? 'Yes' : 'No'}</td>
            <td>${token.premium ? 'Yes' : 'No'}</td>
            <td>${usageCount}</td>
            <td>
                <div class="token-value">
                    <span class="token-mask">••••••••••••••••</span>
                    <button class="btn btn-sm btn-secondary show-token" data-token="${escapeHtml(token.value)}">Show</button>
                </div>
            </td>
            <td>
                <button class="btn btn-sm btn-secondary edit-token" data-id="${token.id}">Edit</button>
                <button class="btn btn-sm btn-danger delete-token" data-id="${token.id}">Delete</button>
            </td>
        `;
        
        // Add event listeners to buttons
        const showTokenBtn = row.querySelector('.show-token');
        const editTokenBtn = row.querySelector('.edit-token');
        const deleteTokenBtn = row.querySelector('.delete-token');
        
        showTokenBtn.addEventListener('click', (e) => {
            const tokenValue = e.target.getAttribute('data-token');
            const tokenMask = e.target.previousElementSibling;
            
            if (tokenMask.classList.contains('token-mask')) {
                tokenMask.textContent = tokenValue;
                tokenMask.classList.remove('token-mask');
                e.target.textContent = 'Hide';
            } else {
                tokenMask.textContent = '••••••••••••••••';
                tokenMask.classList.add('token-mask');
                e.target.textContent = 'Show';
            }
        });
        
        editTokenBtn.addEventListener('click', () => openTokenModal(token));
        deleteTokenBtn.addEventListener('click', () => confirmDelete('token', token.id, token.name));
        
        tokensList.appendChild(row);
    });
}

function renderAdmins(admins) {
    adminsList.innerHTML = '';
    
    if (admins.length === 0) {
        adminsList.innerHTML = '<tr><td colspan="4" class="text-center">No admins found</td></tr>';
        return;
    }
    
    admins.forEach(admin => {
        const row = document.createElement('tr');
        
        row.innerHTML = `
            <td>${escapeHtml(admin.username)}</td>
            <td>${admin.isOwner ? 'Yes' : 'No'}</td>
            <td>${new Date(admin.createdAt).toLocaleDateString()}</td>
            <td>
                ${admin.isOwner ? '' : `<button class="btn btn-sm btn-danger delete-admin" data-id="${admin.id}">Delete</button>`}
            </td>
        `;
        
        // Add event listener to delete button if not owner
        if (!admin.isOwner) {
            const deleteAdminBtn = row.querySelector('.delete-admin');
            deleteAdminBtn.addEventListener('click', () => confirmDelete('admin', admin.id, admin.username));
        }
        
        adminsList.appendChild(row);
    });
}

// Render error filters
function renderErrorFilters(filters) {
    errorFiltersList.innerHTML = '';
    
    if (filters.length === 0) {
        errorFiltersList.innerHTML = '<tr><td colspan="4" class="text-center">No error filters found</td></tr>';
        return;
    }
    
    filters.forEach(filter => {
        const row = document.createElement('tr');
        const createdDate = new Date(filter.createdAt).toLocaleDateString();
        
        row.innerHTML = `
            <td>${escapeHtml(filter.pattern)}</td>
            <td>${escapeHtml(filter.description || '')}</td>
            <td>${createdDate}</td>
            <td>
                <button class="btn btn-sm btn-secondary edit-error-filter" data-id="${filter.id}">Edit</button>
                <button class="btn btn-sm btn-danger delete-error-filter" data-id="${filter.id}">Delete</button>
            </td>
        `;
        
        // Add event listeners to buttons
        const editBtn = row.querySelector('.edit-error-filter');
        const deleteBtn = row.querySelector('.delete-error-filter');
        
        editBtn.addEventListener('click', () => openErrorFilterModal(filter));
        deleteBtn.addEventListener('click', () => confirmDelete('error-filter', filter.id, filter.pattern));
        
        errorFiltersList.appendChild(row);
    });
}

// Modal functions
function openTokenModal(token = null) {
    // Reset form
    tokenForm.reset();
    
    // Hide IP history section by default
    const ipHistorySection = document.getElementById('ipHistorySection');
    ipHistorySection.classList.add('hidden');
    
    if (token) {
        // Edit mode
        tokenModalTitle.textContent = 'Edit Token';
        document.getElementById('tokenId').value = token.id;
        document.getElementById('tokenName').value = token.name;
        document.getElementById('tokenDescription').value = token.description || '';
        
        if (token.expirationDate) {
            const expDate = new Date(token.expirationDate);
            document.getElementById('tokenExpiration').value = expDate.toISOString().split('T')[0];
        }
        
        document.getElementById('tokenRateLimit').checked = token.rateLimit;
        document.getElementById('tokenQueuePriority').checked = token.queuePriority;
        document.getElementById('tokenPremium').checked = token.premium;
        
        // Show IP history section and populate it
        if (token.ipHistory && token.ipHistory.length > 0) {
            ipHistorySection.classList.remove('hidden');
            renderIpHistory(token.ipHistory);
        }
    } else {
        // Create mode
        tokenModalTitle.textContent = 'Create Token';
        document.getElementById('tokenId').value = '';
    }
    
    tokenModal.style.display = 'block';
}

// Render IP history in the token modal
function renderIpHistory(ipHistory) {
    const ipHistoryList = document.getElementById('ipHistoryList');
    ipHistoryList.innerHTML = '';
    
    if (!ipHistory || ipHistory.length === 0) {
        ipHistoryList.innerHTML = '<tr><td colspan="2" class="text-center">No IP history found</td></tr>';
        return;
    }
    
    // Sort by timestamp (newest first)
    const sortedHistory = [...ipHistory].sort((a, b) => 
        new Date(b.timestamp) - new Date(a.timestamp)
    );
    
    sortedHistory.forEach(entry => {
        const row = document.createElement('tr');
        const timestamp = new Date(entry.timestamp).toLocaleString();
        
        row.innerHTML = `
            <td>${escapeHtml(entry.ip)}</td>
            <td>${timestamp}</td>
        `;
        
        ipHistoryList.appendChild(row);
    });
}

function openAdminModal() {
    // Reset form
    adminForm.reset();
    adminModal.style.display = 'block';
}

function openErrorFilterModal(filter = null) {
    // Reset form
    errorFilterForm.reset();
    
    if (filter) {
        // Edit mode
        errorFilterModalTitle.textContent = 'Edit Error Filter';
        document.getElementById('errorFilterId').value = filter.id;
        document.getElementById('errorFilterPattern').value = filter.pattern;
        document.getElementById('errorFilterDescription').value = filter.description || '';
    } else {
        // Create mode
        errorFilterModalTitle.textContent = 'Create Error Filter';
        document.getElementById('errorFilterId').value = '';
    }
    
    errorFilterModal.style.display = 'block';
}

function openAuthCookieModal(cookie = null) {
    // Reset form
    authCookieForm.reset();
    
    if (cookie) {
        // Edit mode
        authCookieModalTitle.textContent = 'Edit Auth Cookie';
        document.getElementById('authCookieId').value = cookie.id;
        document.getElementById('authCookieName').value = cookie.name;
        document.getElementById('authCookieValue').value = cookie.value;
        document.getElementById('authCookieDescription').value = cookie.description || '';
        document.getElementById('authCookieActive').checked = cookie.active;
        
        // Disable value field in edit mode since we don't allow updating the cookie value
        document.getElementById('authCookieValue').disabled = true;
    } else {
        // Create mode
        authCookieModalTitle.textContent = 'Add Auth Cookie';
        document.getElementById('authCookieId').value = '';
        document.getElementById('authCookieValue').disabled = false;
    }
    
    authCookieModal.style.display = 'block';
}

function closeAllModals() {
    tokenModal.style.display = 'none';
    adminModal.style.display = 'none';
    errorFilterModal.style.display = 'none';
    confirmModal.style.display = 'none';
}

function confirmDelete(type, id, name) {
    currentAction = `delete-${type}`;
    currentItemId = id;
    
    confirmMessage.textContent = `Are you sure you want to delete the ${type} "${name}"?`;
    confirmModal.style.display = 'block';
}

// Form submission handlers
async function handleTokenFormSubmit(event) {
    event.preventDefault();
    
    const tokenId = document.getElementById('tokenId').value;
    const isEdit = !!tokenId;
    
    const tokenData = {
        name: document.getElementById('tokenName').value,
        description: document.getElementById('tokenDescription').value,
        expirationDate: document.getElementById('tokenExpiration').value || null,
        rateLimit: document.getElementById('tokenRateLimit').checked,
        queuePriority: document.getElementById('tokenQueuePriority').checked,
        premium: document.getElementById('tokenPremium').checked
    };
    
    try {
        let response;
        
        if (isEdit) {
            response = await fetch(`${API_BASE_URL}/tokens/${tokenId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(tokenData),
                credentials: 'same-origin' // Include cookies with the request
            });
        } else {
            response = await fetch(`${API_BASE_URL}/tokens`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(tokenData),
                credentials: 'same-origin' // Include cookies with the request
            });
        }
        
        if (response.ok) {
            closeAllModals();
            loadTokens();
            showToast(`Token ${isEdit ? 'updated' : 'created'} successfully`, 'success');
        } else {
            const errorData = await response.json();
            showToast(errorData.error || `Failed to ${isEdit ? 'update' : 'create'} token`, 'error');
        }
    } catch (error) {
        console.error(`Error ${isEdit ? 'updating' : 'creating'} token:`, error);
        showToast(`Error ${isEdit ? 'updating' : 'creating'} token`, 'error');
    }
}

async function handleAdminFormSubmit(event) {
    event.preventDefault();
    
    const adminData = {
        username: document.getElementById('adminUsername').value,
        password: document.getElementById('adminPassword').value
    };
    
    try {
        const response = await fetch(`${API_BASE_URL}/admins`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(adminData),
            credentials: 'same-origin' // Include cookies with the request
        });
        
        if (response.ok) {
            closeAllModals();
            loadAdmins();
            showToast('Admin created successfully', 'success');
        } else {
            const errorData = await response.json();
            showToast(errorData.error || 'Failed to create admin', 'error');
        }
    } catch (error) {
        console.error('Error creating admin:', error);
        showToast('Error creating admin', 'error');
    }
}

async function handleErrorFilterFormSubmit(event) {
    event.preventDefault();
    
    const filterId = document.getElementById('errorFilterId').value;
    const isEdit = !!filterId;
    
    const filterData = {
        pattern: document.getElementById('errorFilterPattern').value,
        description: document.getElementById('errorFilterDescription').value
    };
    
    try {
        let response;
        
        if (isEdit) {
            response = await fetch(`${API_BASE_URL}/error-filters/${filterId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(filterData),
                credentials: 'same-origin' // Include cookies with the request
            });
        } else {
            response = await fetch(`${API_BASE_URL}/error-filters`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(filterData),
                credentials: 'same-origin' // Include cookies with the request
            });
        }
        
        if (response.ok) {
            closeAllModals();
            loadErrorFilters();
            showToast(`Error filter ${isEdit ? 'updated' : 'created'} successfully`, 'success');
        } else {
            const errorData = await response.json();
            showToast(errorData.error || `Failed to ${isEdit ? 'update' : 'create'} error filter`, 'error');
        }
    } catch (error) {
        console.error(`Error ${isEdit ? 'updating' : 'creating'} error filter:`, error);
        showToast(`Error ${isEdit ? 'updating' : 'creating'} error filter`, 'error');
    }
}

async function handleAuthCookieFormSubmit(event) {
    event.preventDefault();
    
    const cookieId = document.getElementById('authCookieId').value;
    const isEdit = !!cookieId;
    
    const cookieData = {
        name: document.getElementById('authCookieName').value,
        description: document.getElementById('authCookieDescription').value,
        active: document.getElementById('authCookieActive').checked
    };
    
    // Add value field only for new cookies (not for edits)
    if (!isEdit) {
        cookieData.value = document.getElementById('authCookieValue').value;
    }
    
    try {
        let response;
        
        if (isEdit) {
            response = await fetch(`${API_BASE_URL}/auth-cookies/${cookieId}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(cookieData),
                credentials: 'same-origin' // Include cookies with the request
            });
        } else {
            response = await fetch(`${API_BASE_URL}/auth-cookies`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(cookieData),
                credentials: 'same-origin' // Include cookies with the request
            });
        }
        
        if (response.ok) {
            closeAllModals();
            loadAuthCookies();
            showToast(`Auth cookie ${isEdit ? 'updated' : 'created'} successfully`, 'success');
        } else {
            const errorData = await response.json();
            showToast(errorData.error || `Failed to ${isEdit ? 'update' : 'create'} auth cookie`, 'error');
        }
    } catch (error) {
        console.error(`Error ${isEdit ? 'updating' : 'creating'} auth cookie:`, error);
        showToast(`Error ${isEdit ? 'updating' : 'creating'} auth cookie`, 'error');
    }
}

async function handleConfirmAction() {
    if (!currentAction || !currentItemId) {
        closeAllModals();
        return;
    }
    
    try {
        let response;
        
        if (currentAction === 'delete-token') {
            response = await fetch(`${API_BASE_URL}/tokens/${currentItemId}`, {
                method: 'DELETE',
                credentials: 'same-origin' // Include cookies with the request
            });
            
            if (response.ok) {
                loadTokens();
                showToast('Token deleted successfully', 'success');
            } else {
                showToast('Failed to delete token', 'error');
            }
        } else if (currentAction === 'delete-admin') {
            response = await fetch(`${API_BASE_URL}/admins/${currentItemId}`, {
                method: 'DELETE',
                credentials: 'same-origin' // Include cookies with the request
            });
            
            if (response.ok) {
                loadAdmins();
                showToast('Admin deleted successfully', 'success');
            } else {
                showToast('Failed to delete admin', 'error');
            }
        } else if (currentAction === 'delete-error-filter') {
            response = await fetch(`${API_BASE_URL}/error-filters/${currentItemId}`, {
                method: 'DELETE',
                credentials: 'same-origin' // Include cookies with the request
            });
            
            if (response.ok) {
                loadErrorFilters();
                showToast('Error filter deleted successfully', 'success');
            } else {
                showToast('Failed to delete error filter', 'error');
            }
        } else if (currentAction === 'delete-auth-cookie') {
            response = await fetch(`${API_BASE_URL}/auth-cookies/${currentItemId}`, {
                method: 'DELETE',
                credentials: 'same-origin' // Include cookies with the request
            });
            
            if (response.ok) {
                loadAuthCookies();
                showToast('Auth cookie deleted successfully', 'success');
            } else {
                showToast('Failed to delete auth cookie', 'error');
            }
        }
    } catch (error) {
        console.error('Error handling action:', error);
        showToast('Error performing action', 'error');
    } finally {
        closeAllModals();
        currentAction = null;
        currentItemId = null;
    }
}

// Utility functions
function showToast(message, type = 'info') {
    const toastContainer = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    toastContainer.appendChild(toast);
    
    // Remove toast after animation completes
    setTimeout(() => {
        toast.remove();
    }, 3000);
}

function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}
