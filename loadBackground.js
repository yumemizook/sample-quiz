// Load and apply site background on page load
// Centralized background loading for all non-gameplay pages

import { getAuth, onAuthStateChanged } from "./firebase.js";
import { getFirestore, doc, getDoc } from "./firebase.js";

const auth = getAuth();
const db = getFirestore();

// Apply site background to page
// This is the same method used when manually changing the background in profile settings
function applySiteBackground(imageURL) {
    // Only apply to non-gameplay pages
    const gameplayPages = ['master.html', 'easy.html', 'normal.html', 'hell.html', 'master130.html', 'secret.html'];
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    
    // Profile pages will use profile owner's background (applied by profile.js)
    // This function can still be called from profile.js to apply the profile owner's background
    // But we don't want loadSiteBackground() to override it
    
    if (gameplayPages.includes(currentPage)) {
        return; // Don't apply to gameplay pages
    }
    
    // Ensure document.body exists before applying styles
    if (!document.body) {
        console.warn('Cannot apply background: document.body not available yet');
        // Retry after a short delay
        setTimeout(() => applySiteBackground(imageURL), 100);
        return;
    }
    
    if (imageURL) {
        // Apply background using the exact same method as manual background change
        document.body.style.backgroundImage = `url(${imageURL})`;
        document.body.style.backgroundSize = 'cover';
        document.body.style.backgroundPosition = 'center';
        document.body.style.backgroundRepeat = 'no-repeat';
        document.body.style.backgroundAttachment = 'fixed';
        
        // Mark as loaded
        backgroundLoaded = true;
    }
}

// Remove site background
function removeSiteBackground() {
    const gameplayPages = ['master.html', 'easy.html', 'normal.html', 'hell.html', 'master130.html', 'secret.html'];
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    
    if (gameplayPages.includes(currentPage)) {
        return; // Don't modify gameplay pages
    }
    
    document.body.style.backgroundImage = '';
    document.body.style.backgroundSize = '';
    document.body.style.backgroundPosition = '';
    document.body.style.backgroundRepeat = '';
    document.body.style.backgroundAttachment = '';
}

// Load and apply site background on page load
// Retry logic ensures background is loaded even if auth takes time to initialize
async function loadSiteBackground(retryCount = 0, maxRetries = 20) {
    const gameplayPages = ['master.html', 'easy.html', 'normal.html', 'hell.html', 'master130.html', 'secret.html'];
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    
    // Don't apply viewer's background on profile pages - profile owner's background will be applied by profile.js
    if (currentPage === 'profile.html' && window.location.search.includes('player=')) {
        return; // Profile pages use the profile owner's background
    }
    
    if (gameplayPages.includes(currentPage)) {
        return; // Don't apply to gameplay pages
    }
    
    // Ensure document.body exists
    if (!document.body) {
        // Wait for body to be available
        await new Promise(resolve => {
            if (document.body) {
                resolve();
            } else {
                const checkBody = setInterval(() => {
                    if (document.body) {
                        clearInterval(checkBody);
                        resolve();
                    }
                }, 50);
                // Fallback timeout
                setTimeout(() => {
                    clearInterval(checkBody);
                    resolve();
                }, 5000);
            }
        });
    }
    
    try {
        // Wait for auth to be ready with retry logic
        let user = auth.currentUser;
        
        // Retry getting user if not available immediately
        if (!user && retryCount < maxRetries) {
            // Wait 2 seconds before retrying
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // Try again recursively
            return loadSiteBackground(retryCount + 1, maxRetries);
        }
        
        if (!user) {
            // After max retries, stop trying (will be handled by onAuthStateChanged)
            console.log(`Auth not ready after ${maxRetries} retries, will wait for onAuthStateChanged`);
            return;
        }
        
        // Fetch background from Firestore
        const userProfileRef = doc(db, 'userProfiles', user.uid);
        const userProfileSnap = await getDoc(userProfileRef);
        
        if (userProfileSnap.exists() && userProfileSnap.data().siteBackgroundURL) {
            const bgURL = userProfileSnap.data().siteBackgroundURL;
            // Use the exact same method as when manually changing background
            applySiteBackground(bgURL);
            console.log('Custom background applied successfully');
        } else {
            console.log('No custom background found for user');
        }
    } catch (error) {
        console.error('Error loading site background:', error);
        // Retry on error if we haven't exceeded max retries
        if (retryCount < maxRetries) {
            // Wait 2 seconds before retrying
            setTimeout(() => loadSiteBackground(retryCount + 1, maxRetries), 2000);
        }
    }
}

// Track if background has been successfully loaded to avoid redundant calls
let backgroundLoaded = false;

// Load background on page load
document.addEventListener("DOMContentLoaded", () => {
    // Set up auth state listener first (fires immediately if user is already logged in)
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // Reset flag when user changes
            backgroundLoaded = false;
            // Load background when user is logged in or auth state changes
            await loadSiteBackground();
            backgroundLoaded = true;
        } else {
            // Remove background if user logs out
            removeSiteBackground();
            backgroundLoaded = false;
        }
    });
    
    // Also try loading immediately in case auth is already initialized
    // This handles the case where onAuthStateChanged doesn't fire synchronously
    loadSiteBackground();
    
    // Additional fallback: retry after a short delay
    setTimeout(() => {
        if (!backgroundLoaded && auth.currentUser) {
            loadSiteBackground();
        }
    }, 500);
    
    // Final fallback: retry after a longer delay
    setTimeout(() => {
        if (!backgroundLoaded && auth.currentUser) {
            loadSiteBackground();
        }
    }, 2000);
});

// Export for use in profile.js (for immediate background updates after upload)
export { applySiteBackground, removeSiteBackground };

