import { useState, useEffect } from "react";
import { Link } from "react-router-dom";

import fetchWithTimeout from "../configs/fetch";
import AlertModal from "../components/AlertModal";
import UserAvatar from "../components/UserAvatar";
import UsageStatus from "../components/UsageStatus";
import UpgradeModal from "../components/UpgradeModal";
import LoginModal from "../components/auth/LoginModal";
import { AUTH_CONSTANTS, BASE_URL } from "../constants/auth_constants";
import AnimatedLoader from "../components/loaders/animated-loader/AnimatedLoader";

// const BASE_URL =
//   "http://ats-matcher-backend-alb-1819594825.eu-west-2.elb.amazonaws.com/api";

const ATSMatcher = () => {
  const showOtherFeatures = false; // Toggle to show/hide extended features
  const pendingAnalysis = localStorage.getItem("pendingAnalysis");
  const [resumeFile, setResumeFile] = useState(null);
  const [jobDescription, setJobDescription] = useState(
    pendingAnalysis ? JSON.parse(pendingAnalysis).jobDescription : "",
  );
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [originalResumeText, setOriginalResumeText] = useState("");
  const [showAllAnalysis, setShowAllAnalysis] = useState(false);
  const [downloadingOptimized, setDownloadingOptimized] = useState(false);
  const [downloadingStandard, setDownloadingStandard] = useState(false);

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

  // Manual verification state
  const [showManualVerify, setShowManualVerify] = useState(false);
  const [manualVerifyRef, setManualVerifyRef] = useState("");
  const [manualVerifyGateway, setManualVerifyGateway] = useState("paystack");

  // Saved resumes state
  const [savedResumes, setSavedResumes] = useState([]);
  const [resumeSource, setResumeSource] = useState("upload"); // "upload" or "saved"
  const [selectedSavedResume, setSelectedSavedResume] = useState(null);
  const [loadingStates, setLoadingStates] = useState({
    loadingSavingResume: false,
  });

  console.log({ savedResumes, resumeFile, resumeSource });

  // Check authentication on app load
  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem(AUTH_CONSTANTS.TOKEN_KEY);
      if (token) {
        try {
          const response = await fetch(`${BASE_URL}/auth/verify`, {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });

          if (response.ok) {
            const data = await response.json();
            setUser({
              id: data.user.id,
              email: data.user.email,
              name: data.user.name,
              subscription_type: data.user.subscription_type,
              subscription_expires_at: data.user.subscription_expires_at,
              avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${data.user.email}`,
            });
            setIsAuthenticated(true);
            // Fetch usage info after login
            fetchUsageInfo();
            fetchSavedResumes();

            // Check if user just completed payment
            const paymentSuccess = localStorage.getItem("paymentSuccess");
            if (paymentSuccess === "true") {
              showAlert(
                "Payment successful! Your usage limit has been updated. Please click 'Analyze Resume' to continue with your analysis.",
                "success",
              );
              // Refresh usage info to reflect the payment
              fetchUsageInfo();
              // Don't clear the flag yet - keep it until user performs analysis
              // localStorage.removeItem("paymentSuccess");
            }
          } else {
            localStorage.removeItem(AUTH_CONSTANTS.TOKEN_KEY);
          }
        } catch (error) {
          console.error("Auth verification error:", error);
          // Don't remove token on network errors, just log
        }
      }
    };

    checkAuth();
  }, []);

  // Check for payment verification on page load (independent of auth)
  useEffect(() => {
    console.log("Payment verification useEffect running");
    const checkForPaymentVerification = async () => {
      const urlParams = new URLSearchParams(window.location.search);
      const paypalToken = urlParams.get("token");
      const payerId = urlParams.get("PayerID");
      const paystackReference = urlParams.get("trxref");
      const reference = urlParams.get("reference");

      if ((paypalToken && payerId) || paystackReference || reference) {
        // Clean up the URL
        window.history.replaceState(
          {},
          document.title,
          window.location.pathname,
        );

        const token = localStorage.getItem(AUTH_CONSTANTS.TOKEN_KEY);
        if (!token) {
          console.log(
            "No auth token found for payment verification - showing manual verify option",
          );
          // Show manual verification option
          if (paypalToken && payerId) {
            setManualVerifyRef(paypalToken);
            setManualVerifyGateway("paypal");
            setShowManualVerify(true);
          } else if (paystackReference) {
            setManualVerifyRef(paystackReference);
            setManualVerifyGateway("paystack");
            setShowManualVerify(true);
          } else if (reference) {
            setManualVerifyRef(reference);
            setManualVerifyGateway("paystack");
            setShowManualVerify(true);
          }
          return;
        }

        if (paypalToken && payerId) {
          console.log("Found PayPal verification parameters:", {
            paypalToken,
            payerId,
          });
          // Verify PayPal payment
          verifyPayPalPayment(paypalToken, token);
        } else if (paystackReference) {
          console.log("Found Paystack trxref parameter:", paystackReference);
          // Verify Paystack payment
          handleVerifyPayment(paystackReference);
        } else if (reference) {
          console.log("Found Paystack reference parameter:", reference);
          // Some Paystack integrations use 'reference' instead of 'trxref'
          handleVerifyPayment(reference);
        }
      } else {
        console.log("No payment verification parameters found in URL");
      }
    };

    checkForPaymentVerification();
  }, []);

  // Fetch usage information
  const fetchUsageInfo = async () => {
    const token = localStorage.getItem(AUTH_CONSTANTS.TOKEN_KEY);
    if (!token) return;

    setLoadingUsage(true);
    try {
      const response = await fetch(`${BASE_URL}/user/usage`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setUsageInfo(data);
      }
    } catch (error) {
      console.error("Usage fetch error:", error);
    } finally {
      setLoadingUsage(false);
    }
  };

  // Fetch saved resumes
  const fetchSavedResumes = async () => {
    const token = localStorage.getItem(AUTH_CONSTANTS.TOKEN_KEY);
    if (!token) return;

    try {
      const response = await fetch(`${BASE_URL}/resumes`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        const existingResumes = data?.resumes || [];
        setSavedResumes(existingResumes);
      }
    } catch (error) {
      console.error("Saved resumes fetch error:", error);
    }
  };

  // Save current resume
  const saveResume = async () => {
    if (!resumeFile) {
      showAlert("No resume file to save.", "error");
      return;
    }
    setLoadingStates((prev) => ({ ...prev, loadingSavingResume: true }));
    const token = localStorage.getItem(AUTH_CONSTANTS.TOKEN_KEY);
    const formData = new FormData();
    formData.append("resume", resumeFile);

    try {
      const response = await fetch(`${BASE_URL}/resumes/save`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      });

      if (response.ok) {
        showAlert("Resume saved successfully!", "success");
        fetchSavedResumes();
      } else {
        const errorData = await response.json();
        showAlert(errorData.error || "Failed to save resume.", "error");
      }
    } catch (error) {
      showAlert("Network error. Please try again.", "error");
    }
  };

  // Custom alert function
  const showAlert = (message, type = "info") => {
    setAlertModal({
      isOpen: true,
      message,
      type,
    });
  };

  const closeAlert = () => {
    setAlertModal({
      isOpen: false,
      message: "",
      type: "info",
    });
    localStorage.removeItem("paymentSuccess");
  };

  // Authentication functions
  const handleLogin = (user) => {
    setUser({
      id: user.id,
      email: user.email,
      name: user.name,
      subscription_type: user.subscription_type,
      subscription_expires_at: user.subscription_expires_at,
      avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.email}`,
    });
    setIsAuthenticated(true);
    setShowLoginModal(false);
    showAlert("Successfully logged in!", "success");
    // Fetch usage info after login
    fetchUsageInfo();
  };

  const handleLogout = async () => {
    try {
      const token = localStorage.getItem(AUTH_CONSTANTS.TOKEN_KEY);
      if (token) {
        await fetch(`${BASE_URL}/auth/logout`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      }
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      // Always clear local state and token
      localStorage.removeItem(AUTH_CONSTANTS.TOKEN_KEY);
      setUser(null);
      setIsAuthenticated(false);
      setResults(null);
      setOriginalResumeText("");
      showAlert("Logged out successfully", "info");
    }
  };

  // Function to handle the form submission and API call
  const handleSubmission = async (e) => {
    e.preventDefault();

    // Check authentication first
    if (!isAuthenticated) {
      setShowLoginModal(true);
      return;
    }

    // Check usage limits
    if (usageInfo && !usageInfo.can_perform_analysis) {
      // Fetch latest usage info in case it's stale
      await fetchUsageInfo();
      // Check again with updated info
      if (usageInfo && !usageInfo.can_perform_analysis) {
        setUpgradeModalData({
          subscriptionType: user?.subscription_type || "free",
          currentUsage: usageInfo.current_usage,
          dailyLimit: usageInfo.effective_limit || usageInfo.daily_limit,
          isExpired: usageInfo.is_expired,
        });
        setShowUpgradeModal(true);
        return;
      }
    }

    if (resumeSource === "upload" && !resumeFile) {
      setError("Please upload a resume (PDF).");
      return;
    }
    if (resumeSource === "saved" && !selectedSavedResume) {
      setError("Please select a saved resume.");
      return;
    }
    if (!jobDescription.trim()) {
      setError("Please paste the job description.");
      return;
    }

    setLoading(true);
    setResults(null);
    setError(null);
    setOriginalResumeText(""); // Clear previous text

    const formData = new FormData();
    if (resumeSource === "upload") {
      formData.append("resume", resumeFile);
    } else {
      formData.append("resume_id", selectedSavedResume.id);
    }
    formData.append("job_description", jobDescription);

    try {
      const response = await fetchWithTimeout(
        `${BASE_URL}/match`,
        {
          method: "POST",
          body: formData,
        },
        100000,
      );

      const data = await response.json();

      if (!response.ok) {
        // Handle usage limit errors specifically
        if (response.status === 429 && data.upgrade_required) {
          const upgradeMessage =
            user?.subscription_type === "free"
              ? "You've reached your daily limit of 1 analysis. Upgrade to Premium for up to 10 analyses per day!"
              : "You've reached your daily analysis limit. Please try again tomorrow.";
          showAlert(upgradeMessage, "warning");
          // Refresh usage info
          fetchUsageInfo();
          return;
        }
        throw new Error(data.error || `Server error: ${response.status}`);
      }

      // CRITICAL CHANGE 2: Save the extracted text for the generation feature
      requestAnimationFrame(() => {
        window.scrollTo(0, document.documentElement.scrollHeight);
      });
      setResults(data);
      // setResumeFile(null);
      setJobDescription("");
      setOriginalResumeText(data.original_resume_text || "");

      // Clear payment success flag after successful analysis
      localStorage.removeItem("paymentSuccess");
      localStorage.removeItem("pendingAnalysis");

      // Refresh usage info after successful analysis
      fetchUsageInfo();
    } catch (error) {
      console.error("Submission error:", error);
      setError("Analysis Failed: Please try again later.");
    } finally {
      setLoading(false);
    }
  };

  // 3. New function to trigger the DOCX generation and download
  const handleDownloadOptimizedCV = async () => {
    if (!results || !originalResumeText) {
      showAlert("Please run the analysis first.", "warning");
      return;
    }

    setDownloadingOptimized(true);
    try {
      const token = localStorage.getItem(AUTH_CONSTANTS.TOKEN_KEY);
      const response = await fetch(`${BASE_URL}/generate-cv`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
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
            contentDisp,
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
        showAlert("Optimized CV downloaded successfully!", "success");
      } else {
        showAlert("Failed to generate document.", "error");
      }
    } catch (error) {
      console.error("Download error:", error);
    } finally {
      setDownloadingOptimized(false);
    }
  };

  // Function to download standard PDF resume
  const handleDownloadStandardResume = async () => {
    if (!results || !originalResumeText) {
      showAlert("Please run the analysis first.", "warning");
      return;
    }

    setDownloadingStandard(true);
    try {
      const token = localStorage.getItem(AUTH_CONSTANTS.TOKEN_KEY);
      const response = await fetch(`${BASE_URL}/generate-standard-resume`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          resume_text: originalResumeText,
        }),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "standard_resume.pdf";
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        showAlert("Standard resume downloaded successfully!", "success");
      } else {
        showAlert("Failed to generate standard resume.", "error");
      }
    } catch (error) {
      console.error("Download error:", error);
    } finally {
      setDownloadingStandard(false);
    }
  };

  // Handle pay-as-you-go payment
  const handlePayAsYouGo = async (gateway = "paystack") => {
    if (!user) return;

    setShowUpgradeModal(false);
    showAlert("Initializing payment...", "info");

    try {
      const token = localStorage.getItem(AUTH_CONSTANTS.TOKEN_KEY);

      // Step 1: Get Paystack public key
      const configResponse = await fetch(`${BASE_URL}/payment/config`);
      if (!configResponse.ok) {
        showAlert("Failed to load payment configuration", "error");
        return;
      }
      const configData = await configResponse.json();

      // Step 2: Initialize payment with backend
      const initResponse = await fetch(`${BASE_URL}/payment/initialize`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          email: user.email,
          amount: gateway === "paypal" ? 100 : 1000000, // $1.00 for PayPal, ₦1000 for Paystack
          gateway: gateway,
        }),
      });

      if (!initResponse.ok) {
        const error = await initResponse.json();
        showAlert(error.error || "Failed to initialize payment", "error");
        return;
      }

      const initData = await initResponse.json();

      if (!initData.status || !initData.data) {
        showAlert("Failed to initialize payment", "error");
        return;
      }
      console.log({ initData });
      if (initData?.data?.authorization_url) {
        // Redirect to authorization URL
        window.location.href = initData.data.authorization_url;
        // window.open(initData.data.authorization_url, "_blank");
      }
    } catch (error) {
      console.error("Payment error:", error);
      showAlert("Payment failed. Please try again.", "error");
    }
  };

  // Handle premium upgrade
  const handleUpgradeToPremium = async (
    planType = "monthly",
    gateway = "paystack",
  ) => {
    if (!user) return;

    setShowUpgradeModal(false);
    showAlert("Initializing premium upgrade...", "info");

    try {
      const token = localStorage.getItem(AUTH_CONSTANTS.TOKEN_KEY);

      // Step 1: Get payment config
      const configResponse = await fetch(`${BASE_URL}/payment/config`);
      if (!configResponse.ok) {
        showAlert("Failed to load payment configuration", "error");
        return;
      }

      // Step 2: Initialize subscription upgrade
      const upgradeResponse = await fetch(`${BASE_URL}/subscription/upgrade`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          plan_type: planType,
          gateway: gateway,
        }),
      });

      if (!upgradeResponse.ok) {
        const error = await upgradeResponse.json();
        showAlert(error.error || "Failed to initialize upgrade", "error");
        return;
      }

      const upgradeData = await upgradeResponse.json();

      if (upgradeData?.data?.authorization_url) {
        // Redirect to Paystack payment page
        window.location.href = upgradeData.data.authorization_url;
      } else if (upgradeData?.data?.links) {
        // PayPal response
        const approvalLink = upgradeData.data.links.find(
          (link) => link.rel === "approve",
        );
        if (approvalLink) {
          window.location.href = approvalLink.href;
        } else {
          showAlert("Failed to initialize PayPal payment", "error");
        }
      } else {
        showAlert("Failed to initialize payment", "error");
      }
    } catch (error) {
      console.error("Upgrade error:", error);
      showAlert("Failed to start upgrade process", "error");
    }
  };

  // Verify PayPal payment
  const verifyPayPalPayment = async (orderId, token) => {
    console.log("Starting PayPal verification for orderId:", orderId);
    try {
      showAlert("Verifying PayPal payment...", "info");
      console.log("Making API call to verify PayPal payment");
      const response = await fetch(
        `${BASE_URL}/payment/verify-paypal/${orderId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
      console.log("PayPal verification response status:", response.status);

      if (response.ok) {
        const data = await response.json();
        console.log("PayPal verification data:", data);
        if (data.status && data.data && data.data.status === "success") {
          showAlert(
            "Payment successful! Your usage limit has been updated. Please click 'Analyze Resume' to continue with your analysis.",
            "success",
          );
          localStorage.setItem("paymentSuccess", "true");
          // Refresh usage info to reflect the payment
          fetchUsageInfo();
        } else {
          console.error("PayPal verification failed:", data);
          showAlert("PayPal payment verification failed", "error");
        }
      } else {
        const errorText = await response.text();
        console.error(
          "PayPal verification failed with status:",
          response.status,
          errorText,
        );
        showAlert("PayPal payment verification failed", "error");
      }
    } catch (error) {
      console.error("PayPal verification error:", error);
      showAlert("PayPal payment verification failed", "error");
    }
  };

  // Manual payment verification
  const handleManualVerifyPayment = async (reference, gateway) => {
    const token = localStorage.getItem(AUTH_CONSTANTS.TOKEN_KEY);
    if (!token) {
      showAlert("Authentication required for payment verification", "error");
      return;
    }

    try {
      showAlert("Verifying payment...", "info");
      const response = await fetch(
        `${BASE_URL}/payment/manual-verify/${reference}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ gateway }),
        },
      );

      if (response.ok) {
        const data = await response.json();
        if (data.status && data.data && data.data.status === "success") {
          showAlert("Payment verified successfully!", "success");
          localStorage.setItem("paymentSuccess", "true");
          await fetchUsageInfo();
        } else {
          showAlert("Payment verification failed", "error");
        }
      } else {
        const error = await response.json();
        showAlert(error.error || "Payment verification failed", "error");
      }
    } catch (error) {
      console.error("Manual verification error:", error);
      showAlert("Payment verification failed", "error");
    }
  };

  const handleVerifyPayment = async (reference) => {
    console.log("Starting Paystack verification for reference:", reference);
    const token = localStorage.getItem(AUTH_CONSTANTS.TOKEN_KEY);
    if (!token) {
      console.error("No auth token for Paystack verification");
      showAlert("Authentication required for payment verification", "error");
      return;
    }

    try {
      showAlert("Verifying payment...", "info");
      console.log("Making API call to verify Paystack payment");
      const verifyResponse = await fetch(
        `${BASE_URL}/payment/verify/${reference}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );
      console.log(
        "Paystack verification response status:",
        verifyResponse.status,
        { verifyResponse },
      );

      if (verifyResponse.ok) {
        const verifyData = await verifyResponse.json();
        console.log("Paystack verification data:", verifyData);
        if (verifyData.status && verifyData.data.status === "success") {
          showAlert(
            "Payment successful! You can now run your analysis.",
            "success",
          );
          localStorage.setItem("paymentSuccess", "true");
          // Refresh usage data
          await fetchUsageInfo();
          // Proceed with analysis
          // await performAnalysis();
        } else {
          console.error("Paystack verification failed:", verifyData);
          showAlert("Payment verification failed", "error");
        }
      } else {
        const errorText = await verifyResponse.text();
        console.error(
          "Paystack verification failed with status:",
          verifyResponse.status,
          errorText,
        );
        showAlert("Payment verification failed", "error");
      }
    } catch (error) {
      console.error("Paystack verification error:", error);
      showAlert("Payment verification failed", "error");
    }
  };

  const queryParams = new URLSearchParams(window.location.search);
  const reference = queryParams?.get("trxref") || queryParams?.get("token");
  const gateway = queryParams?.get("gateway") || "paystack";

  useEffect(() => {
    const verifyPayment = async () => {
      try {
        const token = localStorage.getItem(AUTH_CONSTANTS.TOKEN_KEY);
        if (!token) {
          console.error("No auth token found for payment verification");
          window.location.href = "/";
          return;
        }

        let response;
        if (gateway === "paypal") {
          response = await fetch(
            `${BASE_URL}/payment/verify-paypal/${reference}`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            },
          );
        } else {
          response = await fetch(`${BASE_URL}/payment/verify/${reference}`, {
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
        }
        const data = await response.json();
        console.log("Payment verification response:", data);

        if (
          (gateway === "paypal" && data.status) ||
          (gateway === "paystack" &&
            data.status &&
            data.data &&
            data.data.status === "success")
        ) {
          // Payment successful
          localStorage.setItem("paymentSuccess", "true");
        }

        // Redirect to home regardless of payment status
        window.location.href = "/";
      } catch (error) {
        console.error("Error verifying payment:", error);
        window.location.href = "/";
      }
    };

    if (reference) {
      verifyPayment();
    }
  }, [reference, gateway]);

  return (
    <div style={styles.container}>
      {/* Header with Avatar */}
      <div style={styles.headerContainer}>
        <div style={styles.headerLeft}>
          <h1 style={styles.header}>Resume Matcher (AI-Powered ATS)</h1>
          <p style={styles.subHeader}>
            Upload your CV and paste the job requirements below for an instant
            score and tailored recommendations.
          </p>
          {/* <Link to="/recruiters">
            <button style={styles.recruiterButton}>Recruiters Tool</button>
          </Link> */}
        </div>
        {isAuthenticated && user && (
          <div style={styles.avatarContainer}>
            <UserAvatar user={user} onLogout={handleLogout} />
          </div>
        )}
      </div>

      {/* Usage Status for authenticated users */}
      {isAuthenticated && (
        <UsageStatus
          usageInfo={usageInfo}
          user={user}
          loading={loadingUsage}
          onUpgradeClick={() => {
            setUpgradeModalData(usageInfo);
            setShowUpgradeModal(true);
          }}
        />
      )}

      {/* Manual Payment Verification */}
      {showManualVerify && (
        <div
          style={{
            backgroundColor: "#fff3cd",
            border: "1px solid #ffeaa7",
            borderRadius: "8px",
            padding: "16px",
            marginBottom: "20px",
            textAlign: "center",
          }}
        >
          <h3 style={{ color: "#856404", margin: "0 0 8px 0" }}>
            Payment Verification Needed
          </h3>
          <p style={{ color: "#856404", margin: "0 0 12px 0" }}>
            We detected a payment completion. Please verify your payment to
            update your usage limits.
          </p>
          <div
            style={{ display: "flex", gap: "8px", justifyContent: "center" }}
          >
            <input
              type="text"
              placeholder="Payment reference"
              value={manualVerifyRef}
              onChange={(e) => setManualVerifyRef(e.target.value)}
              style={{
                padding: "8px",
                border: "1px solid #ddd",
                borderRadius: "4px",
                width: "200px",
              }}
            />
            <select
              value={manualVerifyGateway}
              onChange={(e) => setManualVerifyGateway(e.target.value)}
              style={{
                padding: "8px",
                border: "1px solid #ddd",
                borderRadius: "4px",
              }}
            >
              <option value="paystack">Paystack</option>
              <option value="paypal">PayPal</option>
            </select>
            <button
              onClick={async () => {
                await handleManualVerifyPayment(
                  manualVerifyRef,
                  manualVerifyGateway,
                );
                setShowManualVerify(false);
              }}
              style={{
                padding: "8px 16px",
                backgroundColor: "#007bff",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              Verify Payment
            </button>
            <button
              onClick={() => setShowManualVerify(false)}
              style={{
                padding: "8px 16px",
                backgroundColor: "#6c757d",
                color: "white",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* --- INPUT FORM --- */}
      <form onSubmit={handleSubmission} style={styles.inputSection}>
        {/* Resume Uploader */}
        <div style={styles.inputGroup}>
          <h3 className="section-title">1. Select Resume Source</h3>
          <div style={{ display: "flex", gap: "20px", marginBottom: "20px" }}>
            <div
              style={{
                ...styles.sourceCard,
                ...(resumeSource === "upload" ? styles.sourceCardSelected : {}),
              }}
              onClick={() => {
                setResumeSource("upload");
                setSelectedSavedResume(null);
                setError(null);
              }}
            >
              <div style={styles.cardIcon}>📤</div>
              <h4 style={styles.cardTitle}>Upload New Resume</h4>
              <p style={styles.cardDescription}>
                Select a PDF file from your device
              </p>
            </div>
            <div
              style={{
                ...styles.sourceCard,
                ...(resumeSource === "saved" ? styles.sourceCardSelected : {}),
              }}
              onClick={() => {
                setResumeSource("saved");
                setResumeFile(null);
                setError(null);
              }}
            >
              <div style={styles.cardIcon}>💾</div>
              <h4 style={styles.cardTitle}>Use Saved Resume</h4>
              <p style={styles.cardDescription}>
                Choose from your saved resumes
              </p>
            </div>
          </div>
          {resumeSource === "upload" ? (
            <>
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
            </>
          ) : (
            <div style={styles.savedResumesContainer}>
              {savedResumes?.length < 1 ? (
                <p
                  style={{
                    textAlign: "center",
                    color: "#666",
                    padding: "20px",
                  }}
                >
                  No saved resumes yet. Upload and save a resume first.
                </p>
              ) : (
                <div style={styles.resumesGrid}>
                  {savedResumes?.map((resume) => (
                    <div
                      key={resume.id}
                      style={{
                        ...styles.resumeCard,
                        ...(selectedSavedResume?.id === resume.id
                          ? styles.resumeCardSelected
                          : {}),
                      }}
                      onClick={() => setSelectedSavedResume(resume)}
                    >
                      <div style={styles.resumeIcon}>📄</div>
                      <div style={styles.resumeInfo}>
                        <h5 style={styles.resumeFilename}>{resume.filename}</h5>
                        <p style={styles.resumeDate}>
                          Saved on{" "}
                          {new Date(resume.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      {selectedSavedResume?.id === resume.id && (
                        <div style={styles.selectedIndicator}>✓</div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Job Description Input */}
        <div style={styles.inputGroup}>
          <h3 className="section-title">2. Paste Job Requirements</h3>
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
            disabled={
              loading ||
              (resumeSource === "upload" && !resumeFile) ||
              (resumeSource === "saved" && !selectedSavedResume) ||
              !jobDescription.trim()
            }
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
            <h3 className="section-title">🎯 Recommendation Summary</h3>
            <blockquote style={styles.blockquote}>
              {results.recommendation_text}
            </blockquote>
          </div>

          {/* Matched and Missing Skills */}
          <div style={styles.skillsContainer}>
            {/* Matched Skills */}
            <div style={styles.skillList}>
              <h3 className="section-title">
                👍 Skills Matched ({results.matched_skills.length})
              </h3>
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
              <h3 className="section-title">
                ⚠️ Missing Key Skills ({results.missing_skills.length})
              </h3>
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
                    <h3 className="section-title">🔍 Keyword Gap Analyzer</h3>
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
                        ),
                      )}
                    </div>
                  </div>
                )}

              {/* Weakly Represented Skills */}
              {results.weakly_represented_skills &&
                results.weakly_represented_skills.length > 0 && (
                  <div style={styles.analysisSection}>
                    <h3 className="section-title">
                      📊 Weakly Represented Skills
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
                  </div>
                )}

              {/* Overused Terms */}
              {results.overused_terms && results.overused_terms.length > 0 && (
                <div style={styles.analysisSection}>
                  <h3 className="section-title">⚡ Overused Terms</h3>
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
                    <h3 className="section-title">
                      💡 "Add to Resume" Suggestions
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
                        ),
                      )}
                    </ul>
                  </div>
                )}
            </>
          )}

          {/* Download Button */}
          <button
            onClick={handleDownloadOptimizedCV}
            disabled={downloadingOptimized}
            style={{
              ...styles.submitButton,
              backgroundColor: downloadingOptimized ? "#ccc" : "#34a853",
              marginTop: "20px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "10px",
            }}
          >
            {downloadingOptimized && (
              <div
                className="spinner"
                style={{ width: "16px", height: "16px" }}
              />
            )}
            {downloadingOptimized
              ? "Generating..."
              : "⬇️ Download Optimized CV (.docx)"}
          </button>

          {/* Standard Resume Download Button */}
          <button
            onClick={handleDownloadStandardResume}
            disabled={downloadingStandard}
            style={{
              ...styles.submitButton,
              backgroundColor: downloadingStandard ? "#ccc" : "#4285f4",
              marginTop: "15px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "10px",
            }}
          >
            {downloadingStandard && (
              <div
                className="spinner"
                style={{ width: "16px", height: "16px" }}
              />
            )}
            {downloadingStandard
              ? "Generating..."
              : "📄 Download Standard Resume (PDF)"}
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

          {/* Save Resume Button - only for uploaded resumes */}
          {resumeSource === "upload" && resumeFile && (
            <button
              onClick={saveResume}
              style={{
                ...styles.submitButton,
                backgroundColor: "#ff9800",
                marginTop: "15px",
              }}
            >
              {loadingStates.loadingSavingResume && (
                <div
                  className="spinner"
                  style={{ width: "16px", height: "16px" }}
                />
              )}
              {loadingStates.loadingSavingResume
                ? "Saving..."
                : "💾 Save Resume for Later"}
            </button>
          )}
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
                <h3 className="section-title">📈 Detailed Scores</h3>
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
                <h3 className="section-title">
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
                <h3 className="section-title">
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
                    <h3 className="section-title">🔍 Keyword Gap Analyzer</h3>
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
                        ),
                      )}
                    </div>
                  </section>
                )}

              {/* Weakly Represented Skills */}
              {results.weakly_represented_skills &&
                results.weakly_represented_skills.length > 0 && (
                  <section style={styles.modalSection}>
                    <h3 className="section-title">
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
                  <h3 className="section-title">
                    ⚡ Overused Terms ({results.overused_terms.length})
                  </h3>
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
                    <h3 className="section-title">
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
                        ),
                      )}
                    </ul>
                  </section>
                )}

              {/* Recommendation Text */}
              <section style={styles.modalSection}>
                <h3 className="section-title">🎯 Recommendation</h3>
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

      {/* Custom Alert Modal */}
      <AlertModal
        isOpen={alertModal.isOpen}
        message={alertModal.message}
        onClose={closeAlert}
        type={alertModal.type}
      />

      {/* Login Modal */}
      <LoginModal
        isOpen={showLoginModal}
        onClose={() => setShowLoginModal(false)}
        onLogin={handleLogin}
      />

      {/* Upgrade Modal */}
      <UpgradeModal
        isOpen={showUpgradeModal}
        onClose={() => setShowUpgradeModal(false)}
        onPayAsYouGo={handlePayAsYouGo}
        onUpgradeToPremium={handleUpgradeToPremium}
        modalData={upgradeModalData}
      />
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
    height: "89vh",
    overflowY: "auto",
    margin: "0 auto",
    padding: "30px",
    fontFamily: "Arial, sans-serif",
    backgroundColor: "#f4f7fa",
    borderRadius: "10px",
    boxShadow: "0 6px 12px rgba(0,0,0,0.15)",
    textAlign: "left",
  },
  headerContainer: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "30px",
  },
  headerLeft: {
    flex: 1,
  },
  avatarContainer: {
    marginLeft: "20px",
  },
  header: {
    textAlign: "left",
    color: "#1a73e8",
    marginBottom: "5px",
  },
  subHeader: {
    textAlign: "left",
    color: "#5f6368",
    marginBottom: "10px",
  },
  recruiterButton: {
    backgroundColor: "#34a853",
    color: "white",
    border: "none",
    padding: "8px 16px",
    borderRadius: "4px",
    cursor: "pointer",
    fontSize: "14px",
    marginTop: "10px",
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
    color: "#202124",
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
    backgroundColor: "#f9f9f9",
    color: "#202124",
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
  sourceCard: {
    flex: 1,
    padding: "20px",
    border: "2px solid #e0e0e0",
    borderRadius: "12px",
    cursor: "pointer",
    textAlign: "center",
    transition: "all 0.3s ease",
    backgroundColor: "#fff",
    minHeight: "120px",
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    alignItems: "center",
    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
  },
  sourceCardSelected: {
    borderColor: "#1a73e8",
    backgroundColor: "#e3f2fd",
    boxShadow: "0 4px 16px rgba(26, 115, 232, 0.2)",
  },
  cardIcon: {
    fontSize: "2em",
    marginBottom: "10px",
  },
  cardTitle: {
    fontSize: "1.1em",
    fontWeight: "600",
    color: "#333",
    margin: "0 0 5px 0",
  },
  cardDescription: {
    fontSize: "0.9em",
    color: "#666",
    margin: 0,
  },
  savedResumesContainer: {
    width: "100%",
  },
  resumesGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
    gap: "15px",
  },
  resumeCard: {
    padding: "15px",
    border: "2px solid #e0e0e0",
    borderRadius: "8px",
    cursor: "pointer",
    transition: "all 0.3s ease",
    backgroundColor: "#fff",
    display: "flex",
    alignItems: "center",
    boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
    position: "relative",
  },
  resumeCardSelected: {
    borderColor: "#1a73e8",
    backgroundColor: "#e3f2fd",
    boxShadow: "0 4px 16px rgba(26, 115, 232, 0.2)",
  },
  resumeIcon: {
    fontSize: "1.5em",
    marginRight: "15px",
    color: "#666",
  },
  resumeInfo: {
    flex: 1,
  },
  resumeFilename: {
    fontSize: "1em",
    fontWeight: "600",
    color: "#333",
    margin: "0 0 5px 0",
  },
  resumeDate: {
    fontSize: "0.8em",
    color: "#666",
    margin: 0,
  },
  selectedIndicator: {
    position: "absolute",
    top: "10px",
    right: "10px",
    backgroundColor: "#1a73e8",
    color: "white",
    borderRadius: "50%",
    width: "24px",
    height: "24px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "0.8em",
    fontWeight: "bold",
  },
};
