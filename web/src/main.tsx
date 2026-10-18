import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./estilos.css";
import { Provedor } from "./estado";
import { App } from "./App";

// PWA: instalável e abre sem internet (só no site publicado; o demo em arquivo único não usa)
if (import.meta.env.PROD && import.meta.env.MODE !== "demo" && "serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("/sw.js").catch(() => undefined));
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Provedor>
      <App />
    </Provedor>
  </StrictMode>
);
