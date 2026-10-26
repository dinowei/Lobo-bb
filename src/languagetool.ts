// ============================================================
// LanguageTool local (decisão do dono, 26/10/2026): juiz DETERMINÍSTICO da esteira de Português.
// Roda só no PC (servidor open-source em ferramentas/, fora do Git), nunca serviço externo.
// Conta como família independente ("languagetool"). O veredito é puro e testável.
// ============================================================
import { spawn } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

export const urlLT = () => process.env.LANGUAGETOOL_URL ?? "http://localhost:8081";
export const FAMILIA_LT = "languagetool";

export type MatchLT = { regra: string; categoria: string; inicio: number; fim: number; mensagem: string };

// só o que é erro de língua conta; estilo e tipografia (aspas, travessão) não
const CATEGORIAS = new Set(["GRAMMAR", "TYPOS", "CONFUSED_WORDS", "CASING", "COLLOQUIALISMS", "REDUNDANCY"]);

const tempoLimite = () => Number(process.env.LANGUAGETOOL_TIMEOUT_MS) || 60_000;

export async function checarLT(texto: string, url = urlLT()): Promise<MatchLT[]> {
  const r = await fetch(`${url}/v2/check`, { method: "POST", body: new URLSearchParams({ text: texto, language: "pt-BR" }), signal: AbortSignal.timeout(tempoLimite()) });
  if (!r.ok) throw new Error(`LanguageTool respondeu ${r.status}`);
  const j = (await r.json()) as { matches: { rule: { id: string; category: { id: string } }; offset: number; length: number; message: string }[] };
  return j.matches.map((m) => ({ regra: m.rule.id, categoria: m.rule.category.id, inicio: m.offset, fim: m.offset + m.length, mensagem: m.message }));
}

// várias frases numa chamada só (uma por parágrafo): o custo do servidor é por pedido, não por frase.
// Os offsets voltam para cada frase; erro que atravessa duas frases não existe (parágrafos separados).
export function dividirMatches(frases: string[], matches: MatchLT[]): MatchLT[][] {
  const por: MatchLT[][] = frases.map(() => []);
  let ini = 0;
  frases.forEach((f, i) => {
    const fim = ini + f.length;
    for (const m of matches) if (m.inicio >= ini && m.inicio < fim) por[i].push({ ...m, inicio: m.inicio - ini, fim: m.fim - ini });
    ini = fim + 2; // "\n\n"
  });
  return por;
}
export async function checarLoteLT(frases: string[], url = urlLT()): Promise<MatchLT[][]> {
  if (!frases.length) return [];
  return dividirMatches(frases, await checarLT(frases.join("\n\n"), url));
}

export async function ltNoAr(url = urlLT()): Promise<boolean> {
  try {
    return (await fetch(`${url}/v2/languages`, { signal: AbortSignal.timeout(3000) })).ok;
  } catch {
    return false;
  }
}

// O que o LanguageTool disse da frase, olhando o "a/à/as/às/àquele" do trecho onde a regra se aplica:
// - limpa: nenhum erro de língua na frase;
// - noTrecho: algum erro cobre esse "a/à" (é ali que a regra de erro manda errar);
// - foraDoTrecho: erro em outro lugar (a frase tem um problema que não é o da regra).
const NUCLEO = /(^|\s)(à|às|a|as|àquel\p{L}*|àquilo)(?=\s|$)/iu;
export function veredictoLT(frase: string, trecho: string, matches: MatchLT[]) {
  const iniTrecho = frase.toLowerCase().indexOf(trecho.toLowerCase());
  const n = NUCLEO.exec(trecho);
  const ini = iniTrecho < 0 || !n ? -1 : iniTrecho + n.index + n[1].length;
  const fim = ini + (n?.[2].length ?? 0);
  const erros = matches.filter((m) => CATEGORIAS.has(m.categoria));
  const cobre = (m: MatchLT) => ini >= 0 && m.inicio < fim && m.fim > ini;
  return {
    limpa: erros.length === 0,
    noTrecho: erros.some(cobre),
    foraDoTrecho: erros.some((m) => !cobre(m)),
    regras: erros.map((m) => m.regra),
  };
}

// A regra do código e o LanguageTool concordam? Frase certa: nenhum erro. Frase de erro: o erro
// apontado exatamente no trecho e em nenhum outro lugar. Divergência → frase descartada (não vai à IA).
export function concordaComRegra(regraCorreta: boolean, v: ReturnType<typeof veredictoLT>): boolean {
  return regraCorreta ? v.limpa : v.noTrecho && !v.foraDoTrecho;
}

// Sobe o servidor local se não estiver no ar (noturno e esteira). Java e LanguageTool em ferramentas/.
export async function garantirLT(raiz = process.cwd(), log: (s: string) => void = console.log): Promise<boolean> {
  if (await ltNoAr()) return true;
  const dirLT = process.env.LANGUAGETOOL_DIR ?? achar(join(raiz, "ferramentas", "languagetool"), /^LanguageTool-/);
  const dirJava = achar(join(raiz, "ferramentas", "java"), /^jdk-|^jre/);
  const java = process.env.LANGUAGETOOL_JAVA ?? (dirJava ? join(dirJava, "bin", process.platform === "win32" ? "java.exe" : "java") : "java");
  if (!dirLT || !existsSync(join(dirLT, "languagetool-server.jar"))) {
    log("✖ LanguageTool não encontrado em ferramentas/languagetool (ver docs/MESTRE.md)");
    return false;
  }
  const porta = new URL(urlLT()).port || "8081";
  // o PC tem ~4 GB de RAM: heap pequeno e coletor serial (com 1 GB o Java ia para o disco e cada frase levava 5–25 s)
  const xmx = process.env.LANGUAGETOOL_XMX ?? "512m";
  const p = spawn(java, ["-Xms128m", `-Xmx${xmx}`, "-XX:+UseSerialGC", "-cp", "languagetool-server.jar", "org.languagetool.server.HTTPServer", "--port", porta], { cwd: dirLT, detached: true, stdio: "ignore", windowsHide: true });
  p.unref();
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    if (await ltNoAr()) {
      log(`… LanguageTool local no ar (porta ${porta})`);
      return true;
    }
  }
  log("✖ LanguageTool não subiu em 60 s");
  return false;
}

function achar(dir: string, padrao: RegExp): string | null {
  if (!existsSync(dir)) return null;
  const nome = readdirSync(dir).find((n) => padrao.test(n));
  return nome ? join(dir, nome) : null;
}
