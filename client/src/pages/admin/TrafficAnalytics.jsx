import { useState, useEffect } from "react";
import { AUTH_CONSTANTS, BASE_URL } from "../../constants/auth_constants";

const TrafficAnalytics = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [days, setDays] = useState(7);

  useEffect(() => {
    fetchTrafficData();
  }, [days]);

  const fetchTrafficData = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    
    try {
      const token = localStorage.getItem(AUTH_CONSTANTS.TOKEN_KEY);
      const response = await fetch(`${BASE_URL}/admin/analytics/traffic?days=${days}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch traffic data");
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

  if (loading && !data) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner}></div>
        <p>Loading traffic analytics...</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div style={styles.errorContainer}>
        <p style={styles.errorText}>{error}</p>
        <button onClick={() => fetchTrafficData()} style={styles.retryBtn}>Retry</button>
      </div>
    );
  }

  const maxDailyUsers = Math.max(...(data?.daily_active_users?.map(d => d.count) || [1]));
  const maxDailyAnalyses = Math.max(...(data?.daily_analyses?.map(d => d.count) || [1]));
  const maxHourlyTraffic = Math.max(...(data?.hourly_traffic?.map(d => d.count) || [1]));

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Traffic & Usage Analytics</h1>
          <p style={styles.subtitle}>Monitor daily traffic patterns and user engagement</p>
        </div>
        <div style={styles.controls}>
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            style={styles.select}
          >
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <button 
            onClick={() => fetchTrafficData(true)} 
            disabled={refreshing}
            style={{
              ...styles.refreshBtn,
              opacity: refreshing ? 0.7 : 1,
              cursor: refreshing ? "not-allowed" : "pointer",
            }}
          >
            {refreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {/* Daily Active Users Chart */}
      <div style={styles.chartCard}>
        <h3 style={styles.chartTitle}>Daily Active Users</h3>
        <div style={styles.chartContainer}>
          <div style={styles.barChart}>
            {data?.daily_active_users?.map((item, index) => (
              <div key={index} style={styles.barWrapper}>
                <div style={styles.barTooltip}>{item.count}</div>
                <div
                  style={{
                    ...styles.bar,
                    height: `${(item.count / maxDailyUsers) * 200}px`,
                    backgroundColor: "#38bdf8",
                  }}
                ></div>
                <span style={styles.barLabel}>
                  {new Date(item.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Daily Analyses Chart */}
      <div style={styles.chartCard}>
        <h3 style={styles.chartTitle}>Daily Analyses</h3>
        <div style={styles.chartContainer}>
          <div style={styles.barChart}>
            {data?.daily_analyses?.map((item, index) => (
              <div key={index} style={styles.barWrapper}>
                <div style={styles.barTooltip}>{item.count}</div>
                <div
                  style={{
                    ...styles.bar,
                    height: `${(item.count / maxDailyAnalyses) * 200}px`,
                    backgroundColor: "#34d399",
                  }}
                ></div>
                <span style={styles.barLabel}>
                  {new Date(item.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Hourly Traffic Pattern */}
      <div style={styles.chartCard}>
        <h3 style={styles.chartTitle}>Hourly Traffic Pattern (Last 24h)</h3>
        <div style={styles.chartContainer}>
          <div style={styles.barChart}>
            {Array.from({ length: 24 }, (_, hour) => {
              const hourData = data?.hourly_traffic?.find(h => h.hour === hour);
              const count = hourData?.count || 0;
              return (
                <div key={hour} style={styles.barWrapper}>
                  <div style={styles.barTooltip}>{count}</div>
                  <div
                    style={{
                      ...styles.bar,
                      height: `${maxHourlyTraffic > 0 ? (count / maxHourlyTraffic) * 150 : 0}px`,
                      backgroundColor: "#a78bfa",
                      minHeight: count > 0 ? "4px" : "0",
                    }}
                  ></div>
                  <span style={styles.barLabel}>{hour}h</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Daily Registrations */}
      <div style={styles.chartCard}>
        <h3 style={styles.chartTitle}>New User Registrations</h3>
        <div style={styles.registrationsList}>
          {data?.daily_registrations?.length > 0 ? (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Date</th>
                  <th style={styles.th}>New Users</th>
                </tr>
              </thead>
              <tbody>
                {data.daily_registrations.map((item, index) => (
                  <tr key={index}>
                    <td style={styles.td}>
                      {new Date(item.date).toLocaleDateString("en-US", {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })}
                    </td>
                    <td style={styles.td}>
                      <span style={styles.countBadge}>{item.count}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p style={styles.noData}>No registration data available</p>
          )}
        </div>
      </div>

      {/* Top Endpoints */}
      <div style={styles.chartCard}>
        <h3 style={styles.chartTitle}>Top Endpoints</h3>
        <div style={styles.endpointsList}>
          {data?.top_endpoints?.length > 0 ? (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Endpoint</th>
                  <th style={styles.th}>Requests</th>
                  <th style={styles.th}>Avg Time</th>
                </tr>
              </thead>
              <tbody>
                {data.top_endpoints.map((endpoint, index) => (
                  <tr key={index}>
                    <td style={styles.td}>
                      <code style={styles.code}>{endpoint.endpoint}</code>
                    </td>
                    <td style={styles.td}>{endpoint.count}</td>
                    <td style={styles.td}>
                      <span style={{
                        ...styles.timeBadge,
                        backgroundColor: endpoint.avg_time > 1000 ? "rgba(239, 68, 68, 0.2)" : "rgba(52, 211, 153, 0.2)",
                        color: endpoint.avg_time > 1000 ? "#ef4444" : "#34d399",
                      }}>
                        {endpoint.avg_time}ms
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p style={styles.noData}>No endpoint data available</p>
          )}
        </div>
      </div>
    </div>
  );
};

const styles = {
  container: {
    maxWidth: "1400px",
    margin: "0 auto",
  },
  loadingContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "400px",
    color: "#94a3b8",
  },
  spinner: {
    width: "40px",
    height: "40px",
    border: "3px solid rgba(56, 189, 248, 0.3)",
    borderTopColor: "#38bdf8",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
    marginBottom: "16px",
  },
  errorContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    minHeight: "400px",
  },
  errorText: {
    color: "#ef4444",
    marginBottom: "16px",
  },
  retryBtn: {
    padding: "10px 20px",
    backgroundColor: "#38bdf8",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: "32px",
    flexWrap: "wrap",
    gap: "16px",
  },
  title: {
    color: "#e2e8f0",
    fontSize: "28px",
    fontWeight: "600",
    margin: 0,
  },
  subtitle: {
    color: "#94a3b8",
    fontSize: "14px",
    marginTop: "8px",
  },
  controls: {
    display: "flex",
    gap: "12px",
  },
  select: {
    padding: "10px 16px",
    backgroundColor: "#1e293b",
    color: "#e2e8f0",
    border: "1px solid rgba(148, 163, 184, 0.2)",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "14px",
  },
  refreshBtn: {
    padding: "10px 20px",
    backgroundColor: "transparent",
    color: "#38bdf8",
    border: "1px solid #38bdf8",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "14px",
  },
  chartCard: {
    backgroundColor: "#1e293b",
    borderRadius: "12px",
    padding: "24px",
    border: "1px solid rgba(148, 163, 184, 0.1)",
    marginBottom: "24px",
  },
  chartTitle: {
    color: "#e2e8f0",
    fontSize: "16px",
    fontWeight: "600",
    marginBottom: "24px",
    margin: "0 0 24px 0",
  },
  chartContainer: {
    overflowX: "auto",
  },
  barChart: {
    display: "flex",
    alignItems: "flex-end",
    gap: "8px",
    minHeight: "250px",
    paddingTop: "30px",
  },
  barWrapper: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    flex: "1",
    minWidth: "30px",
    position: "relative",
  },
  barTooltip: {
    position: "absolute",
    top: "-25px",
    color: "#94a3b8",
    fontSize: "11px",
    opacity: 0.8,
  },
  bar: {
    width: "100%",
    maxWidth: "40px",
    borderRadius: "4px 4px 0 0",
    transition: "height 0.3s ease",
    minHeight: "2px",
  },
  barLabel: {
    marginTop: "8px",
    color: "#64748b",
    fontSize: "10px",
    textAlign: "center",
    whiteSpace: "nowrap",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  th: {
    textAlign: "left",
    padding: "12px 16px",
    color: "#94a3b8",
    fontSize: "12px",
    fontWeight: "600",
    textTransform: "uppercase",
    borderBottom: "1px solid rgba(148, 163, 184, 0.1)",
  },
  td: {
    padding: "12px 16px",
    color: "#e2e8f0",
    fontSize: "14px",
    borderBottom: "1px solid rgba(148, 163, 184, 0.05)",
  },
  code: {
    backgroundColor: "rgba(148, 163, 184, 0.1)",
    padding: "4px 8px",
    borderRadius: "4px",
    fontSize: "13px",
    fontFamily: "monospace",
  },
  countBadge: {
    backgroundColor: "rgba(56, 189, 248, 0.2)",
    color: "#38bdf8",
    padding: "4px 12px",
    borderRadius: "20px",
    fontSize: "13px",
    fontWeight: "500",
  },
  timeBadge: {
    padding: "4px 12px",
    borderRadius: "20px",
    fontSize: "13px",
    fontWeight: "500",
  },
  noData: {
    color: "#64748b",
    textAlign: "center",
    padding: "40px",
  },
  registrationsList: {
    maxHeight: "300px",
    overflowY: "auto",
  },
  endpointsList: {
    maxHeight: "400px",
    overflowY: "auto",
  },
};

export default TrafficAnalytics;
