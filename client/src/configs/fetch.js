import { AUTH_CONSTANTS } from "../constants/auth_constants";

const BASE_URL =
  import.meta.env.VITE_API_BASE_URL ||
  "http://ats-matcher-backend-alb-1819594825.eu-west-2.elb.amazonaws.com/api";

/**
 * Centralised fetch wrapper:
 *   • Injects Bearer token automatically
 *   • Enforces a timeout via AbortController
 *   • On 401 → clears auth and reloads (or calls the optional onAuthExpired callback)
 *   • Logs API failures to the backend so they are visible in server logs
 */
const fetchWithTimeout = async (
  url,
  options = {},
  timeout = 100000,
  { onAuthExpired } = {},
) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  const token = localStorage.getItem(AUTH_CONSTANTS.TOKEN_KEY);

  const headers = {
    ...(options.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  // Only default to JSON content-type when the caller didn't supply one
  // and the body isn't FormData (browser needs to set the multipart boundary).
  if (!headers["Content-Type"] && !(options.body instanceof FormData)) {
    headers["Content-Type"] = "application/json";
  }

  const isFullUrl = url.startsWith("http");
  const finalUrl = isFullUrl ? url : `${BASE_URL}${url}`;

  try {
    const response = await fetch(finalUrl, {
      ...options,
      headers,
      signal: controller.signal,
    });

    if (response.status === 401) {
      localStorage.removeItem(AUTH_CONSTANTS.TOKEN_KEY);
      if (onAuthExpired) {
        onAuthExpired();
      } else {
        window.location.reload();
      }
      throw new Error("Session expired. Please log in again.");
    }

    return response;
  } catch (error) {
    /* ── log non-abort failures to the backend ── */
    if (error.name !== "AbortError") {
      try {
        await fetch(`${BASE_URL}/log-frontend-error`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            endpoint: finalUrl,
            message: error.message || "Network error",
            stack: error.stack || "",
          }),
        });
      } catch {
        /* silent — logging must never crash the app */
      }
    }
    throw error;
  } finally {
    clearTimeout(id);
  }
};

export default fetchWithTimeout;
