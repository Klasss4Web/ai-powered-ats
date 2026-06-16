import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react";
import { AUTH_CONSTANTS, BASE_URL } from "../constants/auth_constants";
import { useAuth } from "./AuthContext";

const FeaturesContext = createContext(null);

export const FeaturesProvider = ({ children }) => {
  const { isAuthenticated, user } = useAuth();
  const [flags, setFlags] = useState({});
  const [loading, setLoading] = useState(true);

  const fetchFlags = useCallback(async () => {
    const token = localStorage.getItem(AUTH_CONSTANTS.TOKEN_KEY);
    if (!token) {
      setFlags({});
      setLoading(false);
      return;
    }
    try {
      const response = await fetch(`${BASE_URL}/features`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setFlags(data.flags || {});
      }
    } catch (err) {
      console.error("Failed to fetch feature flags:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchFlags();
    } else {
      setFlags({});
      setLoading(false);
    }
  }, [isAuthenticated, fetchFlags]);

  const isEnabled = useCallback(
    (flagKey) => {
      // Not configured = enabled by default (fail-open)
      if (!flags || !(flagKey in flags)) return true;
      return !!flags[flagKey]?.enabled;
    },
    [flags],
  );

  const getVariant = useCallback(
    (flagKey) => {
      if (!flags || !(flagKey in flags)) return "control";
      const variant = flags[flagKey]?.variant;
      return variant || "control";
    },
    [flags],
  );

  const refreshFlags = useCallback(() => {
    fetchFlags();
  }, [fetchFlags]);

  return (
    <FeaturesContext.Provider
      value={{ flags, loading, isEnabled, getVariant, refreshFlags }}
    >
      {children}
    </FeaturesContext.Provider>
  );
};

export const useFeatures = () => {
  const ctx = useContext(FeaturesContext);
  if (!ctx) {
    throw new Error("useFeatures must be used within a FeaturesProvider");
  }
  return ctx;
};
