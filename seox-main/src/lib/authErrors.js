// Maps Firebase Auth error codes to friendly user-facing messages.
const map = {
  "auth/email-already-in-use": "An account with this email already exists.",
  "auth/invalid-email": "Please enter a valid email address.",
  "auth/operation-not-allowed": "This sign-in method is currently disabled.",
  "auth/weak-password": "Password should be at least 6 characters.",
  "auth/user-disabled": "This account has been disabled.",
  "auth/user-not-found": "No account found with this email.",
  "auth/wrong-password": "Incorrect password. Please try again.",
  "auth/invalid-credential": "Invalid email or password.",
  "auth/too-many-requests": "Too many attempts. Please try again later.",
  "auth/network-request-failed": "Network error. Check your connection.",
  "auth/popup-closed-by-user": "Sign-in cancelled.",
  "auth/popup-blocked": "Popup was blocked. Please allow popups for this site.",
  "auth/cancelled-popup-request": "Sign-in already in progress.",
  "auth/account-exists-with-different-credential":
    "An account already exists with a different sign-in method.",
  "auth/missing-password": "Please enter your password.",
};

export function getAuthErrorMessage(err) {
  if (!err) return "Something went wrong. Please try again.";
  const code = err.code || err.message || "";
  return map[code] || err.message || "Something went wrong. Please try again.";
}
