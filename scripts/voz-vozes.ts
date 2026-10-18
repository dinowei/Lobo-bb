// Lista as vozes do Magpie TTS (NVIDIA, API hospedada) e mostra as de pt-BR. Não imprime chave.
// uso: npx tsx scripts/voz-vozes.ts
import "../src/env.js";

const chave = process.env.NVIDIA_TTS_API_KEY || process.env.GERADOR_API_KEY;
const funcao = process.env.NVIDIA_TTS_FUNCTION_ID;
if (!chave || !funcao) throw new Error("Faltou NVIDIA_TTS_API_KEY (ou GERADOR_API_KEY) ou NVIDIA_TTS_FUNCTION_ID no .env");
const r = await fetch(`https://${funcao}.invocation.api.nvcf.nvidia.com/v1/audio/list_voices`, { headers: { Authorization: `Bearer ${chave}`, Accept: "application/json" } });
console.log("HTTP", r.status, r.headers.get("content-type"));
const texto = await r.text();
try {
  const json = JSON.parse(texto) as Record<string, { voices?: string[] }> | { voices?: unknown };
  const todas = JSON.stringify(json).match(/"[^"]*PT-BR[^"]*"/gi) ?? [];
  console.log(`vozes pt-BR (${new Set(todas).size}):`, [...new Set(todas)].join(", ") || "(nenhuma)");
  console.log("idiomas:", Object.keys(json).slice(0, 20).join(", "));
} catch {
  console.log(texto.slice(0, 400));
}
