import { useState, useEffect, useCallback, useRef, lazy, Suspense } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useReactToPrint } from "react-to-print";
import fetchWithTimeout from "../../configs/fetch";
import { useAuth } from "../../contexts/AuthContext";
import "./CVBuilderEditor.css";

// Lazy-load templates to keep initial bundle small
const ModernTemplate = lazy(() => import("./ModernTemplate"));
const ClassicTemplate = lazy(() => import("./ClassicTemplate"));
const MinimalTemplate = lazy(() => import("./MinimalTemplate"));

const TEMPLATES = [
  { id: 1, name: "Modern", component: ModernTemplate },
  { id: 2, name: "Classic", component: ClassicTemplate },
  { id: 3, name: "Minimal", component: MinimalTemplate },
];

const SECTIONS = [
  { key: "contact", label: "Contact" },
  { key: "summary", label: "Summary" },
  { key: "experience", label: "Experience" },
  { key: "education", label: "Education" },
  { key: "skills", label: "Skills" },
  { key: "certifications", label: "Certifications" },
  { key: "projects", label: "Projects" },
  { key: "awards", label: "Awards" },
  { key: "publications", label: "Publications" },
];

const emptyProfileData = () => ({
  contact: { full_name: "", email: "", phone: "", location: "", linkedin: "", portfolio: "" },
  job_title: "",
  summary: "",
  experience: [],
  education: [],
  skills: { technical: [], tools: [], soft: [], languages: [] },
  certifications: [],
  projects: [],
  awards: [],
  publications: [],
});

