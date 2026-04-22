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

function App() {
  return (
    <Router>
      <div className="app-shell">
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
        <ToastContainer />
      </div>
    </Router>
  );
}

export default App;
