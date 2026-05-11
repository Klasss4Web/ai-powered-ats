import { useState, useEffect } from "react";
import { AUTH_CONSTANTS, BASE_URL } from "../../constants/auth_constants";

const PerformanceAnalytics = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [days, setDays] = useState(7);

  useEffect(() => {
    fetchPerformanceData();
  }, [days]);

  const fetchPerformanceData = async (isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setError(null);
    
    try {
      const token = localStorage.getItem(AUTH_CONSTANTS.TOKEN_KEY);
      const response = await fetch(`${BASE_URL}/admin/analytics/performance?days=${days}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch performance data");
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
        <p>Loading performance data...</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div style={styles.errorContainer}>
        <p style={styles.errorText}>{error}</p>
        <button onClick={() => fetchPerformanceData()} style={styles.retryBtn}>Retry</button>
      </div>
    );
  }

  const maxResponseTime = Math.max(...(data?.response_times?.map(d => d.max) || [1]));
  const maxErrors = Math.max(...(data?.error_rates?.map(d => d.errors) || [1]));

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>API Performance</h1>
          <p style={styles.subtitle}>Monitor response times, error rates, and endpoint health</p>
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
            onClick={() => fetchPerformanceData(true)} 
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

      {/* Response Time Chart */}
      <div style={styles.chartCard}>
        <h3 style={styles.cardTitle}>Response Time Trends</h3>
        <div style={styles.chartContainer}>
          {data?.response_times?.length > 0 ? (
            <div style={styles.lineChart}>
              {data.response_times.map((item, index) => (
                <div key={index} style={styles.chartColumn}>
                  <div style={styles.columnBars}>
                    {/* Max bar (background) */}
                    <div
                      style={{
                        ...styles.maxBar,
                        height: `${(item.max / maxResponseTime) * 200}px`,
                      }}
                    >
                      <span style={styles.barValue}>{item.max}ms</span>
                    </div>
                    {/* P95 bar */}
                    <div
                      style={{
                        ...styles.p95Bar,
                        height: `${(item.p95 / maxResponseTime) * 200}px`,
                      }}
                    ></div>
                    {/* Avg bar */}
                    <div
                      style={{
                        ...styles.avgBar,
                        height: `${(item.avg / maxResponseTime) * 200}px`,
                      }}
                    >
                      <span style={styles.avgValue}>{item.avg}ms</span>
                    </div>
                  </div>
                  <span style={styles.chartLabel}>
                    {new Date(item.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p style={styles.noData}>No response time data available</p>
          )}
        </div>
        <div style={styles.legend}>
          <div style={styles.legendItem}>
            <div style={{ ...styles.legendDot, backgroundColor: "#38bdf8" }}></div>
            <span>Average</span>
          </div>
          <div style={styles.legendItem}>
            <div style={{ ...styles.legendDot, backgroundColor: "#fbbf24" }}></div>
            <span>P95</span>
          </div>
          <div style={styles.legendItem}>
            <div style={{ ...styles.legendDot, backgroundColor: "rgba(148, 163, 184, 0.3)" }}></div>
            <span>Max</span>
          </div>
        </div>
      </div>

      {/* Error Rates Chart */}
      <div style={styles.chartCard}>
        <h3 style={styles.cardTitle}>Error Rates</h3>
        <div style={styles.chartContainer}>
          {data?.error_rates?.length > 0 ? (
            <div style={styles.errorChart}>
              {data.error_rates.map((item, index) => (
                <div key={index} style={styles.errorColumn}>
                  <div style={styles.errorBars}>
                    <div
                      style={{
                        ...styles.totalBar,
                        height: `${(item.total / Math.max(...data.error_rates.map(d => d.total))) * 150}px`,
                      }}
                    ></div>
                    <div
                      style={{
                        ...styles.errorBar,
                        height: `${maxErrors > 0 ? (item.errors / Math.max(...data.error_rates.map(d => d.total))) * 150 : 0}px`,
                      }}
                    ></div>
                  </div>
                  <div style={styles.errorInfo}>
                    <span style={{
                      ...styles.errorRate,
                      color: item.error_rate > 5 ? "#ef4444" : item.error_rate > 1 ? "#fbbf24" : "#34d399"
                    }}>
                      {item.error_rate}%
                    </span>
                  </div>
                  <span style={styles.chartLabel}>
                    {new Date(item.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p style={styles.noData}>No error rate data available</p>
          )}
        </div>
        <div style={styles.legend}>
          <div style={styles.legendItem}>
            <div style={{ ...styles.legendDot, backgroundColor: "rgba(148, 163, 184, 0.3)" }}></div>
            <span>Total Requests</span>
          </div>
          <div style={styles.legendItem}>
            <div style={{ ...styles.legendDot, backgroundColor: "#ef4444" }}></div>
            <span>Errors</span>
          </div>
        </div>
      </div>

      {/* Slowest Endpoints */}
      <div style={styles.tableCard}>
        <h3 style={styles.cardTitle}>Slowest Endpoints</h3>
        {data?.slowest_endpoints?.length > 0 ? (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Endpoint</th>
                <th style={styles.th}>Avg Response Time</th>
                <th style={styles.th}>Request Count</th>
                <th style={styles.th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.slowest_endpoints.map((endpoint, index) => (
                <tr key={index}>
                  <td style={styles.td}>
                    <code style={styles.code}>{endpoint.endpoint}</code>
                  </td>
                  <td style={styles.td}>
                    <span style={{
                      ...styles.timeBadge,
                      backgroundColor: endpoint.avg_time > 2000 
                        ? "rgba(239, 68, 68, 0.2)" 
                        : endpoint.avg_time > 1000 
                          ? "rgba(251, 191, 36, 0.2)" 
                          : "rgba(52, 211, 153, 0.2)",
                      color: endpoint.avg_time > 2000 
                        ? "#ef4444" 
                        : endpoint.avg_time > 1000 
                          ? "#fbbf24" 
                          : "#34d399",
                    }}>
                      {endpoint.avg_time}ms
                    </span>
                  </td>
                  <td style={styles.td}>{endpoint.count}</td>
                  <td style={styles.td}>
                    <span style={{
                      ...styles.statusBadge,
                      backgroundColor: endpoint.avg_time > 2000 
                        ? "rgba(239, 68, 68, 0.2)" 
                        : endpoint.avg_time > 1000 
                          ? "rgba(251, 191, 36, 0.2)" 
                          : "rgba(52, 211, 153, 0.2)",
                      color: endpoint.avg_time > 2000 
                        ? "#ef4444" 
                        : endpoint.avg_time > 1000 
                          ? "#fbbf24" 
                          : "#34d399",
                    }}>
                      {endpoint.avg_time > 2000 ? "Slow" : endpoint.avg_time > 1000 ? "Warning" : "Good"}
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

      {/* Performance Tips */}
      <div style={styles.tipsCard}>
        <h3 style={styles.cardTitle}>Performance Insights</h3>
        <div style={styles.tipsList}>
          {data?.slowest_endpoints?.some(e => e.avg_time > 2000) && (
            <div style={{ ...styles.tipItem, borderLeftColor: "#ef4444" }}>
              <strong>Critical:</strong> Some endpoints have response times exceeding 2 seconds. 
              Consider optimizing database queries or adding caching.
            </div>
          )}
          {data?.error_rates?.some(e => e.error_rate > 5) && (
            <div style={{ ...styles.tipItem, borderLeftColor: "#fbbf24" }}>
              <strong>Warning:</strong> Error rate exceeded 5% on some days. 
              Review error logs for recurring issues.
            </div>
          )}
          {(!data?.slowest_endpoints?.some(e => e.avg_time > 1000) && 
            !data?.error_rates?.some(e => e.error_rate > 1)) && (
            <div style={{ ...styles.tipItem, borderLeftColor: "#34d399" }}>
              <strong>Healthy:</strong> API performance is within acceptable limits. 
              Continue monitoring for any changes.
            </div>
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
  cardTitle: {
    color: "#e2e8f0",
    fontSize: "16px",
    fontWeight: "600",
    margin: "0 0 24px 0",
  },
  chartContainer: {
    overflowX: "auto",
  },
  lineChart: {
    display: "flex",
    alignItems: "flex-end",
    gap: "16px",
    minHeight: "280px",
    paddingTop: "40px",
  },
  chartColumn: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    flex: "1",
    minWidth: "60px",
  },
  columnBars: {
    position: "relative",
    width: "40px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
  },
  maxBar: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    backgroundColor: "rgba(148, 163, 184, 0.15)",
    borderRadius: "4px 4px 0 0",
    display: "flex",
    justifyContent: "center",
  },
  barValue: {
    position: "absolute",
    top: "-20px",
    color: "#64748b",
    fontSize: "10px",
  },
  p95Bar: {
    position: "absolute",
    bottom: 0,
    width: "70%",
    backgroundColor: "#fbbf24",
    borderRadius: "4px 4px 0 0",
    opacity: 0.7,
  },
  avgBar: {
    position: "absolute",
    bottom: 0,
    width: "50%",
    backgroundColor: "#38bdf8",
    borderRadius: "4px 4px 0 0",
    display: "flex",
    justifyContent: "center",
  },
  avgValue: {
    position: "absolute",
    top: "-18px",
    color: "#38bdf8",
    fontSize: "10px",
    fontWeight: "500",
  },
  chartLabel: {
    marginTop: "12px",
    color: "#64748b",
    fontSize: "10px",
    textAlign: "center",
  },
  legend: {
    display: "flex",
    justifyContent: "center",
    gap: "24px",
    marginTop: "16px",
  },
  legendItem: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    color: "#94a3b8",
    fontSize: "12px",
  },
  legendDot: {
    width: "12px",
    height: "12px",
    borderRadius: "3px",
  },
  errorChart: {
    display: "flex",
    alignItems: "flex-end",
    gap: "16px",
    minHeight: "220px",
    paddingTop: "20px",
  },
  errorColumn: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    flex: "1",
    minWidth: "60px",
  },
  errorBars: {
    position: "relative",
    width: "40px",
    height: "150px",
    display: "flex",
    alignItems: "flex-end",
  },
  totalBar: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    backgroundColor: "rgba(148, 163, 184, 0.2)",
    borderRadius: "4px 4px 0 0",
  },
  errorBar: {
    position: "absolute",
    bottom: 0,
    width: "100%",
    backgroundColor: "#ef4444",
    borderRadius: "4px 4px 0 0",
    opacity: 0.8,
  },
  errorInfo: {
    marginTop: "8px",
  },
  errorRate: {
    fontSize: "12px",
    fontWeight: "600",
  },
  tableCard: {
    backgroundColor: "#1e293b",
    borderRadius: "12px",
    padding: "24px",
    border: "1px solid rgba(148, 163, 184, 0.1)",
    marginBottom: "24px",
    overflowX: "auto",
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
  timeBadge: {
    padding: "4px 12px",
    borderRadius: "20px",
    fontSize: "13px",
    fontWeight: "500",
  },
  statusBadge: {
    padding: "4px 12px",
    borderRadius: "20px",
    fontSize: "12px",
    fontWeight: "500",
  },
  noData: {
    color: "#64748b",
    textAlign: "center",
    padding: "40px",
  },
  tipsCard: {
    backgroundColor: "#1e293b",
    borderRadius: "12px",
    padding: "24px",
    border: "1px solid rgba(148, 163, 184, 0.1)",
    marginBottom: "24px",
  },
  tipsList: {
    display: "flex",
    flexDirection: "column",
    gap: "12px",
  },
  tipItem: {
    padding: "16px",
    backgroundColor: "rgba(148, 163, 184, 0.05)",
    borderRadius: "8px",
    borderLeft: "4px solid",
    color: "#94a3b8",
    fontSize: "14px",
    lineHeight: "1.5",
  },
};

export default PerformanceAnalytics;
