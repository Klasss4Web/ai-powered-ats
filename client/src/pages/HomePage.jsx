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
      {/* Hero Section */}
      <section className="hero-panel">
        <div className="hero-copy">
          <span className="hero-badge">AI-powered career toolkit</span>
          <h1 className="hero-title">
            Your complete job search companion
          </h1>
          <p className="hero-description">
            Analyze resumes, generate cover letters, prepare for interviews, and screen candidates - all powered by AI to help you land your dream job.
          </p>
          <div className="hero-actions">
            {isAuthenticated ? (
              <>
                <Link to="/matcher" className="primary-btn">
                  Analyze Resume
                </Link>
                <Link to="/dashboard" className="secondary-btn">
                  Go to Dashboard
                </Link>
              </>
            ) : (
              <>
                <Link to="/matcher" className="primary-btn">
                  Get Started Free
                </Link>
                <button
                  onClick={() => setShowLoginModal(true)}
                  className="secondary-btn"
                >
                  Login / Register
                </button>
              </>
            )}
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
            <div className="hero-card-header">Career tools</div>
            <div className="hero-card-body">
              <div className="hero-metric">4+</div>
              <div className="hero-subtitle">AI-powered features</div>
            </div>
          </div>
          <div className="hero-wave" />
        </div>
      </section>

      {/* Main Services Section */}
      <section className="services-section">
        <div className="services-header">
          <span className="eyebrow">Our Services</span>
          <h2>Everything you need to succeed</h2>
          <p>From resume optimization to interview preparation - we've got you covered at every step.</p>
        </div>

        <div className="services-grid">
          {/* Resume Matcher */}
          <div className="service-card service-card-primary">
            <div className="service-icon">📊</div>
            <h3>Resume Matcher</h3>
            <p>
              Upload your resume and job description to get instant ATS compatibility scores, 
              skill gap analysis, and actionable recommendations.
            </p>
            <ul className="service-features">
              <li>ATS compatibility scoring</li>
              <li>Missing skills detection</li>
              <li>Keyword optimization tips</li>
              <li>Download optimized resume</li>
            </ul>
            <Link to="/matcher" className="service-btn primary">
              Analyze Resume
            </Link>
          </div>

          {/* Cover Letter Generator */}
          <div className="service-card service-card-purple">
            <div className="service-icon">✉️</div>
            <h3>Cover Letter Generator</h3>
            <p>
              Generate personalized, human-written cover letters tailored to each job application. 
              No AI-sounding text - just natural, compelling letters.
            </p>
            <ul className="service-features">
              <li>Personalized to your experience</li>
              <li>Tailored to job requirements</li>
              <li>Natural, human-like tone</li>
              <li>Ready to copy & send</li>
            </ul>
            <Link to="/matcher" className="service-btn purple">
              Create Cover Letter
            </Link>
          </div>

          {/* Interview Prep */}
          <div className="service-card service-card-teal">
            <div className="service-icon">🎯</div>
            <h3>Interview Preparation</h3>
            <p>
              Get personalized interview questions based on your resume and the job. 
              Includes suggested answers, red flags to address, and questions to ask.
            </p>
            <ul className="service-features">
              <li>Likely interview questions</li>
              <li>Personalized answer suggestions</li>
              <li>Red flags & how to address</li>
              <li>Smart questions to ask</li>
            </ul>
            <Link to="/matcher" className="service-btn teal">
              Prepare for Interview
            </Link>
          </div>

          {/* Recruiter Tools */}
          <div className="service-card service-card-orange">
            <div className="service-icon">👥</div>
            <h3>Recruiter Screening</h3>
            <p>
              Screen multiple candidates at once against your job requirements. 
              Get ranked results, detailed reports, and hiring recommendations.
            </p>
            <ul className="service-features">
              <li>Batch resume screening</li>
              <li>Candidate ranking & scoring</li>
              <li>Detailed screening reports</li>
              <li>Hiring recommendations</li>
            </ul>
            <Link to="/recruiters" className="service-btn orange">
              Screen Candidates
            </Link>
            <span className="service-badge">Premium</span>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="how-it-works">
        <div className="services-header">
          <span className="eyebrow">Simple Process</span>
          <h2>How it works</h2>
        </div>
        <div className="steps-grid">
          <div className="step-card">
            <div className="step-number">1</div>
            <h4>Upload Resume</h4>
            <p>Upload your PDF resume or select a previously saved one.</p>
          </div>
          <div className="step-arrow">→</div>
          <div className="step-card">
            <div className="step-number">2</div>
            <h4>Add Job Description</h4>
            <p>Paste the job description you're applying for.</p>
          </div>
          <div className="step-arrow">→</div>
          <div className="step-card">
            <div className="step-number">3</div>
            <h4>Get Analysis</h4>
            <p>Receive instant scores, feedback, and recommendations.</p>
          </div>
          <div className="step-arrow">→</div>
          <div className="step-card">
            <div className="step-number">4</div>
            <h4>Take Action</h4>
            <p>Download optimized resume, generate cover letter, or prep for interview.</p>
          </div>
        </div>
      </section>

      {/* Quick Features Grid */}
      <section className="feature-grid">
        <div className="feature-card">
          <h3>Instant feedback</h3>
          <p>
            Get scored alignment results in seconds showing how well your resume
            matches the job description.
          </p>
        </div>
        <div className="feature-card">
          <h3>Human-like writing</h3>
          <p>
            Our cover letters sound natural and authentic - no robotic AI text that 
            recruiters can spot.
          </p>
        </div>
        <div className="feature-card">
          <h3>Interview confidence</h3>
          <p>
            Walk into interviews prepared with likely questions and personalized 
            answers based on your experience.
          </p>
        </div>
      </section>

      {/* User Dashboard Summary (if authenticated) */}
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
            <Link to="/matcher" className="primary-btn">
              Analyze Resume
            </Link>
            <Link to="/recruiters" className="secondary-btn">
              Recruiter Tools
            </Link>
            <Link to="/subscribe" className="secondary-btn">
              Upgrade Plan
            </Link>
          </div>
        </section>
      ) : (
        <section className="invite-panel glass-card">
          <div>
            <h2>Ready to level up your job search?</h2>
            <p>
              Sign in to save multiple resumes, track your optimization
              progress, and unlock all career tools.
            </p>
          </div>
          <div className="invite-actions">
            <button
              className="primary-btn"
              onClick={() => setShowLoginModal(true)}
            >
              Create free account
            </button>
            <Link to="/matcher" className="secondary-btn">
              Try without account
            </Link>
          </div>
        </section>
      )}

      {/* Why Choose Us */}
      <section className="insight-section">
        <div className="insight-copy">
          <span className="eyebrow">Why ATS Matcher?</span>
          <h2>Career tools built for modern job seekers</h2>
          <p>
            Everything you need to optimize your job search: resume analysis,
            cover letter generation, interview prep, and recruiter tools - all in one place.
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
            <h3>Complete toolkit</h3>
            <p>
              From resume optimization to interview prep - everything you need 
              in one integrated platform.
            </p>
          </div>
          <div className="insight-card glass-card">
            <h3>Affordable plans</h3>
            <p>
              Pay per analysis or upgrade to unlimited checks with our premium
              subscription.
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="cta-section glass-card">
        {isAuthenticated ? (
          <>
            <h2>Ready to optimize your next application?</h2>
            <p>Use our AI-powered tools to improve your chances of landing your dream job.</p>
            <div className="cta-actions">
              <Link to="/matcher" className="primary-btn large">
                Analyze Resume
              </Link>
              <Link to="/recruiters" className="secondary-btn">
                Recruiter Tools
              </Link>
            </div>
          </>
        ) : (
          <>
            <h2>Start optimizing your career today</h2>
            <p>Join thousands of job seekers who've improved their chances with ATS Matcher</p>
            <div className="cta-actions">
              <Link to="/matcher" className="primary-btn large">
                Get Started Free
              </Link>
              <Link to="/subscribe" className="secondary-btn">
                View Pricing
              </Link>
            </div>
          </>
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

export default HomePage;
