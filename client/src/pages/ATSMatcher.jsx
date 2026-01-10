import { useState } from "react";
import AnimatedLoader from "../components/loaders/animated-loader/AnimatedLoader";

// --- CORE COMPONENT: ATS Matcher ---

const ATSMatcher = () => {
  const showOtherFeatures = false; // Toggle to show/hide extended features
  const [resumeFile, setResumeFile] = useState(null);
  const [jobDescription, setJobDescription] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [originalResumeText, setOriginalResumeText] = useState("");
  const [showAllAnalysis, setShowAllAnalysis] = useState(false);

  // Function to handle the form submission and API call
  const handleSubmission = async (e) => {
    e.preventDefault();

    if (!resumeFile || !jobDescription.trim()) {
      setError("Please upload a resume (PDF) and paste the job description.");
      return;
    }

    setLoading(true);
    setResults(null);
    setError(null);
    setOriginalResumeText(""); // Clear previous text

    const formData = new FormData();
    formData.append("resume", resumeFile);
    formData.append("job_description", jobDescription);

    try {
      const response = await fetch("http://127.0.0.1:5000/api/match", {
        method: "POST",
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `Server error: ${response.status}`);
      }

      // CRITICAL CHANGE 2: Save the extracted text for the generation feature
      requestAnimationFrame(() => {
        window.scrollTo(0, document.documentElement.scrollHeight);
      });
      setResults(data);
      setResumeFile(null);
      setJobDescription("");
      setOriginalResumeText(data.original_resume_text || "");
    } catch (error) {
      console.error("Submission error:", error);
      setError(`Analysis Failed: ${error.message || "Check server status."}`);
    } finally {
      setLoading(false);
    }
  };

  // 3. New function to trigger the DOCX generation and download
  const handleDownloadOptimizedCV = async () => {
    if (!results || !originalResumeText) {
      alert("Please run the analysis first.");
      return;
    }

    try {
      const response = await fetch("http://127.0.0.1:5000/api/generate-cv", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          original_resume_text: originalResumeText,
          missing_skills: results.missing_skills,
        }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;

        // Determine filename from Content-Disposition header or content-type
        const contentDisp =
          response.headers.get("content-disposition") ||
          response.headers.get("Content-Disposition");
        let filename = "optimized_cv";
        if (contentDisp) {
          const fileMatch = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(
            contentDisp
          );
          if (fileMatch && fileMatch[1]) {
            filename = decodeURIComponent(fileMatch[1]);
          }
        } else {
          const ct = response.headers.get("content-type") || "";
          if (ct.includes("pdf")) filename = "optimized_cv.pdf";
          else if (ct.includes("word") || ct.includes("officedocument"))
            filename = "optimized_cv.docx";
          else filename = "optimized_cv.bin";
        }

        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
      } else {
        alert("Failed to generate document.");
      }
    } catch (error) {
      console.error("Download error:", error);
    }
  };

  console.log({ results });

  return (
    <div style={styles.container}>
      <h1 style={styles.header}>Resume Matcher (AI-Powered ATS)</h1>
      <p style={styles.subHeader}>
        Upload your CV and paste the job requirements below for an instant score
        and tailored recommendations.
      </p>

      {/* --- INPUT FORM --- */}
      <form onSubmit={handleSubmission} style={styles.inputSection}>
        {/* Resume Uploader */}
        <div style={styles.inputGroup}>
          <h3>1. Upload Resume (PDF)</h3>
          <input
            type="file"
            accept="application/pdf"
            onChange={(e) => {
              setResumeFile(e.target.files[0]);
              setError(null); // Clear error on new input
            }}
            style={styles.fileInput}
            required
          />
          {resumeFile && <p>File Selected: {resumeFile.name}</p>}
        </div>

        {/* Job Description Input */}
        <div style={styles.inputGroup}>
          <h3>2. Paste Job Requirements</h3>
          <textarea
            placeholder="Paste the full job description here..."
            value={jobDescription}
            onChange={(e) => {
              setJobDescription(e.target.value);
              setError(null); // Clear error on new input
            }}
            rows="10"
            style={styles.textArea}
            required
          />
        </div>

        {loading ? (
          <AnimatedLoader text="Analyzing" />
        ) : (
          <button
            type="submit"
            disabled={loading || !resumeFile || !jobDescription.trim()}
            style={styles.submitButton}
          >
            Get Match Score & Recommendations
          </button>
        )}

        {error && <p style={styles.error}>{error}</p>}
      </form>

      {/* --- RESULTS SECTION --- */}
      {results && (
        <div style={styles.resultsSection}>
          <h2>✅ Analysis Complete</h2>
          <hr style={{ border: "1px solid #eee" }} />

          {/* Main Score Badges - Multi-Metric Display */}
          <div style={styles.scoreGrid}>
            {/* Overall Match Score */}
            <ScoreBadge
              score={results.overall_match_score || results.score}
              label="Overall Match"
              color="#1a73e8"
            />

            {/* Individual Metric Scores */}
            {results.keyword_match_score !== undefined && (
              <ScoreBadge
                score={results.keyword_match_score}
                label="Keyword Match"
                color="#34a853"
              />
            )}
            {results.skills_alignment_score !== undefined && (
              <ScoreBadge
                score={results.skills_alignment_score}
                label="Skills Alignment"
                color="#fbbc04"
              />
            )}
            {results.experience_relevance_score !== undefined && (
              <ScoreBadge
                score={results.experience_relevance_score}
                label="Experience Relevance"
                color="#ea4335"
              />
            )}
            {results.formatting_structure_score !== undefined && (
              <ScoreBadge
                score={results.formatting_structure_score}
                label="Formatting/Structure"
                color="#9c27b0"
              />
            )}
            {results.seniority_fit_score !== undefined && showOtherFeatures && (
              <ScoreBadge
                score={results.seniority_fit_score}
                label="Seniority Fit"
                color="#00bcd4"
              />
            )}
          </div>

          {/* Recommendations */}
          <div style={styles.recommendationBox}>
            <h3>🎯 Recommendation Summary</h3>
            <blockquote style={styles.blockquote}>
              {results.recommendation_text}
            </blockquote>
          </div>

          {/* Matched and Missing Skills */}
          <div style={styles.skillsContainer}>
            {/* Matched Skills */}
            <div style={styles.skillList}>
              <h3>👍 Skills Matched ({results.matched_skills.length})</h3>
              <div style={styles.tagGroup} className="drop-down-container">
                {results.matched_skills.map((skill, index) => (
                  <span
                    key={index}
                    className="drop-down-container__item"
                    style={{ ...styles.tagMatched, "--i": index }}
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>

            {/* Missing Skills */}
            <div style={styles.skillList}>
              <h3>⚠️ Missing Key Skills ({results.missing_skills.length})</h3>
              <div style={styles.tagGroup} className="drop-down-container">
                {results.missing_skills.map((skill, index) => (
                  <span
                    key={index}
                    className="drop-down-container__item"
                    style={{ ...styles.tagMissing, "--i": index }}
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </div>
          </div>
          {showOtherFeatures && (
            <>
              {/* Keyword Gap Analyzer Section */}
              {results.keyword_gap_analysis &&
                Object.keys(results.keyword_gap_analysis).length > 0 && (
                  <div style={styles.gapAnalysisSection}>
                    <h3>🔍 Keyword Gap Analyzer</h3>
                    <div style={styles.gapGrid}>
                      {Object.entries(results.keyword_gap_analysis).map(
                        ([skill, section], index) => (
                          <div key={index} style={styles.gapItem}>
                            <strong style={{ color: "#d93025" }}>
                              {skill}
                            </strong>
                            <p
                              style={{
                                margin: "5px 0 0 0",
                                color: "#666",
                                fontSize: "0.9em",
                              }}
                            >
                              → Add to: <em>{section}</em>
                            </p>
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )}

              {/* Weakly Represented Skills */}
              {results.weakly_represented_skills &&
                results.weakly_represented_skills.length > 0 && (
                  <div style={styles.analysisSection}>
                    <h3>📊 Weakly Represented Skills</h3>
                    <p style={{ color: "#666", marginBottom: "10px" }}>
                      These skills appear but could be emphasized more:
                    </p>
                    <div style={styles.tagGroup}>
                      {results.weakly_represented_skills.map((skill, index) => (
                        <span key={index} style={styles.tagWeakly}>
                          {skill}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

              {/* Overused Terms */}
              {results.overused_terms && results.overused_terms.length > 0 && (
                <div style={styles.analysisSection}>
                  <h3>⚡ Overused Terms</h3>
                  <p style={{ color: "#666", marginBottom: "10px" }}>
                    Consider varying these repeated words/phrases:
                  </p>
                  <div style={styles.tagGroup}>
                    {results.overused_terms.map((term, index) => (
                      <span key={index} style={styles.tagOverused}>
                        {term}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Add to Resume Suggestions */}
              {results.add_to_resume_suggestions &&
                results.add_to_resume_suggestions.length > 0 && (
                  <div style={styles.suggestionsSection}>
                    <h3>💡 "Add to Resume" Suggestions</h3>
                    <p style={{ color: "#666", marginBottom: "10px" }}>
                      Consider adding these bullet points to strengthen your
                      resume:
                    </p>
                    <ul style={styles.suggestionsList}>
                      {results.add_to_resume_suggestions.map(
                        (suggestion, index) => (
                          <li key={index} style={styles.suggestionItem}>
                            {suggestion}
                          </li>
                        )
                      )}
                    </ul>
                  </div>
                )}
            </>
          )}

          {/* Download Button */}
          <button
            onClick={handleDownloadOptimizedCV}
            style={{
              ...styles.submitButton,
              backgroundColor: "#34a853",
              marginTop: "20px",
            }}
          >
            ⬇️ Download Optimized CV (.docx)
          </button>

          {/* See All Analysis Button */}
          <button
            onClick={() => setShowAllAnalysis(true)}
            style={{
              ...styles.submitButton,
              backgroundColor: "#1a73e8",
              marginTop: "15px",
            }}
          >
            📊 See All Analysis
          </button>
        </div>
      )}

      {/* Full Analysis Modal */}
      {showAllAnalysis && results && (
        <div style={styles.modalOverlay}>
          <div style={styles.modalContent}>
            <div style={styles.modalHeader}>
              <h2>📊 Complete Analysis Report</h2>
              <button
                onClick={() => setShowAllAnalysis(false)}
                style={styles.closeButton}
              >
                ✕
              </button>
            </div>

            <div style={styles.modalBody}>
              {/* All Metric Scores */}
              <section style={styles.modalSection}>
                <h3>📈 Detailed Scores</h3>
                <div style={styles.scoresGrid}>
                  <div style={styles.scoreItem}>
                    <span style={styles.scoreLabel}>Overall Match:</span>
                    <span style={styles.scoreValue}>
                      {results.overall_match_score || results.score}%
                    </span>
                  </div>
                  {results.keyword_match_score !== undefined && (
                    <div style={styles.scoreItem}>
                      <span style={styles.scoreLabel}>Keyword Match:</span>
                      <span style={styles.scoreValue}>
                        {results.keyword_match_score}%
                      </span>
                    </div>
                  )}
                  {results.skills_alignment_score !== undefined && (
                    <div style={styles.scoreItem}>
                      <span style={styles.scoreLabel}>Skills Alignment:</span>
                      <span style={styles.scoreValue}>
                        {results.skills_alignment_score}%
                      </span>
                    </div>
                  )}
                  {results.experience_relevance_score !== undefined && (
                    <div style={styles.scoreItem}>
                      <span style={styles.scoreLabel}>
                        Experience Relevance:
                      </span>
                      <span style={styles.scoreValue}>
                        {results.experience_relevance_score}%
                      </span>
                    </div>
                  )}
                  {results.formatting_structure_score !== undefined && (
                    <div style={styles.scoreItem}>
                      <span style={styles.scoreLabel}>
                        Formatting/Structure:
                      </span>
                      <span style={styles.scoreValue}>
                        {results.formatting_structure_score}%
                      </span>
                    </div>
                  )}
                  {results.seniority_fit_score !== undefined && (
                    <div style={styles.scoreItem}>
                      <span style={styles.scoreLabel}>Seniority Fit:</span>
                      <span style={styles.scoreValue}>
                        {results.seniority_fit_score}%
                      </span>
                    </div>
                  )}
                </div>
              </section>

              {/* Matched Skills */}
              <section style={styles.modalSection}>
                <h3>
                  👍 Matched Skills ({results.matched_skills?.length || 0})
                </h3>
                <div style={styles.tagGroup}>
                  {results.matched_skills?.map((skill, index) => (
                    <span key={index} style={styles.tagMatched}>
                      {skill}
                    </span>
                  ))}
                </div>
              </section>

              {/* Missing Skills */}
              <section style={styles.modalSection}>
                <h3>
                  ⚠️ Missing Key Skills ({results.missing_skills?.length || 0})
                </h3>
                <div style={styles.tagGroup}>
                  {results.missing_skills?.map((skill, index) => (
                    <span key={index} style={styles.tagMissing}>
                      {skill}
                    </span>
                  ))}
                </div>
              </section>

              {/* Keyword Gap Analysis */}
              {results.keyword_gap_analysis &&
                Object.keys(results.keyword_gap_analysis).length > 0 && (
                  <section style={styles.modalSection}>
                    <h3>🔍 Keyword Gap Analyzer</h3>
                    <div style={styles.gapGrid}>
                      {Object.entries(results.keyword_gap_analysis).map(
                        ([skill, section], index) => (
                          <div key={index} style={styles.gapItem}>
                            <strong style={{ color: "#d93025" }}>
                              {skill}
                            </strong>
                            <p
                              style={{
                                margin: "5px 0 0 0",
                                color: "#666",
                                fontSize: "0.9em",
                              }}
                            >
                              → Add to: <em>{section}</em>
                            </p>
                          </div>
                        )
                      )}
                    </div>
                  </section>
                )}

              {/* Weakly Represented Skills */}
              {results.weakly_represented_skills &&
                results.weakly_represented_skills.length > 0 && (
                  <section style={styles.modalSection}>
                    <h3>
                      📊 Weakly Represented Skills (
                      {results.weakly_represented_skills.length})
                    </h3>
                    <p style={{ color: "#666", marginBottom: "10px" }}>
                      These skills appear but could be emphasized more:
                    </p>
                    <div style={styles.tagGroup}>
                      {results.weakly_represented_skills.map((skill, index) => (
                        <span key={index} style={styles.tagWeakly}>
                          {skill}
                        </span>
                      ))}
                    </div>
                  </section>
                )}

              {/* Overused Terms */}
              {results.overused_terms && results.overused_terms.length > 0 && (
                <section style={styles.modalSection}>
                  <h3>⚡ Overused Terms ({results.overused_terms.length})</h3>
                  <p style={{ color: "#666", marginBottom: "10px" }}>
                    Consider varying these repeated words/phrases:
                  </p>
                  <div style={styles.tagGroup}>
                    {results.overused_terms.map((term, index) => (
                      <span key={index} style={styles.tagOverused}>
                        {term}
                      </span>
                    ))}
                  </div>
                </section>
              )}

              {/* Add to Resume Suggestions */}
              {results.add_to_resume_suggestions &&
                results.add_to_resume_suggestions.length > 0 && (
                  <section style={styles.modalSection}>
                    <h3>
                      💡 "Add to Resume" Suggestions (
                      {results.add_to_resume_suggestions.length})
                    </h3>
                    <p style={{ color: "#666", marginBottom: "10px" }}>
                      Consider adding these bullet points to strengthen your
                      resume:
                    </p>
                    <ul style={styles.suggestionsList}>
                      {results.add_to_resume_suggestions.map(
                        (suggestion, index) => (
                          <li key={index} style={styles.suggestionItem}>
                            {suggestion}
                          </li>
                        )
                      )}
                    </ul>
                  </section>
                )}

              {/* Recommendation Text */}
              <section style={styles.modalSection}>
                <h3>🎯 Recommendation</h3>
                <blockquote style={styles.blockquote}>
                  {results.recommendation_text}
                </blockquote>
              </section>
            </div>

            <div style={styles.modalFooter}>
              <button
                onClick={() => setShowAllAnalysis(false)}
                style={{
                  ...styles.submitButton,
                  backgroundColor: "#1a73e8",
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ATSMatcher;

// Enhanced Score Badge Component
const ScoreBadge = ({ score, label = "Score", color = "#1a73e8" }) => {
  const getScoreColor = (score) => {
    if (score >= 80) return "#1e8e3e"; // Green
    if (score >= 60) return "#fbbc04"; // Yellow
    return "#d93025"; // Red
  };

  const displayColor = color || getScoreColor(score);
  const backgroundColor = displayColor + "15";

  return (
    <div
      style={{
        ...styles.scoreBadge,
        backgroundColor,
        borderColor: displayColor,
      }}
    >
      <p
        style={{
          margin: 0,
          fontSize: "2em",
          fontWeight: "bold",
          color: displayColor,
        }}
      >
        {score}%
      </p>
      <p style={{ margin: 0, fontSize: "0.75em", color: "#666" }}>{label}</p>
    </div>
  );
};

// --- Basic Inline Styles (For Preview Purposes) ---

const styles = {
  container: {
    width: "100%",
    maxWidth: "1000px",
    margin: "0 auto",
    padding: "30px",
    fontFamily: "Arial, sans-serif",
    backgroundColor: "#f4f7fa",
    borderRadius: "10px",
    boxShadow: "0 6px 12px rgba(0,0,0,0.15)",
    textAlign: "left",
  },
  header: {
    textAlign: "center",
    color: "#1a73e8",
    marginBottom: "5px",
  },
  subHeader: {
    textAlign: "center",
    color: "#5f6368",
    marginBottom: "30px",
  },
  inputSection: {
    width: "100%",
    backgroundColor: "#fff",
    padding: "30px",
    borderRadius: "8px",
    marginBottom: "30px",
    border: "1px solid #dadce0",
  },
  inputGroup: {
    marginBottom: "20px",
    width: "100%",
  },
  fileInput: {
    padding: "20px",
    border: "2px dotted #ccc",
    borderRadius: "5px",
    backgroundColor: "#f9f9f9",
    display: "block",
    width: "100%",
    textAlign: "center",
    cursor: "pointer",
  },
  textArea: {
    width: "100%",
    padding: "15px",
    border: "1px solid #ccc",
    borderRadius: "4px",
    resize: "vertical",
    fontSize: "1em",
  },
  submitButton: {
    width: "100%",
    padding: "15px",
    backgroundColor: "#1a73e8",
    color: "white",
    border: "none",
    borderRadius: "4px",
    fontSize: "1.2em",
    cursor: "pointer",
    marginTop: "15px",
    transition: "background-color 0.3s",
  },
  error: {
    textAlign: "center",
    color: "#d93025",
    fontWeight: "bold",
    marginTop: "15px",
  },
  resultsSection: {
    backgroundColor: "#fff",
    padding: "30px",
    borderRadius: "8px",
    border: "2px solid #1a73e8",
  },
  scoreGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
    gap: "20px",
    marginBottom: "30px",
    padding: "20px 0",
    borderBottom: "1px solid #eee",
  },
  scoreBadge: {
    padding: "15px",
    borderRadius: "12px",
    width: "100%",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    border: "3px solid",
    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
    minHeight: "120px",
  },
  recommendationBox: {
    marginTop: "20px",
    marginBottom: "30px",
  },
  blockquote: {
    borderLeft: "4px solid #fbbc04",
    paddingLeft: "15px",
    margin: "10px 0",
    color: "#3c4043",
    fontStyle: "italic",
    backgroundColor: "#fffbe5",
    padding: "10px 15px",
    borderRadius: "4px",
  },
  skillsContainer: {
    display: "flex",
    gap: "40px",
    marginTop: "30px",
    paddingTop: "20px",
    borderTop: "1px dashed #ccc",
    flexWrap: "wrap",
  },
  skillList: {
    flex: 1,
    minWidth: "300px",
  },
  tagGroup: {
    display: "flex",
    flexWrap: "wrap",
    gap: "10px",
    marginTop: "10px",
  },
  tagMatched: {
    backgroundColor: "#e6f4ea",
    color: "#1e8e3e",
    padding: "8px 12px",
    borderRadius: "20px",
    fontSize: "0.9em",
    fontWeight: "600",
  },
  tagMissing: {
    backgroundColor: "#fce8e6",
    color: "#d93025",
    padding: "8px 12px",
    borderRadius: "20px",
    fontSize: "0.9em",
    fontWeight: "600",
  },
  tagWeakly: {
    backgroundColor: "#fff3cd",
    color: "#f57f17",
    padding: "8px 12px",
    borderRadius: "20px",
    fontSize: "0.9em",
    fontWeight: "600",
  },
  tagOverused: {
    backgroundColor: "#ffe0b2",
    color: "#e65100",
    padding: "8px 12px",
    borderRadius: "20px",
    fontSize: "0.9em",
    fontWeight: "600",
  },
  gapAnalysisSection: {
    marginTop: "30px",
    padding: "20px",
    backgroundColor: "#f3f3f3",
    borderRadius: "8px",
    borderLeft: "4px solid #d93025",
  },
  gapGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
    gap: "15px",
    marginTop: "15px",
  },
  gapItem: {
    backgroundColor: "#fff",
    padding: "12px",
    borderRadius: "6px",
    border: "1px solid #eee",
  },
  analysisSection: {
    marginTop: "25px",
    padding: "20px",
    backgroundColor: "#f9f9f9",
    borderRadius: "8px",
    borderLeft: "4px solid #fbbc04",
  },
  suggestionsSection: {
    marginTop: "25px",
    padding: "20px",
    backgroundColor: "#e8f5e9",
    borderRadius: "8px",
    borderLeft: "4px solid #34a853",
  },
  suggestionsList: {
    marginTop: "10px",
    paddingLeft: "20px",
  },
  suggestionItem: {
    marginBottom: "10px",
    color: "#1e8e3e",
    lineHeight: "1.6",
  },
  // Modal Styles
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
    maxWidth: "900px",
    maxHeight: "90vh",
    overflow: "auto",
    display: "flex",
    flexDirection: "column",
  },
  modalHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "30px",
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
    width: "30px",
    height: "30px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "50%",
    transition: "all 0.2s",
  },
  modalBody: {
    padding: "30px",
    flex: 1,
    overflowY: "auto",
  },
  modalSection: {
    marginBottom: "30px",
    paddingBottom: "30px",
    borderBottom: "1px solid #eee",
  },
  scoresGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: "15px",
    marginTop: "15px",
  },
  scoreItem: {
    backgroundColor: "#f9f9f9",
    padding: "15px",
    borderRadius: "8px",
    border: "1px solid #eee",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
  },
  scoreLabel: {
    fontWeight: "600",
    color: "#1a73e8",
    fontSize: "0.95em",
  },
  scoreValue: {
    fontSize: "1.3em",
    fontWeight: "bold",
    color: "#34a853",
    marginLeft: "10px",
  },
  modalFooter: {
    padding: "20px 30px",
    borderTop: "1px solid #eee",
    display: "flex",
    justifyContent: "flex-end",
    gap: "10px",
    backgroundColor: "#f9f9f9",
  },
};
