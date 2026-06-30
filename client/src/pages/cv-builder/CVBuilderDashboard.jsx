import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import fetchWithTimeout from "../../configs/fetch";
import { useAuth } from "../../contexts/AuthContext";
import "./CVBuilderDashboard.css";

const TEMPLATE_NAMES = {
  1: "Modern",
  2: "Classic",
  3: "Minimal",
};

const CVBuilderDashboard = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [importFile, setImportFile] = useState(null);
  const [importing, setImporting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);

  const showApiError = async (res, fallback = "Something went wrong. Please try again.") => {
    if (!res) {
      setError(fallback);
      return;
    }
    if (res.status >= 500) {
      setError(fallback);
      return;
    }
    try {
      const data = await res.json();
      setError(data.error || fallback);
    } catch {
      setError(fallback);
    }
  };

  const fetchProfiles = useCallback(async () => {
    try {
      const res = await fetchWithTimeout("/cv/profiles");
      if (res.ok) {
        const data = await res.json();
        setProfiles(data.profiles || []);
        setError(null);
      } else {
        await showApiError(res, "Failed to load CV profiles.");
      }
    } catch (err) {
      console.error("Failed to fetch CV profiles:", err);
      setError("Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchProfiles();
    } else {
      setLoading(false);
    }
  }, [isAuthenticated, fetchProfiles]);

  const handleCreateBlank = async () => {
    if (!newTitle.trim()) return;
    try {
      const res = await fetchWithTimeout("/cv/profiles", {
        method: "POST",
        body: JSON.stringify({ title: newTitle.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setShowNewModal(false);
        setNewTitle("");
        setError(null);
        navigate(`/cv-builder/edit/${data.profile.id}`);
      } else {
        await showApiError(res, "Failed to create CV profile.");
      }
    } catch (err) {
      console.error("Failed to create CV profile:", err);
      setError("Network error. Please try again.");
    }
  };

  const handleImportParse = async () => {
    if (!importFile) return;
    setImporting(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("resume", importFile);
      const res = await fetchWithTimeout("/cv/parse", {
        method: "POST",
        body: formData,
      });
      if (!res.ok) {
        await showApiError(res, "Failed to parse resume.");
        setImporting(false);
        return;
      }
      const data = await res.json();
      const createRes = await fetchWithTimeout("/cv/profiles", {
        method: "POST",
        body: JSON.stringify({
          title: newTitle.trim() || `Imported CV — ${importFile.name}`,
          profile_data: data.profile_data,
        }),
      });
      if (createRes.ok) {
        const createData = await createRes.json();
        setShowNewModal(false);
        setNewTitle("");
        setImportFile(null);
        setError(null);
        navigate(`/cv-builder/edit/${createData.profile.id}`);
      } else {
        await showApiError(createRes, "Failed to create profile from resume.");
      }
    } catch (err) {
      console.error("Failed to import resume:", err);
      setError("Network error. Please try again.");
    } finally {
      setImporting(false);
    }
  };

  const handleDeleteClick = (id, e) => {
    e.stopPropagation();
    setDeleteTarget(id);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetchWithTimeout(`/cv/profiles/${deleteTarget}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setProfiles((prev) => prev.filter((p) => p.id !== deleteTarget));
        setError(null);
      } else {
        await showApiError(res, "Failed to delete CV profile.");
      }
    } catch (err) {
      console.error("Failed to delete CV profile:", err);
      setError("Network error. Please try again.");
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="cv-builder-dashboard__empty">
        <div className="cv-builder-dashboard__empty-title">Please Log In</div>
        <p>You need to be logged in to use the CV Builder.</p>
      </div>
    );
  }

  return (
    <div className="cv-builder-dashboard">
      <div className="cv-builder-dashboard__hero">
        <div className="cv-builder-dashboard__hero-content">
          <div className="cv-builder-dashboard__hero-icon">📄</div>
          <h1 className="cv-builder-dashboard__hero-title">CV Builder</h1>
          <p className="cv-builder-dashboard__hero-subtitle">
            Create, edit, and tailor professional CVs powered by AI.
          </p>
        </div>
        <div className="cv-builder-dashboard__hero-actions">
          <button
            className="cv-builder-dashboard__btn cv-builder-dashboard__btn--secondary"
            onClick={() => {
              setNewTitle("");
              setImportFile(null);
              setShowNewModal(true);
            }}
          >
            <span className="cv-builder-dashboard__btn-icon">📥</span>
            Import from Resume
          </button>
          <button
            className="cv-builder-dashboard__btn cv-builder-dashboard__btn--primary"
            onClick={() => {
              setNewTitle("");
              setImportFile(null);
              setShowNewModal(true);
            }}
          >
            <span className="cv-builder-dashboard__btn-icon">+</span>
            Create New CV
          </button>
        </div>
      </div>

      {error && (
        <div className="cv-builder-dashboard__error-banner" onClick={() => setError(null)}>
          <span className="cv-builder-dashboard__error-text">{error}</span>
          <button className="cv-builder-dashboard__error-close">×</button>
        </div>
      )}

      {loading ? (
        <div className="cv-builder-dashboard__empty">
          <p>Loading your CV profiles...</p>
        </div>
      ) : profiles.length === 0 ? (
        <div className="cv-builder-dashboard__empty">
          <div className="cv-builder-dashboard__empty-title">No CV Profiles Yet</div>
          <p>Create your first CV or import from an existing resume.</p>
        </div>
      ) : (
        <div className="cv-builder-dashboard__grid">
          {profiles.map((profile) => (
            <div
              key={profile.id}
              className="cv-builder-dashboard__card"
              onClick={() => navigate(`/cv-builder/edit/${profile.id}`)}
            >
              <h3 className="cv-builder-dashboard__card-title">{profile.title}</h3>
              <div className="cv-builder-dashboard__card-meta">
                Updated {new Date(profile.updated_at || profile.created_at).toLocaleDateString()}
              </div>
              <div className="cv-builder-dashboard__card-badges">
                {profile.template_id && (
                  <span className="cv-builder-dashboard__badge cv-builder-dashboard__badge--template">
                    {TEMPLATE_NAMES[profile.template_id] || "Modern"}
                  </span>
                )}
                {profile.is_master && (
                  <span className="cv-builder-dashboard__badge cv-builder-dashboard__badge--master">
                    Master
                  </span>
                )}
                {profile.tailored_from_id && (
                  <span className="cv-builder-dashboard__badge cv-builder-dashboard__badge--tailored">
                    Tailored
                  </span>
                )}
              </div>
              <div className="cv-builder-dashboard__card-actions">
                <button
                  className="cv-builder-dashboard__card-btn cv-builder-dashboard__card-btn--edit"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(`/cv-builder/edit/${profile.id}`);
                  }}
                >
                  Edit
                </button>
                <button
                  className="cv-builder-dashboard__card-btn cv-builder-dashboard__card-btn--delete"
                  onClick={(e) => handleDeleteClick(profile.id, e)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showNewModal && (
        <div
          className="cv-builder-dashboard__modal-overlay"
          onClick={() => setShowNewModal(false)}
        >
          <div
            className="cv-builder-dashboard__modal"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="cv-builder-dashboard__modal-title">Create New CV</h2>
            <div className="cv-builder-dashboard__modal-body">
              <input
                type="text"
                className="cv-builder-dashboard__input"
                placeholder="CV Title (e.g., 'Software Engineer — Google')"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
              />
              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: "0.9rem", color: "#374151", display: "block", marginBottom: 6 }}>
                  Optionally import from a resume PDF:
                </label>
                <input
                  type="file"
                  accept="application/pdf"
                  onChange={(e) => setImportFile(e.target.files[0])}
                />
              </div>
            </div>
            <div className="cv-builder-dashboard__modal-actions">
              <button
                className="cv-builder-dashboard__btn cv-builder-dashboard__btn--secondary"
                onClick={() => setShowNewModal(false)}
              >
                Cancel
              </button>
              {importFile ? (
                <button
                  className="cv-builder-dashboard__btn cv-builder-dashboard__btn--primary"
                  onClick={handleImportParse}
                  disabled={importing}
                >
                  {importing ? "Importing..." : "Import & Create"}
                </button>
              ) : (
                <button
                  className="cv-builder-dashboard__btn cv-builder-dashboard__btn--primary"
                  onClick={handleCreateBlank}
                  disabled={!newTitle.trim()}
                >
                  Create
                </button>
              )}
            </div>
          </div>
        </div>
      )}
      {deleteTarget && (
        <div
          className="cv-builder-dashboard__modal-overlay"
          onClick={() => setDeleteTarget(null)}
        >
          <div
            className="cv-builder-dashboard__modal cv-builder-dashboard__modal--compact"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="cv-builder-dashboard__modal-title">Delete CV Profile</h2>
            <p className="cv-builder-dashboard__modal-text">
              Are you sure you want to delete this CV profile? This action cannot be undone.
            </p>
            <div className="cv-builder-dashboard__modal-actions">
              <button
                className="cv-builder-dashboard__btn cv-builder-dashboard__btn--secondary"
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </button>
              <button
                className="cv-builder-dashboard__btn cv-builder-dashboard__btn--danger"
                onClick={handleConfirmDelete}
                disabled={deleting}
              >
                {deleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CVBuilderDashboard;
