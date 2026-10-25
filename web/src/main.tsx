import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./estilos.css";
import { Provedor } from "./estado";
import { App } from "./App";

// fonte Inter: carregada sem bloquear a primeira pintura (index.html começa com media="print")
const fonte = document.getElementById("fonte-inter") as HTMLLinkElement | null;
if (fonte) fonte.media = "all";

// PWA: instalável e abre sem internet (só no site publicado; o demo em arquivo único não usa)
if (import.meta.env.PROD && import.meta.env.MODE !== "demo" && "serviceWorker" in navigator) {
  // a versão do build vai na URL: o service worker usa um cache por versão e apaga os antigos (E12)
  window.addEventListener("load", () => navigator.serviceWorker.register(`/sw.js?v=${__VERSAO__}`).catch(() => undefined));
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Provedor>
      <App />
    </Provedor>
  </StrictMode>
);
