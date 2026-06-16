import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AlertModal from "../components/AlertModal";
import LoginModal from "../components/auth/LoginModal";
import { AUTH_CONSTANTS, BASE_URL } from "../constants/auth_constants";
import { useAuth } from "../contexts/AuthContext";

/* ─── helpers ──────────────────────────────────────────────── */
const fmtDate = (iso) =>
  iso ? new Date(iso).toLocaleDateString(undefined, { dateStyle: "medium" }) : "—";
const fmtDateTime = (iso) =>
  iso
    ? new Date(iso).toLocaleString(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      })
    : "—";

const ScoreBadge = ({ score }) => {
  const color = score >= 75 ? "#4ade80" : score >= 50 ? "#fbbf24" : "#f87171";
  const bg = score >= 75 ? "rgba(74,222,128,0.12)" : score >= 50 ? "rgba(251,191,36,0.12)" : "rgba(248,113,113,0.12)";
  return (
    <span
      style={{
        display: "inline-block",
        padding: "3px 12px",
        borderRadius: 99,
        fontSize: 13,
        fontWeight: 700,
        background: bg,
        color,
      }}
    >
      {score}%
    </span>
  );
};

const TypeBadge = ({ children }) => (
  <span
    style={{
      fontSize: 12,
      fontWeight: 600,
      color: "#cbd5e1",
      background: "rgba(148,163,184,0.15)",
      padding: "4px 12px",
      borderRadius: 8,
    }}
  >
    {children}
  </span>
);

const SectionTitle = ({ children }) => (
  <h4 style={{ margin: "24px 0 10px", fontSize: 14, fontWeight: 700, color: "#f1f5f9" }}>
    {children}
  </h4>
);

/* ─── Interview Prep Renderer ──────────────────────────────── */
const InterviewPrepContent = ({ data }) => {
  if (!data) return null;

  /* If the backend stored a raw string, just show it */
  if (typeof data === "string") {
    return (
      <div style={{ whiteSpace: "pre-wrap", fontSize: 14, lineHeight: 1.7, color: "#e2e8f0" }}>
        {data}
      </div>
    );
  }

  /* Structured JSON with key_talking_points */
  if (Array.isArray(data.key_talking_points)) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {data.key_talking_points.map((pt, idx) => (
          <div
            key={idx}
            style={{
              background: "rgba(30,41,59,0.6)",
              border: "1px solid rgba(148,163,184,0.15)",
              borderRadius: 10,
              padding: 16,
            }}
          >
            {pt.topic && (
              <h5 style={{ margin: "0 0 8px", fontSize: 14, fontWeight: 700, color: "#38bdf8" }}>
                {pt.topic}
              </h5>
            )}
            {pt.how_to_present && (
              <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: "#cbd5e1" }}>
                {pt.how_to_present}
              </p>
            )}
          </div>
        ))}
      </div>
    );
  }

  /* Fallback: generic object rendering */
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {Object.entries(data).map(([key, value]) => (
        <div key={key}>
          <h5 style={{ margin: "0 0 6px", fontSize: 13, fontWeight: 700, color: "#94a3b8", textTransform: "capitalize" }}>
            {key.replace(/_/g, " ")}
          </h5>
          {Array.isArray(value) ? (
            value.map((v, i) => (
              <div key={i} style={{ marginBottom: 8, paddingLeft: 12, borderLeft: "2px solid rgba(148,163,184,0.2)" }}>
                {typeof v === "object" ? (
                  Object.entries(v).map(([k2, v2]) => (
                    <p key={k2} style={{ margin: "2px 0", fontSize: 13, color: "#cbd5e1" }}>
                      <strong style={{ color: "#e2e8f0" }}>{k2.replace(/_/g, " ")}:</strong> {String(v2)}
                    </p>
                  ))
                ) : (
                  <p style={{ margin: 0, fontSize: 13, color: "#cbd5e1" }}>{String(v)}</p>
                )}
              </div>
            ))
          ) : (
            <p style={{ margin: 0, fontSize: 14, color: "#cbd5e1", whiteSpace: "pre-wrap" }}>
              {String(value)}
            </p>
          )}
        </div>
      ))}
    </div>
  );
};

