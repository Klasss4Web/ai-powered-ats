import { useState } from "react";
import { AUTH_CONSTANTS, BASE_URL } from "../constants/auth_constants";
import fetchWithTimeout from "../configs/fetch";

/* ─── tiny helpers ─────────────────────────────────────────────────────── */

const PLANS = {
  premium: {
    label: "Premium",
    badge: "Most Popular",
    badgeColor: "#1a73e8",
    accent: "#1a73e8",
    accentLight: "#e8f0fe",
    monthly: { paystack: "₦15,000", paypal: "$15", planKey: "monthly" },
    yearly: {
      paystack: "₦180,000",
      paypal: "$180",
      planKey: "yearly",
      saving: "Save 17%",
    },
    features: [
      "10 AI analyses per day",
      "Batch resume matching",
      "Advanced CV optimisation",
      "Cover letter generator",
      "Interview prep tools",
      "Save up to 3 resumes",
      "Priority support",
    ],
  },
  pro: {
    label: "Pro",
    badge: "For Teams",
    badgeColor: "#7c3aed",
    accent: "#7c3aed",
    accentLight: "#f3f0ff",
    monthly: { paystack: "₦100,000", paypal: "$60", planKey: "pro_monthly" },
    yearly: {
      paystack: "₦1,000,000",
      paypal: "$600",
      planKey: "pro_yearly",
      saving: "Save 17%",
    },
    features: [
      "100 AI analyses per day",
      "Unlimited recruiter sessions",
      "Batch match up to 10 resumes",
      "Candidate email outreach",
      "Full recruiter analytics",
      "Save up to 10 resumes",
      "Dedicated support",
    ],
  },
};

