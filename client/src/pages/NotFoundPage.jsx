import { Link } from "react-router-dom";
import "./NotFoundPage.css";

const NotFoundPage = () => {
  return (
    <div className="not-found-page">
      <div className="not-found-content">
        <h1 className="not-found-404">404</h1>
        <h2 className="not-found-title">Page Not Found</h2>
        <p className="not-found-subtitle">
          The page you are looking for does not exist or has been moved.
          <br />
          Let us get you back on track.
        </p>
        <div className="not-found-actions">
          <Link to="/" className="not-found-btn not-found-btn-primary">
            <span className="not-found-icon">←</span>
            Back to Home
          </Link>
          <Link to="/matcher" className="not-found-btn not-found-btn-secondary">
            <span className="not-found-icon">📝</span>
            Analyze Resume
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFoundPage;
