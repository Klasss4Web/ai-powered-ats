import "./App.css";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import ATSMatcher from "./pages/ATSMatcher";
// import VerifyPaymentPage from "./pages/VerifyPaymentPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import ToastContainer from "./components/ToastContainer";

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<ATSMatcher />} />
        {/* <Route path="/verify-payment" element={<VerifyPaymentPage />} /> */}
        <Route path="/reset-password" element={<ResetPasswordPage />} />
      </Routes>
      <ToastContainer />
    </Router>
  );
}

export default App;
