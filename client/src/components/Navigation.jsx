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

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
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

  return (
    <nav className="nav-shell">
      <div className="nav-brand">ATS Matcher</div>

      {/* Global Search */}
      <div
        ref={dropdownRef}
        style={{ position: "relative", flex: 1, maxWidth: "420px" }}
      >
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

      <div className="nav-links">
        <NavLink to="/" end className={activeClass}>
          Home
        </NavLink>
        <NavLink to="/matcher" className={activeClass}>
          Matcher
        </NavLink>
        {isEnabled("recruiter_pipeline") && (
          <NavLink to="/recruiters" className={activeClass}>
            Recruiters
          </NavLink>
        )}
        {isEnabled("job_tracker") && (
          <NavLink to="/tracker" className={activeClass}>
            Tracker
          </NavLink>
        )}
        <NavLink to="/dashboard" className={activeClass}>
          Dashboard
        </NavLink>
        <NavLink to="/my-analysis" className={activeClass}>
          My Analysis
        </NavLink>
        <NavLink
          to="/subscribe"
          className={({ isActive }) =>
            isActive ? "nav-link active nav-primary" : "nav-link nav-primary"
          }
        >
          Subscribe
        </NavLink>
      </div>
    </nav>
  );
};

export default Navigation;