const CheckIcon = ({ color }) => (
  <svg
    width="15"
    height="15"
    viewBox="0 0 15 15"
    fill="none"
    style={{ flexShrink: 0, marginTop: "1px" }}
  >
    <circle cx="7.5" cy="7.5" r="7.5" fill={color} fillOpacity="0.15" />
    <path
      d="M4.5 7.5l2 2 4-4"
      stroke={color}
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

/* ─── main component ───────────────────────────────────────────────────── */

const UpgradeModal = ({
  isOpen,
  onClose,
  modalData,
  onPayAsYouGo,
  onUpgradeToPremium,
}) => {
  const [loadingPayment, setLoadingPayment] = useState(false);
  const [selectedGateway, setSelectedGateway] = useState("paystack");

  const [manualReference, setManualReference] = useState("");
  const [manualGateway, setManualGateway] = useState("paystack");
  const [loadingManual, setLoadingManual] = useState(false);

  const [billingCycle, setBillingCycle] = useState("monthly"); // shared toggle
  const [subGateway, setSubGateway] = useState("paystack"); // shared gateway

  const [loadingPlan, setLoadingPlan] = useState(null); // "premium" | "pro" | null

  if (!isOpen || !modalData) return null;

  const { subscriptionType, currentUsage, dailyLimit, isExpired, message } =
    modalData;

  /* ── handlers ── */

  const handlePayAsYouGo = async () => {
    setLoadingPayment(true);
    try {
      await onPayAsYouGo(selectedGateway);
      onClose();
    } catch (err) {
      console.error("Payment failed:", err);
    } finally {
      setLoadingPayment(false);
    }
  };

  const handleSubscribe = async (tier) => {
    setLoadingPlan(tier);
    const plan = PLANS[tier];
    const planKey = plan[billingCycle].planKey;
    try {
      await onUpgradeToPremium(planKey, subGateway);
      onClose();
    } catch (err) {
      console.error(`${tier} upgrade failed:`, err);
    } finally {
      setLoadingPlan(null);
    }
  };

  const handleManualVerify = async () => {
    if (!manualReference.trim()) return;
    setLoadingManual(true);
    try {
      const response = await fetchWithTimeout(
        `/payment/manual-verify/${manualReference}`,
        {
          method: "POST",
          body: JSON.stringify({ gateway: manualGateway }),
        },
      );
      if (response.ok) {
        if (window.showToast) {
          window.showToast(
            "Payment verified successfully! Your usage limit has been updated.",
            "success",
          );
        }
        setManualReference("");
        window.location.reload();
      } else {
        const err = await response.json().catch(() => ({}));
        if (window.showToast) {
          window.showToast(
            `Verification failed: ${err.error || "Unknown error"}`,
            "error",
          );
        }
      }
    } catch (err) {
      console.error("Manual verification error:", err);
      if (window.showToast) {
        window.showToast(
          "Verification failed. Check your connection and try again.",
          "error",
        );
      }
    } finally {
      setLoadingManual(false);
    }
  };

  const getMessage = () => {
    if (message) return message;
    if (isExpired)
      return "Your subscription has expired. Renew or pick a new plan below.";
    if (subscriptionType === "free")
      return "You've reached your free daily limit. Upgrade to keep going.";
    return `You've used all ${dailyLimit} analyses for today. Upgrade for more.`;
  };

  /* ── price display helpers ── */
  const price = (tier) =>
    subGateway === "paypal"
      ? PLANS[tier][billingCycle].paypal
      : PLANS[tier][billingCycle].paystack;

  const saving = (tier) => PLANS[tier][billingCycle].saving;

  /* ── styles ── */
  const s = {
    overlay: {
      position: "fixed",
      inset: 0,
      backgroundColor: "rgba(10,10,20,0.65)",
      backdropFilter: "blur(4px)",
      display: "flex",
      justifyContent: "center",
      alignItems: "center",
      zIndex: 1000,
      padding: "16px",
    },
    sheet: {
      backgroundColor: "#fff",
      borderRadius: "20px",
      boxShadow: "0 24px 64px rgba(0,0,0,0.22)",
      width: "100%",
      maxWidth: "760px",
      maxHeight: "96vh",
      overflowY: "auto",
      position: "relative",
    },
    header: {
      background: "linear-gradient(135deg, #1a73e8 0%, #7c3aed 100%)",
      borderRadius: "20px 20px 0 0",
      padding: "28px 32px 24px",
      color: "#fff",
      textAlign: "center",
      position: "relative",
    },
    closeBtn: {
      position: "absolute",
      top: "14px",
      right: "14px",
      background: "rgba(255,255,255,0.18)",
      border: "none",
      color: "#fff",
      width: "32px",
      height: "32px",
      borderRadius: "50%",
      cursor: "pointer",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      fontSize: "18px",
      lineHeight: 1,
      transition: "background 0.2s",
    },
    body: { padding: "24px 28px 28px" },
    sectionLabel: {
      fontSize: "11px",
      fontWeight: "700",
      letterSpacing: "0.08em",
      textTransform: "uppercase",
      color: "#94a3b8",
      marginBottom: "10px",
    },
    divider: {
      border: "none",
      borderTop: "1px solid #f0f0f5",
      margin: "22px 0",
    },
    pill: (active, color) => ({
      flex: 1,
      padding: "8px 0",
      border: "none",
      borderRadius: "8px",
      fontSize: "13px",
      fontWeight: "600",
      cursor: "pointer",
      transition: "all 0.2s",
      background: active ? color : "transparent",
      color: active ? "#fff" : "#64748b",
    }),
    pillWrap: (color) => ({
      display: "flex",
      gap: "4px",
      background: "#f1f5f9",
      borderRadius: "10px",
      padding: "4px",
    }),
  };

  return (
    <div
      style={s.overlay}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div style={s.sheet}>
        {/* ── gradient header ── */}
        <div style={s.header}>
          <button
            style={s.closeBtn}
            onClick={onClose}
            onMouseEnter={(e) =>
              (e.currentTarget.style.background = "rgba(255,255,255,0.30)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.background = "rgba(255,255,255,0.18)")
            }
          >
            ×
          </button>
          <div style={{ fontSize: "36px", marginBottom: "8px", lineHeight: 1 }}>
            ✦
          </div>
          <h2
            style={{ margin: "0 0 6px", fontSize: "22px", fontWeight: "700" }}
          >
            Unlock More Power
          </h2>
          <p
            style={{
              margin: 0,
              opacity: 0.88,
              fontSize: "14px",
              lineHeight: "1.5",
            }}
          >
            {getMessage()}
          </p>
        </div>

        <div style={s.body}>
          {/* ── Pay as You Go ── */}
          {onPayAsYouGo && (
            <>
              <p style={s.sectionLabel}>Quick option</p>
              <div
                style={{
                  border: "1.5px solid #e2e8f0",
                  borderRadius: "14px",
                  padding: "18px 20px",
                  backgroundColor: "#fafbff",
                  display: "flex",
                  alignItems: "center",
                  gap: "16px",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ flex: 1, minWidth: "160px" }}>
                  <div
                    style={{
                      fontWeight: "700",
                      color: "#1e293b",
                      fontSize: "15px",
                      marginBottom: "2px",
                    }}
                  >
                    Pay as You Go
                  </div>
                  <div style={{ fontSize: "13px", color: "#64748b" }}>
                    Single analysis &nbsp;·&nbsp;
                    <strong style={{ color: "#1a73e8" }}>
                      {selectedGateway === "paypal" ? "$2" : "₦2,000"}
                    </strong>
                  </div>
                </div>

                {/* gateway toggle */}
                <div style={{ display: "flex", gap: "6px" }}>
                  {["paystack", "paypal"].map((gw) => (
                    <button
                      key={gw}
                      onClick={() => setSelectedGateway(gw)}
                      style={{
                        padding: "6px 12px",
                        borderRadius: "8px",
                        fontSize: "13px",
                        cursor: "pointer",
                        fontWeight: "500",
                        transition: "all 0.15s",
                        border:
                          selectedGateway === gw
                            ? "1.5px solid #1a73e8"
                            : "1.5px solid #e2e8f0",
                        background: selectedGateway === gw ? "#e8f0fe" : "#fff",
                        color: selectedGateway === gw ? "#1a73e8" : "#64748b",
                      }}
                    >
                      {gw === "paystack" ? "Paystack (₦)" : "PayPal ($)"}
                    </button>
                  ))}
                </div>

                <button
                  onClick={handlePayAsYouGo}
                  disabled={loadingPayment}
                  style={{
                    padding: "9px 20px",
                    borderRadius: "9px",
                    border: "none",
                    background: loadingPayment ? "#94a3b8" : "#1a73e8",
                    color: "#fff",
                    fontWeight: "600",
                    fontSize: "14px",
                    cursor: loadingPayment ? "not-allowed" : "pointer",
                    whiteSpace: "nowrap",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    transition: "background 0.2s",
                  }}
                >
                  {loadingPayment
                    ? "Processing..."
                    : `Pay ${selectedGateway === "paypal" ? "$2" : "₦2,000"} & Continue`}
                </button>
              </div>

              <hr style={s.divider} />
            </>
          )}

          {/* ── Subscription Plans ── */}
          <>
            <p style={s.sectionLabel}>Subscription plans</p>

            {/* shared billing toggle + gateway row */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "12px",
                marginBottom: "16px",
                flexWrap: "wrap",
              }}
            >
              {/* billing cycle */}
              <div style={{ ...s.pillWrap(), flex: "1 0 auto" }}>
                {["monthly", "yearly"].map((cycle) => (
                  <button
                    key={cycle}
                    style={s.pill(billingCycle === cycle, "#1a73e8")}
                    onClick={() => setBillingCycle(cycle)}
                  >
                    {cycle.charAt(0).toUpperCase() + cycle.slice(1)}
                    {cycle === "yearly" && (
                      <span
                        style={{
                          marginLeft: "5px",
                          fontSize: "10px",
                          fontWeight: "700",
                          background: "#fef9c3",
                          color: "#854d0e",
                          padding: "1px 5px",
                          borderRadius: "4px",
                        }}
                      >
                        -17%
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* payment gateway */}
              <div style={{ ...s.pillWrap(), flex: "1 0 auto" }}>
                {["paystack", "paypal"].map((gw) => (
                  <button
                    key={gw}
                    style={s.pill(subGateway === gw, "#7c3aed")}
                    onClick={() => setSubGateway(gw)}
                  >
                    {gw === "paystack" ? "Paystack (₦)" : "PayPal ($)"}
                  </button>
                ))}
              </div>
            </div>

            {/* plan cards */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                gap: "14px",
                marginBottom: "4px",
              }}
            >
              {["premium", "pro"].map((tier) => {
                const plan = PLANS[tier];
                const isLoading = loadingPlan === tier;
                const isCurrent = subscriptionType === tier;
                return (
                  <div
                    key={tier}
                    style={{
                      border: `2px solid ${plan.accent}`,
                      borderRadius: "14px",
                      padding: "20px",
                      background: plan.accentLight,
                      display: "flex",
                      flexDirection: "column",
                      position: "relative",
                      overflow: "hidden",
                    }}
                  >
                    {/* top badge */}
                    <div
                      style={{
                        position: "absolute",
                        top: "0",
                        right: "0",
                        background: plan.accent,
                        color: "#fff",
                        fontSize: "10px",
                        fontWeight: "700",
                        padding: "4px 12px",
                        borderRadius: "0 14px 0 10px",
                        letterSpacing: "0.05em",
                      }}
                    >
                      {plan.badge}
                    </div>

                    <div style={{ marginBottom: "14px" }}>
                      <div
                        style={{
                          fontSize: "16px",
                          fontWeight: "800",
                          color: plan.accent,
                          marginBottom: "4px",
                        }}
                      >
                        {plan.label}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "baseline",
                          gap: "4px",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "26px",
                            fontWeight: "800",
                            color: "#1e293b",
                          }}
                        >
                          {price(tier)}
                        </span>
                        <span style={{ fontSize: "13px", color: "#64748b" }}>
                          /{billingCycle === "monthly" ? "mo" : "yr"}
                        </span>
                      </div>
                      {billingCycle === "yearly" && (
                        <div
                          style={{
                            display: "inline-block",
                            marginTop: "4px",
                            background: "#fef9c3",
                            color: "#854d0e",
                            fontSize: "11px",
                            fontWeight: "700",
                            padding: "2px 8px",
                            borderRadius: "5px",
                          }}
                        >
                          Save 17% vs monthly
                        </div>
                      )}
                    </div>

                    {/* feature list */}
                    <ul
                      style={{
                        listStyle: "none",
                        margin: "0 0 18px",
                        padding: 0,
                        display: "flex",
                        flexDirection: "column",
                        gap: "7px",
                        flex: 1,
                      }}
                    >
                      {plan.features.map((f) => (
                        <li
                          key={f}
                          style={{
                            display: "flex",
                            alignItems: "flex-start",
                            gap: "8px",
                            fontSize: "13px",
                            color: "#374151",
                          }}
                        >
                          <CheckIcon color={plan.accent} />
                          {f}
                        </li>
                      ))}
                    </ul>

                    <button
                      onClick={() => handleSubscribe(tier)}
                      disabled={isLoading || isCurrent}
                      style={{
                        width: "100%",
                        padding: "11px",
                        border: "none",
                        borderRadius: "9px",
                        fontWeight: "700",
                        fontSize: "14px",
                        cursor:
                          isLoading || isCurrent ? "not-allowed" : "pointer",
                        background: isCurrent
                          ? "#e2e8f0"
                          : isLoading
                            ? "#94a3b8"
                            : plan.accent,
                        color: isCurrent ? "#64748b" : "#fff",
                        transition: "all 0.2s",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "6px",
                      }}
                    >
                      {isCurrent
                        ? "Current plan"
                        : isLoading
                          ? "Redirecting..."
                          : `Upgrade to ${plan.label} — ${price(tier)}`}
                    </button>
                  </div>
                );
              })}
            </div>

            <hr style={s.divider} />
          </>

          {/* ── Manual Payment Verification ── */}
          <p style={s.sectionLabel}>Already paid? Verify manually</p>
          <div
            style={{
              border: "1.5px solid #e2e8f0",
              borderRadius: "12px",
              padding: "16px 18px",
              background: "#fafbff",
            }}
          >
            <p
              style={{ margin: "0 0 10px", fontSize: "13px", color: "#64748b" }}
            >
              If automatic verification failed, enter your payment reference
              below:
            </p>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <input
                type="text"
                placeholder="Payment reference"
                value={manualReference}
                onChange={(e) => setManualReference(e.target.value)}
                style={{
                  flex: 1,
                  minWidth: "160px",
                  padding: "9px 12px",
                  border: "1.5px solid #e2e8f0",
                  borderRadius: "8px",
                  fontSize: "13px",
                  outline: "none",
                }}
              />
              <select
                value={manualGateway}
                onChange={(e) => setManualGateway(e.target.value)}
                style={{
                  padding: "9px 10px",
                  border: "1.5px solid #e2e8f0",
                  borderRadius: "8px",
                  fontSize: "13px",
                  cursor: "pointer",
                  background: "#fff",
                }}
              >
                <option value="paystack">Paystack</option>
                <option value="paypal">PayPal</option>
              </select>
              <button
                onClick={handleManualVerify}
                disabled={loadingManual || !manualReference.trim()}
                style={{
                  padding: "9px 18px",
                  border: "none",
                  borderRadius: "8px",
                  background:
                    loadingManual || !manualReference.trim()
                      ? "#94a3b8"
                      : "#1e293b",
                  color: "#fff",
                  fontSize: "13px",
                  fontWeight: "600",
                  cursor:
                    loadingManual || !manualReference.trim()
                      ? "not-allowed"
                      : "pointer",
                  whiteSpace: "nowrap",
                  transition: "background 0.2s",
                }}
              >
                {loadingManual ? "Verifying..." : "Verify Payment"}
              </button>
            </div>
          </div>

          {/* ── footer note ── */}
          <p
            style={{
              textAlign: "center",
              fontSize: "11px",
              color: "#94a3b8",
              marginTop: "18px",
              marginBottom: "0",
            }}
          >
            Secure payment processing &nbsp;·&nbsp; Instant access after payment
            &nbsp;·&nbsp; Cancel anytime
          </p>
        </div>
      </div>
    </div>
  );
};

export default UpgradeModal;
