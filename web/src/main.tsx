import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./estilos.css";
import { Provedor } from "./estado";
import { App } from "./App";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Provedor>
      <App />
    </Provedor>
  </StrictMode>
);
