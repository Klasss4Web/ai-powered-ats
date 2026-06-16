export const AUTH_CONSTANTS = {
  TOKEN_KEY: "authToken",
  USER_ID_KEY: "userId",
  USER_EMAIL_KEY: "userEmail",
};

// BASE_URL is driven by the VITE_API_BASE_URL environment variable.
// Set it in .env.local for local development and in .env.production for production builds.
// Example .env.local:   VITE_API_BASE_URL=http://127.0.0.1:5000/api
// Example .env.production: VITE_API_BASE_URL=https://ai-powered-ats.onrender.com/api
if (!import.meta.env.VITE_API_BASE_URL) {
  console.warn(
    "[ATS Matcher] VITE_API_BASE_URL is not set. " +
    "Create a .env.local file with VITE_API_BASE_URL=http://127.0.0.1:5000/api"
  );
}

export const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:5000/api";
