import { randomUUID } from "node:crypto";

const TIMEOUT_MS = 30_000;
const segredoRegex = [
  /nvapi-[a-z0-9_-]+/i,
  /mongodb(?:\+srv)?:\/\/[^\s"'<>]+/i,
  /\b(?:MONGODB_URI|[A-Z0-9_.-]*API_KEY)\s*=\s*[^\s"'<>]+/i,
  /\bBearer\s+[A-Za-z0-9._~+/-]+=*/i,
  /\b(?:ghp_|github_pat_|sk-)[A-Za-z0-9_-]{12,}/i,
  /\b(?:senha|password)\s*[:=]\s*["']?[^\s"'<>]{8,}/i,
];

function verificarSemSegredos(texto: string): boolean {
  return segredoRegex.every((regex) => !regex.test(texto));
}

function baseUrl(valor: string | undefined): URL {
  if (!valor) throw new Error("Uso: npx tsx scripts/smoke-prod.ts <url-base>");
  let url: URL;
  try { url = new URL(valor); } catch { throw new Error("URL inválida."); }
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
    throw new Error("Informe uma URL HTTP(S) sem credenciais, query ou fragmento.");
  }
  return new URL(url.origin + url.pathname.replace(/\/+$/, ""));
}

type Resposta = { status: number; bytes: Buffer; duracaoMs: number; semSegredos: boolean };
const resultados: { caminho: string; esperado: string; status: number | string; duracaoMs: number; ok: boolean }[] = [];

async function buscar(base: URL, caminho: string, esperado: (resposta: Resposta) => boolean, init?: RequestInit): Promise<Resposta | null> {
  const inicio = performance.now();
  let resposta: Resposta | null = null;
  let falha = "";
  try {
    const url = new URL(caminho, base);
    const r = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS), redirect: "follow" });
    const bytes = Buffer.from(await r.arrayBuffer());
    resposta = { status: r.status, bytes, duracaoMs: Math.round(performance.now() - inicio), semSegredos: verificarSemSegredos(bytes.toString("utf8")) };
  } catch (erro) {
    falha = erro instanceof Error && (erro.name === "TimeoutError" || erro.name === "AbortError") ? "timeout" : "rede";
  }
  const duracaoMs = resposta?.duracaoMs ?? Math.round(performance.now() - inicio);
  const ok = !!resposta && resposta.semSegredos && esperado(resposta);
  resultados.push({ caminho, esperado: "resposta válida sem segredo", status: resposta?.status ?? falha, duracaoMs, ok });
  console.log(`${ok ? "PASS" : "FAIL"} ${caminho} status=${resposta?.status ?? falha} ${duracaoMs}ms${resposta && !resposta.semSegredos ? " segredo-detectado" : ""}`);
  return resposta;
}

async function main() {
  const base = baseUrl(process.argv[2]);
  await buscar(base, "/api/saude", (r) => {
    if (r.status !== 200) return false;
    try { return (JSON.parse(r.bytes.toString("utf8")) as { ok?: unknown }).ok === true; } catch { return false; }
  });

  await buscar(base, "/", (r) => r.status === 200 && /<title>\s*Lobo Binho\s*<\/title>/i.test(r.bytes.toString("utf8")));
  await buscar(base, "/manifest", (r) => r.status === 200);

  const manifesto = await buscar(base, "/manifest.webmanifest", (r) => {
    if (r.status !== 200) return false;
    try {
      const valor = JSON.parse(r.bytes.toString("utf8")) as { icons?: unknown };
      return Array.isArray(valor.icons) && valor.icons.length > 0;
    } catch { return false; }
  });

  if (manifesto?.status === 200) {
    try {
      const dados = JSON.parse(manifesto.bytes.toString("utf8")) as { icons: { src?: unknown; sizes?: unknown }[] };
      const principais = dados.icons.filter((icone) => typeof icone.src === "string" && (icone.sizes === "192x192" || icone.sizes === "512x512"));
      if (!principais.some((i) => i.sizes === "192x192") || !principais.some((i) => i.sizes === "512x512")) {
        resultados.push({ caminho: "/manifest.webmanifest#icons", esperado: "ícones 192x192 e 512x512", status: manifesto.status, duracaoMs: 0, ok: false });
        console.log("FAIL /manifest.webmanifest#icons status=200 0ms configuração-incompleta");
      }
      for (const icone of principais) {
        const url = new URL(icone.src as string, base);
        if (url.origin !== base.origin || url.search || url.hash) {
          resultados.push({ caminho: "/manifest.webmanifest#icons", esperado: "ícone local", status: "URL externa", duracaoMs: 0, ok: false });
          console.log("FAIL /manifest.webmanifest#icons status=URL externa 0ms");
          continue;
        }
        await buscar(base, url.pathname, (r) => r.status === 200 && r.bytes.length > 0);
      }
    } catch {
      resultados.push({ caminho: "/manifest.webmanifest#icons", esperado: "manifesto válido", status: "JSON inválido", duracaoMs: 0, ok: false });
      console.log("FAIL /manifest.webmanifest#icons status=JSON inválido 0ms");
    }
  }

  const emailSintetico = `smoke-${randomUUID()}@example.invalid`;
  await buscar(base, "/api/auth/entrar", (r) => r.status === 401, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email: emailSintetico, senha: "credencial-sintetica-invalida" }),
  });

  const falhas = resultados.filter((r) => !r.ok).length;
  console.log(`Resumo: ${resultados.length - falhas}/${resultados.length} verificações passaram; ${falhas} falha(s).`);
  if (falhas) process.exitCode = 1;
}

main().catch((erro) => {
  console.error(erro instanceof Error ? erro.message : "Falha no smoke test.");
  process.exitCode = 1;
});
