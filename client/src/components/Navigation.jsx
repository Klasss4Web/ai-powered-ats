import { NavLink } from "react-router-dom";

const Navigation = () => {
  const activeClass = ({ isActive }) =>
    isActive ? "nav-link active" : "nav-link";

  return (
    <nav className="nav-shell">
      <div className="nav-brand">ATS Matcher</div>
      <div className="nav-links">
        <NavLink to="/" end className={activeClass}>
          Home
        </NavLink>
        <NavLink to="/matcher" className={activeClass}>
          Matcher
        </NavLink>
        {/* <NavLink to="/recruiters" className={activeClass}>
          Recruiters
        </NavLink> */}
        <NavLink to="/dashboard" className={activeClass}>
          Dashboard
        </NavLink>
        <NavLink
          to="/subscribe"
          className={({ isActive }) =>
            isActive ? "nav-link active nav-primary" : "nav-link nav-primary"
          }
        >
          Subscribe
        </NavLink>
      </div>
    </nav>
  );
};

export default Navigation;
