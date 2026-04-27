import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AlertModal from "../components/AlertModal";
import LoginModal from "../components/auth/LoginModal";
import UsageStatus from "../components/UsageStatus";
import { AUTH_CONSTANTS, BASE_URL } from "../constants/auth_constants";

// const BASE_URL =
//   "http://ats-matcher-backend-alb-1819594825.eu-west-2.elb.amazonaws.com/api";

const DashboardPage = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [usageInfo, setUsageInfo] = useState(null);
  const [savedResumes, setSavedResumes] = useState([]);
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
    setLoading(true);
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
      await fetchUsageInfo(token);
      await fetchSavedResumes(token);
    } catch (error) {
      console.error("Dashboard auth error:", error);
      showAlert("Unable to load dashboard. Please try again.", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchUsageInfo = async (token) => {
    try {
      const response = await fetch(`${BASE_URL}/user/usage`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setUsageInfo(data);
      }
    } catch (error) {
      console.error("Dashboard usage fetch error:", error);
    }
  };

  const fetchSavedResumes = async (token) => {
    try {
      const response = await fetch(`${BASE_URL}/resumes`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setSavedResumes(data.resumes || []);
      }
    } catch (error) {
      console.error("Dashboard resumes fetch error:", error);
    }
  };

  const handleLoginSuccess = (userData) => {
    const token = localStorage.getItem(AUTH_CONSTANTS.TOKEN_KEY);
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
    if (token) {
      fetchUsageInfo(token);
      fetchSavedResumes(token);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem(AUTH_CONSTANTS.TOKEN_KEY);
    setIsAuthenticated(false);
    setUser(null);
    setUsageInfo(null);
    setSavedResumes([]);
    setShowLoginModal(true);
  };

  return (
    <div className="page-shell">
      <section className="page-hero compact-hero">
        <div>
          <span className="eyebrow">Your Control Center</span>
          <h1>Manage your resume optimization</h1>
          <p>
            Track your analyses, saved resumes, and subscription plan.
            Everything you need to land your next interview opportunity.
          </p>
        </div>
        <div className="hero-actions">
          <Link to="/matcher" className="primary-btn">
            Analyze another resume
          </Link>
          <Link to="/subscribe" className="secondary-btn">
            View plans
          </Link>
        </div>
      </section>

      {isAuthenticated && user ? (
        <section className="dashboard-summary glass-card">
          <div className="summary-header">
            <div>
              <p className="eyebrow">Welcome, {user.name}! 👋</p>
              <h2>Your resume insights</h2>
            </div>
            <button className="secondary-btn" onClick={handleLogout}>
              Logout
            </button>
          </div>

          <UsageStatus
            usageInfo={usageInfo}
            loading={!usageInfo && loading}
            onUpgradeClick={() => {
              window.location.href = "/subscribe";
            }}
          />

          <div className="subscription-details">
            <div className="detail-section">
              <h3>Subscription Status</h3>
              <div className="detail-grid">
                <div className="detail-item">
                  <span>Current Plan</span>
                  <strong>
                    {usageInfo?.subscription_type === "premium"
                      ? "Premium"
                      : "Free"}
                  </strong>
                </div>
                {usageInfo?.subscription_type === "premium" &&
                  usageInfo?.subscription_expires_at && (
                    <>
                      <div className="detail-item">
                        <span>Expires</span>
                        <strong>
                          {new Date(
                            usageInfo?.subscription_expires_at,
                          ).toLocaleDateString()}
                        </strong>
                      </div>
                      <div className="detail-item">
                        <span>Days Remaining</span>
                        <strong>
                          {Math.max(
                            0,
                            Math.ceil(
                              (new Date(usageInfo?.subscription_expires_at) -
                                new Date()) /
                                (1000 * 60 * 60 * 24),
                            ),
                          )}
                        </strong>
                      </div>
                    </>
                  )}
              </div>
            </div>
          </div>

          <div className="summary-grid">
            <div className="summary-card">
              <span>Saved Resumes</span>
              <strong>{savedResumes?.length}</strong>
              <p>Your resume library for quick analysis.</p>
            </div>
            <div className="summary-card">
              <span>Analyses This Week</span>
              <strong>{usageInfo?.current_usage ?? 0}</strong>
              <p>Based on your current plan limits.</p>
            </div>
            <div className="summary-card">
              <span>Remaining Analyses</span>
              <strong>{usageInfo?.remaining_analyses ?? "—"}</strong>
              <p>Today's quota available.</p>
            </div>
          </div>

          <div className="table-panel">
            <div className="table-panel-header">
              <h3>Your Resumes</h3>
              <span>{savedResumes.length} saved</span>
            </div>
            <div className="resume-list">
              {savedResumes.length > 0 ? (
                savedResumes.slice(0, 5).map((resume) => (
                  <div key={resume.id} className="resume-card">
                    <div>{resume.filename || "Resume Document"}</div>
                    <small>
                      {new Date(resume.created_at).toLocaleDateString()}
                    </small>
                  </div>
                ))
              ) : (
                <div className="empty-state">
                  No saved resumes yet. Upload one in the matcher and it will
                  appear here.
                </div>
              )}
            </div>
          </div>
        </section>
      ) : (
        <section className="invite-panel glass-card">
          <h2>Unlock advanced analysis</h2>
          <p>
            Upgrade to premium for unlimited daily analyses and priority
            support.
          </p>
          <button
            className="primary-btn"
            onClick={() => {
              window.location.href = "/subscribe";
            }}
          >
            View subscription plans
          </button>
        </section>
      )}

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

export default DashboardPage;