/* ─── Detail Modal ─────────────────────────────────────────── */
const DetailModal = ({ item, type, onClose }) => {
  if (!item) return null;

  const isAnalysis = type === "analyses";
  const isCoverLetter = type === "cover_letters";
  const isInterview = type === "interview_preps";

  let analysisResult = null;
  if (isAnalysis && item.result) {
    try {
      analysisResult = typeof item.result === "string" ? JSON.parse(item.result) : item.result;
    } catch {
      analysisResult = null;
    }
  }

  let interviewData = null;
  if (isInterview && item.result) {
    try {
      interviewData = typeof item.result === "string" ? JSON.parse(item.result) : item.result;
    } catch {
      interviewData = item.result;
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.7)",
        backdropFilter: "blur(4px)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        zIndex: 2000,
        padding: 20,
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        style={{
          background: "#0f172a",
          border: "1px solid rgba(148,163,184,0.2)",
          borderRadius: 16,
          width: "100%",
          maxWidth: 680,
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
        }}
      >
        {/* header */}
        <div
          style={{
            padding: "24px 28px",
            borderBottom: "1px solid rgba(148,163,184,0.15)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 16,
            position: "sticky",
            top: 0,
            background: "#0f172a",
            zIndex: 1,
          }}
        >
          <div>
            <h3 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 800, color: "#f8fafc" }}>
              {isAnalysis && "Resume Analysis"}
              {isCoverLetter && "Cover Letter"}
              {isInterview && "Interview Prep"}
            </h3>
            <p style={{ margin: 0, fontSize: 13, color: "#94a3b8" }}>
              {fmtDateTime(item.created_at)}
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "rgba(148,163,184,0.15)",
              border: "none",
              borderRadius: "50%",
              width: 32,
              height: 32,
              cursor: "pointer",
              fontSize: 18,
              color: "#cbd5e1",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            ×
          </button>
        </div>

        {/* body */}
        <div style={{ padding: "20px 28px 28px" }}>
          {/* Job / Company info */}
          {(item.job_title || item.company_name) && (
            <div style={{ marginBottom: 16 }}>
              {item.job_title && (
                <p style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 700, color: "#f1f5f9" }}>
                  {item.job_title}
                </p>
              )}
              {item.company_name && (
                <p style={{ margin: 0, fontSize: 13, color: "#94a3b8" }}>
                  {item.company_name}
                </p>
              )}
            </div>
          )}

          {/* ── Analysis detail ── */}
          {isAnalysis && (
            <>
              {item.overall_match_score != null && (
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
                  <span style={{ fontSize: 14, fontWeight: 600, color: "#cbd5e1" }}>
                    Overall Match:
                  </span>
                  <ScoreBadge score={item.overall_match_score} />
                </div>
              )}

              {analysisResult?.summary && (
                <>
                  <SectionTitle>Summary</SectionTitle>
                  <p style={{ margin: 0, fontSize: 14, lineHeight: 1.6, color: "#cbd5e1" }}>
                    {analysisResult.summary}
                  </p>
                </>
              )}

              {Array.isArray(analysisResult?.matched_skills) &&
                analysisResult.matched_skills.length > 0 && (
                  <>
                    <SectionTitle>Matched Skills</SectionTitle>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {analysisResult.matched_skills.map((s) => (
                        <span
                          key={s}
                          style={{
                            background: "rgba(74,222,128,0.12)",
                            color: "#4ade80",
                            padding: "4px 10px",
                            borderRadius: 6,
                            fontSize: 12,
                            fontWeight: 600,
                          }}
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </>
                )}

              {Array.isArray(analysisResult?.missing_skills) &&
                analysisResult.missing_skills.length > 0 && (
                  <>
                    <SectionTitle>Missing Skills</SectionTitle>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                      {analysisResult.missing_skills.map((s) => (
                        <span
                          key={s}
                          style={{
                            background: "rgba(248,113,113,0.12)",
                            color: "#f87171",
                            padding: "4px 10px",
                            borderRadius: 6,
                            fontSize: 12,
                            fontWeight: 600,
                          }}
                        >
                          {s}
                        </span>
                      ))}
                    </div>
                  </>
                )}

              {typeof analysisResult?.recommendation === "string" && (
                <>
                  <SectionTitle>Recommendation</SectionTitle>
                  <p style={{ margin: 0, fontSize: 14, color: "#e2e8f0", fontWeight: 600 }}>
                    {analysisResult.recommendation
                      .replace(/_/g, " ")
                      .replace(/\b\w/g, (l) => l.toUpperCase())}
                  </p>
                </>
              )}

              {item.job_description && (
                <>
                  <SectionTitle>Job Description</SectionTitle>
                  <div
                    style={{
                      background: "rgba(30,41,59,0.5)",
                      borderRadius: 10,
                      padding: 14,
                      fontSize: 13,
                      lineHeight: 1.6,
                      color: "#cbd5e1",
                      maxHeight: 200,
                      overflowY: "auto",
                    }}
                  >
                    {item.job_description}
                  </div>
                </>
              )}
            </>
          )}

          {/* ── Cover Letter detail ── */}
          {isCoverLetter && (
            <>
              {item.word_count != null && (
                <div style={{ marginBottom: 16 }}>
                  <TypeBadge>{item.word_count} words</TypeBadge>
                </div>
              )}
              {item.cover_letter && (
                <div
                  style={{
                    background: "rgba(30,41,59,0.5)",
                    borderRadius: 10,
                    padding: 18,
                    fontSize: 14,
                    lineHeight: 1.7,
                    color: "#e2e8f0",
                    whiteSpace: "pre-wrap",
                    maxHeight: "55vh",
                    overflowY: "auto",
                  }}
                >
                  {item.cover_letter}
                </div>
              )}
            </>
          )}

          {/* ── Interview Prep detail ── */}
          {isInterview && (
            <InterviewPrepContent data={interviewData} />
          )}
        </div>
      </div>
    </div>
  );
};

/* ─── Tab Button ───────────────────────────────────────────── */
const TabButton = ({ label, active, onClick, count }) => (
  <button
    onClick={onClick}
    style={{
      padding: "10px 18px",
      border: "none",
      borderRadius: 8,
      cursor: "pointer",
      fontWeight: 600,
      fontSize: 14,
      background: active ? "#1a73e8" : "rgba(148,163,184,0.15)",
      color: active ? "#fff" : "#cbd5e1",
      transition: "all 0.2s",
      display: "flex",
      alignItems: "center",
      gap: 6,
    }}
  >
    {label}
    {count > 0 && (
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          minWidth: 20,
          height: 20,
          padding: "0 6px",
          borderRadius: 10,
          fontSize: 11,
          fontWeight: 700,
          background: active ? "rgba(255,255,255,0.25)" : "rgba(148,163,184,0.2)",
          color: active ? "#fff" : "#cbd5e1",
        }}
      >
        {count}
      </span>
    )}
  </button>
);

