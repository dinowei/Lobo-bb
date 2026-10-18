// ============================================================
// BB Estudos — Pré-geração da noite (adendo do banco grande, item 4)
// "Me explica de outro jeito" sai pronta de madrugada: o tutor (corrente "tutor") escreve,
// um auditor de OUTRA família confere que não contradiz o gabarito nem as explicações salvas.
// De dia o app só mostra o que já está pronto. Aula curta (8.5) e temas de redação (8.4)
// ganham o mesmo gancho quando existirem na Fase B.
// ============================================================
import { Types } from "mongoose";
import { createHash } from "node:crypto";
import { ExplicacaoTutor, Question, Tarefa, TutorUso } from "./models.js";
import { chatJSONFuncao } from "./corrente.js";
import { validarOuReparar, SemModeloDisponivel, ehFalhaDeInfra } from "./llm.js";
import { OutroJeitoZ, OUTRO_JEITO_SYSTEM, outroJeitoUser, ConferenciaOutroJeitoZ, CONFERE_OUTRO_JEITO_SYSTEM, confereOutroJeitoUser } from "./prompts.js";
import { pregeracoes } from "./noturno.js";
import { seFilaLivre } from "./fila.js";

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

const hashDuvida = (duvida: string) => createHash("sha256").update(duvida.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim()).digest("hex");
const diaEmSaoPaulo = (data = new Date()) => new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Sao_Paulo" }).format(data);

async function reservarUsoTutor(userId: Types.ObjectId, dia: string, limite: number) {
  if (limite < 1) return false;
  const filtro = { userId, dia, quantidade: { $lt: limite } };
  if (await TutorUso.findOneAndUpdate(filtro, { $inc: { quantidade: 1 } }, { new: true })) return true;
  try {
    await TutorUso.create({ userId, dia, quantidade: 1 });
    return true;
  } catch (e) {
    if ((e as { code?: number }).code !== 11000) throw e;
    // Outra requisição criou o contador entre a leitura e a inserção.
    return !!(await TutorUso.findOneAndUpdate(filtro, { $inc: { quantidade: 1 } }, { new: true }));
  }
}

/**
 * Resposta sob demanda. Sem dúvida específica, reutiliza a alternativa pré-gerada;
 * pedidos novos ficam cacheados por aluno, questão e texto da dúvida.
 */
export async function explicarSobDemanda(questionId: string, alunoId: string, duvida?: string) {
  if (!Types.ObjectId.isValid(questionId) || !Types.ObjectId.isValid(alunoId)) throw new Error("Identificação inválida.");
  const pergunta = (duvida ?? "").trim();
  if (pergunta.length > 500) throw new Error("A dúvida pode ter até 500 caracteres.");
  const qid = new Types.ObjectId(questionId);
  const uid = new Types.ObjectId(alunoId);
  const q = await Question.findById(qid).lean();
  if (!q || q.status !== "aprovada") throw new Error("Questão fora de circulação.");
  if (!pergunta && q.explicacaoAlternativa?.texto) {
    return { explicacao: q.explicacaoAlternativa.texto, origem: "pregerada" as const };
  }

  const duvidaHash = hashDuvida(pergunta);
  const cache = await ExplicacaoTutor.findOne({ userId: uid, questionId: qid, duvidaHash }).lean();
  if (cache) return { explicacao: cache.explicacao, origem: "cache" as const };

  const correta = q.alternativas.find((a) => a.letra === q.gabarito);
  const dados = {
    textoBase: q.textoBase,
    enunciado: q.enunciado,
    alternativas: q.alternativas.map((a) => ({ letra: a.letra, texto: a.texto })),
    gabarito: q.gabarito,
    explicacaoGeral: q.explicacaoGeral,
    explicacaoCorreta: correta?.explicacao,
    duvida: pergunta,
  };
  let resposta: { explicacao?: string; origem?: "pregerada" | "cache" | "nova"; restantesHoje?: number; mensagem?: string } | undefined;
  const iniciou = await seFilaLivre(`tutor da questão ${questionId}`, async () => {
    // Reconfere cache e pré-geração após adquirir a fila, evitando chamadas duplicadas.
    if (!pergunta) {
      const atual = await Question.findById(qid).select("explicacaoAlternativa").lean();
      if (atual?.explicacaoAlternativa?.texto) {
        resposta = { explicacao: atual.explicacaoAlternativa.texto, origem: "pregerada" };
        return;
      }
    }
    const cacheAtual = await ExplicacaoTutor.findOne({ userId: uid, questionId: qid, duvidaHash }).lean();
    if (cacheAtual) {
      resposta = { explicacao: cacheAtual.explicacao, origem: "cache" };
      return;
    }
    const limiteEnv = Number(process.env.EXPLICACOES_MAIS_MAX_DIA);
    const limite = Number.isFinite(limiteEnv) && limiteEnv >= 0 ? Math.floor(limiteEnv) : 20;
    const dia = diaEmSaoPaulo();
    if (!(await reservarUsoTutor(uid, dia, limite))) {
      const uso = await TutorUso.findOne({ userId: uid, dia }).select("quantidade").lean();
      resposta = { mensagem: `Você chegou ao limite de ${limite} explicações novas hoje. As pré-geradas e as já salvas continuam disponíveis.`, restantesHoje: Math.max(0, limite - (uso?.quantidade ?? limite)) };
      return;
    }
    const user = outroJeitoUser(dados);
    const t = await chatJSONFuncao("tutor", OUTRO_JEITO_SYSTEM, user, 0.6, 1200);
    const { explicacao } = await validarOuReparar(OutroJeitoZ, t.json, { client: t.client, model: t.modelo, system: OUTRO_JEITO_SYSTEM, user });
    const c = await chatJSONFuncao("auditor", CONFERE_OUTRO_JEITO_SYSTEM, confereOutroJeitoUser(dados, explicacao), 0, 1200, { excluirFamilias: [t.familia] });
    const conf = ConferenciaOutroJeitoZ.parse(c.json);
    if (!conf.ok) {
      resposta = { mensagem: "Não consegui validar uma nova explicação agora. Tente novamente mais tarde.", restantesHoje: Math.max(0, limite - ((await TutorUso.findOne({ userId: uid, dia }).select("quantidade").lean())?.quantidade ?? limite)) };
      return;
    }
    if (!pergunta) {
      await Question.updateOne({ _id: qid, status: "aprovada" }, { explicacaoAlternativa: { texto: explicacao.trim(), modelo: t.modelo, conferidaPor: c.modelo, em: new Date() } });
    } else {
      await ExplicacaoTutor.updateOne(
        { userId: uid, questionId: qid, duvidaHash },
        { $setOnInsert: { explicacao: explicacao.trim(), modelo: t.modelo } },
        { upsert: true }
      );
    }
    const restantes = Math.max(0, limite - ((await TutorUso.findOne({ userId: uid, dia }).select("quantidade").lean())?.quantidade ?? limite));
    const salvo = pergunta ? await ExplicacaoTutor.findOne({ userId: uid, questionId: qid, duvidaHash }).select("explicacao").lean() : null;
    resposta = { explicacao: salvo?.explicacao ?? explicacao.trim(), origem: "nova", restantesHoje: restantes };
  });
  if (!iniciou) return { mensagem: "Outra tarefa de IA está em andamento. Tente de novo em instantes." };
  return resposta ?? { mensagem: "Não deu para preparar uma explicação agora." };
}

pregeracoes["explicar_outro_jeito"] = (params, preferir) => explicarDeOutroJeito((params as { questionId: string }).questionId, preferir);
