const ConfirmModal = ({
  isOpen,
  onClose,
  onConfirm,
  title = "Are you sure?",
  message,
  confirmText = "Confirm",
  confirmColor = "#d93025",
  cancelText = "Cancel",
}) => {
  if (!isOpen) return null;

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
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          backgroundColor: "white",
          borderRadius: "12px",
          padding: "28px",
          maxWidth: "420px",
          width: "90%",
          boxShadow: "0 10px 25px rgba(0, 0, 0, 0.2)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", marginBottom: "16px" }}>
          <span style={{ fontSize: "1.8em", marginRight: "12px" }}>⚠️</span>
          <h3
            style={{
              margin: 0,
              fontSize: "1.25em",
              fontWeight: 700,
              color: "#1e293b",
            }}
          >
            {title}
          </h3>
        </div>
        <p
          style={{
            margin: "0 0 24px 0",
            fontSize: "1em",
            lineHeight: "1.5",
            color: "#475569",
          }}
        >
          {message}
        </p>
        <div style={{ display: "flex", gap: "10px" }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: "11px",
              backgroundColor: "#f1f5f9",
              color: "#475569",
              border: "none",
              borderRadius: "8px",
              fontSize: "0.95em",
              fontWeight: 600,
              cursor: "pointer",
              transition: "background-color 0.15s",
            }}
            onMouseOver={(e) => (e.target.style.backgroundColor = "#e2e8f0")}
            onMouseOut={(e) => (e.target.style.backgroundColor = "#f1f5f9")}
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            style={{
              flex: 1,
              padding: "11px",
              backgroundColor: confirmColor,
              color: "white",
              border: "none",
              borderRadius: "8px",
              fontSize: "0.95em",
              fontWeight: 600,
              cursor: "pointer",
              transition: "background-color 0.15s",
            }}
            onMouseOver={(e) =>
              (e.target.style.backgroundColor = darken(confirmColor))
            }
            onMouseOut={(e) => (e.target.style.backgroundColor = confirmColor)}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

/* helper to darken a hex colour for the hover state */
function darken(hex) {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = Math.max((num >> 16) - 40, 0);
  const g = Math.max(((num >> 8) & 0x00ff) - 40, 0);
  const b = Math.max((num & 0x0000ff) - 40, 0);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

export default ConfirmModal;
