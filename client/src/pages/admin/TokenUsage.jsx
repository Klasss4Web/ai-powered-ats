import { useState, useEffect } from "react";
import { BASE_URL } from "../../constants/auth_constants";
import fetchWithTimeout from "../../configs/fetch";
import "./TokenUsage.css";

const TokenUsage = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [days, setDays] = useState(7);
  const [viewMode, setViewMode] = useState("daily");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  useEffect(() => {
    fetchTokenData();
  }, [days, viewMode]);

  const buildUrl = () => {
    const params = new URLSearchParams();
    if (viewMode === "monthly") {
      params.append("months", Math.min(Math.ceil(days / 30), 24));
      return `${BASE_URL}/admin/analytics/tokens/monthly?${params.toString()}`;
    }
    if (startDate && endDate) {
      params.append("start_date", startDate);
      params.append("end_date", endDate);
    } else {
      params.append("days", days);
    }
    return `${BASE_URL}/admin/analytics/tokens?${params.toString()}`;
  };

  const fetchTokenData = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);

    try {
      const response = await fetchWithTimeout(buildUrl());

      if (!response.ok) {
        throw new Error("Failed to fetch token data");
      }

      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const formatNumber = (num) => {
    if (num >= 1000000) return (num / 1000000).toFixed(2) + "M";
    if (num >= 1000) return (num / 1000).toFixed(2) + "K";
    return num.toString();
  };

  if (loading && !data) {
    return (
      <div className="token-usage-loading">
        <div className="token-usage-spinner"></div>
        <p>Loading token usage data...</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="token-usage-error">
        <p className="token-usage-error-text">{error}</p>
        <button onClick={() => fetchTokenData()} className="token-usage-retry-btn">
          Retry
        </button>
      </div>
    );
  }

  const maxDailyTokens = Math.max(...(data?.daily_usage?.map((d) => d.total_tokens) || [1]));

  return (
    <div className="token-usage-container">
      <div className="token-usage-header">
        <div>
          <h1 className="token-usage-title">Token Usage Analytics</h1>
          <p className="token-usage-subtitle">Monitor LLM token consumption and costs</p>
        </div>
        <div className="token-usage-controls">
          <div className="token-usage-toggle-group">
            <button
              onClick={() => setViewMode("daily")}
              className={`token-usage-toggle-btn ${viewMode === "daily" ? "active" : ""}`}
            >
              Daily
            </button>
            <button
              onClick={() => setViewMode("monthly")}
              className={`token-usage-toggle-btn ${viewMode === "monthly" ? "active" : ""}`}
            >
              Monthly
            </button>
          </div>

          {viewMode === "daily" && (
            <>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="token-usage-date-input"
              />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="token-usage-date-input"
              />
              <button
                onClick={() => fetchTokenData()}
                disabled={!startDate || !endDate}
                className="token-usage-refresh-btn"
                style={{
                  opacity: !startDate || !endDate ? 0.5 : 1,
                  cursor: !startDate || !endDate ? "not-allowed" : "pointer",
                }}
              >
                Apply
              </button>
            </>
          )}

          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="token-usage-select"
          >
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <button
            onClick={() => fetchTokenData(true)}
            disabled={refreshing}
            className="token-usage-refresh-btn"
          >
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="token-usage-summary-grid">
        <div className="token-usage-summary-card">
          <div className="token-usage-summary-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect>
              <rect x="9" y="9" width="6" height="6"></rect>
            </svg>
          </div>
          <div className="token-usage-summary-content">
            <span className="token-usage-summary-label">Total Tokens</span>
            <span className="token-usage-summary-value">
              {formatNumber(data?.summary?.total_tokens || 0)}
            </span>
          </div>
        </div>

        <div className="token-usage-summary-card">
          <div className="token-usage-summary-icon green">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="12" y1="1" x2="12" y2="23"></line>
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path>
            </svg>
          </div>
          <div className="token-usage-summary-content">
            <span className="token-usage-summary-label">Total Cost</span>
            <span className="token-usage-summary-value">
              ${(data?.summary?.total_cost || 0).toFixed(4)}
            </span>
          </div>
        </div>

        <div className="token-usage-summary-card">
          <div className="token-usage-summary-icon yellow">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline>
            </svg>
          </div>
          <div className="token-usage-summary-content">
            <span className="token-usage-summary-label">Total Requests</span>
            <span className="token-usage-summary-value">
              {formatNumber(data?.summary?.total_requests || 0)}
            </span>
          </div>
        </div>

        <div className="token-usage-summary-card">
          <div className="token-usage-summary-icon purple">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="10"></circle>
              <polyline points="12 6 12 12 16 14"></polyline>
            </svg>
          </div>
          <div className="token-usage-summary-content">
            <span className="token-usage-summary-label">Avg Tokens/Request</span>
            <span className="token-usage-summary-value">
              {data?.summary?.total_requests
                ? Math.round(data.summary.total_tokens / data.summary.total_requests)
                : 0}
            </span>
          </div>
        </div>
      </div>

      {/* Token Breakdown */}
      <div className="token-usage-breakdown-card">
        <h3 className="token-usage-card-title">Token Breakdown</h3>
        <div className="token-usage-breakdown-grid">
          <div className="token-usage-breakdown-item">
            <span className="token-usage-breakdown-label">Prompt Tokens</span>
            <span className="token-usage-breakdown-value">
              {formatNumber(data?.summary?.prompt_tokens || 0)}
            </span>
            <div className="token-usage-breakdown-bar">
              <div
                className="token-usage-breakdown-fill blue"
                style={{
                  width: data?.summary?.total_tokens
                    ? `${(data.summary.prompt_tokens / data.summary.total_tokens) * 100}%`
                    : "0%",
                }}
              ></div>
            </div>
          </div>
          <div className="token-usage-breakdown-item">
            <span className="token-usage-breakdown-label">Completion Tokens</span>
            <span className="token-usage-breakdown-value">
              {formatNumber(data?.summary?.completion_tokens || 0)}
            </span>
            <div className="token-usage-breakdown-bar">
              <div
                className="token-usage-breakdown-fill green"
                style={{
                  width: data?.summary?.total_tokens
                    ? `${(data.summary.completion_tokens / data.summary.total_tokens) * 100}%`
                    : "0%",
                }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* Daily / Monthly Usage Chart */}
      <div className="token-usage-chart-card">
        <h3 className="token-usage-card-title">
          {viewMode === "monthly" ? "Monthly Token Usage" : "Daily Token Usage"}
        </h3>
        <div className="token-usage-chart-container">
          {viewMode === "monthly" ? (
            data?.monthly?.length > 0 ? (
              <table className="token-usage-table">
                <thead>
                  <tr>
                    <th className="token-usage-th">Month</th>
                    <th className="token-usage-th">Requests</th>
                    <th className="token-usage-th">Prompt Tokens</th>
                    <th className="token-usage-th">Completion Tokens</th>
                    <th className="token-usage-th">Total Tokens</th>
                    <th className="token-usage-th">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {data.monthly.map((item, index) => (
                    <tr key={index}>
                      <td className="token-usage-td">{item.month}</td>
                      <td className="token-usage-td">{item.requests}</td>
                      <td className="token-usage-td">{formatNumber(item.prompt_tokens)}</td>
                      <td className="token-usage-td">{formatNumber(item.completion_tokens)}</td>
                      <td className="token-usage-td">{formatNumber(item.total_tokens)}</td>
                      <td className="token-usage-td">
                        <span className="token-usage-cost-badge">${item.cost.toFixed(4)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="token-usage-no-data">No monthly data available</p>
            )
          ) : data?.daily_usage?.length > 0 ? (
            <div className="token-usage-bar-chart">
              {data.daily_usage.map((item, index) => (
                <div key={index} className="token-usage-bar-wrapper">
                  <div className="token-usage-bar-tooltip">
                    <div>{formatNumber(item.total_tokens)}</div>
                    <div style={{ fontSize: "10px", color: "#64748b" }}>
                      ${item.cost.toFixed(4)}
                    </div>
                  </div>
                  <div className="token-usage-stacked-bar">
                    <div
                      className="token-usage-bar-segment green"
                      style={{
                        height: `${maxDailyTokens > 0 ? (item.completion_tokens / maxDailyTokens) * 180 : 0}px`,
                      }}
                    ></div>
                    <div
                      className="token-usage-bar-segment blue"
                      style={{
                        height: `${maxDailyTokens > 0 ? (item.prompt_tokens / maxDailyTokens) * 180 : 0}px`,
                      }}
                    ></div>
                  </div>
                  <span className="token-usage-bar-label">
                    {new Date(item.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="token-usage-no-data">No usage data available for this period</p>
          )}
        </div>
        {viewMode === "daily" && (
          <div className="token-usage-legend">
            <div className="token-usage-legend-item">
              <div className="token-usage-legend-dot blue"></div>
              <span>Prompt Tokens</span>
            </div>
            <div className="token-usage-legend-item">
              <div className="token-usage-legend-dot green"></div>
              <span>Completion Tokens</span>
            </div>
          </div>
        )}
      </div>

      {/* Usage by Endpoint */}
      <div className="token-usage-table-card">
        <h3 className="token-usage-card-title">Usage by Endpoint</h3>
        {data?.by_endpoint?.length > 0 ? (
          <table className="token-usage-table">
            <thead>
              <tr>
                <th className="token-usage-th">Endpoint</th>
                <th className="token-usage-th">Requests</th>
                <th className="token-usage-th">Total Tokens</th>
                <th className="token-usage-th">Cost</th>
              </tr>
            </thead>
            <tbody>
              {data.by_endpoint.map((endpoint, index) => (
                <tr key={index}>
                  <td className="token-usage-td">
                    <code className="token-usage-code">{endpoint.endpoint}</code>
                  </td>
                  <td className="token-usage-td">{endpoint.requests}</td>
                  <td className="token-usage-td">{formatNumber(endpoint.total_tokens)}</td>
                  <td className="token-usage-td">
                    <span className="token-usage-cost-badge">${endpoint.cost.toFixed(4)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="token-usage-no-data">No endpoint data available</p>
        )}
      </div>

      {/* Top Users by Token Usage */}
      <div className="token-usage-table-card">
        <h3 className="token-usage-card-title">Top Users by Token Usage</h3>
        {data?.top_users?.length > 0 ? (
          <div className="token-usage-users-list">
            {data.top_users.map((user, index) => (
              <div key={index} className="token-usage-user-card">
                <div className="token-usage-user-card-header">
                  <div className="token-usage-user-cell">
                    <div className="token-usage-user-avatar">
                      {user.name?.charAt(0).toUpperCase() || "U"}
                    </div>
                    <div>
                      <div className="token-usage-user-name">{user.name}</div>
                      <div className="token-usage-user-email">{user.email}</div>
                    </div>
                  </div>
                  <div className="token-usage-user-stats">
                    <div className="token-usage-user-stat-item">
                      <span className="token-usage-user-stat-value">
                        {formatNumber(user.total_tokens)}
                      </span>
                      <span className="token-usage-user-stat-label">tokens</span>
                    </div>
                    <div className="token-usage-user-stat-item">
                      <span className="token-usage-user-stat-value">
                        {user.request_count || 0}
                      </span>
                      <span className="token-usage-user-stat-label">requests</span>
                    </div>
                    <div className="token-usage-user-stat-item">
                      <span className="token-usage-cost-badge">${user.cost.toFixed(4)}</span>
                    </div>
                  </div>
                </div>
                {user.breakdown && user.breakdown.length > 0 && (
                  <div className="token-usage-breakdown-section">
                    <div className="token-usage-breakdown-title">Request Types:</div>
                    <div className="token-usage-breakdown-tags">
                      {user.breakdown.map((item, idx) => (
                        <div key={idx} className="token-usage-breakdown-tag">
                          <span className="token-usage-breakdown-endpoint">{item.endpoint}</span>
                          <span className="token-usage-breakdown-count">{item.count}x</span>
                          <span className="token-usage-breakdown-tokens">
                            {formatNumber(item.tokens)} tokens
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="token-usage-no-data">No user data available</p>
        )}
      </div>
    </div>
  );
};

export default TokenUsage;
