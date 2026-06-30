import { useState, useEffect, useRef } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { AUTH_CONSTANTS, BASE_URL } from "../constants/auth_constants";
import { useFeatures } from "../contexts/FeaturesContext";

const Navigation = () => {
  const { isEnabled } = useFeatures();
  const activeClass = ({ isActive }) =>
    isActive ? "nav-link active" : "nav-link";

  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searching, setSearching] = useState(false);
  const dropdownRef = useRef(null);
  const navigate = useNavigate();

  // Mobile menu & tools dropdown state
  const [mobileOpen, setMobileOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const toolsRef = useRef(null);
  const mobileRef = useRef(null);

  // Debounced search
  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      setShowDropdown(false);
      return;
    }
    const timer = setTimeout(() => performSearch(query), 350);
    return () => clearTimeout(timer);
  }, [query]);

  // Close dropdowns on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
      if (toolsRef.current && !toolsRef.current.contains(e.target)) {
        setToolsOpen(false);
      }
      if (mobileRef.current && !mobileRef.current.contains(e.target)) {
        setMobileOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Close mobile menu when resizing to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth > 920) setMobileOpen(false);
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const performSearch = async (q) => {
    setSearching(true);
    try {
      const token = localStorage.getItem(AUTH_CONSTANTS.TOKEN_KEY);
      if (!token) {
        setSearching(false);
        return;
      }
      const res = await fetch(`${BASE_URL}/search?q=${encodeURIComponent(q)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setResults(data.results || []);
        setShowDropdown(true);
      }
    } catch {
      // silent fail
    } finally {
      setSearching(false);
    }
  };

  const getResultLink = (result) => {
    switch (result.type) {
      case "analysis":
        return `/my-analysis`;
      case "cover_letter":
        return `/dashboard`;
      case "interview_prep":
        return `/dashboard`;
      case "screening_session":
        return `/recruiters`;
      default:
        return "/";
    }
  };

  const getResultIcon = (type) => {
    switch (type) {
      case "analysis":
        return "📊";
      case "cover_letter":
        return "📝";
      case "interview_prep":
        return "🎤";
      case "screening_session":
        return "👔";
      default:
        return "📄";
    }
  };

  const hasTools =
    isEnabled("recruiter_pipeline") ||
    isEnabled("job_tracker") ||
    isEnabled("cv_builder");

  return (
    <nav className="nav-shell">
      <div className="nav-brand">ATS Matcher</div>

      {/* Global Search */}
      <div ref={dropdownRef} className="nav-search-wrap">
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => {
              if (results.length > 0) setShowDropdown(true);
            }}
            placeholder="Search analyses, letters, sessions..."
            style={{
              width: "100%",
              padding: "8px 14px",
              borderRadius: "999px",
              border: "1px solid rgba(148,163,184,0.25)",
              background: "rgba(15,23,42,0.6)",
              color: "#e2e8f0",
              fontSize: "0.9rem",
              outline: "none",
            }}
          />
          {searching && (
            <span style={{ color: "#94a3b8", fontSize: "0.8rem" }}>…</span>
          )}
        </div>

        {showDropdown && (
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 6px)",
              left: 0,
              right: 0,
              background: "#0f172a",
              border: "1px solid rgba(148,163,184,0.2)",
              borderRadius: "12px",
              boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
              zIndex: 100,
              maxHeight: "360px",
              overflowY: "auto",
              padding: "8px 0",
            }}
          >
            {results.length === 0 ? (
              <div
                style={{
                  padding: "14px 18px",
                  color: "#94a3b8",
                  fontSize: "0.9rem",
                }}
              >
                No results found
              </div>
            ) : (
              results.map((r) => (
                <div
                  key={`${r.type}-${r.id}`}
                  onClick={() => {
                    setShowDropdown(false);
                    setQuery("");
                    navigate(getResultLink(r));
                  }}
                  style={{
                    padding: "10px 18px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    borderBottom: "1px solid rgba(148,163,184,0.08)",
                  }}
                  onMouseEnter={(e) =>
                    (e.currentTarget.style.background = "rgba(56,189,248,0.08)")
                  }
                  onMouseLeave={(e) =>
                    (e.currentTarget.style.background = "transparent")
                  }
                >
                  <span style={{ fontSize: "1.1rem" }}>
                    {getResultIcon(r.type)}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: "0.9rem",
                        color: "#f1f5f9",
                        fontWeight: 500,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {r.title}
                    </div>
                    {r.subtitle && (
                      <div
                        style={{
                          fontSize: "0.8rem",
                          color: "#94a3b8",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {r.subtitle}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Hamburger (mobile) */}
      <button
        className={`hamburger-btn${mobileOpen ? " open" : ""}`}
        onClick={() => setMobileOpen(!mobileOpen)}
        aria-label="Toggle menu"
        aria-expanded={mobileOpen}
      >
        <span></span>
        <span></span>
        <span></span>
      </button>

      {/* Nav Links */}
      <div
        ref={mobileRef}
        className={`nav-links${mobileOpen ? " open" : ""}`}
      >
        <NavLink to="/" end className={activeClass} onClick={() => setMobileOpen(false)}>
          Home
        </NavLink>
        <NavLink to="/matcher" className={activeClass} onClick={() => setMobileOpen(false)}>
          Matcher
        </NavLink>
        <NavLink to="/dashboard" className={activeClass} onClick={() => setMobileOpen(false)}>
          Dashboard
        </NavLink>
        <NavLink to="/my-analysis" className={activeClass} onClick={() => setMobileOpen(false)}>
          My Analysis
        </NavLink>

        {hasTools && (
          <div ref={toolsRef} className="nav-dropdown">
            <button
              className="nav-link nav-dropdown-toggle"
              onClick={() => setToolsOpen(!toolsOpen)}
              aria-expanded={toolsOpen}
            >
              Tools{" "}
              <span className="caret">{toolsOpen ? "▲" : "▼"}</span>
            </button>
            {toolsOpen && (
              <div className="nav-dropdown-menu">
                {isEnabled("recruiter_pipeline") && (
                  <NavLink
                    to="/recruiters"
                    className={activeClass}
                    onClick={() => {
                      setToolsOpen(false);
                      setMobileOpen(false);
                    }}
                  >
                    Recruiters
                  </NavLink>
                )}
                {isEnabled("job_tracker") && (
                  <NavLink
                    to="/tracker"
                    className={activeClass}
                    onClick={() => {
                      setToolsOpen(false);
                      setMobileOpen(false);
                    }}
                  >
                    Tracker
                  </NavLink>
                )}
                {isEnabled("cv_builder") && (
                  <NavLink
                    to="/cv-builder"
                    className={activeClass}
                    onClick={() => {
                      setToolsOpen(false);
                      setMobileOpen(false);
                    }}
                  >
                    CV Builder
                  </NavLink>
                )}
              </div>
            )}
          </div>
        )}

        <NavLink
          to="/subscribe"
          className={({ isActive }) =>
            isActive ? "nav-link active nav-primary" : "nav-link nav-primary"
          }
          onClick={() => setMobileOpen(false)}
        >
          Subscribe
        </NavLink>
      </div>
    </nav>
  );
};

export default Navigation;
