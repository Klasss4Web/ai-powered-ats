import { useState } from "react";
import { AUTH_CONSTANTS } from "../../constants/auth_constants";

const LoginModal = ({ isOpen, onClose, onLogin }) => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [isForgotLoading, setIsForgotLoading] = useState(false);
  const [isRegister, setIsRegister] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    // Basic form validation
    if (!email.trim()) {
      if (window.showToast) {
        window.showToast("Please enter your email address.", "error");
      }
      setIsLoading(false);
      return;
    }

    if (!password.trim()) {
      if (window.showToast) {
        window.showToast("Please enter your password.", "error");
      }
      setIsLoading(false);
      return;
    }

    if (isRegister && !name.trim()) {
      if (window.showToast) {
        window.showToast("Please enter your full name.", "error");
      }
      setIsLoading(false);
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      if (window.showToast) {
        window.showToast("Please enter a valid email address.", "error");
      }
      setIsLoading(false);
      return;
    }

    try {
      const endpoint = isRegister ? "register" : "login";
      const body = isRegister ? { email, password, name } : { email, password };

      const response = await fetch(
        `http://127.0.0.1:5000/api/auth/${endpoint}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.error || `${isRegister ? "Registration" : "Login"} failed`,
        );
      }

      // Store the token
      localStorage.setItem(AUTH_CONSTANTS.TOKEN_KEY, data.token);

      // Show success message
      if (window.showToast) {
        const successMessage = isRegister
          ? `Account created successfully! Welcome, ${data.user.name}!`
          : `Welcome back, ${data.user.name}!`;
        window.showToast(successMessage, "success");
      }

      onLogin(data.user);
      setIsLoading(false);
      setEmail("");
      setPassword("");
      setName("");
      setIsRegister(false);
    } catch (error) {
      console.error(`${isRegister ? "Registration" : "Login"} error:`, error);

      // Provide user-friendly error messages
      let errorMessage = error.message;

      if (error.message.includes("fetch")) {
        errorMessage =
          "Network error. Please check your connection and try again.";
      } else if (error.message.includes("400")) {
        errorMessage = isRegister
          ? "This email is already registered. Please try logging in instead."
          : "Invalid email or password. Please check your credentials.";
      } else if (error.message.includes("401")) {
        errorMessage =
          "Invalid credentials. Please check your email and password.";
      } else if (error.message.includes("500")) {
        errorMessage = "Server error. Please try again later.";
      } else if (
        !errorMessage ||
        errorMessage === `${isRegister ? "Registration" : "Login"} failed`
      ) {
        errorMessage = `${
          isRegister ? "Registration" : "Login"
        } failed. Please try again.`;
      }

      // Use the global toast function
      if (window.showToast) {
        window.showToast(errorMessage, "error");
      }

      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    setIsForgotLoading(true);

    try {
      const response = await fetch(
        "http://127.0.0.1:5000/api/auth/forgot-password",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ email: forgotEmail }),
        },
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to send reset email");
      }

      // Show success message
      if (window.showToast) {
        window.showToast(
          "If an account with that email exists, a password reset link has been sent.",
          "success",
        );
      }

      setShowForgotPassword(false);
      setForgotEmail("");
    } catch (error) {
      console.error("Forgot password error:", error);

      let errorMessage = error.message;
      if (error.message.includes("fetch")) {
        errorMessage =
          "Network error. Please check your connection and try again.";
      }

      if (window.showToast) {
        window.showToast(errorMessage, "error");
      }
    } finally {
      setIsForgotLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.6)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 1000,
        padding: "20px",
      }}
    >
      <div
        style={{
          backgroundColor: "#fff",
          borderRadius: "12px",
          boxShadow: "0 10px 40px rgba(0, 0, 0, 0.2)",
          width: "100%",
          maxWidth: "400px",
          padding: "30px",
          position: "relative",
        }}
      >
        <button
          onClick={onClose}
          style={{
            position: "absolute",
            top: "15px",
            right: "15px",
            background: "none",
            border: "none",
            fontSize: "1.5em",
            cursor: "pointer",
            color: "#999",
            padding: "0",
            width: "30px",
            height: "30px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "50%",
            transition: "all 0.2s",
          }}
        >
          ✕
        </button>

        <h2
          style={{
            textAlign: "center",
            color: "#1a73e8",
            marginBottom: "10px",
            marginTop: "0",
          }}
        >
          {isRegister ? "Create Account" : "Login Required"}
        </h2>
        <p
          style={{
            textAlign: "center",
            color: "#666",
            marginBottom: "25px",
            fontSize: "0.9em",
          }}
        >
          {isRegister
            ? "Create an account to access ATS analysis features"
            : "Please login to access the ATS analysis features"}
        </p>

        <form onSubmit={handleSubmit}>
          {isRegister && (
            <div style={{ marginBottom: "15px" }}>
              <label
                style={{
                  display: "block",
                  marginBottom: "5px",
                  color: "#333",
                  fontWeight: "500",
                }}
              >
                Full Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                style={{
                  width: "100%",
                  padding: "12px",
                  border: "1px solid #ddd",
                  borderRadius: "6px",
                  fontSize: "1em",
                  boxSizing: "border-box",
                }}
                placeholder="Enter your full name"
              />
            </div>
          )}

          <div style={{ marginBottom: "15px" }}>
            <label
              style={{
                display: "block",
                marginBottom: "5px",
                color: "#333",
                fontWeight: "500",
              }}
            >
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={{
                width: "100%",
                padding: "12px",
                border: "1px solid #ddd",
                borderRadius: "6px",
                fontSize: "1em",
                boxSizing: "border-box",
              }}
              placeholder="Enter your email"
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
              Password
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
              placeholder="Enter your password"
            />
            {!isRegister && (
              <button
                type="button"
                onClick={() => setShowForgotPassword(true)}
                style={{
                  background: "none",
                  border: "none",
                  color: "#1a73e8",
                  cursor: "pointer",
                  textDecoration: "underline",
                  fontSize: "0.8em",
                  marginTop: "5px",
                  padding: "0",
                }}
              >
                Forgot Password?
              </button>
            )}
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
            {isLoading
              ? isRegister
                ? "Creating Account..."
                : "Logging in..."
              : isRegister
                ? "Create Account"
                : "Login"}
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
          {isRegister ? "Already have an account?" : "Don't have an account?"}{" "}
          <button
            onClick={() => setIsRegister(!isRegister)}
            style={{
              background: "none",
              border: "none",
              color: "#1a73e8",
              cursor: "pointer",
              textDecoration: "underline",
              fontSize: "0.8em",
            }}
          >
            {isRegister ? "Login" : "Register"}
          </button>
        </p>
      </div>

      {/* Forgot Password Modal */}
      {showForgotPassword && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.6)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            zIndex: 1001,
            padding: "20px",
          }}
        >
          <div
            style={{
              backgroundColor: "#fff",
              borderRadius: "12px",
              boxShadow: "0 10px 40px rgba(0, 0, 0, 0.2)",
              width: "100%",
              maxWidth: "400px",
              padding: "30px",
              position: "relative",
            }}
          >
            <button
              onClick={() => {
                setShowForgotPassword(false);
                setForgotEmail("");
              }}
              style={{
                position: "absolute",
                top: "15px",
                right: "15px",
                background: "none",
                border: "none",
                fontSize: "1.5em",
                cursor: "pointer",
                color: "#999",
                padding: "0",
                width: "30px",
                height: "30px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "50%",
                transition: "all 0.2s",
              }}
            >
              ✕
            </button>

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
              Enter your email address and we'll send you a link to reset your
              password.
            </p>

            <form onSubmit={handleForgotPassword}>
              <div style={{ marginBottom: "20px" }}>
                <label
                  style={{
                    display: "block",
                    marginBottom: "5px",
                    color: "#333",
                    fontWeight: "500",
                  }}
                >
                  Email
                </label>
                <input
                  type="email"
                  value={forgotEmail}
                  onChange={(e) => setForgotEmail(e.target.value)}
                  required
                  style={{
                    width: "100%",
                    padding: "12px",
                    border: "1px solid #ddd",
                    borderRadius: "6px",
                    fontSize: "1em",
                    boxSizing: "border-box",
                  }}
                  placeholder="Enter your email"
                />
              </div>

              <button
                type="submit"
                disabled={isForgotLoading}
                style={{
                  width: "100%",
                  padding: "12px",
                  backgroundColor: isForgotLoading ? "#ccc" : "#1a73e8",
                  color: "white",
                  border: "none",
                  borderRadius: "6px",
                  fontSize: "1em",
                  cursor: isForgotLoading ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                }}
              >
                {isForgotLoading && (
                  <div
                    className="spinner"
                    style={{ width: "16px", height: "16px" }}
                  />
                )}
                {isForgotLoading ? "Sending..." : "Send Reset Link"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default LoginModal;
