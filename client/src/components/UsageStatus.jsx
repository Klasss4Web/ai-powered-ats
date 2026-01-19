const UsageStatus = ({ usageInfo, user, loading, onUpgradeClick }) => {
  if (loading || !usageInfo) {
    return (
      <div
        style={{
          padding: "12px",
          backgroundColor: "#f8f9fa",
          borderRadius: "8px",
          border: "1px solid #e9ecef",
          marginBottom: "20px",
          display: "flex",
          alignItems: "center",
          gap: "8px",
        }}
      >
        <div
          style={{
            width: "16px",
            height: "16px",
            border: "2px solid #007bff",
            borderTop: "2px solid transparent",
            borderRadius: "50%",
            animation: "spin 1s linear infinite",
          }}
        />
        <span style={{ color: "#6c757d", fontSize: "14px" }}>
          Loading usage info...
        </span>
        <style>{`
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  const {
    subscription_type,
    current_usage,
    daily_limit,
    remaining_analyses,
    is_expired,
    effective_limit,
  } = usageInfo;
  const isPremium = subscription_type === "premium" && !is_expired;
  const usagePercentage =
    subscription_type === "free"
      ? effective_limit > 0
        ? (current_usage / effective_limit) * 100
        : 0
      : daily_limit > 0
      ? (current_usage / daily_limit) * 100
      : 0;

  const getStatusColor = () => {
    if (remaining_analyses === 0) return "#dc3545"; // red
    if (usagePercentage >= 80) return "#fd7e14"; // orange
    return "#28a745"; // green
  };

  const getStatusText = () => {
    if (remaining_analyses === 0) return "Limit reached";
    if (subscription_type === "free")
      return `${remaining_analyses} pay-as-you-go analyses remaining`;
    if (isPremium) return `${remaining_analyses} analyses remaining`;
    return `${remaining_analyses} analysis remaining`;
  };

  return (
    <>
      <div
        style={{
          padding: "16px",
          backgroundColor: "#f8f9fa",
          borderRadius: "8px",
          border: "1px solid #e9ecef",
          marginBottom: "20px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "12px",
          }}
        >
          <div>
            <h3
              style={{
                margin: "0 0 4px 0",
                fontSize: "16px",
                fontWeight: "600",
                color: "#495057",
              }}
            >
              {isPremium ? "Premium Plan" : "Free Plan"}
              {is_expired && (
                <span
                  style={{
                    marginLeft: "8px",
                    fontSize: "12px",
                    color: "#dc3545",
                    fontWeight: "normal",
                  }}
                >
                  (Expired)
                </span>
              )}
            </h3>
            <p
              style={{
                margin: "0",
                fontSize: "14px",
                color: "#6c757d",
              }}
            >
              {subscription_type === "free"
                ? `${current_usage} of ${effective_limit} pay-as-you-go analyses used today`
                : `${current_usage} of ${daily_limit} analyses used today`}
            </p>
          </div>

          {!isPremium && (
            <button
              onClick={() => onUpgradeClick && onUpgradeClick()}
              style={{
                padding: "8px 16px",
                backgroundColor: "#007bff",
                color: "white",
                border: "none",
                borderRadius: "6px",
                fontSize: "14px",
                fontWeight: "500",
                cursor: "pointer",
                transition: "background-color 0.2s",
              }}
              onMouseEnter={(e) => (e.target.style.backgroundColor = "#0056b3")}
              onMouseLeave={(e) => (e.target.style.backgroundColor = "#007bff")}
            >
              Upgrade to Premium
            </button>
          )}
        </div>

        {/* Progress Bar */}
        <div
          style={{
            width: "100%",
            height: "8px",
            backgroundColor: "#e9ecef",
            borderRadius: "4px",
            overflow: "hidden",
            marginBottom: "8px",
          }}
        >
          <div
            style={{
              width: `${Math.min(usagePercentage, 100)}%`,
              height: "100%",
              backgroundColor: getStatusColor(),
              transition: "width 0.3s ease",
            }}
          />
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span
            style={{
              fontSize: "14px",
              color: getStatusColor(),
              fontWeight: "500",
            }}
          >
            {getStatusText()}
          </span>
          <span
            style={{
              fontSize: "12px",
              color: "#6c757d",
            }}
          >
            Resets daily
          </span>
        </div>
      </div>
    </>
  );
};

export default UsageStatus;
