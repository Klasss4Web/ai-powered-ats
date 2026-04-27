import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { BASE_URL } from "../constants/auth_constants";

const ResetPasswordPage = () => {
  const [searchParams] = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");

  // const BASE_URL =
  //   "http://ats-matcher-backend-alb-1819594825.eu-west-2.elb.amazonaws.com/api";

  const token = searchParams.get("token");

  useEffect(() => {
    if (!token) {
      setMessage("Invalid reset link. Please request a new password reset.");
    }
  }, [token]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      setMessage("Passwords do not match.");
      return;
    }

    if (password.length < 6) {
      setMessage("Password must be at least 6 characters long.");
      return;
    }

    setIsLoading(true);
    setMessage("");

    try {
      const response = await fetch(`${BASE_URL}/auth/reset-password`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token, new_password: password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to reset password");
      }

      setMessage(
        "Password reset successfully! You can now login with your new password.",
      );

      // Clear form
      setPassword("");
      setConfirmPassword("");
    } catch (error) {
      console.error("Reset password error:", error);
      setMessage(
        error.message || "Failed to reset password. Please try again.",
      );
    } finally {
      setIsLoading(false);
    }
  };

  if (!token) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#f5f5f5",
          padding: "20px",
        }}
      >
        <div
          style={{
            backgroundColor: "#fff",
            borderRadius: "12px",
            boxShadow: "0 10px 40px rgba(0, 0, 0, 0.1)",
            width: "100%",
            maxWidth: "400px",
            padding: "30px",
            textAlign: "center",
          }}
        >
          <h2 style={{ color: "#1a73e8", marginBottom: "20px" }}>
            Invalid Reset Link
          </h2>
          <p style={{ color: "#666", marginBottom: "20px" }}>
            This password reset link is invalid or has expired. Please request a
            new password reset from the login page.
          </p>
          <button
            onClick={() => (window.location.href = "/")}
            style={{
              padding: "12px 24px",
              backgroundColor: "#1a73e8",
              color: "white",
              border: "none",
              borderRadius: "6px",
              cursor: "pointer",
              fontSize: "1em",
            }}
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#f5f5f5",
        padding: "20px",
      }}
    >
      <div
        style={{
          backgroundColor: "#fff",
          borderRadius: "12px",
          boxShadow: "0 10px 40px rgba(0, 0, 0, 0.1)",
          width: "100%",
          maxWidth: "400px",
          padding: "30px",
        }}
      >
        <h2
          style={{
            textAlign: "center",
            color: "#1a73e8",
            marginBottom: "10px",
            marginTop: "0",
          }}
        >
          Reset Password
        </h2>
        <p
          style={{
            textAlign: "center",
            color: "#666",
            marginBottom: "25px",
            fontSize: "0.9em",
          }}
        >
          Enter your new password below.
        </p>

        {message && (
          <div
            style={{
              padding: "10px",
              marginBottom: "20px",
              borderRadius: "6px",
              backgroundColor: message.includes("successfully")
                ? "#d4edda"
                : "#f8d7da",
              color: message.includes("successfully") ? "#155724" : "#721c24",
              border: `1px solid ${
                message.includes("successfully") ? "#c3e6cb" : "#f5c6cb"
              }`,
            }}
          >
            {message}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: "15px" }}>
            <label
              style={{
                display: "block",
                marginBottom: "5px",
                color: "#333",
                fontWeight: "500",
              }}
            >
              New Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={{
                width: "100%",
                padding: "12px",
                border: "1px solid #ddd",
                borderRadius: "6px",
                fontSize: "1em",
                boxSizing: "border-box",
              }}
              placeholder="Enter new password"
              minLength="6"
            />
          </div>

          <div style={{ marginBottom: "20px" }}>
            <label
              style={{
                display: "block",
                marginBottom: "5px",
                color: "#333",
                fontWeight: "500",
              }}
            >
              Confirm Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              style={{
                width: "100%",
                padding: "12px",
                border: "1px solid #ddd",
                borderRadius: "6px",
                fontSize: "1em",
                boxSizing: "border-box",
              }}
              placeholder="Confirm new password"
              minLength="6"
            />
          </div>

          <button
            type="submit"
            disabled={isLoading}
            style={{
              width: "100%",
              padding: "12px",
              backgroundColor: isLoading ? "#ccc" : "#1a73e8",
              color: "white",
              border: "none",
              borderRadius: "6px",
              fontSize: "1em",
              cursor: isLoading ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
            }}
          >
            {isLoading && (
              <div
                className="spinner"
                style={{ width: "16px", height: "16px" }}
              />
            )}
            {isLoading ? "Resetting..." : "Reset Password"}
          </button>
        </form>

        <p
          style={{
            textAlign: "center",
            marginTop: "15px",
            fontSize: "0.8em",
            color: "#666",
          }}
        >
          Remember your password?{" "}
          <button
            onClick={() => (window.location.href = "/")}
            style={{
              background: "none",
              border: "none",
              color: "#1a73e8",
              cursor: "pointer",
              textDecoration: "underline",
              fontSize: "0.8em",
            }}
          >
            Login
          </button>
        </p>
      </div>
    </div>
  );
};

export default ResetPasswordPage;
