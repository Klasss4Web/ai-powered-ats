import { useState, useCallback } from "react";
import Toast from "./Toast";

let toastId = 0;

const ToastContainer = () => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = "error", duration = 5000) => {
    const id = ++toastId;
    const toast = { id, message, type, duration };

    setToasts((prevToasts) => [...prevToasts, toast]);

    return id;
  }, []);

  const removeToast = useCallback((id) => {
    setToasts((prevToasts) => prevToasts.filter((toast) => toast.id !== id));
  }, []);

  // Expose addToast globally for easy access
  window.showToast = addToast;

  return (
    <div style={{ position: "fixed", top: 0, right: 0, zIndex: 9999 }}>
      {toasts.map((toast, index) => (
        <div
          key={toast.id}
          style={{
            marginBottom: "10px",
            transform: `translateY(${index * 10}px)`,
            transition: "transform 0.3s ease-in-out",
          }}
        >
          <Toast
            message={toast.message}
            type={toast.type}
            onClose={() => removeToast(toast.id)}
            duration={toast.duration}
          />
        </div>
      ))}
    </div>
  );
};

export default ToastContainer;
