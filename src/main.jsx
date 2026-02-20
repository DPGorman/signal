import React from "react";
import ReactDOM from "react-dom/client";
import SignalDashboard from "./app.jsx";
ReactDOM.createRoot(document.getElementById("root")).render(
  <SignalDashboard />
);
import SignalDashboard from "./app.jsx";
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <SignalDashboard />
  </React.StrictMode>
);
