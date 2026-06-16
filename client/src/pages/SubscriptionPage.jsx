import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AlertModal from "../components/AlertModal";
import LoginModal from "../components/auth/LoginModal";
import { AUTH_CONSTANTS, BASE_URL } from "../constants/auth_constants";
import { useAuth } from "../contexts/AuthContext";
import { useUpgrade } from "../hooks/useUpgrade";

const SubscriptionPage = () => {
  const { user, isAuthenticated, login } = useAuth();

  const [paymentConfig, setPaymentConfig] = useState(null);
  const [planType, setPlanType] = useState("monthly");
  const [gateway, setGateway] = useState("paystack");
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [alertModal, setAlertModal] = useState({
    isOpen: false,
    message: "",
    type: "info",
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isAuthenticated && user === null) {
      setShowLoginModal(true);
    }
    fetchPaymentConfig();
  }, [isAuthenticated, user]);

  const showAlert = (message, type = "info") => {
    setAlertModal({ isOpen: true, message, type });
  };

  const { handleUpgrade } = useUpgrade({ showAlert });

  const closeAlert = () =>
    setAlertModal({ isOpen: false, message: "", type: "info" });

  const fetchPaymentConfig = async () => {
    try {
      const response = await fetch(`${BASE_URL}/payment/config`);
      if (response.ok) {
        const data = await response.json();
        setPaymentConfig(data);
      }
    } catch (error) {
      console.error("Payment config fetch error:", error);
    }
  };

  const handleLoginSuccess = (userData) => {
    login(userData);
    setShowLoginModal(false);
    showAlert(`Welcome back, ${userData.name}!`, "success");
  };

  const handleContinueToPayment = async () => {
    setLoading(true);
    try {
      await handleUpgrade(planType, gateway);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-shell">
      <section className="page-hero compact-hero">
        <div>
          <span className="eyebrow">Subscription</span>
          <h1>Choose a plan that fits your hiring rhythm</h1>
          <p>
            Manage your plan dynamically and unlock premium resume matching
            volume, better insights, and priority access.
          </p>
        </div>
        <div className="hero-actions">
          <Link to="/matcher" className="primary-btn">
            Run a quick analysis
          </Link>
          <Link to="/dashboard" className="secondary-btn">
            Open dashboard
          </Link>
        </div>
      </section>

      {/* ── Plan cards ── */}
      <section className="subscription-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>

        {/* Monthly Premium */}
        <div className="plan-card glass-card">
          <div className="plan-tag">Popular</div>
          <h2>Monthly Premium</h2>
          <p className="plan-price">₦15,000 <span style={{ fontSize: "0.7em", color: "#888" }}>or $15 / month</span></p>
          <ul className="plan-coverage">
            <li>Up to 10 analyses per day</li>
            <li>Cover letter &amp; interview prep</li>
            <li>Saved resume library (3 resumes)</li>
            <li>My Analysis history</li>
            <li>Priority support</li>
          </ul>
          <button
            className={planType === "monthly" ? "primary-btn" : "secondary-btn"}
            onClick={() => setPlanType("monthly")}
          >
            {planType === "monthly" ? "✓ Selected" : "Select monthly"}
          </button>
        </div>

        {/* Yearly Premium */}
        <div className="plan-card glass-card premium-plan">
          <div className="plan-tag plan-tag-alt">Best value</div>
          <h2>Yearly Premium</h2>
          <p className="plan-price">₦180,000 <span style={{ fontSize: "0.7em", color: "#888" }}>or $180 / year</span></p>
          <ul className="plan-coverage">
            <li>Everything in monthly</li>
            <li>Save ~17% vs monthly billing</li>
            <li>Priority upgrades and support</li>
          </ul>
          <button
            className={planType === "yearly" ? "primary-btn" : "secondary-btn"}
            onClick={() => setPlanType("yearly")}
          >
            {planType === "yearly" ? "✓ Selected" : "Select yearly"}
          </button>
        </div>

        {/* Pro Monthly */}
        <div className="plan-card glass-card" style={{ borderTop: "3px solid #6366f1" }}>
          <div className="plan-tag" style={{ background: "#6366f1" }}>Recruiter</div>
          <h2>Pro Monthly</h2>
          <p className="plan-price">₦100,000 <span style={{ fontSize: "0.7em", color: "#888" }}>or $60 / month</span></p>
          <ul className="plan-coverage">
            <li>Up to <strong>100 analyses per day</strong></li>
            <li>Full recruiter &amp; batch screening</li>
            <li>Up to 20 resumes per batch</li>
            <li>Saved resume library (10 resumes)</li>
            <li>All Premium features included</li>
            <li>Priority support</li>
          </ul>
          <button
            className={planType === "pro_monthly" ? "primary-btn" : "secondary-btn"}
            onClick={() => setPlanType("pro_monthly")}
          >
            {planType === "pro_monthly" ? "✓ Selected" : "Select Pro monthly"}
          </button>
        </div>

        {/* Pro Yearly */}
        <div className="plan-card glass-card" style={{ borderTop: "3px solid #6366f1" }}>
          <div className="plan-tag plan-tag-alt" style={{ background: "#4f46e5" }}>Best Pro value</div>
          <h2>Pro Yearly</h2>
          <p className="plan-price">₦1,000,000 <span style={{ fontSize: "0.7em", color: "#888" }}>or $600 / year</span></p>
          <ul className="plan-coverage">
            <li>Everything in Pro monthly</li>
            <li>Save ~17% vs Pro monthly</li>
            <li>Dedicated account support</li>
          </ul>
          <button
            className={planType === "pro_yearly" ? "primary-btn" : "secondary-btn"}
            onClick={() => setPlanType("pro_yearly")}
          >
            {planType === "pro_yearly" ? "✓ Selected" : "Select Pro yearly"}
          </button>
        </div>

      </section>

      <section className="payment-panel glass-card">
        <div className="payment-panel-header">
          <div>
            <p className="eyebrow">Ready to upgrade?</p>
            <h2>Secure your access</h2>
          </div>
          <div className="gateway-buttons">
            <button
              className={
                gateway === "paystack" ? "primary-btn" : "secondary-btn"
              }
              onClick={() => setGateway("paystack")}
            >
              Paystack
            </button>
            <button
              className={gateway === "paypal" ? "primary-btn" : "secondary-btn"}
              onClick={() => setGateway("paypal")}
            >
              PayPal
            </button>
          </div>
        </div>

        <div className="payment-summary">
          <div>
            <strong>Selected plan</strong>
            <p>
              {{
                monthly:     "Monthly Premium — ₦15,000 / $15",
                yearly:      "Yearly Premium — ₦180,000 / $180",
                pro_monthly: "Pro Monthly — ₦100,000 / $60",
                pro_yearly:  "Pro Yearly — ₦1,000,000 / $600",
              }[planType]}
            </p>
          </div>
          <div>
            <strong>Gateway</strong>
            <p>
              {gateway === "paystack" ? "₦ via Paystack" : "USD via PayPal"}
            </p>
          </div>
          <div>
            <strong>Tier</strong>
            <p style={{ color: planType.startsWith("pro_") ? "#6366f1" : "#22c55e", fontWeight: 600 }}>
              {planType.startsWith("pro_") ? "Pro (Recruiter)" : "Premium"}
            </p>
          </div>
        </div>

        <div className="payment-btn_container">
          <button
            className="primary-btn upgrade-btn"
            onClick={handleContinueToPayment}
            disabled={loading}
          >
            {loading ? "Processing..." : "Continue to payment"}
          </button>
        </div>

        {paymentConfig && (
          <p className="payment-note">
            Payment providers available:{" "}
            {paymentConfig.paystack_public_key ? "Paystack" : ""}
            {paymentConfig.paystack_public_key && paymentConfig.paypal_client_id
              ? ", "
              : ""}
            {paymentConfig.paypal_client_id ? "PayPal" : ""}.
          </p>
        )}
      </section>

      {alertModal.isOpen && (
        <AlertModal
          isOpen={alertModal.isOpen}
          message={alertModal.message}
          type={alertModal.type}
          onClose={closeAlert}
        />
      )}

      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onLogin={handleLoginSuccess}
      />
    </div>
  );
};

export default SubscriptionPage;
