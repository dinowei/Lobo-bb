// ============================================================
// BB Estudos — questões de cursinho (E7/F10): origem "cursinho", camada C, gabarito do PRÓPRIO material lido
// por código; treinam, revisam e contam no Desempenho, mas ficam fora do simulado fiel.
// A) Múltipla escolha ("72. enunciado… A)…E) Gabarito: D Comentários…"): a IA só copia enunciado e
//    alternativas; o código confere cada texto no PDF e põe o gabarito; "explicar" depois (gabarito travado).
// B) Certo/Errado ("QUESTÃO 12 / ENUNCIADO DA QUESTÃO / … / ( X ) CERTO / SOLUÇÃO DA QUESTÃO / CERTO. …"):
//    100% código. Só entra se a marcação e a 1ª palavra da solução concordam; a explicação é a do material.
// ============================================================
import { basename } from "node:path";
import { ItemCE, Question, Source } from "./models.js";
import { lerArquivo, lerGabaritoCursinho, hashTexto, TextoPdf } from "./extrair.js";
import { classificar, extrairQuestoes, topicosComVetor, type TopicoVetor } from "./ingestao.js";
import { embedLote } from "./llm.js";
import { BANCAS, type IdBanca } from "../shared/concursos.js";
import { DISCIPLINAS, LETRAS, type Disciplina } from "../shared/tipos.js";

const ehDisciplina = (s: string): s is Disciplina => (DISCIPLINAS as readonly string[]).includes(s);

export interface ItemCECursinho { numero: number; afirmacao: string; gabarito: "C" | "E"; explicacao: string }

// B) leitura determinística dos itens C/E com a marcação "( X ) CERTO|ERRADO"
export function lerItensCECursinho(texto: string): { itens: ItemCECursinho[]; recusados: { numero: number; motivo: string }[] } {
  const itens: ItemCECursinho[] = [];
  const recusados: { numero: number; motivo: string }[] = [];
  const blocos = texto.split(/\n\s*QUEST[ÃA]O\s+(\d{1,3})\s*\n\s*ENUNCIADO DA QUEST[ÃA]O\s*\n/i);
  // split com grupo: [antes, n1, bloco1, n2, bloco2, ...]
  for (let k = 1; k < blocos.length; k += 2) {
    const numero = Number(blocos[k]);
    const bloco = blocos[k + 1] ?? "";
    const marcas = [...bloco.matchAll(/\(\s*([Xx]?)\s*\)\s*(CERTO|ERRADO)/g)];
    const marcadas = marcas.filter((m) => m[1]);
    if (marcas.length < 2 || marcadas.length !== 1) { recusados.push({ numero, motivo: "marcação ( X ) ausente ou dupla" }); continue; }
    const gabarito = marcadas[0][2].toUpperCase() === "CERTO" ? "C" : "E";
    const afirmacao = bloco.slice(0, marcas[0].index).replace(/\s+/g, " ").trim();
    const sol = bloco.split(/SOLU[ÇC][ÃA]O DA QUEST[ÃA]O\s*\n/i)[1];
    if (!sol) { recusados.push({ numero, motivo: "sem solução" }); continue; }
    const primeira = sol.trim().match(/^(CERTO|ERRADO)\b/i)?.[1]?.toUpperCase();
    if (!primeira || (primeira === "CERTO" ? "C" : "E") !== gabarito) { recusados.push({ numero, motivo: "marcação e solução discordam" }); continue; }
    const explicacao = sol.trim().replace(/^(CERTO|ERRADO)\.?\s*/i, "").replace(/\s+/g, " ").trim().slice(0, 2000);
    if (afirmacao.length < 20 || explicacao.length < 30) { recusados.push({ numero, motivo: "texto curto demais" }); continue; }
    itens.push({ numero, afirmacao, gabarito, explicacao });
  }
  return { itens, recusados };
}

async function topicoDe(textos: string[], disciplina: string | undefined) {
  const vetores = await embedLote(textos, "passage");
  const cache = new Map<string, TopicoVetor[]>();
  const chave = disciplina && ehDisciplina(disciplina) ? disciplina : "*";
  if (!cache.has(chave)) cache.set(chave, await topicosComVetor(chave === "*" ? undefined : chave).catch(() => topicosComVetor()));
  return vetores.map((v) => classificar(v, cache.get(chave)!, { forcar: true })[0]);
}

