import { useEffect, useState } from "react";
import { AUTH_CONSTANTS, BASE_URL } from "../constants/auth_constants";
import { useFeatures } from "../contexts/FeaturesContext";
import AlertModal from "../components/AlertModal";
import LoginModal from "../components/auth/LoginModal";
import AnimatedLoader from "../components/loaders/animated-loader/AnimatedLoader";

const STAGES = [
  { key: "applied", label: "Applied", color: "#64748b" },
  { key: "phone_screen", label: "Phone Screen", color: "#3b82f6" },
  { key: "interview", label: "Interview", color: "#8b5cf6" },
  { key: "offer", label: "Offer", color: "#f59e0b" },
  { key: "accepted", label: "Accepted", color: "#22c55e" },
  { key: "rejected", label: "Rejected", color: "#ef4444" },
  { key: "ghosted", label: "Ghosted", color: "#94a3b8" },
];

const STAGE_ORDER = STAGES.map((s) => s.key);

const JobTrackerPage = () => {
  const { isEnabled } = useFeatures();
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [alertModal, setAlertModal] = useState({ isOpen: false, message: "", type: "info" });

  // Modal states
  const [showFormModal, setShowFormModal] = useState(false);
  const [editingApp, setEditingApp] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedApp, setSelectedApp] = useState(null);

  // Saved resumes and analyses for linking
  const [savedResumes, setSavedResumes] = useState([]);
  const [savedAnalyses, setSavedAnalyses] = useState([]);

  const [form, setForm] = useState({
    company_name: "",
    job_title: "",
    job_description: "",
    stage: "applied",
    salary_min: "",
    salary_max: "",
    currency: "USD",
    location: "",
    remote_type: "",
    application_date: new Date().toISOString().split("T")[0],
    contact_name: "",
    contact_email: "",
    notes: "",
    resume_id: "",
    analysis_id: "",
  });

  useEffect(() => {
    const token = localStorage.getItem(AUTH_CONSTANTS.TOKEN_KEY);
    if (token) {
      fetchApplications();
      fetchSavedResources();
    } else {
      setLoading(false);
      setShowLoginModal(true);
    }
  }, []);

  const showAlert = (message, type = "info") => {
    setAlertModal({ isOpen: true, message, type });
  };
  const closeAlert = () => setAlertModal({ isOpen: false, message: "", type: "info" });

  const fetchApplications = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem(AUTH_CONSTANTS.TOKEN_KEY);
      const res = await fetch(`${BASE_URL}/applications`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setApplications(data.applications || []);
      }
    } catch {
      showAlert("Failed to load applications.", "error");
    } finally {
      setLoading(false);
    }
  };

  const fetchSavedResources = async () => {
    try {
      const token = localStorage.getItem(AUTH_CONSTANTS.TOKEN_KEY);
      const [resumesRes, analysesRes] = await Promise.all([
        fetch(`${BASE_URL}/resumes`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${BASE_URL}/my-analysis`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (resumesRes.ok) {
        const data = await resumesRes.json();
        setSavedResumes(data.resumes || []);
      }
      if (analysesRes.ok) {
        const data = await analysesRes.json();
        setSavedAnalyses(data.analyses || []);
      }
    } catch {
      // silent fail
    }
  };

  const saveApplication = async () => {
    if (!form.company_name.trim() || !form.job_title.trim()) {
      showAlert("Company name and job title are required.", "warning");
      return;
    }
    try {
      const token = localStorage.getItem(AUTH_CONSTANTS.TOKEN_KEY);
      const url = editingApp
        ? `${BASE_URL}/applications/${editingApp.id}`
        : `${BASE_URL}/applications`;
      const method = editingApp ? "PUT" : "POST";

      const payload = { ...form };
      if (payload.salary_min) payload.salary_min = parseInt(payload.salary_min, 10) || null;
      if (payload.salary_max) payload.salary_max = parseInt(payload.salary_max, 10) || null;
      if (payload.resume_id) payload.resume_id = parseInt(payload.resume_id, 10) || null;
      if (payload.analysis_id) payload.analysis_id = parseInt(payload.analysis_id, 10) || null;

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      if (res.ok) {
        showAlert(editingApp ? "Application updated!" : "Application added!", "success");
        setShowFormModal(false);
        setEditingApp(null);
        resetForm();
        fetchApplications();
      } else {
        const err = await res.json();
        showAlert(err.error || "Failed to save application.", "error");
      }
    } catch {
      showAlert("Network error. Please try again.", "error");
    }
  };

  const deleteApplication = async (appId) => {
    if (!window.confirm("Delete this application? This cannot be undone.")) return;
    try {
      const token = localStorage.getItem(AUTH_CONSTANTS.TOKEN_KEY);
      const res = await fetch(`${BASE_URL}/applications/${appId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        showAlert("Application deleted.", "success");
        fetchApplications();
      } else {
        const err = await res.json();
        showAlert(err.error || "Failed to delete.", "error");
      }
    } catch {
      showAlert("Network error. Please try again.", "error");
    }
  };

  const moveStage = async (app, direction) => {
    const currentIndex = STAGE_ORDER.indexOf(app.stage);
    const nextIndex = direction === "forward" ? currentIndex + 1 : currentIndex - 1;
    if (nextIndex < 0 || nextIndex >= STAGE_ORDER.length) return;

    const newStage = STAGE_ORDER[nextIndex];
    try {
      const token = localStorage.getItem(AUTH_CONSTANTS.TOKEN_KEY);
      const res = await fetch(`${BASE_URL}/applications/${app.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ stage: newStage, stage_notes: `Moved from ${app.stage} to ${newStage}` }),
      });
      if (res.ok) {
        fetchApplications();
      } else {
        const err = await res.json();
        showAlert(err.error || "Failed to move stage.", "error");
      }
    } catch {
      showAlert("Network error. Please try again.", "error");
    }
  };

  const openNewForm = () => {
    setEditingApp(null);
    resetForm();
    setShowFormModal(true);
  };

  const openEditForm = (app) => {
    setEditingApp(app);
    setForm({
      company_name: app.company_name || "",
      job_title: app.job_title || "",
      job_description: app.job_description || "",
      stage: app.stage || "applied",
      salary_min: app.salary_min || "",
      salary_max: app.salary_max || "",
      currency: app.currency || "USD",
      location: app.location || "",
      remote_type: app.remote_type || "",
      application_date: app.application_date || new Date().toISOString().split("T")[0],
      contact_name: app.contact_name || "",
      contact_email: app.contact_email || "",
      notes: app.notes || "",
      resume_id: app.resume_id || "",
      analysis_id: app.analysis_id || "",
    });
    setShowFormModal(true);
  };

  const openDetail = (app) => {
    setSelectedApp(app);
    setShowDetailModal(true);
  };

  const resetForm = () => {
    setForm({
      company_name: "",
      job_title: "",
      job_description: "",
      stage: "applied",
      salary_min: "",
      salary_max: "",
      currency: "USD",
      location: "",
      remote_type: "",
      application_date: new Date().toISOString().split("T")[0],
      contact_name: "",
      contact_email: "",
      notes: "",
      resume_id: "",
      analysis_id: "",
    });
  };

  const getStageLabel = (key) => STAGES.find((s) => s.key === key)?.label || key;
  const getStageColor = (key) => STAGES.find((s) => s.key === key)?.color || "#64748b";

  const appsByStage = (stageKey) => applications.filter((a) => a.stage === stageKey);

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "60vh" }}>
        <AnimatedLoader text="Loading" />
      </div>
    );
  }

  if (!isEnabled("job_tracker")) {
    return (
      <div style={{ textAlign: "center", paddingTop: "80px", color: "#666" }}>
        <h2>Job Application Tracker</h2>
        <p style={{ color: "#888" }}>This feature is temporarily unavailable.</p>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Job Application Tracker</h1>
          <p style={styles.subtitle}>Track your job search pipeline from applied to offer.</p>
        </div>
        <button onClick={openNewForm} style={styles.addButton}>
          + Add Application
        </button>
      </div>

      {/* Kanban Board */}
      <div style={styles.board}>
        {STAGES.map((stage) => (
          <div key={stage.key} style={styles.column}>
            <div style={{ ...styles.columnHeader, borderBottomColor: stage.color }}>
              <span style={{ ...styles.columnDot, backgroundColor: stage.color }} />
              <span style={styles.columnTitle}>{stage.label}</span>
              <span style={styles.columnCount}>{appsByStage(stage.key).length}</span>
            </div>
            <div style={styles.columnBody}>
              {appsByStage(stage.key).map((app) => (
                <div
                  key={app.id}
                  style={styles.card}
                  onClick={() => openDetail(app)}
                >
                  <div style={styles.cardTitle}>{app.job_title}</div>
                  <div style={styles.cardCompany}>{app.company_name}</div>
                  {app.overall_match_score !== null && (
                    <div style={styles.cardScore}>Match: {app.overall_match_score}%</div>
                  )}
                  {(app.salary_min || app.salary_max) && (
                    <div style={styles.cardMeta}>
                      {app.currency} {app.salary_min ? app.salary_min.toLocaleString() : ""}
                      {app.salary_min && app.salary_max ? " - " : ""}
                      {app.salary_max ? app.salary_max.toLocaleString() : ""}
                    </div>
                  )}
                  {app.location && (
                    <div style={styles.cardMeta}>{app.location}</div>
                  )}
                  <div style={styles.cardFooter}>
                    {app.application_date && (
                      <span style={styles.cardDate}>
                        {new Date(app.application_date).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                  {/* Move buttons */}
                  <div style={styles.moveButtons} onClick={(e) => e.stopPropagation()}>
                    {STAGE_ORDER.indexOf(app.stage) > 0 && (
                      <button
                        onClick={() => moveStage(app, "backward")}
                        style={styles.moveBtn}
                        title="Move back"
                      >
                        ←
                      </button>
                    )}
                    {STAGE_ORDER.indexOf(app.stage) < STAGE_ORDER.length - 1 && (
                      <button
                        onClick={() => moveStage(app, "forward")}
                        style={styles.moveBtn}
                        title="Move forward"
                      >
                        →
                      </button>
                    )}
                    <button
                      onClick={() => openEditForm(app)}
                      style={styles.editBtn}
                      title="Edit"
                    >
                      ✎
                    </button>
                  </div>
                </div>
              ))}
              {appsByStage(stage.key).length === 0 && (
                <div style={styles.emptyColumn}>No applications</div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Add/Edit Modal */}
      {showFormModal && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.modalContent, maxWidth: 560 }}>
            <div style={styles.modalHeader}>
              <h2 style={{ margin: 0 }}>
                {editingApp ? "Edit Application" : "New Application"}
              </h2>
              <button onClick={() => setShowFormModal(false)} style={styles.closeButton}>
                ✕
              </button>
            </div>
            <div style={styles.modalBody}>
              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Company *</label>
                  <input
                    type="text"
                    value={form.company_name}
                    onChange={(e) => setForm({ ...form, company_name: e.target.value })}
                    style={styles.input}
                    placeholder="e.g. Google"
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Job Title *</label>
                  <input
                    type="text"
                    value={form.job_title}
                    onChange={(e) => setForm({ ...form, job_title: e.target.value })}
                    style={styles.input}
                    placeholder="e.g. Senior Engineer"
                  />
                </div>
              </div>

              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Stage</label>
                  <select
                    value={form.stage}
                    onChange={(e) => setForm({ ...form, stage: e.target.value })}
                    style={styles.input}
                  >
                    {STAGES.map((s) => (
                      <option key={s.key} value={s.key}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Date Applied</label>
                  <input
                    type="date"
                    value={form.application_date}
                    onChange={(e) => setForm({ ...form, application_date: e.target.value })}
                    style={styles.input}
                  />
                </div>
              </div>

              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Salary Min</label>
                  <input
                    type="number"
                    value={form.salary_min}
                    onChange={(e) => setForm({ ...form, salary_min: e.target.value })}
                    style={styles.input}
                    placeholder="0"
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Salary Max</label>
                  <input
                    type="number"
                    value={form.salary_max}
                    onChange={(e) => setForm({ ...form, salary_max: e.target.value })}
                    style={styles.input}
                    placeholder="0"
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Currency</label>
                  <input
                    type="text"
                    value={form.currency}
                    onChange={(e) => setForm({ ...form, currency: e.target.value })}
                    style={styles.input}
                  />
                </div>
              </div>

              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Location</label>
                  <input
                    type="text"
                    value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                    style={styles.input}
                    placeholder="e.g. Remote / Lagos"
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Remote Type</label>
                  <input
                    type="text"
                    value={form.remote_type}
                    onChange={(e) => setForm({ ...form, remote_type: e.target.value })}
                    style={styles.input}
                    placeholder="e.g. Remote, Hybrid"
                  />
                </div>
              </div>

              <div style={styles.formRow}>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Contact Name</label>
                  <input
                    type="text"
                    value={form.contact_name}
                    onChange={(e) => setForm({ ...form, contact_name: e.target.value })}
                    style={styles.input}
                  />
                </div>
                <div style={styles.formGroup}>
                  <label style={styles.label}>Contact Email</label>
                  <input
                    type="email"
                    value={form.contact_email}
                    onChange={(e) => setForm({ ...form, contact_email: e.target.value })}
                    style={styles.input}
                  />
                </div>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Linked Resume</label>
                <select
                  value={form.resume_id}
                  onChange={(e) => setForm({ ...form, resume_id: e.target.value })}
                  style={styles.input}
                >
                  <option value="">None</option>
                  {savedResumes.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.filename}
                    </option>
                  ))}
                </select>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Linked Analysis</label>
                <select
                  value={form.analysis_id}
                  onChange={(e) => setForm({ ...form, analysis_id: e.target.value })}
                  style={styles.input}
                >
                  <option value="">None</option>
                  {savedAnalyses.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.job_description?.slice(0, 50)}… ({a.overall_match_score}%)
                    </option>
                  ))}
                </select>
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Job Description</label>
                <textarea
                  value={form.job_description}
                  onChange={(e) => setForm({ ...form, job_description: e.target.value })}
                  rows={4}
                  style={{ ...styles.input, resize: "vertical" }}
                />
              </div>

              <div style={styles.formGroup}>
                <label style={styles.label}>Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={3}
                  style={{ ...styles.input, resize: "vertical" }}
                />
              </div>
            </div>
            <div style={styles.modalFooter}>
              {editingApp && (
                <button
                  onClick={() => {
                    deleteApplication(editingApp.id);
                    setShowFormModal(false);
                  }}
                  style={{
                    ...styles.btn,
                    backgroundColor: "#ef4444",
                    color: "#fff",
                    marginRight: "auto",
                  }}
                >
                  Delete
                </button>
              )}
              <button onClick={() => setShowFormModal(false)} style={styles.btnSecondary}>
                Cancel
              </button>
              <button onClick={saveApplication} style={styles.btnPrimary}>
                {editingApp ? "Update" : "Save"} Application
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedApp && (
        <div style={styles.modalOverlay}>
          <div style={{ ...styles.modalContent, maxWidth: 640 }}>
            <div style={styles.modalHeader}>
              <h2 style={{ margin: 0 }}>{selectedApp.job_title}</h2>
              <button onClick={() => setShowDetailModal(false)} style={styles.closeButton}>
                ✕
              </button>
            </div>
            <div style={styles.modalBody}>
              <div style={styles.detailGrid}>
                <div style={styles.detailItem}>
                  <span style={styles.detailLabel}>Company</span>
                  <strong style={styles.detailValue}>{selectedApp.company_name}</strong>
                </div>
                <div style={styles.detailItem}>
                  <span style={styles.detailLabel}>Stage</span>
                  <span
                    style={{
                      ...styles.badge,
                      backgroundColor: getStageColor(selectedApp.stage) + "20",
                      color: getStageColor(selectedApp.stage),
                    }}
                  >
                    {getStageLabel(selectedApp.stage)}
                  </span>
                </div>
                <div style={styles.detailItem}>
                  <span style={styles.detailLabel}>Date Applied</span>
                  <strong style={styles.detailValue}>
                    {selectedApp.application_date
                      ? new Date(selectedApp.application_date).toLocaleDateString()
                      : "N/A"}
                  </strong>
                </div>
                {selectedApp.overall_match_score !== null && (
                  <div style={styles.detailItem}>
                    <span style={styles.detailLabel}>Match Score</span>
                    <strong style={styles.detailValue}>{selectedApp.overall_match_score}%</strong>
                  </div>
                )}
              </div>

              {(selectedApp.salary_min || selectedApp.salary_max) && (
                <div style={styles.detailSection}>
                  <h4 style={styles.detailHeading}>Compensation</h4>
                  <p style={{ margin: 0, color: "#333" }}>
                    {selectedApp.currency} {selectedApp.salary_min?.toLocaleString()} - {selectedApp.salary_max?.toLocaleString()}
                  </p>
                </div>
              )}

              {(selectedApp.contact_name || selectedApp.contact_email) && (
                <div style={styles.detailSection}>
                  <h4 style={styles.detailHeading}>Contact</h4>
                  <p style={{ margin: 0, color: "#333" }}>
                    {selectedApp.contact_name && <>{selectedApp.contact_name}<br /></>}
                    {selectedApp.contact_email && <>{selectedApp.contact_email}</>}
                  </p>
                </div>
              )}

              {selectedApp.job_description && (
                <div style={styles.detailSection}>
                  <h4 style={styles.detailHeading}>Job Description</h4>
                  <p style={{ margin: 0, color: "#333", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                    {selectedApp.job_description}
                  </p>
                </div>
              )}

              {selectedApp.notes && (
                <div style={styles.detailSection}>
                  <h4 style={styles.detailHeading}>Notes</h4>
                  <p style={{ margin: 0, color: "#333", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                    {selectedApp.notes}
                  </p>
                </div>
              )}

              {/* Stage History */}
              <div style={styles.detailSection}>
                <h4 style={styles.detailHeading}>Stage History</h4>
                {selectedApp.stage_history && selectedApp.stage_history.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {selectedApp.stage_history.map((h) => (
                      <div key={h.id} style={styles.historyRow}>
                        <span style={styles.historyDate}>
                          {h.created_at ? new Date(h.created_at).toLocaleDateString() : ""}
                        </span>
                        <span style={styles.historyArrow}>
                          {h.from_stage ? `${getStageLabel(h.from_stage)} → ${getStageLabel(h.to_stage)}` : getStageLabel(h.to_stage)}
                        </span>
                        {h.notes && <span style={styles.historyNote}>{h.notes}</span>}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ color: "#888", margin: 0 }}>No stage history yet.</p>
                )}
              </div>

              {/* Linked resources */}
              {(selectedApp.resume_filename || selectedApp.analysis_id) && (
                <div style={styles.detailSection}>
                  <h4 style={styles.detailHeading}>Linked Resources</h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {selectedApp.resume_filename && (
                      <div style={styles.linkedResource}>📄 Resume: {selectedApp.resume_filename}</div>
                    )}
                    {selectedApp.analysis_id && (
                      <div style={styles.linkedResource}>
                        📊 Analysis: {selectedApp.overall_match_score}% match
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
            <div style={styles.modalFooter}>
              <button
                onClick={() => {
                  setShowDetailModal(false);
                  openEditForm(selectedApp);
                }}
                style={styles.btnPrimary}
              >
                Edit Application
              </button>
              <button onClick={() => setShowDetailModal(false)} style={styles.btnSecondary}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <AlertModal isOpen={alertModal.isOpen} message={alertModal.message} type={alertModal.type} onClose={closeAlert} />
      <LoginModal isOpen={showLoginModal} onClose={() => setShowLoginModal(false)} onLogin={() => {}} />
    </div>
  );
};

const styles = {
  page: {
    padding: "30px",
    maxWidth: "1400px",
    margin: "0 auto",
    minHeight: "100vh",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "30px",
  },
  title: {
    margin: 0,
    color: "#1a73e8",
    fontSize: "1.8rem",
  },
  subtitle: {
    margin: "5px 0 0 0",
    color: "#666",
  },
  addButton: {
    backgroundColor: "#1a73e8",
    color: "#fff",
    border: "none",
    padding: "10px 24px",
    borderRadius: "8px",
    cursor: "pointer",
    fontWeight: "600",
    fontSize: "0.95rem",
  },
  board: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
    gap: "16px",
    alignItems: "start",
  },
  column: {
    backgroundColor: "#fff",
    borderRadius: "12px",
    border: "1px solid #e0e0e0",
    display: "flex",
    flexDirection: "column",
    maxHeight: "calc(100vh - 200px)",
  },
  columnHeader: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "14px 16px",
    borderBottom: "3px solid",
    fontWeight: "600",
    fontSize: "0.9rem",
    color: "#333",
  },
  columnDot: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
  },
  columnTitle: {
    flex: 1,
  },
  columnCount: {
    backgroundColor: "#f1f3f4",
    color: "#666",
    padding: "2px 8px",
    borderRadius: "12px",
    fontSize: "0.8rem",
  },
  columnBody: {
    padding: "12px",
    overflowY: "auto",
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: "10px",
  },
  card: {
    backgroundColor: "#f9f9f9",
    border: "1px solid #eee",
    borderRadius: "10px",
    padding: "14px",
    cursor: "pointer",
    transition: "box-shadow 0.2s",
    position: "relative",
  },
  cardTitle: {
    fontWeight: "600",
    fontSize: "0.95rem",
    color: "#1a1a1a",
    marginBottom: "4px",
  },
  cardCompany: {
    fontSize: "0.85rem",
    color: "#666",
    marginBottom: "8px",
  },
  cardScore: {
    fontSize: "0.8rem",
    color: "#1a73e8",
    fontWeight: "600",
    marginBottom: "4px",
  },
  cardMeta: {
    fontSize: "0.8rem",
    color: "#888",
    marginBottom: "4px",
  },
  cardFooter: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: "8px",
  },
  cardDate: {
    fontSize: "0.75rem",
    color: "#aaa",
  },
  moveButtons: {
    display: "flex",
    gap: "4px",
    marginTop: "8px",
    justifyContent: "flex-end",
  },
  moveBtn: {
    padding: "2px 8px",
    fontSize: "0.8rem",
    border: "1px solid #ddd",
    backgroundColor: "#fff",
    borderRadius: "4px",
    cursor: "pointer",
    color: "#666",
  },
  editBtn: {
    padding: "2px 8px",
    fontSize: "0.8rem",
    border: "1px solid #1a73e8",
    backgroundColor: "#fff",
    borderRadius: "4px",
    cursor: "pointer",
    color: "#1a73e8",
  },
  emptyColumn: {
    textAlign: "center",
    color: "#bbb",
    padding: "20px",
    fontSize: "0.85rem",
  },
  modalOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
    padding: "20px",
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: "16px",
    width: "100%",
    maxWidth: "600px",
    maxHeight: "90vh",
    overflow: "auto",
    display: "flex",
    flexDirection: "column",
    boxShadow: "0 20px 60px rgba(0,0,0,0.2)",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "18px 24px",
    borderBottom: "1px solid #eee",
    position: "sticky",
    top: 0,
    backgroundColor: "#fff",
    zIndex: 10,
  },
  closeButton: {
    background: "none",
    border: "none",
    fontSize: "1.3rem",
    cursor: "pointer",
    color: "#999",
  },
  modalBody: {
    padding: "24px",
    flex: 1,
    overflowY: "auto",
  },
  modalFooter: {
    padding: "14px 24px",
    borderTop: "1px solid #eee",
    display: "flex",
    justifyContent: "flex-end",
    gap: "10px",
    backgroundColor: "#f9f9f9",
  },
  formRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "12px",
  },
  formGroup: {
    marginBottom: "14px",
  },
  label: {
    display: "block",
    fontSize: "0.8rem",
    fontWeight: "600",
    color: "#555",
    marginBottom: "5px",
  },
  input: {
    width: "100%",
    padding: "9px 12px",
    borderRadius: "8px",
    border: "1px solid #ddd",
    fontSize: "0.9rem",
    boxSizing: "border-box",
    fontFamily: "inherit",
  },
  btn: {
    padding: "10px 20px",
    borderRadius: "8px",
    border: "none",
    cursor: "pointer",
    fontWeight: "600",
    fontSize: "0.9rem",
  },
  btnPrimary: {
    padding: "10px 20px",
    borderRadius: "8px",
    border: "none",
    cursor: "pointer",
    fontWeight: "600",
    fontSize: "0.9rem",
    backgroundColor: "#1a73e8",
    color: "#fff",
  },
  btnSecondary: {
    padding: "10px 20px",
    borderRadius: "8px",
    border: "none",
    cursor: "pointer",
    fontWeight: "600",
    fontSize: "0.9rem",
    backgroundColor: "#666",
    color: "#fff",
  },
  detailGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
    gap: "12px",
    marginBottom: "20px",
  },
  detailItem: {
    backgroundColor: "#f9f9f9",
    padding: "12px",
    borderRadius: "10px",
    border: "1px solid #eee",
  },
  detailLabel: {
    display: "block",
    fontSize: "0.75rem",
    color: "#888",
    marginBottom: "4px",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },
  detailValue: {
    fontSize: "1rem",
    color: "#1a1a1a",
  },
  badge: {
    display: "inline-block",
    padding: "4px 12px",
    borderRadius: "20px",
    fontSize: "0.8rem",
    fontWeight: "600",
  },
  detailSection: {
    marginBottom: "20px",
  },
  detailHeading: {
    color: "#1a73e8",
    margin: "0 0 8px 0",
    fontSize: "0.95rem",
  },
  historyRow: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
    padding: "8px 12px",
    backgroundColor: "#f9f9f9",
    borderRadius: "8px",
    border: "1px solid #eee",
  },
  historyDate: {
    fontSize: "0.75rem",
    color: "#888",
    minWidth: "80px",
  },
  historyArrow: {
    fontSize: "0.85rem",
    color: "#333",
    fontWeight: "500",
  },
  historyNote: {
    fontSize: "0.8rem",
    color: "#666",
    flex: 1,
    textAlign: "right",
  },
  linkedResource: {
    fontSize: "0.85rem",
    color: "#555",
    padding: "6px 10px",
    backgroundColor: "#f0f7ff",
    borderRadius: "6px",
  },
};

export default JobTrackerPage;
