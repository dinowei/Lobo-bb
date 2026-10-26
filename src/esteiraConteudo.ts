// ============================================================
// Esteira de conteúdo (decisão do dono, 26/10/2026): trabalha SEMPRE no tema mais próximo do dia do dono
// que ainda não bateu a meta (≥ 15 novas + ficha aprovada + áudio da ficha) e, dentro dele, na ordem de
// fonte mais barata: oficiais e cursinho (já no banco) → derivados C/E (≤ 3 por questão) → geração só
// para completar (Crase pela esteira de Português) → ficha → áudio da ficha. Com todos prontos, para.
// ============================================================
import { Ficha, Geracao, Topic } from "./models.js";
import { usoDeHoje } from "./capacidade.js";
import { coberturaTrilha, textoFichaDoTema } from "./cobertura.js";
import { derivarCE } from "./certoErrado.js";
import { gerarQuestao } from "./pipeline.js";
import { rodarEsteiraPT } from "./esteiraPT.js";
import { gerarFicha } from "./fichas.js";
import { audioDe, vozPadrao } from "./voz.js";
import { classificarBanco } from "./subtopicos.js";
import { carregarVariacoes } from "./variacao.js";
import { tipoDoSubtopico } from "./noturno.js";
import { META_NOVAS, proximoTemaDaEsteira, type LinhaCobertura } from "../shared/cobertura.js";
import { SUBTOPICO_POR_ID } from "../shared/subtopicos.js";

export type PassoTema = { n: number; tema: string; antes: string; depois: string; passos: string[] };
const situacaoCurta = (l: LinhaCobertura) => `${Math.min(l.novas, META_NOVAS)}/${META_NOVAS} novas, ficha ${l.ficha ? "✓" : "✗"}, áudio ${l.audioFicha ? "✓" : "✗"}`;

export async function rodarEsteiraConteudo(opts: { ate?: Date; maxTemas?: number; noturno?: boolean; log?: (s: string) => void } = {}) {
  const log = opts.log ?? console.log;
  const sobra = (min: number) => !opts.ate || +opts.ate - Date.now() > min * 60_000;
  const feitos: PassoTema[] = [];
  const travados = new Set<string>(); // tema que não andou nesta rodada: não insiste
  for (let k = 0; k < (opts.maxTemas ?? 6) && sobra(15); k++) {
    const cob = await coberturaTrilha();
    const linhas = cob.temas.filter((l) => !travados.has(l.subtopico));
    const alvo = proximoTemaDaEsteira(linhas, cob.nHoje);
    if (!alvo) {
      log(cob.temas.every((l) => l.situacao !== "faltando") ? "… esteira: todos os temas prontos ou bloqueados; só manutenção" : "… esteira: nenhum tema andou nesta rodada");
      break;
    }
    log(`… esteira no tema ${alvo.n} (${alvo.nome}): ${situacaoCurta(alvo)}`);
    const passos: string[] = [];
    const sub = alvo.subtopico;

    // 1) questões: derivados C/E do próprio tema → geração para completar
    let faltam = Math.max(0, META_NOVAS - alvo.novas);
    if (faltam && sobra(15)) {
      const r = await derivarCE({ questoes: Math.ceil(faltam / 3) + 1, subtopico: sub });
      if (r.itens) passos.push(`C/E ${r.aprovados}/${r.itens}`);
      faltam = Math.max(0, faltam - r.aprovados);
    }
    if (faltam && sobra(15)) passos.push(await gerarParaOTema(sub, faltam, !!opts.noturno, log));

    // 2) ficha (só com material do acervo; bloqueio de material aparece na cobertura)
    if (!alvo.ficha && sobra(10) && !alvo.bloqueios.some((b) => b.includes("ficha"))) {
      // ficha tentada há menos de 3 dias (pendente ou rejeitada): não gasta IA de novo com o mesmo material
      if (await Ficha.exists({ subtopico: sub, createdAt: { $gte: new Date(Date.now() - 3 * 86_400_000) } })) passos.push("ficha tentada há < 3 dias");
      else {
        const f = await gerarFicha(sub, () => undefined);
        passos.push(`ficha ${f.status}${f.motivos.length ? ` (${f.motivos[0].slice(0, 60)})` : ""}`);
      }
    }
    // 3) áudio da ficha (MP3 da Lo no cache, o mesmo texto do Espaço da Lo)
    const texto = await textoFichaDoTema(sub);
    if (texto && sobra(5)) {
      const depoisFicha = (await coberturaTrilha()).temas.find((l) => l.subtopico === sub);
      if (depoisFicha && !depoisFicha.audioFicha) passos.push((await audioDe(texto, vozPadrao())) ? "áudio da ficha ✓" : "áudio da ficha falhou");
    }

    const depois = (await coberturaTrilha()).temas.find((l) => l.subtopico === sub)!;
    feitos.push({ n: alvo.n, tema: alvo.nome, antes: situacaoCurta(alvo), depois: `${situacaoCurta(depois)} → ${depois.situacao}`, passos });
    log(`  ${alvo.nome}: ${situacaoCurta(alvo)} → ${situacaoCurta(depois)} (${passos.join(" · ") || "nada a fazer"})`);
    if (depois.situacao !== "pronto" && situacaoCurta(depois) === situacaoCurta(alvo)) travados.add(sub);
  }
  const resumo = feitos.length ? feitos.map((f) => `tema ${f.n} ${f.tema}: ${f.antes} → ${f.depois}`).join("; ") : "nada a fazer";
  return { feitos, resumo };
}

