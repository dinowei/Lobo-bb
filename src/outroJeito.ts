// ============================================================
// BB Estudos — Pré-geração da noite (adendo do banco grande, item 4)
// "Me explica de outro jeito" sai pronta de madrugada: o tutor (corrente "tutor") escreve,
// um auditor de OUTRA família confere que não contradiz o gabarito nem as explicações salvas.
// De dia o app só mostra o que já está pronto. Aula curta (8.5) e temas de redação (8.4)
// ganham o mesmo gancho quando existirem na Fase B.
// ============================================================
import { Types } from "mongoose";
import { Question, Tarefa } from "./models.js";
import { chatJSONFuncao } from "./corrente.js";
import { validarOuReparar, SemModeloDisponivel, ehFalhaDeInfra } from "./llm.js";
import { OutroJeitoZ, OUTRO_JEITO_SYSTEM, outroJeitoUser, ConferenciaOutroJeitoZ, CONFERE_OUTRO_JEITO_SYSTEM, confereOutroJeitoUser } from "./prompts.js";
import { pregeracoes } from "./noturno.js";

// questões aprovadas sem explicação alternativa e sem tarefa aberta, até EXPLICACOES_NOITE (40)
export async function planejarPregeracoes(lote: string, max = Number(process.env.EXPLICACOES_NOITE) || 40) {
  // aberta não repete; reprovada por qualidade não volta toda noite (só com corrente nova, à mão)
  const abertas = await Tarefa.distinct("params.questionId", { tipo: "explicar_outro_jeito", status: { $in: ["pendente", "rodando", "aguardando", "descartada"] } });
  const qs = await Question.find({ status: "aprovada", "explicacaoAlternativa.texto": { $exists: false }, _id: { $nin: abertas } })
    .sort({ "stats.tentativas": -1, createdAt: 1 }) // as mais respondidas primeiro
    .limit(max)
    .select("_id")
    .lean();
  if (qs.length) await Tarefa.insertMany(qs.map((q) => ({ tipo: "explicar_outro_jeito", params: { questionId: String(q._id) }, lote })));
  return qs.length;
}

export async function explicarDeOutroJeito(questionId: string, preferir?: string) {
  const q = await Question.findById(questionId).lean();
  if (!q || q.status !== "aprovada") return { ok: false, motivo: "questao_fora_de_circulacao" };
  if (q.explicacaoAlternativa?.texto) return { ok: true };
  const correta = q.alternativas.find((a) => a.letra === q.gabarito);
  const dados = {
    textoBase: q.textoBase,
    enunciado: q.enunciado,
    alternativas: q.alternativas.map((a) => ({ letra: a.letra, texto: a.texto })),
    gabarito: q.gabarito,
    explicacaoGeral: q.explicacaoGeral,
    explicacaoCorreta: correta?.explicacao,
  };
  try {
    const user = outroJeitoUser(dados);
    const t = await chatJSONFuncao("tutor", OUTRO_JEITO_SYSTEM, user, 0.6, 1200, { preferir });
    const { explicacao } = await validarOuReparar(OutroJeitoZ, t.json, { client: t.client, model: t.modelo, system: OUTRO_JEITO_SYSTEM, user });
    // quem confere nunca é da família de quem escreveu
    const c = await chatJSONFuncao("auditor", CONFERE_OUTRO_JEITO_SYSTEM, confereOutroJeitoUser(dados, explicacao), 0, 1200, { excluirFamilias: [t.familia] });
    const conf = ConferenciaOutroJeitoZ.parse(c.json);
    if (!conf.ok) return { ok: false, motivo: "outro_jeito_reprovado", detalhes: conf.problemas.join(" | ").slice(0, 500) };
    await Question.updateOne(
      { _id: new Types.ObjectId(questionId) },
      { explicacaoAlternativa: { texto: explicacao.trim(), modelo: t.modelo, conferidaPor: c.modelo, em: new Date() } }
    );
    return { ok: true };
  } catch (e) {
    const motivo = e instanceof SemModeloDisponivel ? "aguardando_modelo" : ehFalhaDeInfra(e) ? "provedor_falhou" : "outro_jeito_invalido";
    return { ok: false, motivo, detalhes: String(e instanceof Error ? e.message : e).slice(0, 300) };
  }
}

pregeracoes["explicar_outro_jeito"] = (params, preferir) => explicarDeOutroJeito((params as { questionId: string }).questionId, preferir);