/* ─── Main page ─────────────────────────────────────────────── */
const MyAnalysisPage = () => {
  const { user, isAuthenticated, login } = useAuth();

  const [activeTab, setActiveTab] = useState("analyses");
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [alertModal, setAlertModal] = useState({ isOpen: false, message: "", type: "info" });
  const [selectedItem, setSelectedItem] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const showAlert = (msg, type = "info") =>
    setAlertModal({ isOpen: true, message: msg, type });
  const closeAlert = () =>
    setAlertModal({ isOpen: false, message: "", type: "info" });

  /* ── auth check + data load ── */
  useEffect(() => {
    if (isAuthenticated && user) {
      loadMyAnalysis();
    } else if (!isAuthenticated && user === null) {
      setShowLoginModal(true);
    }
  }, [isAuthenticated, user]);

  const loadMyAnalysis = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem(AUTH_CONSTANTS.TOKEN_KEY);
      const res = await fetch(`${BASE_URL}/my-analysis`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await res.json();
      if (!res.ok) {
        if (d.upgrade_required) {
          setData("upgrade_required");
          return;
        }
        throw new Error(d.error || "Failed to load analysis history");
      }
      setData(d);
    } catch (err) {
      showAlert(err.message || "Unable to load your analysis history.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSuccess = (userData) => {
    login(userData);
    setShowLoginModal(false);
    loadMyAnalysis();
  };

  const openDetail = (item) => {
    setSelectedItem(item);
    setShowDetailModal(true);
  };

  /* ── derived counts ── */
  const counts =
    data && data !== "upgrade_required"
      ? {
          analyses: data.pagination?.analyses_total ?? 0,
          cover_letters: data.pagination?.cover_letters_total ?? 0,
          interview_preps: data.pagination?.interview_preps_total ?? 0,
        }
      : { analyses: 0, cover_letters: 0, interview_preps: 0 };

  const items =
    data && data !== "upgrade_required"
      ? data[activeTab === "analyses" ? "analyses" : activeTab] || []
      : [];

  return (
    <div
      style={{
        maxWidth: 960,
        margin: "0 auto",
        padding: "40px 20px 80px",
        minHeight: "80vh",
      }}
    >
      <h1
        style={{
          fontSize: "clamp(1.5rem, 4vw, 2rem)",
          fontWeight: 800,
          marginBottom: 6,
          color: "#f8fafc",
        }}
      >
        My Analysis
      </h1>
      <p style={{ color: "#94a3b8", marginBottom: 28 }}>
        Everything you’ve run — resumes, cover letters, and interview prep — in
        one place.
      </p>

      {!isAuthenticated && !loading && (
        <div
          style={{
            background: "rgba(30,41,59,0.6)",
            border: "1px solid rgba(148,163,184,0.15)",
            borderRadius: 16,
            padding: 40,
            textAlign: "center",
          }}
        >
          <h3 style={{ marginBottom: 8, color: "#f1f5f9" }}>
            Sign in to view your history
          </h3>
          <p style={{ color: "#94a3b8", marginBottom: 20 }}>
            Your past analyses, cover letters, and interview prep sessions are
            saved to your account.
          </p>
          <button
            className="primary-btn"
            onClick={() => setShowLoginModal(true)}
          >
            Log In
          </button>
        </div>
      )}

      {isAuthenticated && data === "upgrade_required" && (
        <div
          style={{
            background: "rgba(146,64,14,0.15)",
            border: "1px solid rgba(251,191,36,0.25)",
            borderRadius: 16,
            padding: 40,
            textAlign: "center",
          }}
        >
          <h3 style={{ color: "#fbbf24", marginBottom: 8 }}>
            Premium feature required
          </h3>
          <p style={{ color: "#fde68a", marginBottom: 20 }}>
            Upgrade to Premium or Pro to view your full analysis history.
          </p>
          <Link to="/subscribe" className="primary-btn">
            Upgrade now
          </Link>
        </div>
      )}

      {isAuthenticated && data && data !== "upgrade_required" && !loading && (
        <>
          {/* Tabs */}
          <div
            style={{
              display: "flex",
              gap: 10,
              flexWrap: "wrap",
              marginBottom: 24,
            }}
          >
            <TabButton
              label="Analyses"
              active={activeTab === "analyses"}
              onClick={() => setActiveTab("analyses")}
              count={counts.analyses}
            />
            <TabButton
              label="Cover Letters"
              active={activeTab === "cover_letters"}
              onClick={() => setActiveTab("cover_letters")}
              count={counts.cover_letters}
            />
            <TabButton
              label="Interview Prep"
              active={activeTab === "interview_preps"}
              onClick={() => setActiveTab("interview_preps")}
              count={counts.interview_preps}
            />
          </div>

          {/* Table */}
          {items.length === 0 ? (
            <div
              style={{
                background: "rgba(30,41,59,0.6)",
                border: "1px solid rgba(148,163,184,0.15)",
                borderRadius: 16,
                padding: 40,
                textAlign: "center",
                color: "#94a3b8",
              }}
            >
              No {activeTab.replace("_", " ")} yet. Head to the{" "}
              <Link to="/matcher" style={{ color: "#38bdf8", fontWeight: 600 }}>
                matcher
              </Link>{" "}
              to get started.
            </div>
          ) : (
            <div
              style={{
                background: "rgba(15,23,42,0.7)",
                borderRadius: 14,
                border: "1px solid rgba(148,163,184,0.12)",
                overflow: "hidden",
              }}
            >
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "rgba(30,41,59,0.8)" }}>
                    <th
                      style={{
                        textAlign: "left",
                        padding: "14px 18px",
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#94a3b8",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                      }}
                    >
                      Created
                    </th>
                    <th
                      style={{
                        textAlign: "left",
                        padding: "14px 18px",
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#94a3b8",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                      }}
                    >
                      Job Title
                    </th>
                    <th
                      style={{
                        textAlign: "left",
                        padding: "14px 18px",
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#94a3b8",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                      }}
                    >
                      {activeTab === "analyses" ? "Score" : "Type"}
                    </th>
                    <th
                      style={{
                        textAlign: "right",
                        padding: "14px 18px",
                        fontSize: 12,
                        fontWeight: 700,
                        color: "#94a3b8",
                        textTransform: "uppercase",
                        letterSpacing: "0.05em",
                      }}
                    >
                      Action
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr
                      key={item.id}
                      style={{
                        borderTop: "1px solid rgba(148,163,184,0.1)",
                        transition: "background 0.15s",
                        cursor: "pointer",
                      }}
                      onClick={() => openDetail(item)}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.background = "rgba(30,41,59,0.5)")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.background = "transparent")
                      }
                    >
                      <td
                        style={{
                          padding: "14px 18px",
                          fontSize: 14,
                          color: "#cbd5e1",
                        }}
                      >
                        {fmtDate(item.created_at)}
                      </td>
                      <td
                        style={{
                          padding: "14px 18px",
                          fontSize: 14,
                          color: "#f1f5f9",
                          fontWeight: 600,
                        }}
                      >
                        {item.job_title || item.company_name || "Untitled"}
                      </td>
                      <td style={{ padding: "14px 18px" }}>
                        {activeTab === "analyses" ? (
                          <ScoreBadge score={item.overall_match_score ?? 0} />
                        ) : (
                          <TypeBadge>
                            {activeTab === "cover_letters"
                              ? "Cover Letter"
                              : "Interview Prep"}
                          </TypeBadge>
                        )}
                      </td>
                      <td
                        style={{
                          padding: "14px 18px",
                          textAlign: "right",
                        }}
                      >
                        <button
                          style={{
                            fontSize: 13,
                            fontWeight: 600,
                            color: "#38bdf8",
                            background: "rgba(56,189,248,0.1)",
                            border: "none",
                            borderRadius: 6,
                            padding: "6px 14px",
                            cursor: "pointer",
                            transition: "background 0.15s",
                          }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.background = "rgba(56,189,248,0.2)")
                          }
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.background = "rgba(56,189,248,0.1)")
                          }
                          onClick={(e) => {
                            e.stopPropagation();
                            openDetail(item);
                          }}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {loading && (
        <div style={{ textAlign: "center", padding: 60, color: "#94a3b8" }}>
          <div
            style={{
              width: 36,
              height: 36,
              border: "3px solid rgba(148,163,184,0.2)",
              borderTopColor: "#38bdf8",
              borderRadius: "50%",
              animation: "spin 0.8s linear infinite",
              margin: "0 auto 16px",
            }}
          />
          Loading your history…
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && (
        <DetailModal
          item={selectedItem}
          type={activeTab}
          onClose={() => {
            setShowDetailModal(false);
            setSelectedItem(null);
          }}
        />
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

export default MyAnalysisPage;