// Relatório diário da esteira: temas prontos × total por concurso; chamadas usadas × capacidade; descarte por motivo
export async function relatorioDiario() {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const [cob, uso, descartes] = await Promise.all([
    coberturaTrilha(),
    usoDeHoje(),
    Geracao.aggregate<{ _id: string; n: number }>([{ $match: { em: { $gte: hoje }, resultado: { $ne: "aprovada" } } }, { $group: { _id: { $ifNull: ["$motivo", "$resultado"] }, n: { $sum: 1 } } }, { $sort: { n: -1 } }]),
  ]);
  const temas = cob.resumo.map((r) => `${r.concurso === "geral" ? "Geral" : r.concurso.toUpperCase()} ${r.prontos}/${r.total}`).join(" · ");
  const chamadas = uso.map((u) => `${u.modelo.split("/").pop()} ${u.usadas}/${u.capacidade}`).join(" · ") || "nenhuma";
  const motivos = descartes.slice(0, 6).map((d) => `${d._id} ${d.n}`).join(" · ") || "nenhum";
  return { temas, chamadas, motivos, texto: `temas prontos: ${temas} | chamadas usadas/capacidade: ${chamadas} | descartes: ${motivos}` };
}

// geração só para completar: Crase pela esteira de Português; os demais pelo pipeline de sempre, no tipo do tema
async function gerarParaOTema(subtopico: string, faltam: number, noturno: boolean, log: (s: string) => void): Promise<string> {
  if (subtopico === "crase") {
    const r = await rodarEsteiraPT({ alvo: faltam, log });
    return `esteira PT: ${r.contagem.aprovadas} aprovada(s)`;
  }
  const s = SUBTOPICO_POR_ID.get(subtopico);
  const topicos = await Topic.find({ ativo: true, assunto: { $in: s?.topicos ?? [] } }).select("_id assunto").lean();
  if (!topicos.length) return "geração: sem tópico";
  const tipos = carregarVariacoes().tipos;
  let aprovadas = 0;
  const motivos: Record<string, number> = {};
  for (let i = 0; i < faltam * 2 && aprovadas < faltam; i++) {
    const t = topicos[i % topicos.length];
    const tipo = tipoDoSubtopico(t.assunto, subtopico, Object.keys(tipos[t.assunto] ?? {}));
    const r = await gerarQuestao(String(t._id), 2 + Math.floor(Math.random() * 3), { tipo, noturno });
    if (r.ok) aprovadas++;
    else motivos[r.motivo] = (motivos[r.motivo] ?? 0) + 1;
    if (!r.ok && (r.motivo === "teto_diario" || r.motivo === "sem_fontes_para_o_topico")) break;
  }
  // a questão nova ganha subtópico na hora (código primeiro), para contar na meta do tema
  if (aprovadas) await classificarBanco({ ia: true, gravar: true });
  return `geração ${aprovadas}/${faltam}${Object.keys(motivos).length ? ` (${Object.entries(motivos).map(([m, n]) => `${m} ${n}`).join(", ")})` : ""}`;
}
