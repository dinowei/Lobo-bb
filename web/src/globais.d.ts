// constantes do build (web/vite.config.ts)
declare const __VERSAO__: string;

interface ImportMetaEnv {
  readonly VITE_API_URL?: string;
  // "1" no build da Vercel: há servidor (Render) atrás do rewrite; demora = servidor acordando, nunca modo demo
  readonly VITE_SERVIDOR_REMOTO?: string;
}
