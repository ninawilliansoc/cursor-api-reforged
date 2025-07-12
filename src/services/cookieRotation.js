const authCookieModel = require('../models/authCookie');

// Keep track of the current cookie index locally
let currentCookieIndex = 0;
// Keep track of the last known cookies length to detect changes
let lastKnownCookiesLength = 0;

/**
 * Get the current authentication cookie and rotate to the next one
 * @returns {string|null} The current authentication cookie or null if none are available
 */
function getNextCookie() {
    // Get all active cookies directly from the model
    const cookies = authCookieModel.getAllActiveCookies();
    
    // If no cookies are available, return null
    if (!cookies || cookies.length === 0) {
        console.log('Cookie rotation: No active cookies available');
        lastKnownCookiesLength = 0;
        currentCookieIndex = 0;
        return null;
    }
    
    console.log(`Cookie rotation: Found ${cookies.length} active cookies`);
    
    // Check if the number of cookies has changed since the last request
    // This handles cases where cookies are added or removed dynamically
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
    
    // Update the index for the next request
    currentCookieIndex = (currentCookieIndex + 1) % cookies.length;
    
    console.log(`Cookie rotation: Using cookie ${currentCookie.name} (${currentCookie.id}), next index will be ${currentCookieIndex}`);
    
    // Return the cookie value
    return currentCookie.value;
}

/**
 * Reset the cookie rotation index
 * This can be useful for testing or when the cookie list changes significantly
 */
function resetCookieRotation() {
    currentCookieIndex = 0;
    lastKnownCookiesLength = 0;
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
    resetCookieRotation,
    getActiveCookiesCount
};
