import "./App.css";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import Navigation from "./components/Navigation";
import HomePage from "./pages/HomePage";
import ATSMatcher from "./pages/ATSMatcher";
import RecruitersView from "./pages/RecruitersView";
import DashboardPage from "./pages/DashboardPage";
import SubscriptionPage from "./pages/SubscriptionPage";
import VerifyPaymentPage from "./pages/VerifyPaymentPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import ToastContainer from "./components/ToastContainer";

// Admin pages
import {
  AdminLayout,
  AdminDashboard,
  TrafficAnalytics,
  TokenUsage,
  PerformanceAnalytics,
  UsersManagement,
  ActivityLog,
} from "./pages/admin";

function App() {
  return (
    <Router>
      <div className="app-shell">
        <Routes>
          {/* Admin Routes - No Navigation wrapper */}
          <Route path="/admin" element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="traffic" element={<TrafficAnalytics />} />
            <Route path="tokens" element={<TokenUsage />} />
            <Route path="performance" element={<PerformanceAnalytics />} />
            <Route path="users" element={<UsersManagement />} />
            <Route path="activity" element={<ActivityLog />} />
          </Route>

          {/* Public Routes - With Navigation */}
          <Route
            path="*"
            element={
              <>
                <Navigation />
                <Routes>
                  <Route path="/" element={<HomePage />} />
                  <Route path="/matcher" element={<ATSMatcher />} />
                  <Route path="/recruiters" element={<RecruitersView />} />
                  <Route path="/dashboard" element={<DashboardPage />} />
                  <Route path="/subscribe" element={<SubscriptionPage />} />
                  <Route path="/verify-payment" element={<VerifyPaymentPage />} />
                  <Route path="/reset-password" element={<ResetPasswordPage />} />
                </Routes>
              </>
            }
          />
        </Routes>
        <ToastContainer />
      </div>
    </Router>
  );
}

export default App;
