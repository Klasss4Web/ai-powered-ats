import { useEffect } from "react";
import { useParams } from "react-router-dom";
import AnimatedLoader from "../components/loaders/animated-loader/AnimatedLoader";
import { AUTH_CONSTANTS } from "../constants/auth_constants";

const VerifyPaymentPage = () => {
  const params = useParams();
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
            `http://127.0.0.1:5000/api/payment/verify-paypal/${reference}`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            },
          );
        } else {
          response = await fetch(
            `http://127.0.0.1:5000/api/payment/verify/${reference}`,
            {
              headers: {
                Authorization: `Bearer ${token}`,
              },
            },
          );
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
    <div>
      <AnimatedLoader text="Verifying Payment" />
    </div>
  );
};

export default VerifyPaymentPage;
