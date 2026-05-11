import { useState, useEffect } from "react";
import { AUTH_CONSTANTS, BASE_URL } from "../../constants/auth_constants";

const UsersManagement = () => {
  const [users, setUsers] = useState([]);
  const [pagination, setPagination] = useState({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);
  const [search, setSearch] = useState("");
  const [subscriptionFilter, setSubscriptionFilter] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetchUsers();
  }, [page, subscriptionFilter]);

  const fetchUsers = async (searchQuery = search, isRefresh = false) => {
    if (isRefresh) {
      setRefreshing(true);
    } else if (users.length === 0) {
      setLoading(true);
    }
    setError(null);
    
    try {
      const token = localStorage.getItem(AUTH_CONSTANTS.TOKEN_KEY);
      const params = new URLSearchParams({
        page: page.toString(),
        per_page: "20",
      });

      if (searchQuery) params.append("search", searchQuery);
      if (subscriptionFilter) params.append("subscription", subscriptionFilter);

      const response = await fetch(`${BASE_URL}/admin/users?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        throw new Error("Failed to fetch users");
      }

      const data = await response.json();
      setUsers(data.users);
      setPagination(data.pagination);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleSearch = (e) => {
    e.preventDefault();
    setPage(1);
    fetchUsers(search);
  };

  const handleRoleChange = async (userId, newRole) => {
    try {
      const token = localStorage.getItem(AUTH_CONSTANTS.TOKEN_KEY);
      const response = await fetch(`${BASE_URL}/admin/users/${userId}/role`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ role: newRole }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to update role");
      }

      // Refresh user list
      fetchUsers();
    } catch (err) {
      alert(err.message);
    }
  };

  // Generate page numbers with ellipsis for large page counts
  const generatePageNumbers = () => {
    const totalPages = pagination.pages || 1;
    const currentPage = page;
    const pages = [];
    
    if (totalPages <= 7) {
      // Show all pages if 7 or fewer
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);
      
      if (currentPage > 3) {
        pages.push('...');
      }
      
      // Show pages around current page
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      
      for (let i = start; i <= end; i++) {
        if (!pages.includes(i)) {
          pages.push(i);
        }
      }
      
      if (currentPage < totalPages - 2) {
        pages.push('...');
      }
      
      // Always show last page
      if (!pages.includes(totalPages)) {
        pages.push(totalPages);
      }
    }
    
    return pages;
  };

  if (loading && users.length === 0) {
    return (
      <div style={styles.loadingContainer}>
        <div style={styles.spinner}></div>
        <p>Loading users...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.errorContainer}>
        <p style={styles.errorText}>{error}</p>
        <button onClick={() => fetchUsers()} style={styles.retryBtn}>Retry</button>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>User Management</h1>
          <p style={styles.subtitle}>
            {pagination.total || 0} total users
          </p>
        </div>
      </div>

      {/* Filters */}
      <div style={styles.filtersRow}>
        <form onSubmit={handleSearch} style={styles.searchForm}>
          <input
            type="text"
            placeholder="Search by email or name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={styles.searchInput}
          />
          <button type="submit" style={styles.searchBtn}>Search</button>
        </form>

        <select
          value={subscriptionFilter}
          onChange={(e) => {
            setSubscriptionFilter(e.target.value);
            setPage(1);
          }}
          style={styles.select}
        >
          <option value="">All Subscriptions</option>
          <option value="free">Free</option>
          <option value="premium">Premium</option>
        </select>

        <button 
          onClick={() => fetchUsers(search, true)} 
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

      {/* Users Table */}
      <div style={styles.tableCard}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={styles.th}>User</th>
              <th style={styles.th}>Role</th>
              <th style={styles.th}>Subscription</th>
              <th style={styles.th}>Usage</th>
              <th style={styles.th}>Joined</th>
              <th style={styles.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user) => (
              <tr key={user.id}>
                <td style={styles.td}>
                  <div style={styles.userCell}>
                    <div style={styles.userAvatar}>
                      {user.name?.charAt(0).toUpperCase() || "U"}
                    </div>
                    <div>
                      <div style={styles.userName}>{user.name}</div>
                      <div style={styles.userEmail}>{user.email}</div>
                    </div>
                  </div>
                </td>
                <td style={styles.td}>
                  <span style={{
                    ...styles.roleBadge,
                    backgroundColor: user.role === "admin" 
                      ? "rgba(139, 92, 246, 0.2)" 
                      : "rgba(148, 163, 184, 0.2)",
                    color: user.role === "admin" ? "#a78bfa" : "#94a3b8",
                  }}>
                    {user.role || "user"}
                  </span>
                </td>
                <td style={styles.td}>
                  <span style={{
                    ...styles.subscriptionBadge,
                    backgroundColor: user.subscription_type === "premium" 
                      ? "rgba(251, 191, 36, 0.2)" 
                      : "rgba(148, 163, 184, 0.2)",
                    color: user.subscription_type === "premium" ? "#fbbf24" : "#94a3b8",
                  }}>
                    {user.subscription_type}
                    {user.subscription_expires_at && (
                      <span style={styles.expiryDate}>
                        (expires {new Date(user.subscription_expires_at).toLocaleDateString()})
                      </span>
                    )}
                  </span>
                </td>
                <td style={styles.td}>
                  <span style={styles.usageCount}>{user.usage_count} actions</span>
                </td>
                <td style={styles.td}>
                  {user.created_at 
                    ? new Date(user.created_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : "N/A"}
                </td>
                <td style={styles.td}>
                  <select
                    value={user.role || "user"}
                    onChange={(e) => handleRoleChange(user.id, e.target.value)}
                    style={styles.roleSelect}
                  >
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {users.length === 0 && (
          <div style={styles.noData}>
            <p>No users found matching your criteria</p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {pagination.total > 0 && (
        <div style={styles.paginationContainer}>
          <div style={styles.paginationInfo}>
            Showing {((page - 1) * 20) + 1} - {Math.min(page * 20, pagination.total)} of {pagination.total} users
          </div>
          
          <div style={styles.pagination}>
            {/* First Page */}
            <button
              onClick={() => setPage(1)}
              disabled={page === 1}
              style={{
                ...styles.pageBtn,
                opacity: page === 1 ? 0.5 : 1,
                cursor: page === 1 ? "not-allowed" : "pointer",
              }}
              title="First page"
            >
              &laquo;
            </button>

            {/* Previous Page */}
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              style={{
                ...styles.pageBtn,
                opacity: page === 1 ? 0.5 : 1,
                cursor: page === 1 ? "not-allowed" : "pointer",
              }}
            >
              Previous
            </button>

            {/* Page Numbers */}
            <div style={styles.pageNumbers}>
              {generatePageNumbers().map((pageNum, idx) => (
                pageNum === '...' ? (
                  <span key={`ellipsis-${idx}`} style={styles.ellipsis}>...</span>
                ) : (
                  <button
                    key={pageNum}
                    onClick={() => setPage(pageNum)}
                    style={{
                      ...styles.pageNumBtn,
                      ...(page === pageNum ? styles.pageNumBtnActive : {}),
                    }}
                  >
                    {pageNum}
                  </button>
                )
              ))}
            </div>

            {/* Next Page */}
            <button
              onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
              disabled={page === pagination.pages || pagination.pages === 0}
              style={{
                ...styles.pageBtn,
                opacity: page === pagination.pages || pagination.pages === 0 ? 0.5 : 1,
                cursor: page === pagination.pages || pagination.pages === 0 ? "not-allowed" : "pointer",
              }}
            >
              Next
            </button>

            {/* Last Page */}
            <button
              onClick={() => setPage(pagination.pages)}
              disabled={page === pagination.pages || pagination.pages === 0}
              style={{
                ...styles.pageBtn,
                opacity: page === pagination.pages || pagination.pages === 0 ? 0.5 : 1,
                cursor: page === pagination.pages || pagination.pages === 0 ? "not-allowed" : "pointer",
              }}
              title="Last page"
            >
              &raquo;
            </button>
          </div>

          {/* Go to page */}
          <div style={styles.goToPage}>
            <span style={styles.goToLabel}>Go to:</span>
            <input
              type="number"
              min="1"
              max={pagination.pages || 1}
              value={page}
              onChange={(e) => {
                const val = parseInt(e.target.value);
                if (val >= 1 && val <= pagination.pages) {
                  setPage(val);
                }
              }}
              style={styles.goToInput}
            />
          </div>
        </div>
      )}
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
    marginBottom: "32px",
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
  filtersRow: {
    display: "flex",
    gap: "16px",
    marginBottom: "24px",
    flexWrap: "wrap",
  },
  searchForm: {
    display: "flex",
    gap: "8px",
    flex: "1",
    minWidth: "300px",
  },
  searchInput: {
    flex: "1",
    padding: "10px 16px",
    backgroundColor: "#1e293b",
    color: "#e2e8f0",
    border: "1px solid rgba(148, 163, 184, 0.2)",
    borderRadius: "8px",
    fontSize: "14px",
  },
  searchBtn: {
    padding: "10px 20px",
    backgroundColor: "#38bdf8",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    cursor: "pointer",
    fontSize: "14px",
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
  tableCard: {
    backgroundColor: "#1e293b",
    borderRadius: "12px",
    border: "1px solid rgba(148, 163, 184, 0.1)",
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
    fontSize: "12px",
    fontWeight: "600",
    textTransform: "uppercase",
    borderBottom: "1px solid rgba(148, 163, 184, 0.1)",
  },
  td: {
    padding: "16px",
    color: "#e2e8f0",
    fontSize: "14px",
    borderBottom: "1px solid rgba(148, 163, 184, 0.05)",
  },
  userCell: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  userAvatar: {
    width: "40px",
    height: "40px",
    borderRadius: "50%",
    backgroundColor: "rgba(56, 189, 248, 0.2)",
    color: "#38bdf8",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: "600",
    fontSize: "16px",
  },
  userName: {
    color: "#e2e8f0",
    fontSize: "14px",
    fontWeight: "500",
  },
  userEmail: {
    color: "#64748b",
    fontSize: "12px",
  },
  roleBadge: {
    padding: "4px 12px",
    borderRadius: "20px",
    fontSize: "12px",
    fontWeight: "500",
    textTransform: "capitalize",
  },
  subscriptionBadge: {
    padding: "4px 12px",
    borderRadius: "20px",
    fontSize: "12px",
    fontWeight: "500",
    textTransform: "capitalize",
  },
  expiryDate: {
    marginLeft: "4px",
    fontSize: "10px",
    opacity: 0.7,
  },
  usageCount: {
    color: "#94a3b8",
    fontSize: "13px",
  },
  roleSelect: {
    padding: "6px 12px",
    backgroundColor: "rgba(148, 163, 184, 0.1)",
    color: "#e2e8f0",
    border: "1px solid rgba(148, 163, 184, 0.2)",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "13px",
  },
  noData: {
    padding: "40px",
    textAlign: "center",
    color: "#64748b",
  },
  paginationContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "16px",
    marginTop: "24px",
    padding: "20px",
    backgroundColor: "#1e293b",
    borderRadius: "12px",
    border: "1px solid rgba(148, 163, 184, 0.1)",
  },
  paginationInfo: {
    color: "#94a3b8",
    fontSize: "13px",
  },
  pagination: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap",
  },
  pageBtn: {
    padding: "8px 16px",
    backgroundColor: "rgba(148, 163, 184, 0.1)",
    color: "#e2e8f0",
    border: "1px solid rgba(148, 163, 184, 0.2)",
    borderRadius: "6px",
    fontSize: "13px",
    transition: "all 0.2s ease",
  },
  pageNumbers: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
  },
  pageNumBtn: {
    width: "36px",
    height: "36px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "transparent",
    color: "#94a3b8",
    border: "1px solid rgba(148, 163, 184, 0.2)",
    borderRadius: "6px",
    fontSize: "13px",
    cursor: "pointer",
    transition: "all 0.2s ease",
  },
  pageNumBtnActive: {
    backgroundColor: "#38bdf8",
    color: "#0f172a",
    borderColor: "#38bdf8",
    fontWeight: "600",
  },
  ellipsis: {
    color: "#64748b",
    padding: "0 8px",
  },
  goToPage: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  goToLabel: {
    color: "#94a3b8",
    fontSize: "13px",
  },
  goToInput: {
    width: "60px",
    padding: "6px 10px",
    backgroundColor: "rgba(148, 163, 184, 0.1)",
    color: "#e2e8f0",
    border: "1px solid rgba(148, 163, 184, 0.2)",
    borderRadius: "6px",
    fontSize: "13px",
    textAlign: "center",
  },
  pageInfo: {
    color: "#94a3b8",
    fontSize: "14px",
  },
};

export default UsersManagement;
