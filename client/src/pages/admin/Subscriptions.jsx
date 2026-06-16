import { useState, useEffect, useCallback } from "react";
import { AUTH_CONSTANTS } from "../../constants/auth_constants";
import fetchWithTimeout from "../../configs/fetch";

/* ─── helpers ───────────────────────────────────────────────── */
const fmtDate = (iso) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const fmtAmount = (amount, currency) => {
  if (!amount) return "—";
  const major = parseFloat(amount) / 100;
  const sym = currency === "USD" ? "$" : currency === "NGN" ? "₦" : "";
  return `${sym}${major.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};

const isExpired = (iso) => {
  if (!iso) return false;
  return new Date(iso) < new Date();
};

/* ─── Subscriptions Management ──────────────────────────────── */
const Subscriptions = () => {
  const [subs, setSubs] = useState([]);
  const [pagination, setPagination] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const [search, setSearch] = useState("");
  const [planFilter, setPlanFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(20);

  // Payment verification modal state
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [verifyReference, setVerifyReference] = useState("");
  const [verifyGateway, setVerifyGateway] = useState("paystack");
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyResult, setVerifyResult] = useState(null);

  const fetchSubs = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else if (subs.length === 0) setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        page: page.toString(),
        per_page: perPage.toString(),
      });
      if (search.trim()) params.append("search", search.trim());
      if (planFilter) params.append("plan", planFilter);
      if (statusFilter) params.append("status", statusFilter);

      const response = await fetchWithTimeout(`/admin/subscriptions?${params}`);
      if (!response.ok) throw new Error("Failed to fetch subscriptions");

      const data = await response.json();
      setSubs(data.subscriptions || []);
      setPagination(data.pagination || {});
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [page, perPage, search, planFilter, statusFilter]);

  useEffect(() => {
    fetchSubs();
  }, [fetchSubs]);

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    fetchSubs();
  };

  const handleVerifyPayment = async (e) => {
    e.preventDefault();
    if (!verifyReference.trim()) return;
    setVerifyLoading(true);
    setVerifyResult(null);
    try {
      const response = await fetchWithTimeout(
        `/payment/manual-verify/${encodeURIComponent(verifyReference.trim())}`,
        {
          method: "POST",
          body: JSON.stringify({ gateway: verifyGateway }),
        },
      );
      const data = await response.json().catch(() => ({}));
      if (response.ok) {
        setVerifyResult({
          type: data.status === "already_verified" ? "warning" : "success",
          message:
            data.message ||
            (data.status === "already_verified"
              ? "This payment has already been verified."
              : "Payment verified successfully!"),
        });
        if (data.status !== "already_verified") {
          fetchSubs(true);
        }
      } else {
        setVerifyResult({
          type: "error",
          message: data.error || "Verification failed.",
        });
      }
    } catch (err) {
      setVerifyResult({
        type: "error",
        message: "Network error. Please try again.",
      });
    } finally {
      setVerifyLoading(false);
    }
  };

  /* ── loading / error states ── */
  if (loading && subs.length === 0) {
    return (
      <div style={st.center}>
        <div style={st.spinner} />
        <p style={{ color: "#94a3b8" }}>Loading subscriptions…</p>
      </div>
    );
  }

  if (error && subs.length === 0) {
    return (
      <div style={st.center}>
        <p style={{ color: "#ef4444", marginBottom: 16 }}>{error}</p>
        <button onClick={() => fetchSubs()} style={st.btnFilled}>Retry</button>
      </div>
    );
  }

  const totalPages = pagination.pages || 1;

  return (
    <div style={{ maxWidth: 1400, margin: "0 auto" }}>
      {/* ── Header ── */}
      <div style={st.header}>
        <div>
          <h1 style={st.title}>Subscriptions</h1>
          <p style={st.subtitle}>
            {pagination.total || 0} total records · Every subscription and pay-as-you-go payment.
          </p>
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <button
            onClick={() => {
              setVerifyReference("");
              setVerifyGateway("paystack");
              setVerifyResult(null);
              setShowVerifyModal(true);
            }}
            style={st.btnFilled}
          >
            Verify Payment
          </button>
          <button onClick={() => fetchSubs(true)} disabled={refreshing} style={st.btnOutline}>
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {/* ── Filters ── */}
      <div style={{ ...st.row, marginBottom: 20, flexWrap: "wrap" }}>
        <form onSubmit={handleSearch} style={{ display: "flex", gap: 8, flex: 1, minWidth: 260 }}>
          <input
            type="text"
            placeholder="Search by user name or email…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ ...st.input, flex: 1 }}
          />
          <button type="submit" style={st.btnFilled}>Search</button>
        </form>

        <select
          value={planFilter}
          onChange={(e) => { setPlanFilter(e.target.value); setPage(1); }}
          style={st.select}
        >
          <option value="">All Plans</option>
          <option value="premium">Premium</option>
          <option value="pro">Pro</option>
          <option value="pay_as_you_go">Pay As You Go</option>
        </select>

        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          style={st.select}
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="expired">Expired</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* ── Table ── */}
      <div style={st.tableCard}>
        <table style={st.table}>
          <thead>
            <tr>
              <th style={st.th}>User</th>
              <th style={st.th}>Plan</th>
              <th style={st.th}>Amount</th>
              <th style={st.th}>Gateway</th>
              <th style={st.th}>Reference</th>
              <th style={st.th}>Status</th>
              <th style={st.th}>Started</th>
              <th style={st.th}>Expires</th>
            </tr>
          </thead>
          <tbody>
            {subs.map((sub) => (
              <tr key={sub.id}>
                <td style={st.td}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={st.avatar}>{sub.user?.name?.charAt(0).toUpperCase() || "U"}</div>
                    <div>
                      <div style={{ fontWeight: 600, color: "#e2e8f0" }}>{sub.user?.name}</div>
                      <div style={{ fontSize: 12, color: "#64748b" }}>{sub.user?.email}</div>
                    </div>
                  </div>
                </td>
                <td style={st.td}>
                  <span style={planBadge(sub.plan_type)}>
                    {sub.plan_type?.replace(/_/g, " ")}
                  </span>
                </td>
                <td style={st.td}>
                  <span style={{ color: "#e2e8f0", fontSize: 13 }}>{fmtAmount(sub.amount, sub.currency)}</span>
                </td>
                <td style={st.td}>
                  <span style={{ color: "#94a3b8", fontSize: 13, textTransform: "capitalize" }}>{sub.gateway}</span>
                </td>
                <td style={st.td}>
                  <span style={{ fontFamily: "monospace", fontSize: 12, color: "#64748b" }}>{sub.reference}</span>
                </td>
                <td style={st.td}>
                  <span style={statusBadge(sub.status, sub.expires_at)}>
                    {sub.status}
                  </span>
                </td>
                <td style={st.td}>
                  <span style={{ color: "#94a3b8", fontSize: 13 }}>{fmtDate(sub.started_at)}</span>
                </td>
                <td style={st.td}>
                  <span style={{ color: isExpired(sub.expires_at) ? "#ef4444" : "#94a3b8", fontSize: 13 }}>
                    {fmtDate(sub.expires_at)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {subs.length === 0 && (
          <div style={{ padding: 40, textAlign: "center", color: "#64748b" }}>
            <p>No subscriptions found matching your criteria</p>
          </div>
        )}
      </div>

      {/* ── Pagination ── */}
      {pagination.total > 0 && (
        <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            <span style={{ color: "#94a3b8", fontSize: 13 }}>
              Showing <strong style={{ color: "#e2e8f0" }}>{(page - 1) * perPage + 1}</strong> –{" "}
              <strong style={{ color: "#e2e8f0" }}>{Math.min(page * perPage, pagination.total)}</strong> of{" "}
              <strong style={{ color: "#e2e8f0" }}>{pagination.total}</strong> records
            </span>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ color: "#64748b", fontSize: 12 }}>Rows:</span>
              <select
                value={perPage}
                onChange={(e) => { setPerPage(Number(e.target.value)); setPage(1); }}
                style={{ ...st.select, padding: "6px 10px", fontSize: 12 }}
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
            </div>
          </div>

          {totalPages > 1 && (
            <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <PageBtn label="First" onClick={() => setPage(1)} disabled={page === 1} />
              <PageBtn label="Prev" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1} />

              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
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
                  ),
                )}

              <PageBtn label="Next" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages} />
              <PageBtn label="Last" onClick={() => setPage(totalPages)} disabled={page === totalPages} />
            </div>
          )}
        </div>
      )}

      {/* ── Payment Verification Modal ── */}
      {showVerifyModal && (
        <div style={st.modalOverlay} onClick={(e) => e.target === e.currentTarget && setShowVerifyModal(false)}>
          <div style={st.modalContent}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <h2 style={{ color: "#e2e8f0", margin: 0, fontSize: 20 }}>Verify Payment</h2>
              <button onClick={() => setShowVerifyModal(false)} style={st.closeBtn}>✕</button>
            </div>

            <form onSubmit={handleVerifyPayment}>
              <div style={{ marginBottom: 16 }}>
                <label style={st.label}>Reference / Transaction ID</label>
                <input
                  type="text"
                  value={verifyReference}
                  onChange={(e) => setVerifyReference(e.target.value)}
                  placeholder="e.g. 9vbjhdc02o"
                  required
                  style={st.input}
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <label style={st.label}>Gateway</label>
                <select
                  value={verifyGateway}
                  onChange={(e) => setVerifyGateway(e.target.value)}
                  style={st.select}
                >
                  <option value="paystack">Paystack</option>
                  <option value="paypal">PayPal</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={verifyLoading || !verifyReference.trim()}
                style={{
                  ...st.btnFilled,
                  width: "100%",
                  opacity: verifyLoading || !verifyReference.trim() ? 0.6 : 1,
                  cursor: verifyLoading || !verifyReference.trim() ? "not-allowed" : "pointer",
                }}
              >
                {verifyLoading ? "Verifying…" : "Verify Payment"}
              </button>
            </form>

            {verifyResult && (
              <div
                style={{
                  marginTop: 16,
                  padding: 12,
                  borderRadius: 8,
                  backgroundColor: verifyResult.type === "success" ? "rgba(52,211,153,0.1)" : verifyResult.type === "warning" ? "rgba(251,191,36,0.1)" : "rgba(239,68,68,0.1)",
                  color: verifyResult.type === "success" ? "#34d399" : verifyResult.type === "warning" ? "#fbbf24" : "#ef4444",
                  fontSize: 14,
                }}
              >
                {verifyResult.message}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

/* ─── tiny components ───────────────────────────────────────── */
const PageBtn = ({ label, onClick, disabled }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    style={{
      padding: "6px 12px",
      borderRadius: 6,
      border: "1px solid rgba(148,163,184,0.2)",
      background: disabled ? "rgba(148,163,184,0.05)" : "rgba(148,163,184,0.1)",
      color: disabled ? "#475569" : "#cbd5e1",
      fontSize: 13,
      cursor: disabled ? "not-allowed" : "pointer",
    }}
  >
    {label}
  </button>
);

/* ─── badge helpers ─────────────────────────────────────────── */
const planBadge = (type) => ({
  display: "inline-block",
  padding: "4px 12px",
  borderRadius: 20,
  fontSize: 12,
  fontWeight: 600,
  textTransform: "capitalize",
  backgroundColor:
    type === "premium"
      ? "rgba(251, 191, 36, 0.2)"
      : type === "pro"
        ? "rgba(139, 92, 246, 0.2)"
        : type === "pay_as_you_go"
          ? "rgba(52, 211, 153, 0.2)"
          : "rgba(148, 163, 184, 0.2)",
  color:
    type === "premium" ? "#fbbf24" : type === "pro" ? "#a78bfa" : type === "pay_as_you_go" ? "#34d399" : "#94a3b8",
});

const statusBadge = (status, expires) => ({
  display: "inline-block",
  padding: "4px 12px",
  borderRadius: 20,
  fontSize: 12,
  fontWeight: 600,
  textTransform: "capitalize",
  backgroundColor: status === "active" && !isExpired(expires)
    ? "rgba(52, 211, 153, 0.2)"
    : "rgba(239, 68, 68, 0.2)",
  color: status === "active" && !isExpired(expires) ? "#34d399" : "#ef4444",
});

/* ─── styles ────────────────────────────────────────────────── */
const st = {
  center: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    minHeight: 400,
  },
  spinner: {
    width: 40,
    height: 40,
    border: "3px solid rgba(56,189,248,0.3)",
    borderTopColor: "#38bdf8",
    borderRadius: "50%",
    animation: "spin 1s linear infinite",
    marginBottom: 16,
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 24,
    flexWrap: "wrap",
    gap: 16,
  },
  title: {
    color: "#e2e8f0",
    fontSize: 28,
    fontWeight: 600,
    margin: "0 0 8px",
  },
  subtitle: {
    color: "#94a3b8",
    fontSize: 14,
    margin: 0,
  },
  row: {
    display: "flex",
    gap: 12,
    alignItems: "center",
  },
  input: {
    padding: "10px 14px",
    backgroundColor: "#0f172a",
    color: "#e2e8f0",
    border: "1px solid rgba(148,163,184,0.2)",
    borderRadius: 8,
    fontSize: 14,
    outline: "none",
    minWidth: 180,
  },
  select: {
    padding: "10px 14px",
    backgroundColor: "#0f172a",
    color: "#e2e8f0",
    border: "1px solid rgba(148,163,184,0.2)",
    borderRadius: 8,
    fontSize: 14,
    cursor: "pointer",
  },
  btnFilled: {
    padding: "10px 20px",
    backgroundColor: "#38bdf8",
    color: "#0f172a",
    border: "none",
    borderRadius: 8,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  },
  btnOutline: {
    padding: "10px 20px",
    backgroundColor: "transparent",
    color: "#38bdf8",
    border: "1px solid #38bdf8",
    borderRadius: 8,
    fontSize: 14,
    cursor: "pointer",
  },
  tableCard: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    border: "1px solid rgba(148,163,184,0.1)",
    overflowX: "auto",
  },
  table: {
    width: "100%",
    borderCollapse: "collapse",
  },
  th: {
    textAlign: "left",
    padding: "16px",
    color: "#94a3b8",
    fontSize: 12,
    fontWeight: 600,
    textTransform: "uppercase",
    borderBottom: "1px solid rgba(148,163,184,0.1)",
  },
  td: {
    padding: "16px",
    color: "#e2e8f0",
    fontSize: 14,
    borderBottom: "1px solid rgba(148,163,184,0.05)",
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: "50%",
    backgroundColor: "rgba(56,189,248,0.2)",
    color: "#38bdf8",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 600,
    fontSize: 14,
    flexShrink: 0,
  },
  modalOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.6)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 2000,
    padding: 20,
  },
  modalContent: {
    backgroundColor: "#1e293b",
    borderRadius: 12,
    padding: 28,
    maxWidth: 420,
    width: "100%",
    border: "1px solid rgba(148,163,184,0.1)",
  },
  closeBtn: {
    background: "none",
    border: "none",
    color: "#94a3b8",
    fontSize: 20,
    cursor: "pointer",
  },
  label: {
    display: "block",
    color: "#94a3b8",
    fontSize: 13,
    fontWeight: 500,
    marginBottom: 6,
  },
};

export default Subscriptions;
