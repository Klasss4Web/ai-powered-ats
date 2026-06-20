import { useState, useEffect, useCallback } from "react";
import { AUTH_CONSTANTS, BASE_URL } from "../../constants/auth_constants";

/* ─── helpers ───────────────────────────────────────────────── */
const fmtTime = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("en-US", {
    month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit", second: "2-digit",
  });
};

const fmtDate = (iso) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

/* colour helpers */
const statusColor = (code) => {
  if (code >= 500) return { bg: "rgba(239,68,68,0.15)",  text: "#ef4444" };
  if (code >= 400) return { bg: "rgba(251,191,36,0.15)", text: "#fbbf24" };
  return              { bg: "rgba(52,211,153,0.15)",  text: "#34d399" };
};

const rateColor = (rate) => {
  if (rate > 10) return "#ef4444";
  if (rate > 5)  return "#fbbf24";
  if (rate > 1)  return "#fb923c";
  return "#34d399";
};

/* ─── stat card ─────────────────────────────────────────────── */
const StatCard = ({ label, value, sub, accent }) => (
  <div style={{
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: "20px 24px",
    border: "1px solid rgba(148,163,184,0.1)",
    borderTop: `3px solid ${accent}`,
    flex: 1,
    minWidth: 140,
  }}>
    <p style={{ color: "#94a3b8", fontSize: 12, margin: "0 0 8px", textTransform: "uppercase", letterSpacing: "0.05em" }}>
      {label}
    </p>
    <p style={{ color: accent, fontSize: 28, fontWeight: 700, margin: "0 0 4px" }}>{value}</p>
    {sub && <p style={{ color: "#64748b", fontSize: 12, margin: 0 }}>{sub}</p>}
  </div>
);

/* ─── section card wrapper ──────────────────────────────────── */
const Card = ({ title, children, style }) => (
  <div style={{
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 24,
    border: "1px solid rgba(148,163,184,0.1)",
    marginBottom: 24,
    ...style,
  }}>
    {title && (
      <h3 style={{ color: "#e2e8f0", fontSize: 16, fontWeight: 600, margin: "0 0 20px" }}>
        {title}
      </h3>
    )}
    {children}
  </div>
);

/* ─── page nav button helper ───────────────────────────────── */
const PageBtn = ({ label, onClick, disabled }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    style={{
      padding: "6px 14px",
      background: disabled ? "transparent" : "rgba(148,163,184,0.1)",
      color: disabled ? "#475569" : "#cbd5e1",
      border: "1px solid rgba(148,163,184,0.2)",
      borderRadius: 6,
      fontSize: 12,
      fontWeight: 600,
      cursor: disabled ? "not-allowed" : "pointer",
      transition: "all 0.15s",
    }}
    onMouseEnter={(e) => {
      if (!disabled) e.currentTarget.style.background = "rgba(148,163,184,0.2)";
    }}
    onMouseLeave={(e) => {
      if (!disabled) e.currentTarget.style.background = "rgba(148,163,184,0.1)";
    }}
  >
    {label}
  </button>
);

