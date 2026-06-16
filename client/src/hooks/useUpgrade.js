import { useCallback } from "react";
import { AUTH_CONSTANTS, BASE_URL } from "../constants/auth_constants";

export const useUpgrade = ({ showAlert }) => {
  const handleUpgrade = useCallback(
    async (planType = "monthly", gateway = "paystack") => {
      const token = localStorage.getItem(AUTH_CONSTANTS.TOKEN_KEY);
      if (!token) {
        showAlert("Please log in to upgrade your subscription.", "error");
        return;
      }

      showAlert("Initializing upgrade...", "info");

      try {
        const upgradeResponse = await fetch(
          `${BASE_URL}/subscription/upgrade`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ plan_type: planType, gateway }),
          },
        );

        if (!upgradeResponse.ok) {
          const err = await upgradeResponse.json();
          showAlert(err.error || "Failed to initialize upgrade", "error");
          return;
        }

        const upgradeData = await upgradeResponse.json();

        if (upgradeData?.data?.authorization_url) {
          window.location.href = upgradeData.data.authorization_url;
        } else if (upgradeData?.data?.links) {
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
    },
    [showAlert],
  );

  return { handleUpgrade };
};
