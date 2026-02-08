// Load and apply color theme on page load
// Centralized theme loading for all non-gameplay and non-auth pages

import { getAuth, onAuthStateChanged } from "../../firebase.js";
import { getFirestore, doc, getDoc } from "../../firebase.js";

const auth = getAuth();
const db = getFirestore();

// Apply color theme to the page
// forceApply: if true, bypasses page checks (used by profile.js to apply profile owner's theme)
function applyColorTheme(theme, forceApply = false) {
    // Only apply to non-gameplay and non-auth pages (unless forced)
    if (!forceApply) {
        const gameplayPages = ['master.html', 'easy.html', 'normal.html', 'hell.html', 'master130.html', 'secret.html'];
        const authPages = ['signin.html', 'signup.html', 'reset.html', 'reset-confirm.html'];
        const currentPage = window.location.pathname.split('/').pop() || 'index.html';
        
        // Don't apply viewer's theme on profile pages - profile owner's theme will be applied by profile.js
        // But allow if forceApply is true (called from profile.js)
        if (currentPage === 'profile.html' && window.location.search.includes('player=')) {
            return; // Profile pages use the profile owner's theme (unless forced)
        }
        
        if (gameplayPages.includes(currentPage) || authPages.includes(currentPage)) {
            return; // Don't apply to gameplay or auth pages
        }
    }
    
    // Ensure document.body exists before applying styles
    if (!document.body) {
        console.warn('Cannot apply theme: document.body not available yet');
        // Retry after a short delay
        setTimeout(() => applyColorTheme(theme, forceApply), 100);
        return;
    }
    
    // Remove all theme classes
    document.body.classList.remove('theme-default', 'theme-green', 'theme-purple', 'theme-orange', 'theme-red', 'theme-pink', 'theme-yellow');
    
    // Add selected theme class
    if (theme && theme !== 'default') {
        document.body.classList.add(`theme-${theme}`);
    }
}

// Load and apply color theme on page load
// Retry logic ensures theme is loaded even if auth takes time to initialize
async function loadColorTheme(retryCount = 0, maxRetries = 20) {
    const gameplayPages = ['master.html', 'easy.html', 'normal.html', 'hell.html', 'master130.html', 'secret.html'];
    const authPages = ['signin.html', 'signup.html', 'reset.html', 'reset-confirm.html'];
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    
    // Don't apply viewer's theme on profile pages - profile owner's theme will be applied by profile.js
    if (currentPage === 'profile.html' && window.location.search.includes('player=')) {
        return; // Profile pages use the profile owner's theme
    }
    
    if (gameplayPages.includes(currentPage) || authPages.includes(currentPage)) {
        return; // Don't apply to gameplay or auth pages
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
            return loadColorTheme(retryCount + 1, maxRetries);
        }
        
        if (!user) {
            // After max retries, stop trying (will be handled by onAuthStateChanged)
            console.log(`Auth not ready after ${maxRetries} retries, will wait for onAuthStateChanged`);
            return;
        }
        
        // Fetch theme from Firestore
        const userProfileRef = doc(db, 'userProfiles', user.uid);
        const userProfileSnap = await getDoc(userProfileRef);
        
        if (userProfileSnap.exists() && userProfileSnap.data().colorTheme) {
            const theme = userProfileSnap.data().colorTheme;
            applyColorTheme(theme);
        } else {
            // Default theme
            applyColorTheme('default');
        }
    } catch (error) {
        console.error('Error loading color theme:', error);
        // Retry on error if we haven't exceeded max retries
        if (retryCount < maxRetries) {
            // Wait 2 seconds before retrying
            setTimeout(() => loadColorTheme(retryCount + 1, maxRetries), 2000);
        }
    }
}

// Track if theme has been successfully loaded to avoid redundant calls
let themeLoaded = false;

// Load theme on page load
document.addEventListener("DOMContentLoaded", () => {
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    const isProfilePage = currentPage === 'profile.html' && window.location.search.includes('player=');
    
    // Skip loading viewer's theme on profile pages - profile owner's theme will be applied by profile.js
    if (isProfilePage) {
        return;
    }
    
    // Set up auth state listener first (fires immediately if user is already logged in)
    onAuthStateChanged(auth, async (user) => {
        // Skip if we're on a profile page
        const currentPageCheck = window.location.pathname.split('/').pop() || 'index.html';
        const isProfilePageCheck = currentPageCheck === 'profile.html' && window.location.search.includes('player=');
        if (isProfilePageCheck) {
            return;
        }
        
        if (user) {
            // Reset flag when user changes
            themeLoaded = false;
            // Load theme when user is logged in or auth state changes
            await loadColorTheme();
            themeLoaded = true;
        } else {
            // Apply default theme if user logs out
            applyColorTheme('default');
            themeLoaded = false;
        }
    });
    
    // Also try loading immediately in case auth is already initialized
    // This handles the case where onAuthStateChanged doesn't fire synchronously
    loadColorTheme();
    
    // Additional fallback: retry after a short delay
    setTimeout(() => {
        const currentPageCheck = window.location.pathname.split('/').pop() || 'index.html';
        const isProfilePageCheck = currentPageCheck === 'profile.html' && window.location.search.includes('player=');
        if (!isProfilePageCheck && !themeLoaded && auth.currentUser) {
            loadColorTheme();
        }
    }, 500);
    
    // Final fallback: retry after a longer delay
    setTimeout(() => {
        const currentPageCheck = window.location.pathname.split('/').pop() || 'index.html';
        const isProfilePageCheck = currentPageCheck === 'profile.html' && window.location.search.includes('player=');
        if (!isProfilePageCheck && !themeLoaded && auth.currentUser) {
            loadColorTheme();
        }
    }, 2000);
});

// Export for use in profile.js (for immediate theme updates after selection)
export { applyColorTheme };


