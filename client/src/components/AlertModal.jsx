const AlertModal = ({ isOpen, message, onClose, type = "info" }) => {
  if (!isOpen) return null;

  const getTypeStyles = (type) => {
    switch (type) {
      case "error":
        return {
          backgroundColor: "#fce8e6",
          borderColor: "#d93025",
          color: "#d93025",
          icon: "⚠️",
        };
      case "success":
        return {
          backgroundColor: "#e6f4ea",
          borderColor: "#1e8e3e",
          color: "#1e8e3e",
          icon: "✅",
        };
      case "warning":
        return {
          backgroundColor: "#fff3cd",
          borderColor: "#f57f17",
          color: "#f57f17",
          icon: "⚡",
        };
      default:
        return {
          backgroundColor: "#e3f2fd",
          borderColor: "#1a73e8",
          color: "#1a73e8",
          icon: "ℹ️",
        };
    }
  };

  const styles = getTypeStyles(type);

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 2000,
      }}
    >
      <div
        style={{
          backgroundColor: "white",
          borderRadius: "12px",
          padding: "30px",
          maxWidth: "400px",
          width: "90%",
          boxShadow: "0 10px 25px rgba(0, 0, 0, 0.2)",
          border: `2px solid ${styles.borderColor}`,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            marginBottom: "20px",
          }}
        >
          <span
            style={{
              fontSize: "2em",
              marginRight: "15px",
            }}
          >
            {styles.icon}
          </span>
          <div
            style={{
              backgroundColor: styles.backgroundColor,
              color: styles.color,
              padding: "8px 12px",
              borderRadius: "6px",
              fontWeight: "bold",
              fontSize: "0.9em",
            }}
          >
            {type.toUpperCase()}
          </div>
        </div>
        <p
          style={{
            margin: "0 0 25px 0",
            fontSize: "1.1em",
            lineHeight: "1.5",
            color: "#333",
          }}
        >
          {message}
        </p>
        <button
          onClick={onClose}
          style={{
            width: "100%",
            padding: "12px",
            backgroundColor: styles.borderColor,
            color: "white",
            border: "none",
            borderRadius: "6px",
            fontSize: "1em",
            fontWeight: "bold",
            cursor: "pointer",
            transition: "background-color 0.3s",
          }}
          onMouseOver={(e) => (e.target.style.backgroundColor = styles.color)}
          onMouseOut={(e) =>
            (e.target.style.backgroundColor = styles.borderColor)
          }
        >
          OK
        </button>
      </div>
    </div>
  );
};

export default AlertModal;
