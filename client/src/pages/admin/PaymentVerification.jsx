import { useState } from "react";
import { BASE_URL } from "../../constants/auth_constants";
import fetchWithTimeout from "../../configs/fetch";

const PaymentVerification = () => {
  const [reference, setReference] = useState("");
  const [gateway, setGateway] = useState("paystack");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const handleVerify = async (e) => {
    e.preventDefault();
    if (!reference.trim()) return;
    setLoading(true);
    setResult(null);
    try {
      const response = await fetchWithTimeout(
        `/payment/manual-verify/${encodeURIComponent(reference.trim())}`,
        {
          method: "POST",
          body: JSON.stringify({ gateway }),
        },
      );
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        setResult({ type: "success", message: "Payment verified successfully!", data });
        if (window.showToast) {
          window.showToast("Payment verified successfully!", "success");
        }
      } else {
        setResult({ type: "error", message: data.error || "Verification failed." });
        if (window.showToast) {
          window.showToast(data.error || "Verification failed.", "error");
        }
      }
    } catch (err) {
      console.error("Payment verification error:", err);
      setResult({ type: "error", message: "Network error. Please try again." });
      if (window.showToast) {
        window.showToast("Network error. Please try again.", "error");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <h1 style={styles.title}>Payment Verification</h1>
        <p style={styles.subtitle}>
          Manually verify Paystack or PayPal payments by reference.
        </p>
      </div>

      <div style={styles.card}>
        <form onSubmit={handleVerify} style={styles.form}>
          <div style={styles.field}>
            <label style={styles.label}>Reference / Transaction ID</label>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="e.g. 9vbjhdc02o"
              required
              style={styles.input}
            />
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Gateway</label>
            <select
              value={gateway}
              onChange={(e) => setGateway(e.target.value)}
              style={styles.input}
            >
              <option value="paystack">Paystack</option>
              <option value="paypal">PayPal</option>
            </select>
          </div>

          <button
            type="submit"
            disabled={loading || !reference.trim()}
            style={{
              ...styles.btn,
              opacity: loading || !reference.trim() ? 0.6 : 1,
              cursor: loading || !reference.trim() ? "not-allowed" : "pointer",
            }}
          >
            {loading ? "Verifying..." : "Verify Payment"}
          </button>
        </form>

        {result && (
          <div
            style={{
              marginTop: "20px",
              padding: "16px",
              borderRadius: "8px",
              backgroundColor: result.type === "success" ? "#e6f4ea" : "#fce8e6",
              color: result.type === "success" ? "#1e8e3e" : "#d93025",
            }}
          >
            <strong>{result.type === "success" ? "Success" : "Error"}</strong>
            <p style={{ margin: "4px 0 0 0" }}>{result.message}</p>
            {result.data && (
              <pre
                style={{
                  marginTop: "10px",
                  padding: "10px",
                  backgroundColor: "#fff",
                  borderRadius: "6px",
                  fontSize: "12px",
                  overflowX: "auto",
                }}
              >
                {JSON.stringify(result.data, null, 2)}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

const styles = {
  container: {
    maxWidth: "600px",
    margin: "0 auto",
  },
  header: {
    marginBottom: "28px",
  },
  title: {
    color: "#e2e8f0",
    fontSize: "28px",
    fontWeight: "600",
    margin: 0,
  },
  subtitle: {
    color: "#94a3b8",
    fontSize: "14px",
    marginTop: "8px",
  },
  card: {
    backgroundColor: "#1e293b",
    borderRadius: "12px",
    border: "1px solid rgba(148, 163, 184, 0.1)",
    padding: "24px",
  },
  form: {
    display: "flex",
    flexDirection: "column",
    gap: "16px",
  },
  field: {
    display: "flex",
    flexDirection: "column",
    gap: "6px",
  },
  label: {
    color: "#94a3b8",
    fontSize: "13px",
    fontWeight: "500",
  },
  input: {
    padding: "10px 14px",
    backgroundColor: "#0f172a",
    color: "#e2e8f0",
    border: "1px solid rgba(148, 163, 184, 0.2)",
    borderRadius: "8px",
    fontSize: "14px",
    outline: "none",
    width: "100%",
    boxSizing: "border-box",
  },
  btn: {
    padding: "12px",
    backgroundColor: "#38bdf8",
    color: "#0f172a",
    border: "none",
    borderRadius: "8px",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer",
    marginTop: "4px",
  },
};

export default PaymentVerification;
