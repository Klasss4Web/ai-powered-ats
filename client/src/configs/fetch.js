import { AUTH_CONSTANTS } from "../constants/auth_constants";

const fetchWithTimeout = async (url, options = {}, timeout = 100000) => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);

  const token = localStorage.getItem(AUTH_CONSTANTS.TOKEN_KEY);

  const headers = {
    ...(options.headers || {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  try {
    return await fetch(url, {
      ...options,
      headers,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(id);
  }
};
export default fetchWithTimeout;
