import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import NHSTExplainer from "../nhst";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <main className="app-shell">
      <header className="site-header">
        <p className="eyebrow">Interactive statistics</p>
        <h1>NHST Explorer</h1>
        <p>See how significance thresholds, effect size, and sample size shape a hypothesis test.</p>
      </header>
      <NHSTExplainer />
    </main>
  </StrictMode>,
);
