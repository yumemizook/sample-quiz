import {
    getAuth,
    signInWithEmailAndPassword,
    GoogleAuthProvider,
    signInWithPopup
} from "./firebase.js";

const auth = getAuth();
const signinForm = document.getElementById("login");

signinForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const email = signinForm.email.value;
    const password = signinForm.pw.value;
await signInWithEmailAndPassword(auth, email, password)
.then((userCredential) => {
    const user = userCredential.user;
    alert("Signed in successfully! Redirecting to home page...");
    window.location.href = "index.html";
    console.log("User signed in:", user);
})
.catch((error) => {
    const errorCode = error.code;
    const errorMessage = error.message;
    switch(errorCode){
        case "auth/wrong-password":
        case "auth/invalid-email":
        case "auth/invalid-login-credentials":
            alert("Invalid email or password. Please double check and try again.");
        case "auth/user-not-found":
            alert("No account found with this email. Check for typos or create a new account.");
        case "auth/too-many-requests":
            alert("Too many failed attempts. You have been rate limited. Please try again later.");
            break;
        default:
            alert("An unexpected error occurred. Please try again later.");
            console.error("Error signing in:", errorCode, errorMessage);
    }
}
);
});

const googleButton = document.getElementById("googlelog");
googleButton.addEventListener("click", async () => {
    const provider = new GoogleAuthProvider();
    try {
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        const credential = GoogleAuthProvider.credentialFromResult(result);
        console.log("User signed in with Google:", user);
        window.location.href = "index.html";
    } catch (error) {
        const errorCode = error.code;
const errorMessage = error.message;
switch (errorCode) {
            case "auth/popup-closed-by-user":
                alert("Popup closed by user. Please avoid closing the popup during sign-in.");
                break;
            case "auth/cancelled-popup-request":
                alert("Popup request cancelled. Please try again.");
                break;
            default:
                console.error("Error signing in with Google:", errorCode, errorMessage);
                alert("An error occurred while signing in with Google. Please try again.");
        }
    }
});