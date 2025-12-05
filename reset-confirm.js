import {
    getAuth,
    confirmPasswordReset
} from "./firebase.js";

const auth = getAuth();
const resetConfirmForm = document.getElementById("resetConfirmForm");
const statusMessage = document.getElementById("statusMessage");

// Get the action code from URL parameters
const urlParams = new URLSearchParams(window.location.search);
const actionCode = urlParams.get('oobCode');
const mode = urlParams.get('mode');

function showMessage(message, isError = false) {
    statusMessage.textContent = message;
    statusMessage.className = `status-message ${isError ? 'error' : 'success'}`;
    statusMessage.style.display = "block";
    
    // Hide message after 5 seconds for success, 10 seconds for errors
    setTimeout(() => {
        statusMessage.style.display = "none";
    }, isError ? 10000 : 5000);
}

// Check if we have a valid reset code
if (!actionCode || mode !== 'resetPassword') {
    showMessage("Invalid or missing reset link. Please request a new password reset.", true);
    resetConfirmForm.style.display = "none";
}

resetConfirmForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const password = resetConfirmForm.password.value;
    const confirmPassword = resetConfirmForm.confirmPassword.value;
    
    // Validate passwords match
    if (password !== confirmPassword) {
        showMessage("Passwords do not match. Please try again.", true);
        return;
    }
    
    // Validate password length
    if (password.length < 6) {
        showMessage("Password must be at least 6 characters long.", true);
        return;
    }
    
    // Disable form during submission
    const submitButton = resetConfirmForm.querySelector('input[type="submit"]');
    const originalValue = submitButton.value;
    submitButton.disabled = true;
    submitButton.value = "Resetting...";
    
    try {
        await confirmPasswordReset(auth, actionCode, password);
        showMessage("Password reset successful! Redirecting to login...", false);
        
        // Redirect to login page after 2 seconds
        setTimeout(() => {
            window.location.href = "signin.html";
        }, 2000);
    } catch (error) {
        const errorCode = error.code;
        const errorMessage = error.message;
        
        switch(errorCode) {
            case "auth/expired-action-code":
                showMessage("The password reset link has expired. Please request a new one.", true);
                break;
            case "auth/invalid-action-code":
                showMessage("Invalid reset link. Please request a new password reset.", true);
                break;
            case "auth/weak-password":
                showMessage("Password is too weak. Please choose a stronger password.", true);
                break;
            case "auth/network-request-failed":
                showMessage("Network error. Please check your connection and try again.", true);
                break;
            default:
                showMessage("An error occurred. Please try again or request a new reset link.", true);
                console.error("Error confirming password reset:", errorCode, errorMessage);
        }
        
        submitButton.disabled = false;
        submitButton.value = originalValue;
    }
});

