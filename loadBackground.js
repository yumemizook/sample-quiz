// Load and apply site background on page load
// This can be used on pages that don't import hm.js

import { getAuth, onAuthStateChanged } from "./firebase.js";
import { getFirestore, doc, getDoc } from "./firebase.js";

const auth = getAuth();
const db = getFirestore();

// Apply site background to page
function applySiteBackground(imageURL) {
    // Only apply to non-gameplay pages
    const gameplayPages = ['master.html', 'easy.html', 'normal.html', 'hell.html', 'master130.html', 'secret.html'];
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    
    if (gameplayPages.includes(currentPage)) {
        return; // Don't apply to gameplay pages
    }
    
    if (imageURL) {
        document.body.style.backgroundImage = `url(${imageURL})`;
        document.body.style.backgroundSize = 'cover';
        document.body.style.backgroundPosition = 'center';
        document.body.style.backgroundRepeat = 'no-repeat';
        document.body.style.backgroundAttachment = 'fixed';
    }
}

// Load and apply site background on page load
async function loadSiteBackground() {
    const gameplayPages = ['master.html', 'easy.html', 'normal.html', 'hell.html', 'master130.html', 'secret.html'];
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    
    if (gameplayPages.includes(currentPage)) {
        return; // Don't apply to gameplay pages
    }
    
    try {
        const user = auth.currentUser;
        if (!user) {
            // If no user, check auth state changes
            onAuthStateChanged(auth, async (user) => {
                if (user) {
                    const userProfileRef = doc(db, 'userProfiles', user.uid);
                    const userProfileSnap = await getDoc(userProfileRef);
                    
                    if (userProfileSnap.exists() && userProfileSnap.data().siteBackgroundURL) {
                        const bgURL = userProfileSnap.data().siteBackgroundURL;
                        applySiteBackground(bgURL);
                    }
                }
            });
            return;
        }
        
        const userProfileRef = doc(db, 'userProfiles', user.uid);
        const userProfileSnap = await getDoc(userProfileRef);
        
        if (userProfileSnap.exists() && userProfileSnap.data().siteBackgroundURL) {
            const bgURL = userProfileSnap.data().siteBackgroundURL;
            applySiteBackground(bgURL);
        }
    } catch (error) {
        console.error('Error loading site background:', error);
    }
}

// Load background on page load
document.addEventListener("DOMContentLoaded", () => {
    loadSiteBackground();
    
    // Also listen for auth state changes in case user logs in after page load
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            loadSiteBackground();
        } else {
            // Remove background if user logs out
            const gameplayPages = ['master.html', 'easy.html', 'normal.html', 'hell.html', 'master130.html', 'secret.html'];
            const currentPage = window.location.pathname.split('/').pop() || 'index.html';
            
            if (!gameplayPages.includes(currentPage)) {
                document.body.style.backgroundImage = '';
                document.body.style.backgroundSize = '';
                document.body.style.backgroundPosition = '';
                document.body.style.backgroundRepeat = '';
                document.body.style.backgroundAttachment = '';
            }
        }
    });
});