const CVBuilderEditor = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();

  const [profileId, setProfileId] = useState(id);
  const [title, setTitle] = useState("");
  const [templateId, setTemplateId] = useState(1);
  const [profileData, setProfileData] = useState(emptyProfileData());
  const [skillsRaw, setSkillsRaw] = useState({});
  const [activeSection, setActiveSection] = useState("contact");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [error, setError] = useState(null);

  const printRef = useRef(null);
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `${title || "CV"} - ATS Matcher`,
    pageStyle: `
      @page { size: auto; margin: 0; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    `,
  });

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

  const fetchProfile = useCallback(async () => {
    if (!profileId || profileId === "new") {
      setLoading(false);
      return;
    }
    try {
      const res = await fetchWithTimeout(`/cv/profiles/${profileId}`);
      if (res.ok) {
        const data = await res.json();
        setTitle(data.title || "");
        setTemplateId(data.template_id || 1);
        const loadedProfileData = { ...emptyProfileData(), ...(data.profile_data || {}) };
        setProfileData(loadedProfileData);
        const raw = {};
        Object.entries(loadedProfileData.skills || {}).forEach(([key, arr]) => {
          raw[key] = Array.isArray(arr) ? arr.join(", ") : "";
        });
        setSkillsRaw(raw);
        setError(null);
      } else if (res.status === 404) {
        navigate("/cv-builder");
      } else {
        await showApiError(res, "Failed to load CV profile.");
      }
    } catch (err) {
      console.error("Failed to load CV profile:", err);
      setError("Network error. Please check your connection.");
    } finally {
      setLoading(false);
    }
  }, [profileId, navigate]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchProfile();
    }
  }, [isAuthenticated, fetchProfile]);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetchWithTimeout(`/cv/profiles/${profileId}`, {
        method: "PUT",
        body: JSON.stringify({
          title,
          template_id: templateId,
          profile_data: profileData,
        }),
      });
      if (res.ok) {
        setHasChanges(false);
        setError(null);
      } else {
        await showApiError(res, "Failed to save changes.");
      }
    } catch (err) {
      console.error("Failed to save CV profile:", err);
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const updateField = (section, updater) => {
    setProfileData((prev) => {
      const next = { ...prev, [section]: typeof updater === "function" ? updater(prev[section]) : updater };
      return next;
    });
    setHasChanges(true);
  };

  // ── String helpers ──
  const arrayToText = (arr) => (Array.isArray(arr) ? arr.join("\n") : "");
  const textToArray = (text) => text.split("\n");

  // ── Render helpers ──
  const renderContactForm = () => {
    const c = profileData.contact || {};
    const fields = [
      { key: "full_name", label: "Full Name" },
      { key: "email", label: "Email" },
      { key: "phone", label: "Phone" },
      { key: "location", label: "Location" },
      { key: "linkedin", label: "LinkedIn" },
      { key: "portfolio", label: "Portfolio / Website" },
    ];
    return (
      <div>
        <h3 className="cv-builder-editor__section-title">Contact Information</h3>
        <div className="cv-builder-editor__field">
          <label className="cv-builder-editor__label">Job Title / Professional Headline</label>
          <input
            type="text"
            className="cv-builder-editor__input"
            value={profileData.job_title || ""}
            onChange={(e) => updateField("job_title", e.target.value)}
            placeholder="e.g., Senior Software Engineer"
          />
        </div>
        {fields.map((f) => (
          <div key={f.key} className="cv-builder-editor__field">
            <label className="cv-builder-editor__label">{f.label}</label>
            <input
              type="text"
              className="cv-builder-editor__input"
              value={c[f.key] || ""}
              onChange={(e) =>
                updateField("contact", { ...c, [f.key]: e.target.value })
              }
            />
          </div>
        ))}
      </div>
    );
  };

  const renderSummaryForm = () => (
    <div>
      <h3 className="cv-builder-editor__section-title">Professional Summary</h3>
      <div className="cv-builder-editor__field">
        <textarea
          className="cv-builder-editor__textarea"
          value={profileData.summary || ""}
          onChange={(e) => updateField("summary", e.target.value)}
          rows={6}
          placeholder="Write a brief professional summary..."
        />
      </div>
    </div>
  );

  const renderExperienceForm = () => {
    const jobs = profileData.experience || [];
    return (
      <div>
        <h3 className="cv-builder-editor__section-title">Work Experience</h3>
        {jobs.map((job, i) => (
          <div key={i} className="cv-builder-editor__array-item">
            <div className="cv-builder-editor__array-header">
              <span className="cv-builder-editor__array-title">Job {i + 1}</span>
              <button
                className="cv-builder-editor__remove-btn"
                onClick={() =>
                  updateField("experience", jobs.filter((_, idx) => idx !== i))
                }
              >
                Remove
              </button>
            </div>
            <div className="cv-builder-editor__field">
              <label className="cv-builder-editor__label">Title</label>
              <input
                type="text"
                className="cv-builder-editor__input"
                value={job.title || ""}
                onChange={(e) => {
                  const next = [...jobs];
                  next[i] = { ...job, title: e.target.value };
                  updateField("experience", next);
                }}
              />
            </div>
            <div className="cv-builder-editor__field">
              <label className="cv-builder-editor__label">Company</label>
              <input
                type="text"
                className="cv-builder-editor__input"
                value={job.company || ""}
                onChange={(e) => {
                  const next = [...jobs];
                  next[i] = { ...job, company: e.target.value };
                  updateField("experience", next);
                }}
              />
            </div>
            <div className="cv-builder-editor__field">
              <label className="cv-builder-editor__label">Duration</label>
              <input
                type="text"
                className="cv-builder-editor__input"
                value={job.duration || ""}
                onChange={(e) => {
                  const next = [...jobs];
                  next[i] = { ...job, duration: e.target.value };
                  updateField("experience", next);
                }}
              />
            </div>
            <div className="cv-builder-editor__field">
              <label className="cv-builder-editor__label">Location</label>
              <input
                type="text"
                className="cv-builder-editor__input"
                value={job.location || ""}
                onChange={(e) => {
                  const next = [...jobs];
                  next[i] = { ...job, location: e.target.value };
                  updateField("experience", next);
                }}
              />
            </div>
            <div className="cv-builder-editor__field">
              <label className="cv-builder-editor__label">Achievements (one per line)</label>
              <textarea
                className="cv-builder-editor__textarea"
                value={arrayToText(job.achievements)}
                onChange={(e) => {
                  const next = [...jobs];
                  next[i] = { ...job, achievements: textToArray(e.target.value) };
                  updateField("experience", next);
                }}
                rows={4}
              />
            </div>
          </div>
        ))}
        <button
          className="cv-builder-editor__add-btn"
          onClick={() =>
            updateField("experience", [
              ...jobs,
              { title: "", company: "", duration: "", location: "", achievements: [] },
            ])
          }
        >
          + Add Job
        </button>
      </div>
    );
  };

  const renderEducationForm = () => {
    const eduList = profileData.education || [];
    return (
      <div>
        <h3 className="cv-builder-editor__section-title">Education</h3>
        {eduList.map((edu, i) => (
          <div key={i} className="cv-builder-editor__array-item">
            <div className="cv-builder-editor__array-header">
              <span className="cv-builder-editor__array-title">Education {i + 1}</span>
              <button
                className="cv-builder-editor__remove-btn"
                onClick={() =>
                  updateField("education", eduList.filter((_, idx) => idx !== i))
                }
              >
                Remove
              </button>
            </div>
            {["degree", "institution", "year", "gpa", "details"].map((field) => (
              <div key={field} className="cv-builder-editor__field">
                <label className="cv-builder-editor__label">
                  {field.charAt(0).toUpperCase() + field.slice(1)}
                </label>
                <input
                  type="text"
                  className="cv-builder-editor__input"
                  value={edu[field] || ""}
                  onChange={(e) => {
                    const next = [...eduList];
                    next[i] = { ...edu, [field]: e.target.value };
                    updateField("education", next);
                  }}
                />
              </div>
            ))}
          </div>
        ))}
        <button
          className="cv-builder-editor__add-btn"
          onClick={() =>
            updateField("education", [
              ...eduList,
              { degree: "", institution: "", year: "", gpa: "", details: "" },
            ])
          }
        >
          + Add Education
        </button>
      </div>
    );
  };

  const renderSkillsForm = () => {
    const s = profileData.skills || {};
    const categories = [
      { key: "technical", label: "Technical Skills (one per line or comma-separated)" },
      { key: "tools", label: "Tools (one per line or comma-separated)" },
      { key: "soft", label: "Soft Skills (one per line or comma-separated)" },
      { key: "languages", label: "Languages (one per line or comma-separated)" },
    ];
    return (
      <div>
        <h3 className="cv-builder-editor__section-title">Skills</h3>
        {categories.map((cat) => (
          <div key={cat.key} className="cv-builder-editor__field">
            <label className="cv-builder-editor__label">{cat.label}</label>
            <textarea
              className="cv-builder-editor__textarea"
              rows={3}
              value={skillsRaw[cat.key] || ""}
              onChange={(e) => {
                const text = e.target.value;
                setSkillsRaw((prev) => ({ ...prev, [cat.key]: text }));
                const items = text
                  .split(/\n|,/)
                  .map((x) => x.trim())
                  .filter(Boolean);
                updateField("skills", { ...s, [cat.key]: items });
              }}
            />
          </div>
        ))}
      </div>
    );
  };

  const renderStringArrayForm = (section, title) => {
    const items = profileData[section] || [];
    return (
      <div>
        <h3 className="cv-builder-editor__section-title">{title}</h3>
        <div className="cv-builder-editor__field">
          <label className="cv-builder-editor__label">One item per line</label>
          <textarea
            className="cv-builder-editor__textarea"
            value={arrayToText(items)}
            onChange={(e) => updateField(section, textToArray(e.target.value))}
            rows={8}
          />
        </div>
      </div>
    );
  };

  const renderProjectsForm = () => {
    const projs = profileData.projects || [];
    return (
      <div>
        <h3 className="cv-builder-editor__section-title">Projects</h3>
        {projs.map((proj, i) => (
          <div key={i} className="cv-builder-editor__array-item">
            <div className="cv-builder-editor__array-header">
              <span className="cv-builder-editor__array-title">Project {i + 1}</span>
              <button
                className="cv-builder-editor__remove-btn"
                onClick={() =>
                  updateField("projects", projs.filter((_, idx) => idx !== i))
                }
              >
                Remove
              </button>
            </div>
            <div className="cv-builder-editor__field">
              <label className="cv-builder-editor__label">Name</label>
              <input
                type="text"
                className="cv-builder-editor__input"
                value={proj.name || ""}
                onChange={(e) => {
                  const next = [...projs];
                  next[i] = { ...proj, name: e.target.value };
                  updateField("projects", next);
                }}
              />
            </div>
            <div className="cv-builder-editor__field">
              <label className="cv-builder-editor__label">Description</label>
              <textarea
                className="cv-builder-editor__textarea"
                value={proj.description || ""}
                onChange={(e) => {
                  const next = [...projs];
                  next[i] = { ...proj, description: e.target.value };
                  updateField("projects", next);
                }}
                rows={3}
              />
            </div>
            <div className="cv-builder-editor__field">
              <label className="cv-builder-editor__label">Technologies (comma-separated)</label>
              <input
                type="text"
                className="cv-builder-editor__input"
                value={(proj.technologies || []).join(", ")}
                onChange={(e) => {
                  const techs = e.target.value
                    .split(",")
                    .map((x) => x.trim())
                    .filter(Boolean);
                  const next = [...projs];
                  next[i] = { ...proj, technologies: techs };
                  updateField("projects", next);
                }}
              />
            </div>
          </div>
        ))}
        <button
          className="cv-builder-editor__add-btn"
          onClick={() =>
            updateField("projects", [
              ...projs,
              { name: "", description: "", technologies: [] },
            ])
          }
        >
          + Add Project
        </button>
      </div>
    );
  };

  const renderSectionForm = () => {
    switch (activeSection) {
      case "contact":
        return renderContactForm();
      case "summary":
        return renderSummaryForm();
      case "experience":
        return renderExperienceForm();
      case "education":
        return renderEducationForm();
      case "skills":
        return renderSkillsForm();
      case "certifications":
        return renderStringArrayForm("certifications", "Certifications");
      case "projects":
        return renderProjectsForm();
      case "awards":
        return renderStringArrayForm("awards", "Awards");
      case "publications":
        return renderStringArrayForm("publications", "Publications");
      default:
        return null;
    }
  };

  if (!isAuthenticated) {
    return <div className="cv-builder-editor__loading">Please log in to use the CV Builder.</div>;
  }

  if (loading) {
    return <div className="cv-builder-editor__loading">Loading CV profile...</div>;
  }

  return (
    <div className="cv-builder-editor">
      {/* Sidebar */}
      <aside className="cv-builder-editor__sidebar">
        <div className="cv-builder-editor__sidebar-title">Sections</div>
        {SECTIONS.map((sec) => (
          <button
            key={sec.key}
            className={`cv-builder-editor__nav-item ${
              activeSection === sec.key ? "cv-builder-editor__nav-item--active" : ""
            }`}
            onClick={() => setActiveSection(sec.key)}
          >
            {sec.label}
          </button>
        ))}
      </aside>

      {/* Form Panel */}
      <main className="cv-builder-editor__form-panel">
        <div className="cv-builder-editor__form-header">
          <input
            type="text"
            className="cv-builder-editor__input"
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              setHasChanges(true);
            }}
            placeholder="CV Title"
            style={{ maxWidth: 300, marginRight: 12 }}
          />
          <select
            className="cv-builder-editor__input"
            value={templateId}
            onChange={(e) => {
              setTemplateId(Number(e.target.value));
              setHasChanges(true);
            }}
            style={{ maxWidth: 140, marginRight: 12 }}
          >
            {TEMPLATES.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <div style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
            <button
              className="cv-builder-editor__save-btn cv-builder-editor__save-btn--secondary"
              onClick={handlePrint}
            >
              Export PDF
            </button>
            <button
              className="cv-builder-editor__save-btn"
              onClick={handleSave}
              disabled={saving || !hasChanges}
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
        {error && (
          <div className="cv-builder-editor__error-banner" onClick={() => setError(null)}>
            <span className="cv-builder-editor__error-text">{error}</span>
            <button className="cv-builder-editor__error-close">×</button>
          </div>
        )}
        {renderSectionForm()}
      </main>

      {/* Preview Panel */}
      <aside className="cv-builder-editor__preview-panel">
        <div className="cv-builder-editor__preview-label">Live Preview</div>
        <div className="cv-builder-editor__preview-wrapper" ref={printRef}>
          <Suspense fallback={<div style={{ padding: 40, textAlign: "center", color: "#6b7280" }}>Loading preview...</div>}>
            {templateId === 1 && <ModernTemplate profileData={profileData} />}
            {templateId === 2 && <ClassicTemplate profileData={profileData} />}
            {templateId === 3 && <MinimalTemplate profileData={profileData} />}
          </Suspense>
        </div>
      </aside>
    </div>
  );
};

export default CVBuilderEditor;
