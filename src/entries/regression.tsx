import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import RegressionExplorer from "../../regression";
import "../styles.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <main>
      <RegressionExplorer />
    </main>
  </StrictMode>,
);
