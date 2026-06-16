import { useState, useEffect } from "react";
import { AUTH_CONSTANTS, BASE_URL } from "../../constants/auth_constants";
import ConfirmModal from "../../components/ConfirmModal";

const FeatureFlags = () => {
  const [flags, setFlags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [editingFlag, setEditingFlag] = useState(null);
  const [form, setForm] = useState({
    flag_key: "",
    enabled: true,
    rollout_pct: 100,
    variant: "",
    metadata: "",
  });

  // Delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [flagToDelete, setFlagToDelete] = useState(null);

  useEffect(() => {
    fetchFlags();
  }, []);

  const fetchFlags = async () => {
    setLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem(AUTH_CONSTANTS.TOKEN_KEY);
      const response = await fetch(`${BASE_URL}/admin/feature-flags`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error("Failed to fetch flags");
      const data = await response.json();
      setFlags(data.flags || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setEditingFlag(null);
    setForm({
      flag_key: "",
      enabled: true,
      rollout_pct: 100,
      variant: "",
      metadata: "",
    });
  };

  const startEdit = (flag) => {
    setEditingFlag(flag.flag_key);
    setForm({
      flag_key: flag.flag_key,
      enabled: flag.enabled,
      rollout_pct: flag.rollout_pct ?? 100,
      variant: flag.variant || "",
      metadata: flag.metadata ? JSON.stringify(flag.metadata, null, 2) : "",
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const token = localStorage.getItem(AUTH_CONSTANTS.TOKEN_KEY);
      const body = {
        flag_key: form.flag_key.trim(),
        enabled: form.enabled,
        rollout_pct: parseInt(form.rollout_pct, 10),
        variant: form.variant.trim() || null,
        metadata: form.metadata.trim()
          ? JSON.parse(form.metadata)
          : null,
      };

      const response = await fetch(`${BASE_URL}/admin/feature-flags`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || "Failed to save flag");
      }

      resetForm();
      fetchFlags();
    } catch (err) {
      if (window.showToast) {
        window.showToast(err.message, "error");
      } else {
        setError(err.message);
      }
    } finally {
      setSaving(false);
    }
  };

  const promptDelete = (flagKey) => {
    setFlagToDelete(flagKey);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!flagToDelete) return;
    try {
      const response = await fetchWithTimeout(
        `/admin/feature-flags/${encodeURIComponent(flagToDelete)}`,
        {
          method: "DELETE",
        },
      );
      if (!response.ok) throw new Error("Failed to delete flag");
      setFlags((prev) => prev.filter((f) => f.flag_key !== flagToDelete));
    } catch (err) {
      if (window.showToast) {
        window.showToast(err.message, "error");
      } else {
        setError(err.message);
      }
    } finally {
      setShowDeleteConfirm(false);
      setFlagToDelete(null);
    }
  };

  if (loading) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner}></div>
        <p>Loading feature flags...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.errorContainer}>
        <p style={styles.errorText}>{error}</p>
        <button onClick={fetchFlags} style={styles.retryBtn}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Feature Flags</h1>
          <p style={styles.subtitle}>
            {flags.length} flag{flags.length !== 1 ? "s" : ""} configured
          </p>
        </div>
        <button onClick={fetchFlags} style={styles.refreshBtn}>
          Refresh
        </button>
      </div>

      {/* Create / Edit Form */}
      <div style={styles.formCard}>
        <h2 style={styles.formTitle}>
          {editingFlag ? `Editing: ${editingFlag}` : "Create Flag"}
        </h2>
        <form onSubmit={handleSubmit}>
          <div style={styles.formGrid}>
            <div style={styles.formField}>
              <label style={styles.label}>Flag Key</label>
              <input
                type="text"
                value={form.flag_key}
                onChange={(e) =>
                  setForm((f) => ({ ...f, flag_key: e.target.value }))
                }
                required
                disabled={!!editingFlag}
                style={styles.input}
                placeholder="e.g. new_cover_letter_v2"
              />
            </div>

            <div style={styles.formField}>
              <label style={styles.label}>Variant</label>
              <input
                type="text"
                value={form.variant}
                onChange={(e) =>
                  setForm((f) => ({ ...f, variant: e.target.value }))
                }
                style={styles.input}
                placeholder="e.g. control, variant_a"
              />
            </div>

            <div style={styles.formField}>
              <label style={styles.label}>Rollout %</label>
              <input
                type="number"
                min="0"
                max="100"
                value={form.rollout_pct}
                onChange={(e) =>
                  setForm((f) => ({ ...f, rollout_pct: e.target.value }))
                }
                style={styles.input}
                required
              />
            </div>

            <div style={{ ...styles.formField, display: "flex", alignItems: "flex-end", gap: "8px" }}>
              <label style={{ ...styles.label, display: "flex", alignItems: "center", gap: "8px", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={form.enabled}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, enabled: e.target.checked }))
                  }
                  style={{ width: "18px", height: "18px", cursor: "pointer" }}
                />
                Enabled
              </label>
            </div>
          </div>

          <div style={{ marginTop: "12px" }}>
            <label style={styles.label}>Metadata (JSON)</label>
            <textarea
              value={form.metadata}
              onChange={(e) =>
                setForm((f) => ({ ...f, metadata: e.target.value }))
              }
              rows="3"
              style={{ ...styles.input, fontFamily: "monospace", fontSize: "13px" }}
              placeholder='{"description": "..."}'
            />
          </div>

          <div style={styles.formActions}>
            <button type="submit" disabled={saving} style={styles.saveBtn}>
              {saving ? "Saving..." : editingFlag ? "Update Flag" : "Create Flag"}
            </button>
            {editingFlag && (
              <button type="button" onClick={resetForm} style={styles.cancelBtn}>
                Cancel
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Flags Table */}
      <div style={styles.tableCard}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>Flag Key</th>
              <th style={styles.th}>Status</th>
              <th style={styles.th}>Rollout</th>
              <th style={styles.th}>Variant</th>
              <th style={styles.th}>Updated</th>
              <th style={styles.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {flags.map((flag) => (
              <tr key={flag.flag_key}>
                <td style={styles.td}>
                  <div style={styles.flagKey}>{flag.flag_key}</div>
                  {flag.metadata?.description && (
                    <div style={styles.metaDesc}>{flag.metadata.description}</div>
                  )}
                </td>
                <td style={styles.td}>
                  <span
                    style={{
                      ...styles.badge,
                      backgroundColor: flag.enabled
                        ? "rgba(52, 211, 153, 0.2)"
                        : "rgba(239, 68, 68, 0.2)",
                      color: flag.enabled ? "#34d399" : "#ef4444",
                    }}
                  >
                    {flag.enabled ? "ON" : "OFF"}
                  </span>
                </td>
                <td style={styles.td}>
                  <div style={styles.progressBarContainer}>
                    <div
                      style={{
                        ...styles.progressBar,
                        width: `${flag.rollout_pct ?? 100}%`,
                        backgroundColor: flag.enabled ? "#38bdf8" : "#64748b",
                      }}
                    />
                  </div>
                  <span style={styles.progressText}>{flag.rollout_pct ?? 100}%</span>
                </td>
                <td style={styles.td}>
                  <span style={styles.variantText}>{flag.variant || "—"}</span>
                </td>
                <td style={styles.td}>
                  {flag.updated_at
                    ? new Date(flag.updated_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : "N/A"}
                </td>
                <td style={styles.td}>
                  <div style={styles.actionBtns}>
                    <button
                      onClick={() => startEdit(flag)}
                      style={styles.editBtn}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => promptDelete(flag.flag_key)}
                      style={styles.deleteBtn}
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {flags.length === 0 && (
          <div style={styles.noData}>
            <p>No feature flags yet. Create one above.</p>
          </div>
        )}
      </div>

      {/* Delete Confirmation */}
      <ConfirmModal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={confirmDelete}
        title="Delete Feature Flag?"
        message={`This will permanently delete the "${flagToDelete}" flag. UI sections using this flag may re-appear or disappear for users.`}
        confirmText="Delete"
        confirmColor="#ef4444"
        cancelText="Cancel"
      />
    </div>
  );
};

const styles = {
  container: {
    maxWidth: "1200px",
    margin: "0 auto",
  },
  loadingContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "400px",
    color: "#94a3b8",
  },
  spinner: {
    width: "40px",
    height: "40px",
    border: "3px solid rgba(56, 189, 248, 0.3)",
    borderTopColor: "#38bdf8",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
    marginBottom: "16px",
  },
  errorContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "400px",
  },
  errorText: {
    color: "#ef4444",
    marginBottom: "16px",
  },
  retryBtn: {
    padding: "10px 20px",
    backgroundColor: "#38bdf8",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: "32px",
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
  refreshBtn: {
    padding: "10px 20px",
    backgroundColor: "transparent",
    color: "#38bdf8",
    border: "1px solid #38bdf8",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "14px",
  },
  formCard: {
    backgroundColor: "#1e293b",
    borderRadius: "12px",
    border: "1px solid rgba(148, 163, 184, 0.1)",
    padding: "24px",
    marginBottom: "32px",
  },
  formTitle: {
    color: "#e2e8f0",
    fontSize: "18px",
    fontWeight: "600",
    margin: "0 0 16px 0",
  },
  formGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: "16px",
  },
  formField: {
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
  formActions: {
    display: "flex",
    gap: "12px",
    marginTop: "16px",
  },
  saveBtn: {
    padding: "10px 24px",
    backgroundColor: "#38bdf8",
    color: "#0f172a",
    border: "none",
    borderRadius: "8px",
    fontSize: "14px",
    fontWeight: "600",
    cursor: "pointer",
  },
  cancelBtn: {
    padding: "10px 24px",
    backgroundColor: "transparent",
    color: "#94a3b8",
    border: "1px solid rgba(148, 163, 184, 0.3)",
    borderRadius: "8px",
    fontSize: "14px",
    cursor: "pointer",
  },
  tableCard: {
    backgroundColor: "#1e293b",
    borderRadius: "12px",
    border: "1px solid rgba(148, 163, 184, 0.1)",
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  th: {
    textAlign: "left",
    padding: "16px",
    color: "#94a3b8",
    fontSize: "12px",
    fontWeight: "600",
    textTransform: "uppercase",
    borderBottom: "1px solid rgba(148, 163, 184, 0.1)",
  },
  td: {
    padding: "16px",
    color: "#e2e8f0",
    fontSize: "14px",
    borderBottom: "1px solid rgba(148, 163, 184, 0.05)",
  },
  flagKey: {
    fontWeight: "600",
    color: "#e2e8f0",
  },
  metaDesc: {
    fontSize: "12px",
    color: "#64748b",
    marginTop: "4px",
  },
  badge: {
    padding: "4px 12px",
    borderRadius: "20px",
    fontSize: "12px",
    fontWeight: "600",
  },
  progressBarContainer: {
    width: "80px",
    height: "6px",
    backgroundColor: "rgba(148, 163, 184, 0.2)",
    borderRadius: "3px",
    overflow: "hidden",
    marginBottom: "4px",
  },
  progressBar: {
    height: "100%",
    borderRadius: "3px",
    transition: "width 0.3s ease",
  },
  progressText: {
    fontSize: "12px",
    color: "#94a3b8",
  },
  variantText: {
    color: "#94a3b8",
    fontSize: "13px",
  },
  actionBtns: {
    display: "flex",
    gap: "8px",
  },
  editBtn: {
    padding: "6px 12px",
    backgroundColor: "rgba(56, 189, 248, 0.1)",
    color: "#38bdf8",
    border: "1px solid rgba(56, 189, 248, 0.3)",
    borderRadius: "6px",
    fontSize: "13px",
    cursor: "pointer",
  },
  deleteBtn: {
    padding: "6px 12px",
    backgroundColor: "rgba(239, 68, 68, 0.1)",
    color: "#ef4444",
    border: "1px solid rgba(239, 68, 68, 0.3)",
    borderRadius: "6px",
    fontSize: "13px",
    cursor: "pointer",
  },
  noData: {
    padding: "40px",
    textAlign: "center",
    color: "#64748b",
  },
};

export default FeatureFlags;
