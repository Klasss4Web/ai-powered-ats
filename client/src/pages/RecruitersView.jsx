import { useState, useEffect } from "react";
import AlertModal from "../components/AlertModal";
import UserAvatar from "../components/UserAvatar";
import UsageStatus from "../components/UsageStatus";
import UpgradeModal from "../components/UpgradeModal";
import LoginModal from "../components/auth/LoginModal";
import { AUTH_CONSTANTS, BASE_URL } from "../constants/auth_constants";
import AnimatedLoader from "../components/loaders/animated-loader/AnimatedLoader";

const RecruitersView = () => {
  const [jobDescription, setJobDescription] = useState("");
  const [resumeFiles, setResumeFiles] = useState([]);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sortBy, setSortBy] = useState("overall_match_score");
  const [sortOrder, setSortOrder] = useState("desc");

  const sortedResults = results
    ? [...results].sort((a, b) => {
        if (a.error || b.error) return 0;
        const aVal = a.scores[sortBy];
        const bVal = b.scores[sortBy];
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

  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(null);
  const [showLoginModal, setShowLoginModal] = useState(false);

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

  // Premium check state
  const [isPremiumUser, setIsPremiumUser] = useState(false);

  // Check authentication on app load
  useEffect(() => {
    const token = localStorage.getItem(AUTH_CONSTANTS.TOKEN_KEY);
    if (token) {
      verifyAuth(token);
    } else {
      setShowLoginModal(true);
    }
  }, []);

  // Fetch usage info when authenticated
  useEffect(() => {
    if (isAuthenticated && user) {
      fetchUsageInfo();
    }
  }, [isAuthenticated, user]);

  const verifyAuth = async (token) => {
    try {
      const response = await fetch(`${BASE_URL}/auth/verify`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setUser(data.user);
        setIsAuthenticated(true);
        setIsPremiumUser(data.user.subscription_type === "premium");
      } else {
        throw new Error("Verification failed");
      }
    } catch (error) {
      console.error("Auth verification failed:", error);
      localStorage.removeItem(AUTH_CONSTANTS.TOKEN_KEY);
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

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    // Filter to only PDFs
    const pdfFiles = files.filter((file) => file.type === "application/pdf");
    if (pdfFiles.length !== files.length) {
      setAlertModal({
        isOpen: true,
        message: "Only PDF files are allowed. Non-PDF files were ignored.",
        type: "warning",
      });
    }
    setResumeFiles(pdfFiles);
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
      setError("Maximum 10 resumes allowed.");
      return;
    }

    setLoading(true);
    setError(null);
    setResults(null);

    const formData = new FormData();
    formData.append("job_description", jobDescription);
    resumeFiles.forEach((file) => {
      formData.append("resumes", file);
    });

    try {
      const token = localStorage.getItem(AUTH_CONSTANTS.TOKEN_KEY);
      const response = await fetch(`${BASE_URL}/batch-match`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (response.ok) {
        const data = await response.json();
        setResults(data.results);
        fetchUsageInfo(); // Refresh usage
      } else {
        const errorData = await response.json();
        if (errorData.upgrade_required) {
          setUpgradeModalData({
            message: errorData.error,
            type: "analysis",
          });
          setShowUpgradeModal(true);
        } else {
          setError(errorData.error || "An error occurred.");
        }
      }
    } catch (err) {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleLoginSuccess = (userData) => {
    setUser(userData);
    setIsAuthenticated(true);
    setIsPremiumUser(userData.subscription_type === "premium");
    setShowLoginModal(false);
    localStorage.setItem(AUTH_CONSTANTS.TOKEN_KEY, userData.token);
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    setUser(null);
    localStorage.removeItem(AUTH_CONSTANTS.TOKEN_KEY);
    setShowLoginModal(true);
  };

  const closeAlertModal = () => {
    setAlertModal({ isOpen: false, message: "", type: "info" });
  };

  const closeUpgradeModal = () => {
    setShowUpgradeModal(false);
    setUpgradeModalData(null);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-gray-900">
                ATS Recruiter Tool
              </h1>
              {isAuthenticated && user && (
                <UserAvatar user={user} onLogout={handleLogout} />
              )}
            </div>
            {isAuthenticated && usageInfo && (
              <UsageStatus usageInfo={usageInfo} loading={loadingUsage} />
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {!isAuthenticated ? (
          <div className="text-center">
            <p className="text-gray-600">
              Please log in to use the recruiter tool.
            </p>
          </div>
        ) : !isPremiumUser ? (
          <div className="text-center py-12">
            <div className="bg-white rounded-lg shadow p-8 max-w-md mx-auto">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">
                Premium Feature
              </h2>
              <p className="text-gray-600 mb-6">
                The Recruiters Tool is available exclusively for premium
                subscribers. Upgrade your account to access batch resume
                analysis and advanced recruiting features.
              </p>
              <button
                onClick={() => {
                  setUpgradeModalData({
                    message:
                      "Upgrade to premium to access the Recruiters Tool and unlock unlimited analyses.",
                    type: "premium_required",
                  });
                  setShowUpgradeModal(true);
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-6 rounded-lg transition duration-200"
              >
                Upgrade to Premium
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Job Description Input */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">Job Description</h2>
              <textarea
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                placeholder="Paste the job description here..."
                className="w-full h-40 p-3 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                rows="6"
              />
            </div>

            {/* Resume Upload */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-semibold mb-4">
                Upload Resumes (PDF only, max 10)
              </h2>
              <input
                type="file"
                multiple
                accept=".pdf"
                onChange={handleFileChange}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
              />
              {resumeFiles.length > 0 && (
                <p className="mt-2 text-sm text-gray-600">
                  {resumeFiles.length} file(s) selected
                </p>
              )}
            </div>

            {/* Analyze Button */}
            <div className="text-center">
              <button
                onClick={handleAnalyze}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-bold py-3 px-8 rounded-lg transition duration-200"
              >
                {loading ? "Analyzing..." : "Analyze Candidates"}
              </button>
            </div>

            {/* Error Message */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
                {error}
              </div>
            )}

            {/* Results */}
            {results && (
              <div className="bg-white rounded-lg shadow p-6">
                <h2 className="text-lg font-semibold mb-4">Analysis Results</h2>
                <div className="overflow-x-auto">
                  <table className="min-w-full table-auto">
                    <thead>
                      <tr className="bg-gray-50">
                        <th className="px-4 py-2 text-left">Filename</th>
                        <th
                          className="px-4 py-2 text-center cursor-pointer"
                          onClick={() => handleSort("overall_match_score")}
                        >
                          Overall Match{" "}
                          {sortBy === "overall_match_score" &&
                            (sortOrder === "desc" ? "↓" : "↑")}
                        </th>
                        <th
                          className="px-4 py-2 text-center cursor-pointer"
                          onClick={() => handleSort("keyword_match_score")}
                        >
                          Keyword Match{" "}
                          {sortBy === "keyword_match_score" &&
                            (sortOrder === "desc" ? "↓" : "↑")}
                        </th>
                        <th
                          className="px-4 py-2 text-center cursor-pointer"
                          onClick={() => handleSort("skills_alignment_score")}
                        >
                          Skills{" "}
                          {sortBy === "skills_alignment_score" &&
                            (sortOrder === "desc" ? "↓" : "↑")}
                        </th>
                        <th
                          className="px-4 py-2 text-center cursor-pointer"
                          onClick={() =>
                            handleSort("experience_relevance_score")
                          }
                        >
                          Experience{" "}
                          {sortBy === "experience_relevance_score" &&
                            (sortOrder === "desc" ? "↓" : "↑")}
                        </th>
                        <th
                          className="px-4 py-2 text-center cursor-pointer"
                          onClick={() =>
                            handleSort("formatting_structure_score")
                          }
                        >
                          Formatting{" "}
                          {sortBy === "formatting_structure_score" &&
                            (sortOrder === "desc" ? "↓" : "↑")}
                        </th>
                        <th
                          className="px-4 py-2 text-center cursor-pointer"
                          onClick={() => handleSort("seniority_fit_score")}
                        >
                          Seniority{" "}
                          {sortBy === "seniority_fit_score" &&
                            (sortOrder === "desc" ? "↓" : "↑")}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedResults.map((result, index) => (
                        <tr key={index} className="border-t">
                          <td className="px-4 py-2 font-medium">
                            {result.filename}
                          </td>
                          {result.error ? (
                            <td colSpan="6" className="px-4 py-2 text-red-600">
                              {result.error}
                            </td>
                          ) : (
                            <>
                              <td className="px-4 py-2 text-center">
                                <span
                                  className={`px-2 py-1 rounded ${
                                    result.scores.overall_match_score >= 80
                                      ? "bg-green-100 text-green-800"
                                      : result.scores.overall_match_score >= 60
                                        ? "bg-yellow-100 text-yellow-800"
                                        : "bg-red-100 text-red-800"
                                  }`}
                                >
                                  {result.scores.overall_match_score}%
                                </span>
                              </td>
                              <td className="px-4 py-2 text-center">
                                {result.scores.keyword_match_score}%
                              </td>
                              <td className="px-4 py-2 text-center">
                                {result.scores.skills_alignment_score}%
                              </td>
                              <td className="px-4 py-2 text-center">
                                {result.scores.experience_relevance_score}%
                              </td>
                              <td className="px-4 py-2 text-center">
                                {result.scores.formatting_structure_score}%
                              </td>
                              <td className="px-4 py-2 text-center">
                                {result.scores.seniority_fit_score}%
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
      </main>

      {/* Modals */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onLoginSuccess={handleLoginSuccess}
      />
      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={closeUpgradeModal}
        data={upgradeModalData}
      />
      <AlertModal
        isOpen={alertModal.isOpen}
        message={alertModal.message}
        type={alertModal.type}
        onClose={closeAlertModal}
      />
      {loading && <AnimatedLoader />}
    </div>
  );
};

export default RecruitersView;
