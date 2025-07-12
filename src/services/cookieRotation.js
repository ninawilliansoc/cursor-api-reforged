const authCookieModel = require('../models/authCookie');

// Keep track of the current cookie index locally
let currentCookieIndex = 0;
// Keep track of the last known cookies length to detect changes
let lastKnownCookiesLength = 0;
// Keep track of the last rotation timestamp
let lastRotationTimestamp = Date.now();
// Rotation interval in milliseconds (30 seconds)
const ROTATION_INTERVAL_MS = 30 * 1000;
// Timer reference for the rotation interval
let rotationTimer = null;

/**
 * Rotate to the next cookie
 * This function is called by the timer and updates the current cookie index
 */
function rotateCookie() {
    // Get all active cookies directly from the model
    const cookies = authCookieModel.getAllActiveCookies();
    
    // If no cookies are available, reset and return
    if (!cookies || cookies.length === 0) {
        console.log('Cookie rotation: No active cookies available');
        lastKnownCookiesLength = 0;
        currentCookieIndex = 0;
        lastRotationTimestamp = Date.now();
        return;
    }
    
    // Check if the number of cookies has changed
    if (cookies.length !== lastKnownCookiesLength) {
        console.log(`Cookie rotation: Number of cookies changed from ${lastKnownCookiesLength} to ${cookies.length}`);
        // If the number of cookies has changed, make sure the index is still valid
        if (currentCookieIndex >= cookies.length) {
            currentCookieIndex = 0;
            console.log('Cookie rotation: Resetting index to 0');
        }
        lastKnownCookiesLength = cookies.length;
    }
    
    // Update the index for the next rotation
    currentCookieIndex = (currentCookieIndex + 1) % cookies.length;
    
    // Get the current cookie after rotation
    const currentCookie = cookies[currentCookieIndex];
    
    console.log(`Cookie rotation: Rotated to cookie ${currentCookie.name} (${currentCookie.id}), index ${currentCookieIndex}`);
    
    // Update the last rotation timestamp
    lastRotationTimestamp = Date.now();
}

/**
 * Get the current authentication cookie without rotating
 * @returns {string|null} The current authentication cookie or null if none are available
 */
function getCurrentCookie() {
    // Get all active cookies directly from the model
    const cookies = authCookieModel.getAllActiveCookies();
    
    // If no cookies are available, return null
    if (!cookies || cookies.length === 0) {
        console.log('Cookie rotation: No active cookies available');
        return null;
    }
    
    // Check if the number of cookies has changed
    if (cookies.length !== lastKnownCookiesLength) {
        console.log(`Cookie rotation: Number of cookies changed from ${lastKnownCookiesLength} to ${cookies.length}`);
        // If the number of cookies has changed, make sure the index is still valid
        if (currentCookieIndex >= cookies.length) {
            currentCookieIndex = 0;
            console.log('Cookie rotation: Resetting index to 0');
        }
        lastKnownCookiesLength = cookies.length;
    }
    
    // Get the current cookie
    const currentCookie = cookies[currentCookieIndex];
    
    console.log(`Cookie rotation: Using cookie ${currentCookie.name} (${currentCookie.id}), current index is ${currentCookieIndex}`);
    
    // Return the cookie value
    return currentCookie.value;
}

/**
 * Get the current authentication cookie
 * This is the main function that should be called by other modules
 * @returns {string|null} The current authentication cookie or null if none are available
 */
function getNextCookie() {
    return getCurrentCookie();
}

/**
 * Reset the cookie rotation index
 * This can be useful for testing or when the cookie list changes significantly
 */
function resetCookieRotation() {
    currentCookieIndex = 0;
    lastKnownCookiesLength = 0;
    lastRotationTimestamp = Date.now();
}

/**
 * Start the cookie rotation timer
 * This should be called when the application starts
 */
function startCookieRotationTimer() {
    if (rotationTimer) {
        // Timer already running, clear it first
        clearInterval(rotationTimer);
    }
    
    console.log(`Starting cookie rotation timer with interval: ${ROTATION_INTERVAL_MS}ms`);
    
    // Initial rotation to set the first cookie
    rotateCookie();
    
    // Set up the timer for future rotations
    rotationTimer = setInterval(rotateCookie, ROTATION_INTERVAL_MS);
    
    return rotationTimer;
}

/**
 * Stop the cookie rotation timer
 * This can be useful for testing or when shutting down the application
 */
function stopCookieRotationTimer() {
    if (rotationTimer) {
        clearInterval(rotationTimer);
        rotationTimer = null;
        console.log('Cookie rotation timer stopped');
    }
}

/**
 * Get the count of active cookies available for rotation
 * @returns {number} The number of active cookies
 */
function getActiveCookiesCount() {
    const cookies = authCookieModel.getAllActiveCookies();
    return cookies ? cookies.length : 0;
}

module.exports = {
    getNextCookie,
    getCurrentCookie,
    resetCookieRotation,
    getActiveCookiesCount,
    startCookieRotationTimer,
    stopCookieRotationTimer,
    rotateCookie
};
