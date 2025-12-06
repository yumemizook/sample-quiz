import {
  getAuth,
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup
} from "./firebase.js";
import { getFirestore, doc, setDoc, getDoc } from "./firebase.js";
const auth = getAuth();
const signupForm = document.getElementById("signup");

signupForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = signupForm.email.value.trim();
  const password = signupForm.pw.value;
  const repeatPassword = signupForm.rpw.value;
  const validEmail = email.includes("@") && email.includes(".");
  const validPassword =
    password.length >= 6 && /[A-Za-z]/.test(password) && /\d/.test(password);
  if (password !== repeatPassword) {
    alert("Please make sure the passwords match.");
    return;
  } else if (!validEmail) {
    alert("Please enter a valid email address.");
    return;
  } else if (!validPassword) {
    alert(
      "Password must be at least 6 characters long and contain both letters and numbers."
    );
    return;
  } else
    await createUserWithEmailAndPassword(auth, email, password)
      .then(async (userCredential) => {
        const user = userCredential.user;
        const db = getFirestore();
        // Mark as new user and set account creation timestamp
        const userProfileRef = doc(db, 'userProfiles', user.uid);
        await setDoc(userProfileRef, { 
          hasSeenIntro: false,
          createdAt: new Date().toISOString()
        }, { merge: true });
        alert("Account created successfully! Redirecting to introduction...");
        window.location.href = "introduction.html";
        console.log("User created:", user);
      })
      .catch((error) => {
        const errorCode = error.code;
        const errorMessage = error.message;
        console.error("Error creating user:", errorCode, errorMessage);
        switch (errorCode) {
          case "auth/email-already-in-use":
            alert(
              "This email is already in use. If you are the owner of this email, try resetting your password."
            );
            break;
          case "auth/invalid-email":
            alert(
              "The email address is not valid. Please enter a valid email address."
            );
            break;
        }
      });
});

const googleButton = document.getElementById("googlelog");
googleButton.addEventListener("click", async () => {
    const provider = new GoogleAuthProvider();
    try {
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        const credential = GoogleAuthProvider.credentialFromResult(result);
        const db = getFirestore();
        // Check if this is a new user (first time signing in)
        const userProfileRef = doc(db, 'userProfiles', user.uid);
        const userProfileSnap = await getDoc(userProfileRef);
        if (!userProfileSnap.exists() || !userProfileSnap.data().hasSeenIntro) {
            await setDoc(userProfileRef, { 
              hasSeenIntro: false,
              createdAt: new Date().toISOString()
            }, { merge: true });
            window.location.href = "introduction.html";
        } else {
            // Backfill createdAt if it doesn't exist
            if (!userProfileSnap.data().createdAt) {
              await setDoc(userProfileRef, { 
                createdAt: new Date().toISOString()
              }, { merge: true });
            }
            window.location.href = "index.html";
        }
        console.log("User signed in with Google:", user);
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