export async function importarCursinho(caminho: string, meta: { nome: string; formato: "multipla" | "ce"; banca?: string; disciplina?: string }) {
  const lido = await lerArquivo(caminho);
  if (await Source.findOne({ hashArquivo: lido.hash })) return { ja: true as const };
  const texto = lido.paginas.join("\n");
  const banca = meta.banca && meta.banca in BANCAS ? (meta.banca as IdBanca) : undefined;
  const fonte = await Source.create({ tipo: "material_cursinho", titulo: meta.nome, hashArquivo: lido.hash, arquivoNome: basename(caminho), paginas: lido.paginas.length, totalChunks: 0 });

  if (meta.formato === "ce") {
    const { itens, recusados } = lerItensCECursinho(texto);
    const topicos = itens.length ? await topicoDe(itens.map((i) => i.afirmacao), meta.disciplina) : [];
    let salvos = 0, duplicados = 0;
    for (const [k, it] of itens.entries()) {
      try {
        await ItemCE.create({
          topicId: topicos[k], origem: "cursinho", camada: "C", ...(banca ? { banca } : {}), prova: meta.nome, numeroOriginal: it.numero,
          afirmacao: it.afirmacao, gabarito: it.gabarito, explicacao: `${it.explicacao} (Fonte: ${meta.nome}, camada C)`,
          status: "pendente", // vira "aprovada" no explicar-ce (julgamento às cegas; a explicação do material fica)
          hashAfirmacao: hashTexto(`cursinho|${it.afirmacao}`),
        });
        salvos++;
      } catch (e) {
        if ((e as { code?: number }).code === 11000) duplicados++;
        else throw e;
      }
    }
    return { ja: false as const, formato: "ce", lidos: itens.length + recusados.length, salvos, duplicados, recusados, fonte: String(fonte._id) };
  }

  // A) múltipla escolha: gabarito por código; a IA só copia
  const gabarito = lerGabaritoCursinho(texto);
  if (!gabarito.size) throw new Error('Nenhum "Gabarito: X" reconhecido neste material.');
  const questoes = await extrairQuestoes(lido.paginas, [...gabarito.keys()], null);
  const pdf = new TextoPdf(lido.paginas);
  const rel = { gabaritos: gabarito.size, extraidas: questoes.length, salvas: 0, anuladas: 0, naoConfere: 0, incompletas: 0, semGabarito: 0, duplicadas: 0 };
  const validas = questoes.flatMap((q) => {
    const g = gabarito.get(q.numero);
    if (!g) { rel.semGabarito++; return []; }
    if (g === "anulada") { rel.anuladas++; return []; }
    const alts = LETRAS.map((l) => q.alternativas[l]);
    if (!q.completa || q.dependeDeImagem || alts.some((a) => !a?.trim())) { rel.incompletas++; return []; }
    const textos = [q.enunciado, ...(alts as string[])].map((t) => pdf.conferir(t));
    if (textos.some((c) => c.status === "suspeito")) { rel.naoConfere++; return []; }
    return [{ ...q, enunciado: textos[0].texto, alternativas: Object.fromEntries(LETRAS.map((l, i) => [l, textos[i + 1].texto])) as typeof q.alternativas, resposta: g }];
  });
  const topicos = validas.length ? await topicoDe(validas.map((q) => `${q.enunciado}\n${LETRAS.map((l) => q.alternativas[l]).join("\n")}`), meta.disciplina) : [];
  for (const [k, q] of validas.entries()) {
    try {
      await Question.create({
        topicId: topicos[k], origem: "cursinho", camada: "C", ...(banca ? { banca, estiloBanca: banca } : {}), prova: meta.nome, numeroOriginal: q.numero,
        textoBase: q.textoBase ?? undefined, enunciado: q.enunciado,
        alternativas: LETRAS.map((l) => ({ letra: l, texto: q.alternativas[l]!.trim(), correta: l === q.resposta })),
        gabarito: q.resposta, fontes: [{ sourceId: fonte._id }], status: "pendente", // "explicar" escreve as explicações com o gabarito travado
        hashEnunciado: hashTexto(`${q.textoBase ?? ""}|${q.enunciado}|${LETRAS.map((l) => q.alternativas[l]).join("|")}`),
      });
      rel.salvas++;
    } catch (e) {
      if ((e as { code?: number }).code === 11000) rel.duplicadas++;
      else throw e;
    }
  }
  return { ja: false as const, formato: "multipla", ...rel, fonte: String(fonte._id) };
}
