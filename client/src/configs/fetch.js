import { AUTH_CONSTANTS } from "../constants/auth_constants";

// const BASE_URL =
//   "http://ats-matcher-backend-alb-1819594825.eu-west-2.elb.amazonaws.com/api";

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
