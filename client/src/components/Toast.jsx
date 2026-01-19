import { useState, useEffect } from "react";

const Toast = ({ message, type = "error", onClose, duration = 5000 }) => {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 300); // Allow fade out animation
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const getTypeStyles = (type) => {
    switch (type) {
      case "error":
        return {
          backgroundColor: "#fee2e2",
          borderColor: "#fecaca",
          color: "#dc2626",
          icon: "❌",
        };
      case "success":
        return {
          backgroundColor: "#d1fae5",
          borderColor: "#a7f3d0",
          color: "#059669",
          icon: "✅",
        };
      case "warning":
        return {
          backgroundColor: "#fef3c7",
          borderColor: "#fde68a",
          color: "#d97706",
          icon: "⚠️",
        };
      default: // info
        return {
          backgroundColor: "#dbeafe",
          borderColor: "#bfdbfe",
          color: "#2563eb",
          icon: "ℹ️",
        };
    }
  };

  const styles = getTypeStyles(type);

  if (!isVisible) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: "20px",
        right: "20px",
        zIndex: 9999,
        minWidth: "300px",
        maxWidth: "500px",
        padding: "16px",
        backgroundColor: styles.backgroundColor,
        border: `1px solid ${styles.borderColor}`,
        borderRadius: "8px",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.15)",
        display: "flex",
        alignItems: "flex-start",
        gap: "12px",
        fontSize: "14px",
        lineHeight: "1.4",
        color: styles.color,
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? "translateX(0)" : "translateX(100%)",
        transition: "all 0.3s ease-in-out",
      }}
    >
      <span style={{ fontSize: "18px", flexShrink: 0 }}>{styles.icon}</span>

      <div style={{ flex: 1 }}>{message}</div>

      <button
        onClick={() => {
          setIsVisible(false);
          setTimeout(onClose, 300);
        }}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          fontSize: "18px",
          color: styles.color,
          opacity: 0.7,
          padding: "0",
          width: "20px",
          height: "20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
        }}
        onMouseEnter={(e) => (e.target.style.opacity = "1")}
        onMouseLeave={(e) => (e.target.style.opacity = "0.7")}
      >
        ×
      </button>
    </div>
  );
};

export default Toast;
