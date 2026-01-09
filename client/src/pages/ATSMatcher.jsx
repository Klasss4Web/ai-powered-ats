import { useState } from "react";
import AnimatedLoader from "../components/loaders/animated-loader/AnimatedLoader";

// --- CORE COMPONENT: ATS Matcher ---

const ATSMatcher = () => {
  const [resumeFile, setResumeFile] = useState(null);
  const [jobDescription, setJobDescription] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [originalResumeText, setOriginalResumeText] = useState("");

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

  const ScoreBadge = ({ score }) => (
    <div style={styles.scoreBadge}>
      <p style={{ margin: 0, fontSize: "3em", fontWeight: "bold" }}>{score}%</p>
      <p style={{ margin: 0, fontSize: "0.8em", color: "#666" }}>Match Score</p>
    </div>
  );

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
          <div
            style={{
              display: "flex",
              gap: "40px",
              alignItems: "flex-start",
              flexWrap: "wrap",
            }}
          >
            {/* Score Display */}
            <ScoreBadge score={results.score} />

            {/* Recommendations */}
            <div style={styles.recommendationBox}>
              <h3>🎯 Recommendation Summary</h3>
              <blockquote style={styles.blockquote}>
                {results.recommendation_text}
              </blockquote>
            </div>
          </div>
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
        </div>
      )}
    </div>
  );
};

export default ATSMatcher;

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
  scoreBadge: {
    backgroundColor: "#e8f0fe",
    color: "#1a73e8",
    padding: "20px",
    borderRadius: "50%",
    width: "150px",
    height: "150px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    border: "5px solid #1a73e8",
    boxShadow: "0 4px 8px rgba(0,0,0,0.1)",
  },
  recommendationBox: {
    flex: 2,
    minWidth: "300px",
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
  },
  skillList: {
    flex: 1,
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
};
