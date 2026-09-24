import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import NHSTExplainer from "../nhst";
import "./styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <main>
      <NHSTExplainer />
    </main>
  </StrictMode>,
);
