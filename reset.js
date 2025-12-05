import {
    getAuth,
    sendPasswordResetEmail
} from "./firebase.js";

const auth = getAuth();
const resetForm = document.getElementById("resetForm");
const statusMessage = document.getElementById("statusMessage");

function showMessage(message, isError = false) {
    statusMessage.textContent = message;
    statusMessage.className = `status-message ${isError ? 'error' : 'success'}`;
    statusMessage.style.display = "block";
    
    // Hide message after 5 seconds
    setTimeout(() => {
        statusMessage.style.display = "none";
    }, 5000);
}

resetForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = resetForm.email.value.trim();
    
    if (!email) {
        showMessage("Please enter your email address.", true);
        return;
    }
    
    // Disable form during submission
    const submitButton = resetForm.querySelector('input[type="submit"]');
    const originalValue = submitButton.value;
    submitButton.disabled = true;
    submitButton.value = "Sending...";
    
    try {
        await sendPasswordResetEmail(auth, email, {
            url: window.location.origin + '/reset-confirm.html',
            handleCodeInApp: false
        });
        showMessage("Password reset email sent! Please check your inbox and follow the instructions to reset your password.", false);
        resetForm.reset();
    } catch (error) {
        const errorCode = error.code;
        const errorMessage = error.message;
        
        switch(errorCode) {
            case "auth/user-not-found":
                showMessage("No account found with this email address. Please check for typos or create a new account.", true);
                break;
            case "auth/invalid-email":
                showMessage("Invalid email address. Please enter a valid email.", true);
                break;
            case "auth/too-many-requests":
                showMessage("Too many requests. Please wait a moment and try again.", true);
                break;
            case "auth/network-request-failed":
                showMessage("Network error. Please check your connection and try again.", true);
                break;
            default:
                showMessage("An error occurred. Please try again later.", true);
                console.error("Error sending password reset email:", errorCode, errorMessage);
        }
    } finally {
        submitButton.disabled = false;
        submitButton.value = originalValue;
    }
});

