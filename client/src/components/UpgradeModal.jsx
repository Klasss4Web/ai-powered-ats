import { useState } from "react";

const UpgradeModal = ({
  isOpen,
  onClose,
  modalData,
  onPayAsYouGo,
  onUpgradeToPremium,
}) => {
  const [loadingPayment, setLoadingPayment] = useState(false);
  const [selectedGateway, setSelectedGateway] = useState("paystack");
  const [manualReference, setManualReference] = useState("");
  const [manualGateway, setManualGateway] = useState("paystack");
  const [loadingManual, setLoadingManual] = useState(false);
  const [premiumGateway, setPremiumGateway] = useState("paystack");
  const [premiumPlan, setPremiumPlan] = useState("monthly");
  const [loadingPremium, setLoadingPremium] = useState(false);

  if (!isOpen || !modalData) return null;

  const { subscriptionType, currentUsage, dailyLimit, isExpired } = modalData;

  const handlePayAsYouGo = async () => {
    setLoadingPayment(true);
    try {
      await onPayAsYouGo(selectedGateway);
      onClose();
    } catch (error) {
      console.error("Payment failed:", error);
      // Error handling will be done in the parent component
    } finally {
      setLoadingPayment(false);
    }
  };

  const handleManualVerify = async () => {
    if (!manualReference.trim()) return;

    setLoadingManual(true);
    try {
      const token = localStorage.getItem("authToken");
      const response = await fetch(
        `http://127.0.0.1:5000/api/payment/manual-verify/${manualReference}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ gateway: manualGateway }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        alert(
          "Payment verified successfully! Your usage limit has been updated."
        );
        setManualReference("");
        // Refresh usage data in parent component
        if (window.location.reload) {
          window.location.reload();
        }
      } else {
        const error = await response.json();
        alert(`Verification failed: ${error.error || "Unknown error"}`);
      }
    } catch (error) {
      console.error("Manual verification error:", error);
      alert("Verification failed. Check console for details.");
    } finally {
      setLoadingManual(false);
    }
  };

  const handlePremiumUpgrade = async () => {
    setLoadingPremium(true);
    try {
      await onUpgradeToPremium(premiumPlan, premiumGateway);
      onClose();
    } catch (error) {
      console.error("Premium upgrade failed:", error);
      // Error handling will be done in the parent component
    } finally {
      setLoadingPremium(false);
    }
  };

  const getMessage = () => {
    if (isExpired) {
      return "Your premium subscription has expired. Choose an option below to continue.";
    }
    if (subscriptionType === "free") {
      return "You've reached your free limit. Pay as you go to continue analyzing resumes.";
    }
    return `You've reached your daily limit of ${dailyLimit} analyses.`;
  };

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
          maxWidth: "500px",
          padding: "30px",
          position: "relative",
          maxHeight: "98vh",
          overflowY: "auto",
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
            fontSize: "24px",
            cursor: "pointer",
            color: "#666",
            padding: "0",
            width: "32px",
            height: "32px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: "50%",
            transition: "all 0.2s",
          }}
          onMouseEnter={(e) => {
            e.target.style.backgroundColor = "#f0f0f0";
            e.target.style.color = "#333";
          }}
          onMouseLeave={(e) => {
            e.target.style.backgroundColor = "transparent";
            e.target.style.color = "#666";
          }}
        >
          ×
        </button>

        <div style={{ textAlign: "center", marginBottom: "20px" }}>
          <div
            style={{
              fontSize: "30px",
              marginBottom: "10px",
            }}
          >
            🚀
          </div>
          <h2
            style={{
              color: "#1a73e8",
              marginBottom: "10px",
              marginTop: "0",
            }}
          >
            Continue Your Analysis
          </h2>
          <p
            style={{
              color: "#666",
              marginBottom: "20px",
              fontSize: "16px",
              lineHeight: "1.5",
            }}
          >
            {getMessage()}
          </p>
        </div>

        <div style={{ marginBottom: "20px" }}>
          {/* Pay as you go option */}
          <div
            style={{
              border: "2px solid #007bff",
              borderRadius: "8px",
              padding: "20px",
              marginBottom: "16px",
              backgroundColor: "#f8f9ff",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "12px",
              }}
            >
              <div>
                <h3 style={{ margin: "0 0 4px 0", color: "#007bff" }}>
                  Pay as You Go
                </h3>
                <p style={{ margin: "0", color: "#666", fontSize: "14px" }}>
                  One-time payment for this analysis
                </p>
              </div>
              <div
                style={{
                  fontSize: "24px",
                  fontWeight: "bold",
                  color: "#007bff",
                }}
              >
                {selectedGateway === "paypal" ? "$1" : "₦1000"}
              </div>
            </div>
            {/* Payment Gateway Selection */}
            <div style={{ marginBottom: "12px" }}>
              <p
                style={{ margin: "0 0 8px 0", fontSize: "14px", color: "#666" }}
              >
                Choose payment method:
              </p>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  onClick={() => setSelectedGateway("paystack")}
                  style={{
                    flex: 1,
                    padding: "8px",
                    border:
                      selectedGateway === "paystack"
                        ? "2px solid #007bff"
                        : "1px solid #ddd",
                    backgroundColor:
                      selectedGateway === "paystack" ? "#f8f9ff" : "white",
                    color: selectedGateway === "paystack" ? "#007bff" : "#666",
                    borderRadius: "4px",
                    fontSize: "14px",
                    cursor: "pointer",
                  }}
                >
                  Paystack (₦)
                </button>
                <button
                  onClick={() => setSelectedGateway("paypal")}
                  style={{
                    flex: 1,
                    padding: "8px",
                    border:
                      selectedGateway === "paypal"
                        ? "2px solid #007bff"
                        : "1px solid #ddd",
                    backgroundColor:
                      selectedGateway === "paypal" ? "#f8f9ff" : "white",
                    color: selectedGateway === "paypal" ? "#007bff" : "#666",
                    borderRadius: "4px",
                    fontSize: "14px",
                    cursor: "pointer",
                  }}
                >
                  PayPal ($)
                </button>
              </div>
            </div>
            <button
              onClick={handlePayAsYouGo}
              disabled={loadingPayment}
              style={{
                width: "100%",
                padding: "12px",
                backgroundColor: loadingPayment ? "#ccc" : "#007bff",
                color: "white",
                border: "none",
                borderRadius: "6px",
                fontSize: "16px",
                cursor: loadingPayment ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                fontWeight: "500",
              }}
            >
              {loadingPayment && (
                <div
                  className="spinner"
                  style={{ width: "16px", height: "16px" }}
                />
              )}
              {loadingPayment
                ? "Processing..."
                : `Pay ${
                    selectedGateway === "paypal" ? "$1" : "₦1000"
                  } & Continue`}
            </button>
          </div>

          {/* Premium upgrade option */}
          <div
            style={{
              border: "1px solid #e9ecef",
              borderRadius: "8px",
              padding: "20px",
              backgroundColor: "#f8f9fa",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "12px",
              }}
            >
              <div>
                <h3 style={{ margin: "0 0 4px 0", color: "#28a745" }}>
                  Premium Plan
                </h3>
                <p style={{ margin: "0", color: "#666", fontSize: "14px" }}>
                  Unlimited analyses + priority support
                </p>
              </div>
              <div
                style={{
                  fontSize: "18px",
                  fontWeight: "bold",
                  color: "#28a745",
                }}
              >
                {premiumPlan === "monthly"
                  ? premiumGateway === "paypal"
                    ? "$15"
                    : "₦15,000"
                  : premiumGateway === "paypal"
                  ? "$180"
                  : "₦180,000"}
                <span style={{ fontSize: "14px", fontWeight: "normal" }}>
                  /{premiumPlan === "monthly" ? "month" : "year"}
                </span>
              </div>
            </div>

            {/* Plan Selection */}
            <div style={{ marginBottom: "12px" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "8px",
                }}
              >
                <p style={{ margin: "0", fontSize: "14px", color: "#666" }}>
                  Billing cycle:
                </p>
                <div
                  style={{ display: "flex", alignItems: "center", gap: "8px" }}
                >
                  <span
                    style={{
                      fontSize: "14px",
                      color: premiumPlan === "monthly" ? "#28a745" : "#666",
                    }}
                  >
                    Monthly
                  </span>
                  <label
                    style={{
                      position: "relative",
                      display: "inline-block",
                      width: "50px",
                      height: "24px",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={premiumPlan === "yearly"}
                      onChange={(e) =>
                        setPremiumPlan(e.target.checked ? "yearly" : "monthly")
                      }
                      style={{ opacity: 0, width: 0, height: 0 }}
                    />
                    <span
                      style={{
                        position: "absolute",
                        cursor: "pointer",
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        backgroundColor:
                          premiumPlan === "yearly" ? "#28a745" : "#ccc",
                        transition: "0.4s",
                        borderRadius: "24px",
                      }}
                    >
                      <span
                        style={{
                          position: "absolute",
                          content: '""',
                          height: "18px",
                          width: "18px",
                          left: premiumPlan === "yearly" ? "28px" : "3px",
                          bottom: "3px",
                          backgroundColor: "white",
                          transition: "0.4s",
                          borderRadius: "50%",
                        }}
                      />
                    </span>
                  </label>
                  <span
                    style={{
                      fontSize: "14px",
                      color: premiumPlan === "yearly" ? "#28a745" : "#666",
                    }}
                  >
                    Yearly
                    {premiumPlan === "yearly" && (
                      <span
                        style={{
                          fontSize: "12px",
                          color: "#28a745",
                          marginLeft: "4px",
                        }}
                      >
                        Save 25%
                      </span>
                    )}
                  </span>
                </div>
              </div>
            </div>

            {/* Payment Gateway Selection */}
            <div style={{ marginBottom: "12px" }}>
              <p
                style={{ margin: "0 0 8px 0", fontSize: "14px", color: "#666" }}
              >
                Choose payment method:
              </p>
              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  onClick={() => setPremiumGateway("paystack")}
                  style={{
                    flex: 1,
                    padding: "8px",
                    border:
                      premiumGateway === "paystack"
                        ? "2px solid #28a745"
                        : "1px solid #ddd",
                    backgroundColor:
                      premiumGateway === "paystack" ? "#f8fff8" : "white",
                    color: premiumGateway === "paystack" ? "#28a745" : "#666",
                    borderRadius: "4px",
                    fontSize: "14px",
                    cursor: "pointer",
                  }}
                >
                  Paystack (₦)
                </button>
                <button
                  onClick={() => setPremiumGateway("paypal")}
                  style={{
                    flex: 1,
                    padding: "8px",
                    border:
                      premiumGateway === "paypal"
                        ? "2px solid #28a745"
                        : "1px solid #ddd",
                    backgroundColor:
                      premiumGateway === "paypal" ? "#f8fff8" : "white",
                    color: premiumGateway === "paypal" ? "#28a745" : "#666",
                    borderRadius: "4px",
                    fontSize: "14px",
                    cursor: "pointer",
                  }}
                >
                  PayPal ($)
                </button>
              </div>
            </div>

            <div style={{ marginBottom: "12px" }}>
              <ul
                style={{
                  margin: "0",
                  paddingLeft: "20px",
                  fontSize: "14px",
                  color: "#666",
                }}
              >
                <li>Up to 10 analyses per day</li>
                <li>Advanced optimization features</li>
                <li>Priority customer support</li>
                <li>Cancel anytime</li>
              </ul>
            </div>
            <button
              onClick={handlePremiumUpgrade}
              disabled={loadingPremium}
              style={{
                width: "100%",
                padding: "12px",
                backgroundColor: loadingPremium ? "#ccc" : "#28a745",
                color: "white",
                border: "none",
                borderRadius: "6px",
                fontSize: "16px",
                cursor: loadingPremium ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                fontWeight: "500",
              }}
            >
              {loadingPremium && (
                <div
                  className="spinner"
                  style={{ width: "16px", height: "16px" }}
                />
              )}
              {loadingPremium
                ? "Processing..."
                : `Upgrade to Premium - ${
                    premiumPlan === "monthly"
                      ? premiumGateway === "paypal"
                        ? "$15"
                        : "₦15,000"
                      : premiumGateway === "paypal"
                      ? "$180"
                      : "₦180,000"
                  }/${premiumPlan === "monthly" ? "mo" : "yr"}`}
            </button>
          </div>

          {/* Manual Payment Verification */}
          <div
            style={{
              border: "1px solid #28a745",
              borderRadius: "8px",
              padding: "16px",
              marginBottom: "16px",
              marginTop: "16px",
              backgroundColor: "#f8fff8",
            }}
          >
            <h4 style={{ margin: "0 0 8px 0", color: "#28a745" }}>
              Manual Payment Verification
            </h4>
            <p
              style={{ margin: "0 0 12px 0", fontSize: "14px", color: "#666" }}
            >
              If automatic verification failed, enter your payment reference:
            </p>
            <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
              <input
                type="text"
                placeholder="Payment reference"
                value={manualReference}
                onChange={(e) => setManualReference(e.target.value)}
                style={{
                  flex: 1,
                  padding: "8px",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                  fontSize: "14px",
                }}
              />
              <select
                value={manualGateway}
                onChange={(e) => setManualGateway(e.target.value)}
                style={{
                  padding: "8px",
                  border: "1px solid #ddd",
                  borderRadius: "4px",
                  fontSize: "14px",
                }}
              >
                <option value="paystack">Paystack</option>
                <option value="paypal">PayPal</option>
              </select>
            </div>
            <button
              onClick={handleManualVerify}
              disabled={loadingManual || !manualReference.trim()}
              style={{
                width: "100%",
                padding: "8px",
                backgroundColor: loadingManual ? "#ccc" : "#28a745",
                color: "white",
                border: "none",
                borderRadius: "4px",
                fontSize: "14px",
                cursor:
                  loadingManual || !manualReference.trim()
                    ? "not-allowed"
                    : "pointer",
              }}
            >
              {loadingManual ? "Verifying..." : "Verify Payment"}
            </button>
          </div>
        </div>

        <p
          style={{
            textAlign: "center",
            fontSize: "12px",
            color: "#6c757d",
            margin: "0",
          }}
        >
          Secure payment processing • Instant access after payment
        </p>
      </div>
    </div>
  );
};

export default UpgradeModal;
