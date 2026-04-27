import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AlertModal from "../components/AlertModal";
import LoginModal from "../components/auth/LoginModal";
import { AUTH_CONSTANTS, BASE_URL } from "../constants/auth_constants";

const SubscriptionPage = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
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
    const token = localStorage.getItem(AUTH_CONSTANTS.TOKEN_KEY);
    if (token) {
      verifyAuth(token);
      fetchPaymentConfig();
    } else {
      setShowLoginModal(true);
    }
  }, []);

  const showAlert = (message, type = "info") => {
    setAlertModal({ isOpen: true, message, type });
  };

  const closeAlert = () =>
    setAlertModal({ isOpen: false, message: "", type: "info" });

  const verifyAuth = async (token) => {
    try {
      const response = await fetch(`${BASE_URL}/auth/verify`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        localStorage.removeItem(AUTH_CONSTANTS.TOKEN_KEY);
        setShowLoginModal(true);
        return;
      }
      const data = await response.json();
      setUser({
        id: data.user.id,
        email: data.user.email,
        name: data.user.name,
        subscription_type: data.user.subscription_type,
        subscription_expires_at: data.user.subscription_expires_at,
      });
      setIsAuthenticated(true);
    } catch (error) {
      console.error("Subscription auth error:", error);
      showAlert("Unable to verify your account. Please try again.", "error");
    }
  };

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
    setUser({
      id: userData.id,
      email: userData.email,
      name: userData.name,
      subscription_type: userData.subscription_type,
      subscription_expires_at: userData.subscription_expires_at,
    });
    setIsAuthenticated(true);
    setShowLoginModal(false);
    showAlert(`Welcome back, ${userData.name}!`, "success");
    fetchPaymentConfig();
  };

  const handleUpgrade = async () => {
    const token = localStorage.getItem(AUTH_CONSTANTS.TOKEN_KEY);
    if (!token) {
      showAlert("Login is required to upgrade.", "warning");
      setShowLoginModal(true);
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${BASE_URL}/subscription/upgrade`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ plan_type: planType, gateway }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "Subscription request failed.");
      }

      const authorizationUrl =
        data?.data?.authorization_url ||
        data?.data?.links?.find((link) => link.rel === "approve")?.href;
      if (authorizationUrl) {
        window.location.href = authorizationUrl;
      } else {
        throw new Error("No payment URL returned.");
      }
    } catch (error) {
      console.error("Subscription upgrade error:", error);
      showAlert(error.message || "Upgrade failed. Please try again.", "error");
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

      <section className="subscription-grid">
        <div className="plan-card glass-card">
          <div className="plan-tag">Popular</div>
          <h2>Monthly Premium</h2>
          <p className="plan-price">₦15,000 or $15 / month</p>
          <ul className="plan-coverage">
            <li>Up to 10 analyses per day</li>
            <li>Saved resume library</li>
            <li>Priority support</li>
          </ul>
          <button
            className={planType === "monthly" ? "primary-btn" : "secondary-btn"}
            onClick={() => setPlanType("monthly")}
          >
            Select monthly
          </button>
        </div>

        <div className="plan-card glass-card premium-plan">
          <div className="plan-tag plan-tag-alt">Best value</div>
          <h2>Yearly Premium</h2>
          <p className="plan-price">₦180,000 or $180 / year</p>
          <ul className="plan-coverage">
            <li>Everything in monthly</li>
            <li>Save 25% with yearly billing</li>
            <li>Priority upgrades and support</li>
          </ul>
          <button
            className={planType === "yearly" ? "primary-btn" : "secondary-btn"}
            onClick={() => setPlanType("yearly")}
          >
            Select yearly
          </button>
        </div>
      </section>

      <section className="payment-panel glass-card">
        <div className="payment-panel-header">
          <div>
            <p className="eyebrow">Ready to upgrade?</p>
            <h2>Secure your premium access</h2>
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
              {planType === "monthly" ? "Monthly Premium" : "Yearly Premium"}
            </p>
          </div>
          <div>
            <strong>Gateway</strong>
            <p>
              {gateway === "paystack" ? "₦ or NGN gateway" : "USD via PayPal"}
            </p>
          </div>
        </div>

        <div className="payment-btn_container">
          <button
            className="primary-btn upgrade-btn"
            onClick={handleUpgrade}
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
