export const sessionStorageUtil = {
  set(key, value) {
    try {
      const data = JSON.stringify(value);
      sessionStorage.setItem(key, data);
    } catch (error) {
      console.error(`Error setting sessionStorage key "${key}":`, error);
    }
  },

  get(key, defaultValue = null) {
    try {
      const data = sessionStorage.getItem(key);
      return data ? JSON.parse(data) : defaultValue;
    } catch (error) {
      console.error(`Error parsing sessionStorage key "${key}":`, error);
      return defaultValue;
    }
  },

  remove(key) {
    try {
      sessionStorage.removeItem(key);
    } catch (error) {
      console.error(`Error removing sessionStorage key "${key}":`, error);
    }
  },

  clear() {
    try {
      sessionStorage.clear();
    } catch (error) {
      console.error('Error clearing sessionStorage:', error);
    }
  },
};
