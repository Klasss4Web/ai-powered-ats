import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AlertModal from "../components/AlertModal";
import LoginModal from "../components/auth/LoginModal";
import UsageStatus from "../components/UsageStatus";
import { AUTH_CONSTANTS, BASE_URL } from "../constants/auth_constants";

const HomePage = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [usageInfo, setUsageInfo] = useState(null);
  const [savedCount, setSavedCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [alertModal, setAlertModal] = useState({
    isOpen: false,
    message: "",
    type: "info",
  });

  useEffect(() => {
    const token = localStorage.getItem(AUTH_CONSTANTS.TOKEN_KEY);
    if (token) {
      verifyAuth(token);
    }
  }, []);

  const verifyAuth = async (token) => {
    setLoading(true);
    try {
      const response = await fetch(`${BASE_URL}/auth/verify`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        localStorage.removeItem(AUTH_CONSTANTS.TOKEN_KEY);
        setIsAuthenticated(false);
        return;
      }

      const data = await response.json();
      const nextUser = {
        id: data.user.id,
        email: data.user.email,
        name: data.user.name,
        subscription_type: data.user.subscription_type,
        subscription_expires_at: data.user.subscription_expires_at,
      };

      setUser(nextUser);
      setIsAuthenticated(true);
      fetchUsageInfo(token);
      fetchSavedResumes(token);
    } catch (error) {
      console.error("Home auth verify error:", error);
      localStorage.removeItem(AUTH_CONSTANTS.TOKEN_KEY);
    } finally {
      setLoading(false);
    }
  };

  const fetchUsageInfo = async (token) => {
    try {
      const response = await fetch(`${BASE_URL}/user/usage`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setUsageInfo(data);
      }
    } catch (error) {
      console.error("Home usage fetch error:", error);
    }
  };

  const fetchSavedResumes = async (token) => {
    try {
      const response = await fetch(`${BASE_URL}/resumes`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setSavedCount(data.resumes?.length || 0);
      }
    } catch (error) {
      console.error("Saved resumes fetch error:", error);
    }
  };

  const showAlert = (message, type = "info") => {
    setAlertModal({ isOpen: true, message, type });
  };

  const closeAlert = () => {
    setAlertModal({ isOpen: false, message: "", type: "info" });
  };

  const handleLoginSuccess = (userData) => {
    const nextUser = {
      id: userData.id,
      email: userData.email,
      name: userData.name,
      subscription_type: userData.subscription_type,
      subscription_expires_at: userData.subscription_expires_at,
    };
    setUser(nextUser);
    setIsAuthenticated(true);
    setShowLoginModal(false);
    showAlert(`Welcome back, ${userData.name}!`, "success");
    const token = localStorage.getItem(AUTH_CONSTANTS.TOKEN_KEY);
    if (token) {
      fetchUsageInfo(token);
      fetchSavedResumes(token);
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setUser(null);
    setUsageInfo(null);
    setSavedCount(0);
    localStorage.removeItem(AUTH_CONSTANTS.TOKEN_KEY);
    showAlert("Logged out successfully.", "info");
  };

  return (
    <div className="page-shell">
      <section className="hero-panel">
        <div className="hero-copy">
          <span className="hero-badge">AI-powered career growth</span>
          <h1 className="hero-title">
            Optimize your resume and land your dream job
          </h1>
          <p className="hero-description">
            Analyze your resume against job descriptions, uncover skill gaps,
            and get AI-powered recommendations to stand out to recruiters.
          </p>
          <div className="hero-actions">
            <Link to="/matcher" className="primary-btn">
              Analyze my resume
            </Link>
            <Link
              to={isAuthenticated ? "/dashboard" : "#"}
              onClick={(e) =>
                !isAuthenticated &&
                (e.preventDefault(), setShowLoginModal(true))
              }
              className="secondary-btn"
            >
              {isAuthenticated ? "Go to dashboard" : "Login / Register"}
            </Link>
          </div>
        </div>
        <div className="hero-visual">
          <div className="hero-card glass-card">
            <div className="hero-card-header">Instant talent pulse</div>
            <div className="hero-card-body">
              <div className="hero-metric">94%</div>
              <div className="hero-subtitle">Resume match accuracy</div>
            </div>
          </div>
          <div className="hero-card glass-card secondary-card">
            <div className="hero-card-header">Premium members</div>
            <div className="hero-card-body">
              <div className="hero-metric">20+</div>
              <div className="hero-subtitle">Advanced insights daily</div>
            </div>
          </div>
          <div className="hero-wave" />
        </div>
      </section>

      <section className="feature-grid">
        <div className="feature-card">
          <h3>Instant feedback</h3>
          <p>
            Get scored alignment results in seconds showing how well your resume
            matches the job description.
          </p>
        </div>
        <div className="feature-card">
          <h3>Skill insights</h3>
          <p>
            Discover missing keywords and technical skills required for roles
            you're targeting.
          </p>
        </div>
        <div className="feature-card">
          <h3>Flexible access</h3>
          <p>
            Use pay-as-you-go for occasional checks or subscribe for unlimited
            analyses.
          </p>
        </div>
      </section>

      {isAuthenticated && user ? (
        <section className="dashboard-summary glass-card large-card">
          <div className="summary-header">
            <div>
              <p className="eyebrow">Hi {user.name}! 👋</p>
              <h2>Your optimization dashboard</h2>
            </div>
            <button className="secondary-btn" onClick={handleLogout}>
              Logout
            </button>
          </div>

          <div className="summary-grid">
            <div className="summary-tile">
              <span>Current plan</span>
              <strong>
                {usageInfo?.subscription_type === "premium"
                  ? "Premium"
                  : "Free"}
              </strong>
              <p>
                {usageInfo?.subscription_expires_at
                  ? `Active until ${new Date(usageInfo.subscription_expires_at).toLocaleDateString()}`
                  : "Pay-as-you-go available"}
              </p>
            </div>
            <div className="summary-tile">
              <span>Analyses used today</span>
              <strong>{usageInfo?.current_usage ?? 0}</strong>
              <p>
                {usageInfo?.daily_limit
                  ? `${usageInfo.daily_limit} limit per day`
                  : "Flexible daily limit"}
              </p>
            </div>
            <div className="summary-tile">
              <span>Saved resumes</span>
              <strong>{savedCount}</strong>
              <p>
                {savedCount === 0
                  ? "Upload your first resume"
                  : "Ready for analysis"}
              </p>
            </div>
          </div>

          <div className="quick-links">
            <Link to="/dashboard" className="primary-btn">
              Open dashboard
            </Link>
            <Link to="/subscribe" className="secondary-btn">
              Upgrade subscription
            </Link>
          </div>
        </section>
      ) : (
        <section className="invite-panel glass-card">
          <div>
            <h2>Ready to level up your job search?</h2>
            <p>
              Sign in to save multiple resumes, track your optimization
              progress, and manage your analysis plan.
            </p>
          </div>
          <div>
            <button
              className="primary-btn"
              onClick={() => setShowLoginModal(true)}
            >
              Create account
            </button>
            <Link to="/matcher" className="secondary-btn">
              Explore matcher
            </Link>
          </div>
        </section>
      )}

      <section className="insight-section">
        <div className="insight-copy">
          <span className="eyebrow">Why ATS Matcher?</span>
          <h2>Career tools built for job seekers</h2>
          <p>
            Everything you need to optimize your job search: resume analysis,
            skill gap detection, and flexible pricing all in one place.
          </p>
        </div>

        <div className="insight-grid">
          <div className="insight-card glass-card">
            <h3>AI-powered analysis</h3>
            <p>
              Get detailed matching scores and see exactly where your resume
              aligns with target roles.
            </p>
          </div>
          <div className="insight-card glass-card">
            <h3>Affordable plans</h3>
            <p>
              Pay per analysis or upgrade to unlimited checks with our premium
              subscription.
            </p>
          </div>
          <div className="insight-card glass-card">
            <h3>Personal dashboard</h3>
            <p>
              Keep your resumes organized, track your improvements, and manage
              your subscription.
            </p>
          </div>
        </div>
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

export default HomePage;
