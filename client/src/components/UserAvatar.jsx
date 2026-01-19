import { useState, useEffect, useRef } from "react";

const UserAvatar = ({ user, onLogout }) => {
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div ref={dropdownRef} style={{ position: "relative" }}>
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: "5px",
          borderRadius: "50%",
          transition: "all 0.2s",
        }}
      >
        <img
          src={user.avatar}
          alt={user.name}
          style={{
            width: "40px",
            height: "40px",
            borderRadius: "50%",
            border: "2px solid #1a73e8",
          }}
        />
      </button>

      {showDropdown && (
        <div
          style={{
            position: "absolute",
            top: "50px",
            right: "0",
            backgroundColor: "#fff",
            borderRadius: "8px",
            boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
            padding: "10px",
            minWidth: "150px",
            zIndex: 1000,
          }}
        >
          <div
            style={{
              padding: "8px 12px",
              borderBottom: "1px solid #eee",
              marginBottom: "8px",
            }}
          >
            <div style={{ fontWeight: "bold", color: "#333" }}>{user.name}</div>
            <div style={{ fontSize: "0.8em", color: "#666" }}>{user.email}</div>
          </div>
          <button
            onClick={() => {
              onLogout();
              setShowDropdown(false);
            }}
            style={{
              width: "100%",
              padding: "8px 12px",
              backgroundColor: "#f44336",
              color: "white",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "0.9em",
            }}
          >
            Logout
          </button>
        </div>
      )}
    </div>
  );
};

export default UserAvatar;