/* ─── main component ────────────────────────────────────────── */
const ErrorLog = () => {
  const [data, setData]         = useState(null);
  const [loading, setLoading]   = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]       = useState(null);

  /* grouped state */
  const [filters, setFilters]   = useState({
    days: 7,
    statusClass: "",
    endpointSearch: "",
    endpointFilter: "",
    startDate: "",
    endDate: "",
  });
  const [pagination, setPagination] = useState({ page: 1, perPage: 25 });

  const { days, statusClass, endpointSearch, endpointFilter, startDate, endDate } = filters;
  const { page, perPage } = pagination;

  const updateFilter = (key, value) => setFilters((f) => ({ ...f, [key]: value }));
  const setPage      = (p) => setPagination((pg) => ({ ...pg, page: p }));

  const fetchErrors = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);

    try {
      const token = localStorage.getItem(AUTH_CONSTANTS.TOKEN_KEY);
      const qs = new URLSearchParams({
        days,
        page,
        per_page: perPage,
        status_class: statusClass,
        endpoint: endpointFilter,
      });
      if (startDate) qs.append("start_date", startDate);
      if (endDate) qs.append("end_date", endDate);

      const res = await fetch(`${BASE_URL}/admin/errors?${qs.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) throw new Error("Failed to fetch error log");
      const json = await res.json();
      setData(json);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [days, page, perPage, statusClass, endpointFilter, startDate, endDate]);

  useEffect(() => { fetchErrors(); }, [fetchErrors]);

  /* reset page when filters change */
  const applyFilters = () => {
    updateFilter("endpointFilter", endpointSearch);
    setPage(1);
  };

  const clearFilters = () => {
    setFilters({
      days: 7,
      statusClass: "",
      endpointSearch: "",
      endpointFilter: "",
      startDate: "",
      endDate: "",
    });
    setPagination({ page: 1, perPage: 25 });
  };

  /* ── loading / error states ── */
  if (loading && !data) {
    return (
      <div style={st.center}>
        <div style={st.spinner} />
        <p style={{ color: "#94a3b8" }}>Loading error log…</p>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div style={st.center}>
        <p style={{ color: "#ef4444", marginBottom: 16 }}>{error}</p>
        <button onClick={() => fetchErrors()} style={st.btnFilled}>Retry</button>
      </div>
    );
  }

  const s = data?.summary || {};
  const trend = data?.daily_trend || [];
  const maxTrend = Math.max(...trend.map(d => d.total_errors), 1);
  const totalPages = data?.pagination?.pages || 1;

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto" }}>

      {/* ── Header ── */}
      <div style={st.pageHeader}>
        <div>
          <h1 style={st.title}>Error Log</h1>
          <p style={st.subtitle}>
            Every HTTP error (4xx &amp; 5xx) recorded on the platform, with context, trends, and user attribution.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <select value={days} onChange={e => { updateFilter("days", Number(e.target.value)); setPage(1); }} style={st.select}>
            <option value={1}>Last 24 h</option>
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <button
            onClick={() => fetchErrors(true)}
            disabled={refreshing}
            style={{ ...st.btnOutline, opacity: refreshing ? 0.7 : 1 }}
          >
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {/* ── Summary stat cards ── */}
      <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 24 }}>
        <StatCard
          label="Total Errors"
          value={s.total_errors ?? 0}
          sub={`${s.error_rate ?? 0}% of all requests`}
          accent={rateColor(s.error_rate ?? 0)}
        />
        <StatCard
          label="Client Errors (4xx)"
          value={s.client_errors ?? 0}
          sub="Bad requests, auth failures"
          accent="#fbbf24"
        />
        <StatCard
          label="Server Errors (5xx)"
          value={s.server_errors ?? 0}
          sub="Unhandled exceptions"
          accent="#ef4444"
        />
        <StatCard
          label="Affected Users"
          value={s.affected_users ?? 0}
          sub="Distinct users who hit errors"
          accent="#fb923c"
        />
        <StatCard
          label="Avg Response (errors)"
          value={`${s.avg_response_ms ?? 0} ms`}
          sub={`Peak: ${s.max_response_ms ?? 0} ms`}
          accent="#38bdf8"
        />
      </div>

      {/* ── Insight banner ── */}
      {s.total_errors > 0 && (
        <div style={{
          marginBottom: 24,
          padding: "14px 18px",
          borderRadius: 10,
          borderLeft: `4px solid ${s.server_errors > 0 ? "#ef4444" : "#fbbf24"}`,
          backgroundColor: s.server_errors > 0
            ? "rgba(239,68,68,0.07)"
            : "rgba(251,191,36,0.07)",
          color: "#e2e8f0",
          fontSize: 14,
          lineHeight: 1.6,
        }}>
          {s.server_errors > 0 ? (
            <>
              <strong style={{ color: "#ef4444" }}>🔴 Server errors detected.</strong>{" "}
              {s.server_errors} internal error{s.server_errors !== 1 ? "s" : ""} occurred in the last {days} day{days !== 1 ? "s" : ""}.
              Check the table below and review backend logs for stack traces.
            </>
          ) : (
            <>
              <strong style={{ color: "#fbbf24" }}>🟡 Client errors only.</strong>{" "}
              No 5xx errors in this period — all {s.client_errors} error{s.client_errors !== 1 ? "s" : ""} are client-side (4xx).
              Review authentication flows and input validation if numbers are high.
            </>
          )}
        </div>
      )}

      {/* ── Daily trend ── */}
      <Card title="Daily Error Trend">
        {trend.length > 0 ? (
          <>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 10, minHeight: 140, overflowX: "auto", paddingBottom: 8 }}>
              {trend.map((d, i) => (
                <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: 1, minWidth: 44 }}>
                  <span style={{ color: "#64748b", fontSize: 10, marginBottom: 4 }}>{d.total_errors}</span>
                  <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                    {/* server errors (red) */}
                    {d.server_errors > 0 && (
                      <div style={{
                        width: "70%",
                        height: Math.max(4, (d.server_errors / maxTrend) * 100),
                        backgroundColor: "#ef4444",
                        borderRadius: "3px 3px 0 0",
                      }} title={`5xx: ${d.server_errors}`} />
                    )}
                    {/* client errors (yellow) */}
                    {d.client_errors > 0 && (
                      <div style={{
                        width: "70%",
                        height: Math.max(4, (d.client_errors / maxTrend) * 100),
                        backgroundColor: "#fbbf24",
                        borderRadius: d.server_errors > 0 ? 0 : "3px 3px 0 0",
                      }} title={`4xx: ${d.client_errors}`} />
                    )}
                  </div>
                  <span style={{ color: "#64748b", fontSize: 10, marginTop: 6, textAlign: "center" }}>
                    {fmtDate(d.date)}
                  </span>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 20, marginTop: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#94a3b8", fontSize: 12 }}>
                <div style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: "#ef4444" }} />
                Server errors (5xx)
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#94a3b8", fontSize: 12 }}>
                <div style={{ width: 12, height: 12, borderRadius: 3, backgroundColor: "#fbbf24" }} />
                Client errors (4xx)
              </div>
            </div>
          </>
        ) : (
          <p style={st.noData}>No errors in this period — everything looks healthy.</p>
        )}
      </Card>

      {/* ── Two-column: by endpoint + by status code ── */}
      <div style={{ display: "flex", gap: 20, marginBottom: 24, flexWrap: "wrap" }}>

        {/* Errors by endpoint */}
        <div style={{ flex: 2, minWidth: 280, backgroundColor: "#1e293b", borderRadius: 12, padding: 24, border: "1px solid rgba(148,163,184,0.1)" }}>
          <h3 style={st.cardTitle}>Errors by Endpoint</h3>
          {data?.by_endpoint?.length > 0 ? (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Endpoint", "Total", "5xx", "4xx", "Worst Status", "Avg (ms)"].map(h => (
                    <th key={h} style={st.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.by_endpoint.map((row, i) => (
                  <tr key={i} style={{ backgroundColor: i % 2 === 0 ? "transparent" : "rgba(148,163,184,0.03)" }}>
                    <td style={st.td}>
                      <code style={st.code}>{row.endpoint}</code>
                    </td>
                    <td style={{ ...st.td, fontWeight: 700, color: "#e2e8f0" }}>{row.error_count}</td>
                    <td style={{ ...st.td, color: row.server_errors > 0 ? "#ef4444" : "#64748b" }}>
                      {row.server_errors}
                    </td>
                    <td style={{ ...st.td, color: row.client_errors > 0 ? "#fbbf24" : "#64748b" }}>
                      {row.client_errors}
                    </td>
                    <td style={st.td}>
                      <span style={{
                        ...st.badge,
                        backgroundColor: statusColor(row.worst_status).bg,
                        color: statusColor(row.worst_status).text,
                      }}>
                        {row.worst_status}
                      </span>
                    </td>
                    <td style={{ ...st.td, color: row.avg_response_ms > 2000 ? "#ef4444" : row.avg_response_ms > 1000 ? "#fbbf24" : "#94a3b8" }}>
                      {row.avg_response_ms}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p style={st.noData}>No errors recorded for this period.</p>
          )}
        </div>

        {/* Status code distribution */}
        <div style={{ flex: 1, minWidth: 220, backgroundColor: "#1e293b", borderRadius: 12, padding: 24, border: "1px solid rgba(148,163,184,0.1)" }}>
          <h3 style={st.cardTitle}>Status Code Breakdown</h3>
          {data?.by_status_code?.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {data.by_status_code.map((row, i) => {
                const c = statusColor(row.status_code);
                const maxCount = data.by_status_code[0]?.count || 1;
                return (
                  <div key={i}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                      <span style={{ ...st.badge, backgroundColor: c.bg, color: c.text }}>{row.status_code}</span>
                      <span style={{ color: "#e2e8f0", fontSize: 13, fontWeight: 600 }}>{row.count}</span>
                    </div>
                    <div style={{ height: 5, borderRadius: 3, backgroundColor: "rgba(148,163,184,0.1)", overflow: "hidden" }}>
                      <div style={{
                        height: "100%",
                        width: `${(row.count / maxCount) * 100}%`,
                        backgroundColor: c.text,
                        borderRadius: 3,
                      }} />
                    </div>
                    <p style={{ color: "#64748b", fontSize: 11, margin: "3px 0 0" }}>
                      Most common on: <code style={{ color: "#94a3b8" }}>{row.most_common_endpoint}</code>
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <p style={st.noData}>No data</p>
          )}
        </div>
      </div>

      {/* ── Top affected users ── */}
      {data?.top_affected_users?.length > 0 && (
        <Card title="Top Affected Users">
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["User", "Total Errors", "Server Errors (5xx)", "Last Error"].map(h => (
                    <th key={h} style={st.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.top_affected_users.map((u, i) => (
                  <tr key={i}>
                    <td style={st.td}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div style={st.avatar}>{(u.name || u.email || "?").charAt(0).toUpperCase()}</div>
                        <div>
                          <div style={{ color: "#e2e8f0", fontSize: 14, fontWeight: 500 }}>{u.name || "—"}</div>
                          <div style={{ color: "#64748b", fontSize: 12 }}>{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ ...st.td, fontWeight: 700, color: "#e2e8f0" }}>{u.error_count}</td>
                    <td style={{ ...st.td, color: u.server_errors > 0 ? "#ef4444" : "#64748b" }}>{u.server_errors}</td>
                    <td style={{ ...st.td, color: "#64748b", fontSize: 12 }}>{fmtTime(u.last_error_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ── Filters + full error table ── */}
      <Card title="All Error Requests">
        {/* Filter bar */}
        <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap", alignItems: "center" }}>
          <select
            value={statusClass}
            onChange={e => { updateFilter("statusClass", e.target.value); setPage(1); }}
            style={st.select}
          >
            <option value="">All errors</option>
            <option value="4xx">4xx only</option>
            <option value="5xx">5xx only</option>
          </select>
          <input
            type="text"
            placeholder="Filter by endpoint…"
            value={endpointSearch}
            onChange={e => updateFilter("endpointSearch", e.target.value)}
            onKeyDown={e => e.key === "Enter" && applyFilters()}
            style={{ ...st.select, minWidth: 200 }}
          />
          <input
            type="date"
            value={startDate}
            onChange={e => updateFilter("startDate", e.target.value)}
            style={st.select}
          />
          <input
            type="date"
            value={endDate}
            onChange={e => updateFilter("endDate", e.target.value)}
            style={st.select}
          />
          <button onClick={applyFilters} style={st.btnFilled}>Apply</button>
          {(endpointFilter || statusClass || startDate || endDate) && (
            <button onClick={clearFilters} style={st.btnOutline}>Clear</button>
          )}
          <span style={{ color: "#64748b", fontSize: 13, marginLeft: "auto" }}>
            {data?.pagination?.total ?? 0} errors
          </span>
        </div>

        {/* Table */}
        <div style={{ overflowX: "auto" }}>
          {data?.errors?.length > 0 ? (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
              <thead>
                <tr>
                  {["Time", "Method", "Endpoint", "Status", "Response (ms)", "User", "IP"].map(h => (
                    <th key={h} style={st.th}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.errors.map((row) => {
                  const c = statusColor(row.status_code);
                  return (
                    <tr key={row.id} style={{ borderBottom: "1px solid rgba(148,163,184,0.05)" }}>
                      <td style={{ ...st.td, color: "#64748b", whiteSpace: "nowrap", fontSize: 12 }}>
                        {fmtTime(row.created_at)}
                      </td>
                      <td style={st.td}>
                        <span style={{
                          ...st.badge,
                          backgroundColor: row.method === "POST" ? "rgba(56,189,248,0.12)" : "rgba(148,163,184,0.1)",
                          color: row.method === "POST" ? "#38bdf8" : "#94a3b8",
                        }}>
                          {row.method}
                        </span>
                      </td>
                      <td style={st.td}>
                        <code style={st.code}>{row.endpoint}</code>
                      </td>
                      <td style={st.td}>
                        <span style={{ ...st.badge, backgroundColor: c.bg, color: c.text, fontWeight: 700 }}>
                          {row.status_code}
                        </span>
                      </td>
                      <td style={{
                        ...st.td,
                        color: row.response_time_ms > 5000 ? "#ef4444"
                          : row.response_time_ms > 2000 ? "#fbbf24"
                          : "#94a3b8",
                      }}>
                        {row.response_time_ms}
                      </td>
                      <td style={st.td}>
                        {row.user_email ? (
                          <div>
                            <div style={{ color: "#e2e8f0" }}>{row.user_name || "—"}</div>
                            <div style={{ color: "#64748b", fontSize: 11 }}>{row.user_email}</div>
                          </div>
                        ) : (
                          <span style={{ color: "#64748b" }}>Anonymous</span>
                        )}
                      </td>
                      <td style={{ ...st.td, color: "#64748b", fontSize: 12, fontFamily: "monospace" }}>
                        {row.ip_address || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <p style={st.noData}>
              {data?.summary?.total_errors === 0
                ? "No errors in this period. The platform is running cleanly."
                : "No errors match the current filters."}
            </p>
          )}
        </div>

        {/* Pagination */}
        {data?.pagination?.total > 0 && (
          <div style={{ marginTop: 24, borderTop: "1px solid rgba(148,163,184,0.1)", paddingTop: 20 }}>
            {/* Row count + per-page selector */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 12 }}>
              <span style={{ color: "#94a3b8", fontSize: 13 }}>
                {"Showing "}
                <strong style={{ color: "#e2e8f0" }}>
                  {Math.max(1, ((Number(page) || 1) - 1) * (Number(perPage) || 25) + 1)}
                </strong>
                {" – "}
                <strong style={{ color: "#e2e8f0" }}>
                  {Math.min((Number(page) || 1) * (Number(perPage) || 25), data.pagination.total)}
                </strong>
                {" of "}
                <strong style={{ color: "#e2e8f0" }}>{data.pagination.total}</strong>
                {" errors"}
              </span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ color: "#64748b", fontSize: 12 }}>Rows per page:</span>
                <select
                  value={perPage}
                  onChange={(e) => { setPagination({ page: 1, perPage: Number(e.target.value) }); }}
                  style={{ ...st.select, padding: "6px 10px", fontSize: 12 }}
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
              </div>
            </div>

            {/* Page controls */}
            {totalPages > 1 && (
              <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <PageBtn
                  label="First"
                  onClick={() => setPage(1)}
                  disabled={page === 1}
                />
                <PageBtn
                  label="Prev"
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                />

                {/* Page number window */}
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
                  .reduce((acc, p, idx, arr) => {
                    if (idx > 0 && p - arr[idx - 1] > 1) acc.push("…");
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p, i) =>
                    p === "…" ? (
                      <span key={`gap-${i}`} style={{ color: "#64748b", fontSize: 13, padding: "0 4px" }}>…</span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        style={{
                          minWidth: 32,
                          height: 32,
                          padding: "0 8px",
                          borderRadius: 6,
                          border: "none",
                          fontSize: 13,
                          fontWeight: 600,
                          cursor: "pointer",
                          background: page === p ? "#38bdf8" : "rgba(148,163,184,0.1)",
                          color: page === p ? "#0f172a" : "#cbd5e1",
                        }}
                      >
                        {p}
                      </button>
                    )
                  )}

                <PageBtn
                  label="Next"
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                />
                <PageBtn
                  label="Last"
                  onClick={() => setPage(totalPages)}
                  disabled={page === totalPages}
                />
              </div>
            )}
          </div>
        )}
      </Card>
    </div>
  );
};

/* ─── styles ────────────────────────────────────────────────── */
const st = {
  center: {
    display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center",
    minHeight: 400, color: "#94a3b8",
  },
  spinner: {
    width: 40, height: 40,
    border: "3px solid rgba(56,189,248,0.3)",
    borderTopColor: "#38bdf8",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
    marginBottom: 16,
  },
  pageHeader: {
    display: "flex", justifyContent: "space-between",
    alignItems: "flex-start", marginBottom: 28,
    flexWrap: "wrap", gap: 16,
  },
  title:    { color: "#e2e8f0", fontSize: 28, fontWeight: 600, margin: 0 },
  subtitle: { color: "#94a3b8", fontSize: 14, marginTop: 8 },
  cardTitle:{ color: "#e2e8f0", fontSize: 16, fontWeight: 600, margin: "0 0 20px" },
  select: {
    padding: "9px 14px", backgroundColor: "#0f172a",
    color: "#e2e8f0", border: "1px solid rgba(148,163,184,0.2)",
    borderRadius: 8, cursor: "pointer", fontSize: 13,
  },
  btnFilled: {
    padding: "9px 18px", backgroundColor: "#38bdf8",
    color: "#0f172a", border: "none",
    borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 13,
  },
  btnOutline: {
    padding: "9px 18px", backgroundColor: "transparent",
    color: "#38bdf8", border: "1px solid #38bdf8",
    borderRadius: 8, cursor: "pointer", fontSize: 13,
  },
  th: {
    textAlign: "left", padding: "10px 14px",
    color: "#94a3b8", fontSize: 11,
    fontWeight: 600, textTransform: "uppercase",
    letterSpacing: "0.05em",
    borderBottom: "1px solid rgba(148,163,184,0.1)",
    whiteSpace: "nowrap",
  },
  td: {
    padding: "10px 14px", color: "#e2e8f0",
    fontSize: 13, verticalAlign: "middle",
  },
  code: {
    backgroundColor: "rgba(148,163,184,0.1)",
    padding: "3px 7px", borderRadius: 4,
    fontSize: 12, fontFamily: "monospace", color: "#94a3b8",
  },
  badge: {
    display: "inline-block",
    padding: "3px 10px", borderRadius: 99,
    fontSize: 12, fontWeight: 600,
  },
  avatar: {
    width: 32, height: 32, borderRadius: "50%",
    backgroundColor: "rgba(239,68,68,0.15)",
    color: "#ef4444", display: "flex",
    alignItems: "center", justifyContent: "center",
    fontWeight: 700, fontSize: 13, flexShrink: 0,
  },
  noData: {
    color: "#64748b", textAlign: "center", padding: "40px 20px",
  },
};

export default ErrorLog;
