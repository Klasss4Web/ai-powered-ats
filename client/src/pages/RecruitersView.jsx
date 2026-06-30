import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import AlertModal from "../components/AlertModal";
import UserAvatar from "../components/UserAvatar";
import UsageStatus from "../components/UsageStatus";
import UpgradeModal from "../components/UpgradeModal";
import LoginModal from "../components/auth/LoginModal";
import ConfirmModal from "../components/ConfirmModal";
import { AUTH_CONSTANTS, BASE_URL } from "../constants/auth_constants";
import { useAuth } from "../contexts/AuthContext";
import { useFeatures } from "../contexts/FeaturesContext";
import { useUpgrade } from "../hooks/useUpgrade";
import AnimatedLoader from "../components/loaders/animated-loader/AnimatedLoader";

const RecruitersView = () => {
  const { user, isAuthenticated, login, logout } = useAuth();
  const { isEnabled } = useFeatures();
  // Form state
  const [jobTitle, setJobTitle] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [resumeFiles, setResumeFiles] = useState([]);

  // Results state
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sortBy, setSortBy] = useState("overall_match_score");
  const [sortOrder, setSortOrder] = useState("desc");

  // Sessions state
  const [sessions, setSessions] = useState([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [activeSession, setActiveSession] = useState(null);
  const [showSessionsPanel, setShowSessionsPanel] = useState(true);

  // Report state
  const [report, setReport] = useState(null);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);

  // Candidate detail modal state
  const [selectedCandidate, setSelectedCandidate] = useState(null);
  const [showCandidateModal, setShowCandidateModal] = useState(false);

  // Authentication state
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Usage and subscription state
  const [usageInfo, setUsageInfo] = useState(null);
  const [loadingUsage, setLoadingUsage] = useState(false);

  // Upgrade modal state
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeModalData, setUpgradeModalData] = useState(null);

  // Alert modal state
  const [alertModal, setAlertModal] = useState({
    isOpen: false,
    message: "",
    type: "info",
  });

  // Confirm modal state
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [confirmModalData, setConfirmModalData] = useState(null);

  // Premium check state
  const [isPremiumUser, setIsPremiumUser] = useState(false);

  // Email compose modal state
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailType, setEmailType] = useState("acceptance"); // "acceptance" | "rejection"
  const [emailForm, setEmailForm] = useState({
    to_email: "",
    to_name: "",
    subject: "",
    body: "",
  });
  const [sendingEmail, setSendingEmail] = useState(false);

  // Email templates state
  const [emailTemplates, setEmailTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [templateForm, setTemplateForm] = useState({
    name: "",
    email_type: "custom",
    subject_template: "",
    body_template: "",
  });

  // Initial page loading state
  const [initialLoading, setInitialLoading] = useState(true);

  const [loadingSessionDetail, setLoadingSessionDetail] = useState(false);

  // Background job polling state
  const [activeJobId, setActiveJobId] = useState(null);
  const [jobProgress, setJobProgress] = useState({ progress: 0, total: 0, status: "" });

  // Sort results
  const sortedResults = results
    ? [...results].sort((a, b) => {
        if (a.error || b.error) return 0;
        const aVal = a.scores?.[sortBy] || 0;
        const bVal = b.scores?.[sortBy] || 0;
        return sortOrder === "desc" ? bVal - aVal : aVal - bVal;
      })
    : null;

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortOrder(sortOrder === "desc" ? "asc" : "desc");
    } else {
      setSortBy(column);
      setSortOrder("desc");
    }
  };

  // Check authentication on app load
  useEffect(() => {
    const token = localStorage.getItem(AUTH_CONSTANTS.TOKEN_KEY);
    if (token) {
      verifyAuth(token);
    } else {
      setInitialLoading(false);
      setShowLoginModal(true);
    }
  }, []);

  // Fetch usage info and sessions when authenticated
  useEffect(() => {
    if (isAuthenticated && user && isPremiumUser) {
      Promise.all([fetchUsageInfo(), fetchSessions(), fetchEmailTemplates()]).finally(() => {
        setInitialLoading(false);
      });
    } else if (isAuthenticated && user && !isPremiumUser) {
      setInitialLoading(false);
    }
  }, [isAuthenticated, user, isPremiumUser]);

  // Poll active background job
  useEffect(() => {
    if (!activeJobId) return;
    const poll = async () => {
      try {
        const token = localStorage.getItem(AUTH_CONSTANTS.TOKEN_KEY);
        const res = await fetch(`${BASE_URL}/jobs/${activeJobId}/status`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return;
        const data = await res.json();
        setJobProgress({
          progress: data.progress ?? 0,
          total: data.total ?? 0,
          status: data.status,
        });

        if (data.status === "completed") {
          setActiveJobId(null);
          setLoading(false);
          if (data.result) {
            setResults(data.result.results);
            setResumeFiles([]);
            showAlert(
              `Successfully analyzed ${data.result.successful} candidate(s).`,
              "success",
            );
            // Refresh active session if one was created/updated
            if (data.result.session_id) {
              loadSession(data.result.session_id);
            }
            fetchSessions();
            fetchUsageInfo();
          }
        } else if (data.status === "failed") {
          setActiveJobId(null);
          setLoading(false);
          showAlert(data.error_message || "Batch analysis failed.", "error");
        }
      } catch {
        // silent fail on poll errors
      }
    };

    poll(); // immediate first check
    const interval = setInterval(poll, 2000);
    return () => clearInterval(interval);
  }, [activeJobId]);

  const verifyAuth = async (token) => {
    try {
      const response = await fetch(`${BASE_URL}/auth/verify`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        login(data.user);
        setIsPremiumUser(
          ["premium", "pro"].includes(data.user.subscription_type),
        );
      } else {
        throw new Error("Verification failed");
      }
    } catch (error) {
      console.error("Auth verification failed:", error);
      logout();
      setInitialLoading(false);
      setShowLoginModal(true);
    }
  };

  const fetchUsageInfo = async () => {
    setLoadingUsage(true);
    try {
      const token = localStorage.getItem(AUTH_CONSTANTS.TOKEN_KEY);
      const response = await fetch(`${BASE_URL}/user/usage`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setUsageInfo(data);
      }
    } catch (error) {
      console.error("Failed to fetch usage info:", error);
    } finally {
      setLoadingUsage(false);
    }
  };

  const fetchEmailTemplates = async () => {
    setLoadingTemplates(true);
    try {
      const token = localStorage.getItem(AUTH_CONSTANTS.TOKEN_KEY);
      const response = await fetch(`${BASE_URL}/recruiter/email-templates`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setEmailTemplates(data.templates || []);
      }
    } catch (error) {
      console.error("Failed to fetch email templates:", error);
    } finally {
      setLoadingTemplates(false);
    }
  };

  const saveTemplate = async () => {
    if (!templateForm.name.trim() || !templateForm.body_template.trim()) {
      showAlert("Name and message are required.", "warning");
      return;
    }
    try {
      const token = localStorage.getItem(AUTH_CONSTANTS.TOKEN_KEY);
      const url = editingTemplate
        ? `${BASE_URL}/recruiter/email-templates/${editingTemplate.id}`
        : `${BASE_URL}/recruiter/email-templates`;
      const method = editingTemplate ? "PUT" : "POST";
      const response = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(templateForm),
      });
      if (response.ok) {
        showAlert(
          editingTemplate ? "Template updated!" : "Template saved!",
          "success",
        );
        setEditingTemplate(null);
        setTemplateForm({
          name: "",
          email_type: "custom",
          subject_template: "",
          body_template: "",
        });
        fetchEmailTemplates();
      } else {
        const err = await response.json();
        showAlert(err.error || "Failed to save template.", "error");
      }
    } catch {
      showAlert("Network error. Please try again.", "error");
    }
  };

  const deleteTemplate = async (templateId) => {
    try {
      const token = localStorage.getItem(AUTH_CONSTANTS.TOKEN_KEY);
      const response = await fetch(
        `${BASE_URL}/recruiter/email-templates/${templateId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (response.ok) {
        showAlert("Template deleted.", "success");
        fetchEmailTemplates();
      } else {
        const err = await response.json();
        showAlert(err.error || "Failed to delete template.", "error");
      }
    } catch {
      showAlert("Network error. Please try again.", "error");
    }
  };

  const applyTemplate = (template) => {
    setEmailForm((prev) => ({
      ...prev,
      subject: template.subject_template || prev.subject,
      body: template.body_template || prev.body,
    }));
    showAlert(`Template "${template.name}" applied.`, "success");
  };

  const fetchSessions = async () => {
    setLoadingSessions(true);
    try {
      const token = localStorage.getItem(AUTH_CONSTANTS.TOKEN_KEY);
      const response = await fetch(`${BASE_URL}/recruiter/sessions`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setSessions(data.sessions || []);
      }
    } catch (error) {
      console.error("Failed to fetch sessions:", error);
    } finally {
      setLoadingSessions(false);
    }
  };

  const loadSession = async (sessionId) => {
    setLoadingSessionDetail(true);
    try {
      const token = localStorage.getItem(AUTH_CONSTANTS.TOKEN_KEY);
      const response = await fetch(
        `${BASE_URL}/recruiter/sessions/${sessionId}`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (response.ok) {
        const data = await response.json();
        const session = data.session;
        setActiveSession(session);
        setJobTitle(session.job_title || "");
        setJobDescription(session.job_description || "");
        setResults(session.results || []);
        setReport(session.report || null);
        showAlert("Session loaded successfully!", "success");
      } else {
        showAlert("Failed to load session.", "error");
      }
    } catch (error) {
      console.error("Failed to load session:", error);
      showAlert("Failed to load session.", "error");
    } finally {
      setLoadingSessionDetail(false);
    }
  };

  const deleteSession = (sessionId) => {
    setConfirmModalData({
      title: "Delete Screening Session",
      message:
        "Are you sure you want to delete this screening session? This action cannot be undone.",
      confirmText: "Delete",
      onConfirm: () => executeDeleteSession(sessionId),
    });
    setShowConfirmModal(true);
  };

  const executeDeleteSession = async (sessionId) => {
    setShowConfirmModal(false);
    try {
      const token = localStorage.getItem(AUTH_CONSTANTS.TOKEN_KEY);
      const response = await fetch(
        `${BASE_URL}/recruiter/sessions/${sessionId}`,
        {
          method: "DELETE",
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (response.ok) {
        setSessions(sessions.filter((s) => s.id !== sessionId));
        if (activeSession?.id === sessionId) {
          setActiveSession(null);
          setResults(null);
          setJobTitle("");
          setJobDescription("");
          setReport(null);
        }
        showAlert("Session deleted successfully!", "success");
      } else {
        showAlert("Failed to delete session.", "error");
      }
    } catch (error) {
      console.error("Failed to delete session:", error);
      showAlert("Failed to delete session.", "error");
    }
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    const pdfFiles = files.filter((file) => file.type === "application/pdf");
    if (pdfFiles.length !== files.length) {
      showAlert(
        "Only PDF files are allowed. Non-PDF files were ignored.",
        "warning",
      );
    }
    setResumeFiles(pdfFiles);
  };

  const showAlert = (message, type = "info") => {
    setAlertModal({ isOpen: true, message, type });
  };

  // Upgrade handler (shared hook)
  const { handleUpgrade: handleUpgradeToPremium } = useUpgrade({ showAlert });

  const handleStartNewSession = () => {
    setActiveSession(null);
    setResults(null);
    setJobTitle("");
    setJobDescription("");
    setReport(null);
    setResumeFiles([]);
    setError(null);
  };

  const handleAnalyze = async () => {
    if (!jobDescription.trim()) {
      setError("Please enter a job description.");
      return;
    }
    if (resumeFiles.length === 0) {
      setError("Please select at least one resume file.");
      return;
    }
    if (resumeFiles.length > 10) {
      setError("Maximum 10 resumes allowed per batch.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem(AUTH_CONSTANTS.TOKEN_KEY);

      if (activeSession) {
        // Continue existing session — synchronous
        const formData = new FormData();
        formData.append("job_description", jobDescription);
        resumeFiles.forEach((file) => {
          formData.append("resumes", file);
        });

        const response = await fetch(
          `${BASE_URL}/recruiter/sessions/${activeSession.id}/analyze`,
          {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: formData,
          },
        );

        if (response.ok) {
          const data = await response.json();
          setActiveSession({
            ...activeSession,
            total_candidates: data.total_candidates,
          });
          setResults(data.results);
          setResumeFiles([]);
          showAlert(
            `Successfully analyzed ${data.successful || data.results.filter((r) => !r.error).length} candidate(s).`,
            "success",
          );
          fetchSessions();
          fetchUsageInfo();
        } else {
          const errorData = await response.json();
          if (errorData.upgrade_required) {
            setUpgradeModalData({
              message: errorData.error,
              type: "analysis",
              subscriptionType: user?.subscription_type || "free",
            });
            setShowUpgradeModal(true);
          } else {
            setError(errorData.error || "An error occurred.");
          }
          setLoading(false);
        }
      } else {
        // New analysis — async background job
        const formData = new FormData();
        formData.append("job_description", jobDescription);
        if (jobTitle) {
          formData.append("job_title", jobTitle);
        }
        resumeFiles.forEach((file) => {
          formData.append("resumes", file);
        });

        const response = await fetch(`${BASE_URL}/batch-match-async`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        });

        if (response.ok) {
          const data = await response.json();
          setActiveJobId(data.job_id);
          setJobProgress({ progress: 0, total: resumeFiles.length, status: "pending" });
        } else {
          const errorData = await response.json();
          if (errorData.upgrade_required) {
            setUpgradeModalData({
              message: errorData.error,
              type: "analysis",
              subscriptionType: user?.subscription_type || "free",
            });
            setShowUpgradeModal(true);
          } else {
            setError(errorData.error || "An error occurred.");
          }
          setLoading(false);
        }
      }
    } catch (err) {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  };

  const handleGenerateReport = async () => {
    if (!results || results.length === 0) {
      showAlert("Please analyze candidates first.", "warning");
      return;
    }

    setGeneratingReport(true);

    try {
      const token = localStorage.getItem(AUTH_CONSTANTS.TOKEN_KEY);
      const response = await fetch(`${BASE_URL}/recruiter/report`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          candidates: results,
          job_description: jobDescription,
          job_title: jobTitle || "the position",
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setReport(data);
        setShowReportModal(true);

        // Save report to session if we have one
        if (activeSession) {
          await fetch(
            `${BASE_URL}/recruiter/sessions/${activeSession.id}/report`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ report: data.report }),
            },
          );
          fetchSessions(); // Refresh to show report indicator
        }

        showAlert("Report generated successfully!", "success");
      } else {
        const errorData = await response.json();
        showAlert(errorData.error || "Failed to generate report.", "error");
      }
    } catch (err) {
      showAlert("Network error. Please try again.", "error");
    } finally {
      setGeneratingReport(false);
    }
  };

  const handleViewCandidate = (candidate) => {
    setSelectedCandidate(candidate);
    setShowCandidateModal(true);
  };

  const handleCopyReport = () => {
    if (report?.report) {
      navigator.clipboard.writeText(report.report);
      showAlert("Report copied to clipboard!", "success");
    }
  };

  const handleDownloadReport = () => {
    if (report?.report) {
      const blob = new Blob([report.report], { type: "text/plain" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `screening_report_${jobTitle || "candidates"}_${new Date().toISOString().split("T")[0]}.txt`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      showAlert("Report downloaded!", "success");
    }
  };

  const handleDownloadPDFReport = async () => {
    if (!activeSession) {
      showAlert("Save the session first to download a PDF report.", "warning");
      return;
    }
    try {
      const token = localStorage.getItem(AUTH_CONSTANTS.TOKEN_KEY);
      const response = await fetch(
        `${BASE_URL}/recruiter/sessions/${activeSession.id}/report/pdf`,
        {
          headers: { Authorization: `Bearer ${token}` },
        },
      );
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const disposition = response.headers.get("content-disposition");
        const filenameMatch = disposition && disposition.match(/filename="?([^"]+)"?/);
        a.download = filenameMatch ? filenameMatch[1] : `screening_report_${jobTitle || "candidates"}.pdf`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        showAlert("PDF report downloaded!", "success");
      } else {
        const err = await response.json();
        showAlert(err.error || "Failed to download PDF.", "error");
      }
    } catch {
      showAlert("Network error. Please try again.", "error");
    }
  };

  // ── Email helpers ──────────────────────────────────────────────────────────

  const buildEmailBody = (type, candidate) => {
    const name = candidate?.candidate_name || "there";
    const title = jobTitle || "the position";
    if (type === "acceptance") {
      return `Hi ${name},\n\nThank you for applying for the ${title} role. After reviewing your application, we're pleased to move forward and would love to schedule a conversation with you.\n\nPlease reply to this email with your availability for an interview, and we'll arrange a suitable time.\n\nLooking forward to speaking with you.`;
    }
    return `Hi ${name},\n\nThank you for taking the time to apply for the ${title} role. After careful consideration, we've decided to move forward with other candidates whose experience more closely matches our current requirements.\n\nWe appreciate your interest and wish you the best in your search.`;
  };

  const openEmailModal = (type, candidate) => {
    setEmailType(type);
    setEmailForm({
      to_email: candidate?.candidate_email || "",
      to_name: candidate?.candidate_name || "",
      subject: "",
      body: buildEmailBody(type, candidate),
    });
    setShowEmailModal(true);
  };

  const handleSendEmail = async () => {
    if (!emailForm.to_email.trim()) {
      showAlert("Please enter the candidate's email address.", "warning");
      return;
    }
    if (!emailForm.body.trim()) {
      showAlert("Email body cannot be empty.", "warning");
      return;
    }

    setSendingEmail(true);
    try {
      const token = localStorage.getItem(AUTH_CONSTANTS.TOKEN_KEY);
      const response = await fetch(`${BASE_URL}/recruiter/send-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          to_email: emailForm.to_email.trim(),
          to_name: emailForm.to_name.trim(),
          email_type: emailType,
          subject: emailForm.subject.trim(),
          body: emailForm.body.trim(),
          job_title: jobTitle,
          session_id: activeSession?.id ?? null,
          candidate_filename: selectedCandidate?.filename ?? "",
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        showAlert(
          data.error || "Failed to send email. Please try again.",
          "error",
        );
        return;
      }

      // Persist email_status into the results array so both the table
      // and the detail modal reflect it immediately and after reload.
      const updatedResults = (results || []).map((r) =>
        r.filename === selectedCandidate?.filename
          ? { ...r, email_status: emailType }
          : r,
      );
      setResults(updatedResults);

      // Keep the open modal in sync
      if (selectedCandidate?.filename) {
        setSelectedCandidate((prev) =>
          prev ? { ...prev, email_status: emailType } : prev,
        );
      }

      showAlert(
        `${emailType === "acceptance" ? "Acceptance" : "Rejection"} email sent to ${emailForm.to_email}.`,
        "success",
      );
      setShowEmailModal(false);
    } catch {
      showAlert(
        "Network error. Please check your connection and try again.",
        "error",
      );
    } finally {
      setSendingEmail(false);
    }
  };

  const getRecommendationBadge = (recommendation) => {
    const badges = {
      strongly_recommend: {
        bg: "#e6f4ea",
        color: "#1e8e3e",
        text: "Strongly Recommend",
      },
      recommend: { bg: "#e3f2fd", color: "#1a73e8", text: "Recommend" },
      consider: { bg: "#fff3cd", color: "#f57f17", text: "Consider" },
      not_recommended: {
        bg: "#fce8e6",
        color: "#d93025",
        text: "Not Recommended",
      },
    };
    const badge = badges[recommendation] || badges.consider;
    return (
      <span
        style={{
          backgroundColor: badge.bg,
          color: badge.color,
          padding: "4px 12px",
          borderRadius: "20px",
          fontSize: "0.85em",
          fontWeight: "600",
        }}
      >
        {badge.text}
      </span>
    );
  };

  const getScoreColor = (score) => {
    if (score >= 80) return "#1e8e3e";
    if (score >= 60) return "#f57f17";
    return "#d93025";
  };

  const handleLoginSuccess = (userData) => {
    login(userData);
    setIsPremiumUser(["premium", "pro"].includes(userData.subscription_type));
    setShowLoginModal(false);
  };

  const handleLogout = () => {
    setShowLogoutConfirm(true);
  };

  const confirmLogout = () => {
    logout();
    setShowLoginModal(true);
    setShowLogoutConfirm(false);
  };

  const closeAlertModal = () => {
    setAlertModal({ isOpen: false, message: "", type: "info" });
  };

  const closeUpgradeModal = () => {
    setShowUpgradeModal(false);
    setUpgradeModalData(null);
  };

  // Statistics calculations
  const getStatistics = () => {
    if (!results) return null;
    const validResults = results.filter((r) => !r.error);
    const stronglyRecommend = validResults.filter(
      (r) => r.recommendation === "strongly_recommend",
    );
    const recommend = validResults.filter(
      (r) => r.recommendation === "recommend",
    );
    const consider = validResults.filter(
      (r) => r.recommendation === "consider",
    );
    const notRecommended = validResults.filter(
      (r) => r.recommendation === "not_recommended",
    );
    const avgScore = validResults.length
      ? Math.round(
          validResults.reduce(
            (sum, r) => sum + (r.scores?.overall_match_score || 0),
            0,
          ) / validResults.length,
        )
      : 0;

    return {
      total: results.length,
      valid: validResults.length,
      stronglyRecommend: stronglyRecommend.length,
      recommend: recommend.length,
      consider: consider.length,
      notRecommended: notRecommended.length,
      avgScore,
    };
  };

  const stats = getStatistics();

  // Show initial page loader while loading data
  if (initialLoading) {
    return (
      <div style={styles.initialLoaderContainer}>
        <AnimatedLoader text="Loading" />
      </div>
    );
  }

  // Feature flag gate
  if (!isEnabled("recruiter_pipeline")) {
    return (
      <div style={styles.pageContainer}>
        <div style={{ ...styles.mainContainer, textAlign: "center", paddingTop: "80px" }}>
          <h2 style={{ color: "#666" }}>Recruiter Pipeline</h2>
          <p style={{ color: "#888" }}>This feature is temporarily unavailable.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.pageContainer}>
      {/* Sessions Sidebar */}
      {isPremiumUser && isAuthenticated && (
        <div
          style={{
            ...styles.sessionsPanel,
            width: showSessionsPanel ? "280px" : "50px",
            minWidth: showSessionsPanel ? "280px" : "50px",
          }}
        >
          <button
            onClick={() => setShowSessionsPanel(!showSessionsPanel)}
            style={styles.togglePanelButton}
          >
            {showSessionsPanel ? "◀" : "▶"}
          </button>

          {showSessionsPanel && (
            <>
              <div style={styles.sessionsPanelHeader}>
                <h3 className="section-title" style={{ margin: 0 }}>
                  Screening Sessions
                </h3>
                <button
                  onClick={handleStartNewSession}
                  style={styles.newSessionButton}
                >
                  + New
                </button>
              </div>

              {loadingSessions ? (
                <div style={{ padding: "30px 0", textAlign: "center" }}>
                  <AnimatedLoader text="Loading sessions" showSpinner />
                </div>
              ) : sessions.length === 0 ? (
                <p
                  style={{
                    color: "#666",
                    padding: "20px",
                    textAlign: "center",
                  }}
                >
                  No sessions yet. Start screening candidates!
                </p>
              ) : (
                <div style={styles.sessionsList}>
                  {sessions.map((session) => (
                    <div
                      key={session.id}
                      style={{
                        ...styles.sessionCard,
                        ...(activeSession?.id === session.id
                          ? styles.sessionCardActive
                          : {}),
                      }}
                    >
                      <div
                        style={styles.sessionCardContent}
                        onClick={() => loadSession(session.id)}
                      >
                        <h4 style={styles.sessionTitle}>
                          {session.job_title || "Untitled"}
                        </h4>
                        <p style={styles.sessionMeta}>
                          {session.total_candidates} candidate
                          {session.total_candidates !== 1 ? "s" : ""}
                          {session.has_report && " • Has Report"}
                        </p>
                        <p style={styles.sessionDate}>
                          {new Date(session.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteSession(session.id);
                        }}
                        style={styles.deleteSessionButton}
                        title="Delete session"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {/* Usage Counter */}
              {usageInfo && (
                <div style={styles.usageCounter}>
                  <p style={{ margin: 0, fontWeight: "600", color: "#1a73e8" }}>
                    Today's Usage
                  </p>
                  <p
                    style={{
                      margin: "5px 0 0 0",
                      fontSize: "0.9em",
                      color: "#666",
                    }}
                  >
                    {usageInfo.current_usage ?? 0} /{" "}
                    {usageInfo.effective_limit ?? usageInfo.daily_limit ?? 10}{" "}
                    analyses
                  </p>
                  <div style={styles.usageBar}>
                    <div
                      style={{
                        ...styles.usageBarFill,
                        width: `${Math.min(100, ((usageInfo.current_usage ?? 0) / (usageInfo.effective_limit ?? usageInfo.daily_limit ?? 10)) * 100)}%`,
                      }}
                    />
                  </div>
                  {usageInfo.remaining_analyses === 0 && (
                    <p
                      style={{
                        margin: "5px 0 0 0",
                        fontSize: "0.8em",
                        color: "#d93025",
                      }}
                    >
                      Daily limit reached
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Main Content */}
      <div style={styles.mainContainer}>
        {/* Header */}
        <div style={styles.headerContainer}>
          <div style={styles.headerLeft}>
            <h1 style={styles.header}>Recruiter Screening Tool</h1>
            <p style={styles.subHeader}>
              {activeSession
                ? `Editing: ${activeSession.job_title || "Untitled Position"}`
                : "Upload multiple resumes and screen candidates against your job requirements."}
            </p>
            <Link to="/matcher">
              <button style={styles.backButton}>← Back to Matcher</button>
            </Link>
          </div>
          {isAuthenticated && user && (
            <div style={styles.avatarContainer}>
              <UserAvatar user={user} onLogout={handleLogout} />
            </div>
          )}
        </div>

        {/* Main Content */}
        {!isAuthenticated ? (
          <div style={styles.centerMessage}>
            <p>Please log in to use the recruiter tool.</p>
          </div>
        ) : !isPremiumUser ? (
          <div style={styles.premiumRequired}>
            <div style={styles.premiumCard}>
              <h2 style={{ color: "#6366f1", marginBottom: "15px" }}>
                Pro Plan Required
              </h2>
              <p style={{ color: "#666", marginBottom: "8px" }}>
                The Recruiters Tool is available exclusively on the{" "}
                <strong>Pro plan</strong>. Upgrade to unlock batch resume
                screening, recruiter reports, and up to 100 analyses per day.
              </p>
              <p
                style={{
                  color: "#888",
                  fontSize: "13px",
                  marginBottom: "20px",
                }}
              >
                Pro plan — ₦100,000/month or $60/month
              </p>
              <button
                onClick={() => {
                  setUpgradeModalData({
                    message:
                      "Upgrade to the Pro plan to access the Recruiters Tool.",
                    type: "premium_required",
                    subscriptionType: user?.subscription_type || "free",
                  });
                  setShowUpgradeModal(true);
                }}
                style={styles.upgradeButton}
              >
                Upgrade to Premium
              </button>
            </div>
          </div>
        ) : (
          <div style={styles.mainContent}>
            {/* Session Loading Overlay */}
            {loadingSessionDetail && (
              <div style={styles.sessionLoadingOverlay}>
                <AnimatedLoader text="Loading session" showSpinner />
              </div>
            )}
            {/* Input Section */}
            <div style={styles.inputSection}>
              {/* Job Title */}
              <div style={styles.inputGroup}>
                <h3 style={styles.sectionTitle}>
                  Job Title{" "}
                  {activeSession && (
                    <span style={styles.editingBadge}>Editing Session</span>
                  )}
                </h3>
                <input
                  type="text"
                  value={jobTitle}
                  onChange={(e) => setJobTitle(e.target.value)}
                  placeholder="e.g., Senior Software Engineer, Product Manager"
                  style={styles.textInput}
                />
              </div>

              {/* Job Description */}
              <div style={styles.inputGroup}>
                <h3 style={styles.sectionTitle}>Job Description *</h3>
                <textarea
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  placeholder="Paste the full job description here..."
                  style={styles.textArea}
                  rows="8"
                  disabled={!!activeSession} // Disable editing if session is loaded
                />
                {activeSession && (
                  <p
                    style={{
                      color: "#666",
                      fontSize: "0.85em",
                      marginTop: "5px",
                    }}
                  >
                    Job description is locked for this session. Start a new
                    session to use a different JD.
                  </p>
                )}
              </div>

              {/* Resume Upload */}
              <div style={styles.inputGroup}>
                <h3 style={styles.sectionTitle}>
                  {activeSession ? "Add More Resumes" : "Upload Resumes"} (PDF
                  only, max 10)
                </h3>
                <input
                  type="file"
                  multiple
                  accept=".pdf"
                  onChange={handleFileChange}
                  style={styles.fileInput}
                />
                {resumeFiles.length > 0 && (
                  <div style={styles.fileList}>
                    <p style={{ fontWeight: "600", marginBottom: "10px" }}>
                      {resumeFiles.length} file(s) selected:
                    </p>
                    <ul style={{ margin: 0, paddingLeft: "20px" }}>
                      {resumeFiles.map((file, index) => (
                        <li
                          key={index}
                          style={{ color: "#666", fontSize: "0.9em" }}
                        >
                          {file.name}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {/* Error Message */}
              {error && <div style={styles.errorMessage}>{error}</div>}

              {/* Analyze Button */}
              <button
                onClick={handleAnalyze}
                disabled={
                  loading || !jobDescription.trim() || resumeFiles.length === 0
                }
                style={{
                  ...styles.primaryButton,
                  backgroundColor: loading ? "#ccc" : "#1a73e8",
                }}
              >
                {loading
                  ? "Analyzing..."
                  : activeSession
                    ? "Add & Analyze Candidates"
                    : "Analyze Candidates"}
              </button>
            </div>

            {/* Results Section */}
            {results && results.length > 0 && (
              <div style={styles.resultsSection}>
                <div style={styles.resultsHeader}>
                  <h2 className="section-title" style={{ margin: 0 }}>
                    Screening Results
                    {activeSession && (
                      <span
                        style={{
                          fontSize: "0.6em",
                          color: "#1a1a1a",
                          marginLeft: "10px",
                        }}
                      >
                        Session saved
                      </span>
                    )}
                  </h2>
                  <button
                    onClick={handleGenerateReport}
                    disabled={generatingReport}
                    style={{
                      ...styles.reportButton,
                      backgroundColor: generatingReport ? "#ccc" : "#34a853",
                    }}
                  >
                    {generatingReport ? "Generating..." : "Generate Report"}
                  </button>
                </div>

                {/* Statistics Summary */}
                {stats && (
                  <div style={styles.statsGrid}>
                    <div style={styles.statCard}>
                      <div style={styles.statNumber}>{stats.total}</div>
                      <div style={styles.statLabel}>Total Candidates</div>
                    </div>
                    <div style={styles.statCard}>
                      <div style={{ ...styles.statNumber, color: "#1e8e3e" }}>
                        {stats.stronglyRecommend}
                      </div>
                      <div style={styles.statLabel}>Strongly Recommend</div>
                    </div>
                    <div style={styles.statCard}>
                      <div style={{ ...styles.statNumber, color: "#1a73e8" }}>
                        {stats.recommend}
                      </div>
                      <div style={styles.statLabel}>Recommend</div>
                    </div>
                    <div style={styles.statCard}>
                      <div style={{ ...styles.statNumber, color: "#f57f17" }}>
                        {stats.consider}
                      </div>
                      <div style={styles.statLabel}>Consider</div>
                    </div>
                    <div style={styles.statCard}>
                      <div style={{ ...styles.statNumber, color: "#d93025" }}>
                        {stats.notRecommended}
                      </div>
                      <div style={styles.statLabel}>Not Recommended</div>
                    </div>
                    <div style={styles.statCard}>
                      <div
                        style={{
                          ...styles.statNumber,
                          color: getScoreColor(stats.avgScore),
                        }}
                      >
                        {stats.avgScore}%
                      </div>
                      <div style={styles.statLabel}>Avg. Match Score</div>
                    </div>
                  </div>
                )}

                {/* Results Table */}
                <div style={styles.tableContainer}>
                  <table style={styles.table}>
                    <thead>
                      <tr style={styles.tableHeader}>
                         <th style={styles.th}>Candidate</th>
                        <th
                          style={{ ...styles.th, cursor: "pointer" }}
                          onClick={() => handleSort("overall_match_score")}
                        >
                          Overall{" "}
                          {sortBy === "overall_match_score" &&
                            (sortOrder === "desc" ? "↓" : "↑")}
                        </th>
                        <th
                          style={{ ...styles.th, cursor: "pointer" }}
                          onClick={() => handleSort("skills_alignment_score")}
                        >
                          Skills{" "}
                          {sortBy === "skills_alignment_score" &&
                            (sortOrder === "desc" ? "↓" : "↑")}
                        </th>
                        <th
                          style={{ ...styles.th, cursor: "pointer" }}
                          onClick={() =>
                            handleSort("experience_relevance_score")
                          }
                        >
                          Experience{" "}
                          {sortBy === "experience_relevance_score" &&
                            (sortOrder === "desc" ? "↓" : "↑")}
                        </th>
                        <th style={styles.th}>Years Exp.</th>
                        <th style={styles.th}>Recommendation</th>
                        <th style={styles.th}>Email Status</th>
                        <th style={styles.th}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedResults.map((result) => (
                        <tr
                          key={result.filename || result.candidate_name}
                          style={styles.tableRow}
                        >
                          <td style={styles.td}>
                            <div>
                              <strong>
                                {result.candidate_name || "Unknown"}
                              </strong>
                              <div
                                style={{ fontSize: "0.85em", color: "#666" }}
                              >
                                {result.filename}
                              </div>
                            </div>
                          </td>
                          {result.error ? (
                            <td
                              colSpan="7"
                              style={{ ...styles.td, color: "#d93025" }}
                            >
                              Error: {result.error}
                            </td>
                          ) : (
                            <>
                              <td style={styles.td}>
                                <span
                                  style={{
                                    ...styles.scoreBadge,
                                    backgroundColor:
                                      getScoreColor(
                                        result.scores?.overall_match_score,
                                      ) + "20",
                                    color: getScoreColor(
                                      result.scores?.overall_match_score,
                                    ),
                                  }}
                                >
                                  {result.scores?.overall_match_score || 0}%
                                </span>
                              </td>
                              <td style={styles.td}>
                                {result.scores?.skills_alignment_score || 0}%
                              </td>
                              <td style={styles.td}>
                                {result.scores?.experience_relevance_score || 0}
                                %
                              </td>
                              <td style={styles.td}>
                                {result.years_experience || "N/A"}
                              </td>
                              <td style={styles.td}>
                                {getRecommendationBadge(result.recommendation)}
                              </td>
                              <td style={styles.td}>
                                {result.email_status ? (
                                  <span
                                    style={{
                                      display: "inline-block",
                                      padding: "3px 10px",
                                      borderRadius: 99,
                                      fontSize: 12,
                                      fontWeight: 600,
                                      background:
                                        result.email_status === "acceptance"
                                          ? "#e6f4ea"
                                          : "#fce8e6",
                                      color:
                                        result.email_status === "acceptance"
                                          ? "#1e8e3e"
                                          : "#d93025",
                                    }}
                                  >
                                    {result.email_status === "acceptance"
                                      ? "✓ Accepted"
                                      : "✕ Rejected"}
                                  </span>
                                ) : (
                                  <span style={{ color: "#aaa", fontSize: 12 }}>
                                    —
                                  </span>
                                )}
                              </td>
                              <td style={styles.td}>
                                <button
                                  onClick={() => handleViewCandidate(result)}
                                  style={styles.viewButton}
                                >
                                  View Details
                                </button>
                              </td>
                            </>
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Candidate Detail Modal */}
      {showCandidateModal && selectedCandidate && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <div style={styles.modalHeader}>
              <h2 className="section-title">Candidate Details</h2>
              <button
                onClick={() => setShowCandidateModal(false)}
                style={styles.closeButton}
              >
                ✕
              </button>
            </div>
            <div style={styles.modalBody}>
              <div style={styles.candidateHeader}>
                <h3 style={{ margin: 0, color: "#1a73e8" }}>
                  {selectedCandidate.candidate_name || "Unknown Candidate"}
                </h3>
                <p style={{ margin: "5px 0", color: "#666" }}>
                  {selectedCandidate.filename}
                </p>
                {/* Email sent badge */}
                {selectedCandidate.email_status && (
                  <span
                    style={{
                      display: "inline-block",
                      marginTop: 6,
                      padding: "3px 12px",
                      borderRadius: 99,
                      fontSize: 12,
                      fontWeight: 600,
                      background:
                        selectedCandidate.email_status === "acceptance"
                          ? "#e6f4ea"
                          : "#fce8e6",
                      color:
                        selectedCandidate.email_status === "acceptance"
                          ? "#1e8e3e"
                          : "#d93025",
                    }}
                  >
                    {selectedCandidate.email_status === "acceptance"
                      ? "✓ Acceptance email sent"
                      : "✕ Rejection email sent"}
                  </span>
                )}
                {getRecommendationBadge(selectedCandidate.recommendation)}
              </div>

              {/* Scores Grid */}
              <div style={styles.scoresGrid}>
                <div style={styles.scoreCard}>
                  <div
                    style={{
                      fontSize: "1.5em",
                      fontWeight: "bold",
                      color: getScoreColor(
                        selectedCandidate.scores?.overall_match_score,
                      ),
                    }}
                  >
                    {selectedCandidate.scores?.overall_match_score || 0}%
                  </div>
                  <div style={{ color: "#666", fontSize: "0.9em" }}>
                    Overall Match
                  </div>
                </div>
                <div style={styles.scoreCard}>
                  <div
                    style={{
                      fontSize: "1.5em",
                      fontWeight: "bold",
                      color: "#1a73e8",
                    }}
                  >
                    {selectedCandidate.scores?.skills_alignment_score || 0}%
                  </div>
                  <div style={{ color: "#666", fontSize: "0.9em" }}>Skills</div>
                </div>
                <div style={styles.scoreCard}>
                  <div
                    style={{
                      fontSize: "1.5em",
                      fontWeight: "bold",
                      color: "#34a853",
                    }}
                  >
                    {selectedCandidate.scores?.experience_relevance_score || 0}%
                  </div>
                  <div style={{ color: "#666", fontSize: "0.9em" }}>
                    Experience
                  </div>
                </div>
                <div style={styles.scoreCard}>
                  <div
                    style={{
                      fontSize: "1.5em",
                      fontWeight: "bold",
                      color: "#9c27b0",
                    }}
                  >
                    {selectedCandidate.years_experience || "N/A"}
                  </div>
                  <div style={{ color: "#666", fontSize: "0.9em" }}>
                    Years Exp.
                  </div>
                </div>
              </div>

              {/* Summary */}
              {selectedCandidate.summary && (
                <div style={styles.detailSection}>
                  <h4 style={styles.detailTitle}>Summary</h4>
                  <p style={{ color: "#333", lineHeight: "1.6" }}>
                    {selectedCandidate.summary}
                  </p>
                </div>
              )}

              {/* Matched Skills */}
              {selectedCandidate.matched_skills?.length > 0 && (
                <div style={styles.detailSection}>
                  <h4 style={styles.detailTitle}>Matched Skills</h4>
                  <div style={styles.tagGroup}>
                    {selectedCandidate.matched_skills.map((skill, i) => (
                      <span key={i} style={styles.tagMatched}>
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Missing Skills */}
              {selectedCandidate.missing_skills?.length > 0 && (
                <div style={styles.detailSection}>
                  <h4 style={styles.detailTitle}>Missing Skills</h4>
                  <div style={styles.tagGroup}>
                    {selectedCandidate.missing_skills.map((skill, i) => (
                      <span key={i} style={styles.tagMissing}>
                        {skill}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* All Scores */}
              <div style={styles.detailSection}>
                <h4 style={styles.detailTitle}>Detailed Scores</h4>
                <div style={styles.allScores}>
                  <div style={styles.scoreRow}>
                    <span>Keyword Match:</span>
                    <span style={{ fontWeight: "600" }}>
                      {selectedCandidate.scores?.keyword_match_score || 0}%
                    </span>
                  </div>
                  <div style={styles.scoreRow}>
                    <span>Skills Alignment:</span>
                    <span style={{ fontWeight: "600" }}>
                      {selectedCandidate.scores?.skills_alignment_score || 0}%
                    </span>
                  </div>
                  <div style={styles.scoreRow}>
                    <span>Experience Relevance:</span>
                    <span style={{ fontWeight: "600" }}>
                      {selectedCandidate.scores?.experience_relevance_score ||
                        0}
                      %
                    </span>
                  </div>
                  <div style={styles.scoreRow}>
                    <span>Formatting/Structure:</span>
                    <span style={{ fontWeight: "600" }}>
                      {selectedCandidate.scores?.formatting_structure_score ||
                        0}
                      %
                    </span>
                  </div>
                  <div style={styles.scoreRow}>
                    <span>Seniority Fit:</span>
                    <span style={{ fontWeight: "600" }}>
                      {selectedCandidate.scores?.seniority_fit_score || 0}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div
              style={{
                ...styles.modalFooter,
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 10,
              }}
            >
              {/* Email action buttons */}
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <button
                  onClick={() =>
                    openEmailModal("acceptance", selectedCandidate)
                  }
                  disabled={selectedCandidate?.email_status === "acceptance"}
                  title={
                    selectedCandidate?.email_status === "acceptance"
                      ? "Acceptance email already sent"
                      : ""
                  }
                  style={{
                    padding: "9px 18px",
                    backgroundColor: "#1e8e3e",
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    cursor:
                      selectedCandidate?.email_status === "acceptance"
                        ? "not-allowed"
                        : "pointer",
                    fontSize: 14,
                    fontWeight: 600,
                    opacity:
                      selectedCandidate?.email_status === "acceptance"
                        ? 0.6
                        : 1,
                  }}
                >
                  {selectedCandidate?.email_status === "acceptance"
                    ? "Accepted"
                    : "Send Acceptance"}
                </button>
                <button
                  onClick={() => openEmailModal("rejection", selectedCandidate)}
                  disabled={selectedCandidate?.email_status === "rejection"}
                  title={
                    selectedCandidate?.email_status === "rejection"
                      ? "Rejection email already sent"
                      : ""
                  }
                  style={{
                    padding: "9px 18px",
                    backgroundColor: "#d93025",
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    cursor:
                      selectedCandidate?.email_status === "rejection"
                        ? "not-allowed"
                        : "pointer",
                    fontSize: 14,
                    fontWeight: 600,
                    opacity:
                      selectedCandidate?.email_status === "rejection"
                        ? 0.6
                        : 1,
                  }}
                >
                  {selectedCandidate?.email_status === "rejection"
                    ? "Rejected"
                    : "Send Rejection"}
                </button>
              </div>
              <button
                onClick={() => setShowTemplatesModal(true)}
                style={{
                  padding: "9px 18px",
                  backgroundColor: "transparent",
                  color: "#1a73e8",
                  border: "1px solid #1a73e8",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontSize: 13,
                  fontWeight: 600,
                }}
              >
                Manage Templates
              </button>
              <button
                onClick={() => setShowCandidateModal(false)}
                style={styles.closeModalButton}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Email Compose Modal */}
      {showEmailModal && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.modalContent, maxWidth: 560 }}>
            <div style={styles.modalHeader}>
              <h2 className="section-title">
                {emailType === "acceptance"
                  ? "Send Acceptance Email"
                  : "Send Rejection Email"}
              </h2>
              <button
                onClick={() => setShowEmailModal(false)}
                style={styles.closeButton}
              >
                ✕
              </button>
            </div>

            <div style={styles.modalBody}>
              {/* To email */}
              <div style={{ marginBottom: 14 }}>
                <label
                  style={{
                    display: "block",
                    fontWeight: 600,
                    fontSize: 13,
                    marginBottom: 5,
                    color: "#333",
                  }}
                >
                  Candidate Email *
                </label>
                <input
                  type="email"
                  value={emailForm.to_email}
                  onChange={(e) =>
                    setEmailForm((f) => ({ ...f, to_email: e.target.value }))
                  }
                  placeholder="candidate@example.com"
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: 8,
                    border: "1px solid #ddd",
                    fontSize: 14,
                    boxSizing: "border-box",
                  }}
                />
                {!emailForm.to_email && (
                  <p
                    style={{
                      fontSize: 12,
                      color: "#f57f17",
                      margin: "4px 0 0",
                    }}
                  >
                    No email found in resume. Please enter it manually.
                  </p>
                )}
              </div>

              {/* Template Selector */}
              {emailTemplates.length > 0 && (
                <div style={{ marginBottom: 14 }}>
                  <label
                    style={{
                      display: "block",
                      fontWeight: 600,
                      fontSize: 13,
                      marginBottom: 5,
                      color: "#333",
                    }}
                  >
                    Apply Template{" "}
                    <span style={{ fontWeight: 400, color: "#888" }}>
                      (optional)
                    </span>
                  </label>
                  <select
                    value=""
                    onChange={(e) => {
                      const t = emailTemplates.find(
                        (tmpl) => tmpl.id === parseInt(e.target.value),
                      );
                      if (t) applyTemplate(t);
                      e.target.value = "";
                    }}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: 8,
                      border: "1px solid #ddd",
                      fontSize: 14,
                      backgroundColor: "#fff",
                    }}
                  >
                    <option value="">-- Select a template --</option>
                    {emailTemplates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name} ({t.email_type})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Subject */}
              <div style={{ marginBottom: 14 }}>
                <label
                  style={{
                    display: "block",
                    fontWeight: 600,
                    fontSize: 13,
                    marginBottom: 5,
                    color: "#333",
                  }}
                >
                  Subject{" "}
                  <span style={{ fontWeight: 400, color: "#888" }}>
                    (optional — auto-generated if blank)
                  </span>
                </label>
                <input
                  type="text"
                  value={emailForm.subject}
                  onChange={(e) =>
                    setEmailForm((f) => ({ ...f, subject: e.target.value }))
                  }
                  placeholder={
                    emailType === "acceptance"
                      ? `Your application for ${jobTitle || "the position"} — Next Steps`
                      : `Your application for ${jobTitle || "the position"} — Update`
                  }
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: 8,
                    border: "1px solid #ddd",
                    fontSize: 14,
                    boxSizing: "border-box",
                  }}
                />
              </div>

              {/* Body */}
              <div style={{ marginBottom: 6 }}>
                <label
                  style={{
                    display: "block",
                    fontWeight: 600,
                    fontSize: 13,
                    marginBottom: 5,
                    color: "#333",
                  }}
                >
                  Message *
                </label>
                <textarea
                  value={emailForm.body}
                  onChange={(e) =>
                    setEmailForm((f) => ({ ...f, body: e.target.value }))
                  }
                  rows={10}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: "1px solid #ddd",
                    fontSize: 14,
                    lineHeight: 1.6,
                    resize: "vertical",
                    fontFamily: "inherit",
                    boxSizing: "border-box",
                  }}
                />
              </div>
              <p style={{ fontSize: 12, color: "#888", margin: "4px 0 0" }}>
                You can edit the message above before sending. This email will
                be sent via your registered sender address.
              </p>
            </div>

            <div
              style={{
                ...styles.modalFooter,
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: 10,
              }}
            >
              <button
                onClick={() => setShowEmailModal(false)}
                style={styles.closeModalButton}
                disabled={sendingEmail}
              >
                Cancel
              </button>
              <button
                onClick={handleSendEmail}
                disabled={sendingEmail}
                style={{
                  padding: "10px 24px",
                  backgroundColor:
                    emailType === "acceptance" ? "#1e8e3e" : "#d93025",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  cursor: sendingEmail ? "not-allowed" : "pointer",
                  fontSize: 14,
                  fontWeight: 600,
                  opacity: sendingEmail ? 0.7 : 1,
                }}
              >
                {sendingEmail
                  ? "Sending..."
                  : `Send ${emailType === "acceptance" ? "Acceptance" : "Rejection"} Email`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Email Templates Management Modal */}
      {showTemplatesModal && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.modalContent, maxWidth: 560 }}>
            <div style={styles.modalHeader}>
              <h2 className="section-title">Email Templates</h2>
              <button
                onClick={() => {
                  setShowTemplatesModal(false);
                  setEditingTemplate(null);
                  setTemplateForm({
                    name: "",
                    email_type: "custom",
                    subject_template: "",
                    body_template: "",
                  });
                }}
                style={styles.closeButton}
              >
                ✕
              </button>
            </div>
            <div style={styles.modalBody}>
              {/* Template Form */}
              <div
                style={{
                  backgroundColor: "#f9f9f9",
                  padding: "16px",
                  borderRadius: 8,
                  marginBottom: 20,
                }}
              >
                <h4 style={{ margin: "0 0 12px 0", color: "#1a73e8" }}>
                  {editingTemplate ? "Edit Template" : "New Template"}
                </h4>
                <div style={{ marginBottom: 10 }}>
                  <input
                    type="text"
                    placeholder="Template name"
                    value={templateForm.name}
                    onChange={(e) =>
                      setTemplateForm((f) => ({ ...f, name: e.target.value }))
                    }
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: 6,
                      border: "1px solid #ddd",
                      fontSize: 14,
                      boxSizing: "border-box",
                      marginBottom: 8,
                    }}
                  />
                  <input
                    type="text"
                    placeholder="Subject (optional)"
                    value={templateForm.subject_template}
                    onChange={(e) =>
                      setTemplateForm((f) => ({
                        ...f,
                        subject_template: e.target.value,
                      }))
                    }
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: 6,
                      border: "1px solid #ddd",
                      fontSize: 14,
                      boxSizing: "border-box",
                      marginBottom: 8,
                    }}
                  />
                  <textarea
                    placeholder="Message body"
                    value={templateForm.body_template}
                    onChange={(e) =>
                      setTemplateForm((f) => ({
                        ...f,
                        body_template: e.target.value,
                      }))
                    }
                    rows={5}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: 6,
                      border: "1px solid #ddd",
                      fontSize: 14,
                      boxSizing: "border-box",
                      fontFamily: "inherit",
                      resize: "vertical",
                    }}
                  />
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    onClick={saveTemplate}
                    style={{
                      padding: "8px 18px",
                      backgroundColor: "#1a73e8",
                      color: "#fff",
                      border: "none",
                      borderRadius: 6,
                      cursor: "pointer",
                      fontWeight: 600,
                      fontSize: 13,
                    }}
                  >
                    {editingTemplate ? "Update" : "Save"} Template
                  </button>
                  {editingTemplate && (
                    <button
                      onClick={() => {
                        setEditingTemplate(null);
                        setTemplateForm({
                          name: "",
                          email_type: "custom",
                          subject_template: "",
                          body_template: "",
                        });
                      }}
                      style={{
                        padding: "8px 18px",
                        backgroundColor: "#666",
                        color: "#fff",
                        border: "none",
                        borderRadius: 6,
                        cursor: "pointer",
                        fontWeight: 600,
                        fontSize: 13,
                      }}
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>

              {/* Email Templates List */}
              {loadingTemplates ? (
                <div style={{ padding: "20px 0", textAlign: "center" }}>
                  <AnimatedLoader text="Loading templates" showSpinner />
                </div>
              ) : emailTemplates.length === 0 ? (
                <p style={{ color: "#666", textAlign: "center" }}>
                  No templates yet. Create one above.
                </p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {emailTemplates.map((t) => (
                    <div
                      key={t.id}
                      style={{
                        padding: "12px",
                        border: "1px solid #eee",
                        borderRadius: 8,
                        backgroundColor: "#fff",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "flex-start",
                      }}
                    >
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            fontWeight: 600,
                            fontSize: 14,
                            color: "#333",
                            marginBottom: 4,
                          }}
                        >
                          {t.name}
                        </div>
                        <div
                          style={{
                            fontSize: 12,
                            color: "#888",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {t.subject_template || "No subject"}
                        </div>
                      </div>
                      <div style={{ display: "flex", gap: 6, marginLeft: 8 }}>
                        <button
                          onClick={() => {
                            setEditingTemplate(t);
                            setTemplateForm({
                              name: t.name,
                              email_type: t.email_type,
                              subject_template: t.subject_template || "",
                              body_template: t.body_template,
                            });
                          }}
                          style={{
                            padding: "4px 10px",
                            fontSize: 12,
                            borderRadius: 4,
                            border: "1px solid #1a73e8",
                            background: "#fff",
                            color: "#1a73e8",
                            cursor: "pointer",
                          }}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deleteTemplate(t.id)}
                          style={{
                            padding: "4px 10px",
                            fontSize: 12,
                            borderRadius: 4,
                            border: "1px solid #d93025",
                            background: "#fff",
                            color: "#d93025",
                            cursor: "pointer",
                          }}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div style={styles.modalFooter}>
              <button
                onClick={() => {
                  setShowTemplatesModal(false);
                  setEditingTemplate(null);
                  setTemplateForm({
                    name: "",
                    email_type: "custom",
                    subject_template: "",
                    body_template: "",
                  });
                }}
                style={styles.closeModalButton}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Report Modal */}
      {showReportModal && report && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.modalContent, maxWidth: "800px" }}>
            <div style={styles.modalHeader}>
              <h2 className="section-title">Screening Report</h2>
              <button
                onClick={() => setShowReportModal(false)}
                style={styles.closeButton}
              >
                ✕
              </button>
            </div>
            <div style={styles.modalBody}>
              {/* Report Summary Stats */}
              <div style={styles.reportSummary}>
                <div style={styles.reportStat}>
                  <strong>{report.summary?.total_candidates || 0} </strong>
                  <span>Total</span>
                </div>
                <div style={styles.reportStat}>
                  <strong style={{ color: "#1e8e3e" }}>
                    {report.summary?.strongly_recommend || 0}{" "}
                  </strong>
                  <span>Strongly Recommend</span>
                </div>
                <div style={styles.reportStat}>
                  <strong style={{ color: "#1a73e8" }}>
                    {report.summary?.recommend || 0}{" "}
                  </strong>
                  <span>Recommend</span>
                </div>
                <div style={styles.reportStat}>
                  <strong style={{ color: "#f57f17" }}>
                    {report.summary?.consider || 0}{" "}
                  </strong>
                  <span>Consider</span>
                </div>
                <div style={styles.reportStat}>
                  <strong style={{ color: "#d93025" }}>
                    {report.summary?.not_recommended || 0}{" "}
                  </strong>
                  <span>Not Recommended</span>
                </div>
              </div>

              {/* Report Content */}
              <div style={styles.reportContent}>
                <pre style={styles.reportText}>{report.report}</pre>
              </div>

              {/* Action Buttons */}
              <div style={styles.reportActions}>
                <button onClick={handleCopyReport} style={styles.actionButton}>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect
                      x="9"
                      y="9"
                      width="13"
                      height="13"
                      rx="2"
                      ry="2"
                    ></rect>
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
                  </svg>
                  Copy Report
                </button>
                <button
                  onClick={handleDownloadReport}
                  style={{ ...styles.actionButton, backgroundColor: "#34a853" }}
                >
                  ⬇️ Download Report
                </button>
                <button
                  onClick={handleDownloadPDFReport}
                  style={{
                    ...styles.actionButton,
                    backgroundColor: "#d93025",
                  }}
                >
                  📄 Download PDF
                </button>
              </div>
            </div>
            <div style={styles.modalFooter}>
              <button
                onClick={() => setShowReportModal(false)}
                style={styles.closeModalButton}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onLogin={handleLoginSuccess}
      />
      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={closeUpgradeModal}
        modalData={upgradeModalData}
        onUpgradeToPremium={handleUpgradeToPremium}
      />
      <AlertModal
        isOpen={alertModal.isOpen}
        message={alertModal.message}
        type={alertModal.type}
        onClose={closeAlertModal}
      />
      {confirmModalData && (
        <ConfirmModal
          isOpen={showConfirmModal}
          onClose={() => setShowConfirmModal(false)}
          onConfirm={confirmModalData.onConfirm}
          title={confirmModalData.title}
          message={confirmModalData.message}
          confirmText={confirmModalData.confirmText}
        />
      )}
      {/* Background Job Progress Overlay */}
      {activeJobId && (
        <div style={styles.jobProgressOverlay}>
          <div style={styles.jobProgressCard}>
            <AnimatedLoader
              text="Analyzing candidates in background"
              helperText={`${jobProgress.progress} of ${jobProgress.total} processed`}
            />
            <div style={styles.progressBarContainer}>
              <div
                style={{
                  ...styles.progressBarFill,
                  width: `${jobProgress.total > 0 ? (jobProgress.progress / jobProgress.total) * 100 : 0}%`,
                }}
              />
            </div>
            <p style={styles.progressLabel}>
              {Math.round(
                jobProgress.total > 0
                  ? (jobProgress.progress / jobProgress.total) * 100
                  : 0,
              )}
              % Complete
            </p>
            {jobProgress.status && (
              <p style={styles.progressStatus}>{jobProgress.status}</p>
            )}
          </div>
        </div>
      )}

      {/* Generic loading overlay for synchronous analysis */}
      {loading && !activeJobId && (
        <div style={styles.jobProgressOverlay}>
          <div style={styles.jobProgressCard}>
            <AnimatedLoader text="Analyzing" />
          </div>
        </div>
      )}
      {showLogoutConfirm && (
        <ConfirmModal
          isOpen={showLogoutConfirm}
          onClose={() => setShowLogoutConfirm(false)}
          onConfirm={confirmLogout}
          title="Logout?"
          message="Are you sure you want to log out?"
          confirmText="Logout"
          confirmColor="#ef4444"
          cancelText="Cancel"
        />
      )}
    </div>
  );
};

// Styles
const styles = {
  initialLoaderContainer: {
    position: "fixed",
    inset: 0,
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 9999,
    backgroundColor: "#f4f7fa",
  },
  pageContainer: {
    display: "flex",
    minHeight: "100vh",
    backgroundColor: "#f4f7fa",
  },
  sessionsPanel: {
    backgroundColor: "#fff",
    borderRight: "1px solid #e0e0e0",
    padding: "20px",
    display: "flex",
    flexDirection: "column",
    transition: "width 0.3s ease",
    position: "relative",
    overflow: "hidden",
  },
  togglePanelButton: {
    position: "absolute",
    top: "10px",
    right: "10px",
    width: "30px",
    height: "30px",
    border: "1px solid #ddd",
    borderRadius: "4px",
    backgroundColor: "#fff",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "12px",
    color: "#666",
  },
  sessionsPanelHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "20px",
    paddingRight: "30px",
  },
  newSessionButton: {
    backgroundColor: "#1a73e8",
    color: "#fff",
    border: "none",
    padding: "6px 12px",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "0.85em",
    fontWeight: "600",
  },
  sessionsList: {
    flex: 1,
    overflowY: "auto",
  },
  sessionCard: {
    display: "flex",
    alignItems: "flex-start",
    padding: "12px",
    borderRadius: "8px",
    marginBottom: "10px",
    cursor: "pointer",
    backgroundColor: "#f9f9f9",
    border: "1px solid #eee",
    transition: "all 0.2s",
  },
  sessionCardActive: {
    backgroundColor: "#e3f2fd",
    borderColor: "#1a73e8",
  },
  sessionCardContent: {
    flex: 1,
  },
  sessionTitle: {
    margin: "0 0 5px 0",
    fontSize: "0.95em",
    color: "#333",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  sessionMeta: {
    margin: 0,
    fontSize: "0.8em",
    color: "#666",
  },
  sessionDate: {
    margin: "5px 0 0 0",
    fontSize: "0.75em",
    color: "#999",
  },
  deleteSessionButton: {
    backgroundColor: "transparent",
    border: "none",
    color: "#999",
    fontSize: "1.2em",
    cursor: "pointer",
    padding: "0 5px",
    marginLeft: "5px",
  },
  usageCounter: {
    padding: "15px",
    backgroundColor: "#f0f7ff",
    borderRadius: "8px",
    marginTop: "auto",
  },
  usageBar: {
    height: "6px",
    backgroundColor: "#e0e0e0",
    borderRadius: "3px",
    marginTop: "10px",
    overflow: "hidden",
  },
  usageBarFill: {
    height: "100%",
    backgroundColor: "#1a73e8",
    borderRadius: "3px",
    transition: "width 0.3s ease",
  },
  mainContainer: {
    flex: 1,
    padding: "30px",
    maxWidth: "1100px",
    overflow: "auto",
  },
  headerContainer: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "30px",
  },
  headerLeft: {
    flex: 1,
  },
  avatarContainer: {
    marginLeft: "20px",
  },
  header: {
    color: "#1a73e8",
    marginBottom: "5px",
  },
  subHeader: {
    color: "#5f6368",
    marginBottom: "15px",
  },
  backButton: {
    backgroundColor: "transparent",
    color: "#1a73e8",
    border: "1px solid #1a73e8",
    padding: "8px 16px",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "14px",
  },
  centerMessage: {
    textAlign: "center",
    padding: "60px 20px",
    color: "#666",
  },
  premiumRequired: {
    display: "flex",
    justifyContent: "center",
    padding: "60px 20px",
  },
  premiumCard: {
    backgroundColor: "#fff",
    padding: "40px",
    borderRadius: "12px",
    textAlign: "center",
    maxWidth: "500px",
    boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
  },
  upgradeButton: {
    backgroundColor: "#1a73e8",
    color: "#fff",
    border: "none",
    padding: "12px 30px",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "1em",
    fontWeight: "600",
  },
  mainContent: {
    display: "flex",
    flexDirection: "column",
    gap: "30px",
  },
  inputSection: {
    backgroundColor: "#fff",
    padding: "30px",
    borderRadius: "8px",
    border: "1px solid #dadce0",
  },
  inputGroup: {
    marginBottom: "20px",
  },
  sectionTitle: {
    color: "#202124",
    marginBottom: "10px",
    fontSize: "1em",
    fontWeight: "600",
    display: "flex",
    alignItems: "center",
    gap: "10px",
  },
  editingBadge: {
    backgroundColor: "#e3f2fd",
    color: "#1a73e8",
    padding: "4px 10px",
    borderRadius: "20px",
    fontSize: "0.75em",
    fontWeight: "500",
  },
  textInput: {
    width: "100%",
    padding: "12px 15px",
    border: "1px solid #ddd",
    borderRadius: "8px",
    fontSize: "1em",
    outline: "none",
  },
  textArea: {
    width: "100%",
    padding: "15px",
    border: "1px solid #ccc",
    borderRadius: "4px",
    resize: "vertical",
    fontSize: "1em",
    backgroundColor: "#f9f9f9",
    color: "#202124",
  },
  fileInput: {
    padding: "20px",
    border: "2px dashed #ccc",
    borderRadius: "8px",
    backgroundColor: "#f9f9f9",
    display: "block",
    width: "100%",
    cursor: "pointer",
  },
  fileList: {
    marginTop: "15px",
    padding: "15px",
    backgroundColor: "#f0f7ff",
    borderRadius: "8px",
  },
  errorMessage: {
    backgroundColor: "#fce8e6",
    color: "#d93025",
    padding: "12px 15px",
    borderRadius: "8px",
    marginBottom: "15px",
  },
  primaryButton: {
    width: "100%",
    padding: "15px",
    backgroundColor: "#1a73e8",
    color: "white",
    border: "none",
    borderRadius: "8px",
    fontSize: "1.1em",
    fontWeight: "600",
    cursor: "pointer",
  },
  resultsSection: {
    backgroundColor: "#fff",
    padding: "30px",
    borderRadius: "8px",
    border: "2px solid #1a73e8",
  },
  resultsHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "20px",
    flexWrap: "wrap",
    gap: "15px",
  },
  reportButton: {
    padding: "10px 20px",
    backgroundColor: "#34a853",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    fontWeight: "600",
  },
  statsGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
    gap: "15px",
    marginBottom: "25px",
  },
  statCard: {
    backgroundColor: "#f9f9f9",
    padding: "20px",
    borderRadius: "8px",
    textAlign: "center",
    border: "1px solid #eee",
  },
  statNumber: {
    fontSize: "1.8em",
    fontWeight: "bold",
    color: "#1a73e8",
  },
  statLabel: {
    color: "#666",
    fontSize: "0.8em",
    marginTop: "5px",
  },
  tableContainer: {
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  tableHeader: {
    backgroundColor: "#f1f3f4",
  },
  th: {
    padding: "12px 15px",
    textAlign: "left",
    fontWeight: "600",
    color: "#202124",
    borderBottom: "2px solid #dadce0",
  },
  tableRow: {
    borderBottom: "1px solid #eee",
  },
  td: {
    color: "gray",
    padding: "12px 15px",
    verticalAlign: "middle",
  },
  scoreBadge: {
    padding: "4px 12px",
    borderRadius: "20px",
    fontWeight: "600",
    fontSize: "0.9em",
  },
  viewButton: {
    backgroundColor: "#1a73e8",
    color: "#fff",
    border: "none",
    padding: "6px 12px",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "0.85em",
  },
  modalOverlay: {
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
    overflowY: "auto",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: "12px",
    boxShadow: "0 10px 40px rgba(0, 0, 0, 0.2)",
    width: "100%",
    maxWidth: "700px",
    maxHeight: "90vh",
    overflow: "auto",
    display: "flex",
    flexDirection: "column",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "20px 30px",
    borderBottom: "2px solid #1a73e8",
    position: "sticky",
    top: 0,
    backgroundColor: "#fff",
    zIndex: 1001,
  },
  closeButton: {
    background: "none",
    border: "none",
    fontSize: "1.5em",
    cursor: "pointer",
    color: "#999",
    padding: "0",
  },
  modalBody: {
    padding: "30px",
    flex: 1,
    overflowY: "auto",
  },
  modalFooter: {
    padding: "15px 30px",
    borderTop: "1px solid #eee",
    display: "flex",
    justifyContent: "flex-end",
    backgroundColor: "#f9f9f9",
  },
  closeModalButton: {
    backgroundColor: "#666",
    color: "#fff",
    border: "none",
    padding: "10px 25px",
    borderRadius: "8px",
    cursor: "pointer",
    fontWeight: "600",
  },
  candidateHeader: {
    marginBottom: "25px",
    paddingBottom: "20px",
    borderBottom: "1px solid #eee",
  },
  scoresGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(4, 1fr)",
    gap: "15px",
    marginBottom: "25px",
  },
  scoreCard: {
    backgroundColor: "#f9f9f9",
    padding: "15px",
    borderRadius: "8px",
    textAlign: "center",
  },
  detailSection: {
    marginBottom: "25px",
  },
  detailTitle: {
    color: "#1a73e8",
    marginBottom: "10px",
    fontSize: "1em",
  },
  tagGroup: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
  },
  tagMatched: {
    backgroundColor: "#e6f4ea",
    color: "#1e8e3e",
    padding: "6px 12px",
    borderRadius: "20px",
    fontSize: "0.85em",
    fontWeight: "600",
  },
  tagMissing: {
    backgroundColor: "#fce8e6",
    color: "#d93025",
    padding: "6px 12px",
    borderRadius: "20px",
    fontSize: "0.85em",
    fontWeight: "600",
  },
  allScores: {
    backgroundColor: "#f9f9f9",
    borderRadius: "8px",
    padding: "15px",
  },
  scoreRow: {
    display: "flex",
    justifyContent: "space-between",
    padding: "8px 0",
    color: "#333",
    borderBottom: "1px solid #eee",
  },
  reportSummary: {
    display: "flex",
    justifyContent: "space-around",
    flexWrap: "wrap",
    gap: "15px",
    marginBottom: "25px",
    padding: "20px",
    backgroundColor: "#f9f9f9",
    borderRadius: "8px",
  },
  reportStat: {
    textAlign: "center",
    color: "#333",
  },
  reportContent: {
    backgroundColor: "#f9f9f9",
    border: "1px solid #e0e0e0",
    borderRadius: "8px",
    padding: "20px",
    maxHeight: "400px",
    overflowY: "auto",
  },
  reportText: {
    whiteSpace: "pre-wrap",
    fontFamily: "Georgia, 'Times New Roman', serif",
    fontSize: "0.95em",
    lineHeight: "1.8",
    color: "#333",
    margin: 0,
  },
  reportActions: {
    display: "flex",
    gap: "10px",
    marginTop: "20px",
    flexWrap: "wrap",
  },
  actionButton: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "10px 20px",
    backgroundColor: "#1a73e8",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    fontWeight: "600",
  },
  jobProgressOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(255, 255, 255, 0.85)",
    backdropFilter: "blur(4px)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1002,
  },
  sessionLoadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(244, 247, 250, 0.85)",
    backdropFilter: "blur(2px)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
    borderRadius: "8px",
  },
  jobProgressCard: {
    backgroundColor: "#fff",
    padding: "40px 50px",
    borderRadius: "16px",
    boxShadow: "0 20px 60px rgba(0,0,0,0.15)",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    minWidth: "320px",
  },
  progressBarContainer: {
    width: "100%",
    height: "10px",
    backgroundColor: "#e0e0e0",
    borderRadius: "5px",
    overflow: "hidden",
    marginTop: "20px",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#1a73e8",
    borderRadius: "5px",
    transition: "width 0.3s ease",
  },
  progressLabel: {
    marginTop: "12px",
    fontWeight: "600",
    color: "#1a73e8",
    fontSize: "0.95em",
  },
  progressStatus: {
    marginTop: "8px",
    fontSize: "0.85em",
    color: "#666",
    textTransform: "capitalize",
  },
};

export default RecruitersView;
