import { useState } from "react";
import reactLogo from "./assets/react.svg";
import viteLogo from "/vite.svg";
import "./App.css";
import ATSMatcher from "./pages/ATSMatcher";

function App() {
  const [count, setCount] = useState(0);

  return <ATSMatcher />;
}

export default App;
