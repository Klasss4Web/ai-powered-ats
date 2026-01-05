import "./AnimatedLoader.css";

const AnimatedLoader = ({
  text = "Verifying you are not a bot",
  showText = true,
  helperText = "",
  showSpinner = true,
}) => {
  return (
    <div className="recaptcha-loader-container slide-in-right">
      {showSpinner && <div className="spinner" />}
      {helperText && <small>{helperText}</small>}
      <p className="verifying-text">
        {showText && text} <br />
        <span className="dots">
          <span>.</span>
          <span>.</span>
          <span>.</span>
        </span>
      </p>
    </div>
  );
};

export default AnimatedLoader;
