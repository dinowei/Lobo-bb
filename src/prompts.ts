// ============================================================
// BB Estudos — Prompts: GERADOR, AUDITOR, EXTRATOR de provas e EXPLICADOR
// ============================================================
import { z } from "zod";
import { DISCIPLINAS } from "./models.js";
import { VerificacaoZ, ehDisciplinaDeCalculo } from "./verificacao.js";

export const LetraZ = z.enum(["A", "B", "C", "D", "E"]);

type QuestaoParaResolver = {
  textoBase?: string | null;
  enunciado: string;
  alternativas: { letra: string; texto: string }[];
};

const blocoFontes = (fontes: string[]) =>
  fontes.length ? fontes.join("\n\n") : "(nenhuma — matéria estável, resolva com conhecimento consolidado)";

const blocoQuestao = (q: QuestaoParaResolver) =>
  `${q.textoBase ? `TEXTO DE APOIO:\n${q.textoBase}\n\n` : ""}${q.enunciado}\n\n${q.alternativas
    .map((a) => `(${a.letra}) ${a.texto}`)
    .join("\n")}`;

// ============================================================
// 1. GERADOR
// ============================================================
export const QuestaoGeradaZ = z.object({
  enunciado: z.string().min(40),
  alternativas: z
    .array(
      z.object({
        letra: LetraZ,
        texto: z.string().min(1),
        correta: z.boolean(),
        explicacao: z.string().min(30),
        pegadinha: z.string().nullish(),
      })
    )
    .length(5),
  gabarito: LetraZ,
  explicacaoGeral: z.string().min(60),
  dicaDeProva: z.string().nullish(),
  trechoFonte: z.string().nullish(), // obrigatório quando há fontes (checado no pipeline)
  dificuldade: z.coerce.number().int().min(1).max(5),
  verificacao: VerificacaoZ.nullish(), // obrigatório em cálculo (conferido por código no pipeline)
});
export type QuestaoGerada = z.infer<typeof QuestaoGeradaZ>;

export const GERADOR_SYSTEM = `Você é um elaborador sênior de questões de concurso bancário, especialista no estilo da Fundação Cesgranrio e no concurso de Escriturário do Banco do Brasil.

Sua missão: criar UMA questão inédita de múltipla escolha que ensine de verdade, e não só teste.

REGRAS DE CONTEÚDO
1. Se vierem FONTES: use EXCLUSIVAMENTE as informações delas. Se não sustentarem uma boa questão, devolva {"erro": "fonte_insuficiente"}. Nunca invente número, prazo, percentual, artigo de lei ou órgão que não esteja nas fontes. "trechoFonte" = cópia LITERAL do trecho que comprova o gabarito.
2. Se as FONTES vierem vazias (matérias estáveis como Português, Inglês, Matemática, Estatística): use conhecimento consolidado de nível médio, REFAÇA toda conta antes de responder e devolva "trechoFonte": null.

REGRAS DE ESTILO (Cesgranrio)
3. Enunciado contextualizado sempre que possível: situação de agência, cliente, notícia ou caso prático. Evite a pergunta seca de "decoreba".
4. Exatamente 5 alternativas (A–E), com tamanho e estrutura parecidos. A correta não pode ser visivelmente a mais longa ou a mais detalhada.
5. Exatamente UMA alternativa correta. Proibido usar "todas as anteriores", "nenhuma das anteriores" ou combinações do tipo "I e II".
6. Cada alternativa errada precisa ser um distrator PLAUSÍVEL, construído a partir de um erro real de candidato: troca de órgão (CMN × BACEN × CVM), prazo trocado, extrapolação ("sempre", "somente", "vedado"), inversão de conceito, conta com passo esquecido. Registre esse erro no campo "pegadinha".
7. O gabarito DEVE ser a letra informada em GABARITO_OBRIGATORIO. Isso evita viés de posição.

REGRAS DIDÁTICAS
8. "explicacao" de cada alternativa: diga POR QUE ela está certa ou errada, apontando o conceito exato. Nada de só "incorreta, pois não condiz com a norma".
9. "explicacaoGeral": ensine o conceito por trás da questão como um bom professor faria em 3 a 6 frases, de modo que o aluno acerte qualquer variação dela.
10. "dicaDeProva": um atalho mental ou macete curto para a hora da prova.
11. Em questões de cálculo, a explicação da correta mostra a conta passo a passo.

Responda APENAS com JSON válido no formato:
{"enunciado": "...", "alternativas": [{"letra":"A","texto":"...","correta":false,"explicacao":"...","pegadinha":"..."}, ...], "gabarito":"X", "explicacaoGeral":"...", "dicaDeProva":"...", "trechoFonte":"..." ou null, "dificuldade": 1-5}`;

// Só para Matemática, Matemática Financeira e Probabilidade e Estatística: o número é conferido por código (mathjs)
const VERIFICACAO_CALCULO = `

=== VERIFICAÇÃO DA CONTA (OBRIGATÓRIA NESTA DISCIPLINA) ===
Inclua no JSON o campo "verificacao": {"expressao": "...", "fatoresDados": {...}}.
- "expressao": a expressão matemática que gera EXATAMENTE o número da alternativa correta, em sintaxe de calculadora: ponto como separador decimal, * para multiplicar, ^ para potência, sem "R$", "%" nem texto. Ex.: "12000 * 1.04^8", "combinations(10, 3) / 2^10".
- No estilo Cesgranrio, prefira DAR no enunciado os fatores difíceis já arredondados (ex.: "Dado: 1,04^8 = 1,3686"). Nesse caso liste-os em "fatoresDados" escritos igual na expressão (ex.: {"1.04^8": 1.3686}) e calcule a alternativa correta COM O FATOR DADO, não com o valor exato. Sem fatores dados, use {}.
- A alternativa correta deve conter UM único número (o resultado), arredondado em 2 casas se for valor em R$, no formato brasileiro (ex.: "R$ 6.050,00"). Nenhuma alternativa errada pode ter esse mesmo valor.
- O texto das alternativas traz SÓ a resposta: nada de conta, comentário ou "(valor correto…)". A conta vai na "explicacao".
- Se a resposta correta não for um número (ex.: uma afirmação conceitual), use "verificacao": null.
O valor será recalculado por código: se não bater, a questão é descartada.`;

export function geradorUser(p: {
  disciplina: string;
  assunto: string;
  subtopicos: string[];
  dificuldade: number;
  gabaritoObrigatorio: string;
  fontes: { titulo: string; texto: string }[];
  exemplosOficiais: string[]; // 1–2 questões reais da banca, para calibrar o estilo
  enunciadosRecentes: string[]; // para não repetir
}) {
  return `DISCIPLINA: ${p.disciplina}
ASSUNTO: ${p.assunto}
SUBTÓPICOS POSSÍVEIS: ${p.subtopicos.join(", ") || "livre dentro do assunto"}
DIFICULDADE ALVO (1–5): ${p.dificuldade}
GABARITO_OBRIGATORIO: ${p.gabaritoObrigatorio}

=== FONTES (única base de verdade) ===
${p.fontes.length ? p.fontes.map((f, i) => `[${i + 1}] ${f.titulo}\n${f.texto}`).join("\n\n") : "(vazio)"}

=== EXEMPLOS REAIS DA BANCA (copie o ESTILO, nunca o conteúdo) ===
${p.exemplosOficiais.join("\n---\n") || "(nenhum)"}

=== NÃO REPITA ESTES ENFOQUES ===
${p.enunciadosRecentes.map((e) => `- ${e.slice(0, 160)}`).join("\n") || "(nenhum)"}${
    ehDisciplinaDeCalculo(p.disciplina) ? VERIFICACAO_CALCULO : ""
  }`;
}

// ============================================================
// 2. AUDITOR — etapa 1: resolve SEM ver o gabarito
// ============================================================
export const RespostaCegaZ = z.object({
  resposta: LetraZ,
  raciocinio: z.string(),
  confianca: z.coerce.number().min(0).max(1),
});

export const AUDITOR_CEGO_SYSTEM = `Você é um candidato de altíssimo nível e também revisor técnico de concursos bancários.
Resolva a questão. Se houver FONTES, use-as como referência principal. Você NÃO sabe o gabarito. Em cálculo, faça a conta completa.
Responda APENAS com JSON: {"resposta":"A-E","raciocinio":"...","confianca":0.0-1.0}`;

export function auditorCegoUser(q: QuestaoParaResolver, fontes: string[]) {
  return `FONTES:\n${blocoFontes(fontes)}\n\nQUESTÃO:\n${blocoQuestao(q)}`;
}

// ============================================================
// 3. AUDITOR — etapa 2: revisão completa (só roda se a etapa 1 bateu)
// ============================================================
export const RevisaoZ = z.object({
  veredito: z.enum(["aprovada", "rejeitada"]),
  problemas: z.array(z.string()),
});

export const AUDITOR_REVISAO_SYSTEM = `Você é o revisor final de uma banca de concurso. Seu trabalho é BARRAR questões ruins, e uma questão errada que passa é pior do que uma questão boa descartada.

REJEITE se houver QUALQUER um destes problemas:
- mais de uma alternativa defensável, ou nenhuma totalmente correta;
- havendo fontes: gabarito não sustentado literalmente pelo trechoFonte, ou dado (número, prazo, órgão, artigo) ausente das fontes;
- não havendo fontes: qualquer erro conceitual ou de conta;
- explicação que contradiz a fonte ou ensina conceito errado;
- enunciado ambíguo, com dupla interpretação;
- alternativa correta identificável só pela forma (muito mais longa ou com mais ressalvas);
- conteúdo potencialmente desatualizado.

Seja específico em "problemas". Responda APENAS com JSON: {"veredito":"aprovada|rejeitada","problemas":["..."]}`;

export function auditorRevisaoUser(q: QuestaoGerada, fontes: string[]) {
  return `FONTES:\n${blocoFontes(fontes)}\n\nQUESTÃO COMPLETA (JSON):\n${JSON.stringify(q, null, 2)}`;
}

// ============================================================
// 4. EXTRATOR — texto bruto de prova (PDF) → questões estruturadas
// ============================================================
const altOpc = z.string().nullish();
export const QuestaoExtraidaZ = z.object({
  numero: z.coerce.number().int().positive(),
  disciplina: z.string(),
  textoBase: z.string().nullish(),
  referenciaTexto: z.boolean().default(false),
  enunciado: z.string().min(5),
  alternativas: z.object({ A: altOpc, B: altOpc, C: altOpc, D: altOpc, E: altOpc }),
  dependeDeImagem: z.boolean().default(false),
  completa: z.boolean().default(true),
});
export type QuestaoExtraida = z.infer<typeof QuestaoExtraidaZ>;
export const ExtracaoZ = z.object({ questoes: z.array(QuestaoExtraidaZ) });

export const EXTRATOR_SYSTEM = `Você converte o texto bruto (extraído de PDF) de uma prova de concurso em JSON estruturado. Você é um COPISTA, não um professor.

REGRAS
1. Copie textos de apoio, enunciados e alternativas LITERALMENTE. Não corrija, não resuma, não reescreva. Só junte palavras quebradas no fim da linha e remova cabeçalhos, rodapés, números de página e avisos ("RASCUNHO", "BOA PROVA") que caírem no meio do texto.
2. Extraia SOMENTE questões cujo número aparece nesta janela. Se a questão é cortada pelo fim da janela, extraia o que houver e marque "completa": false.
3. "disciplina": exatamente uma destas: ${DISCIPLINAS.join(", ")}. Use o título de seção da prova (ex.: "LÍNGUA PORTUGUESA", "CONHECIMENTOS BANCÁRIOS"). Se o título não aparece na janela, use a SEÇÃO ATUAL informada.
4. "textoBase": se a questão depende de um texto de apoio (ex.: "Texto I", "De acordo com o texto") e esse texto aparece na janela, copie-o inteiro; senão null. Marque "referenciaTexto": true sempre que a questão depender de um texto de apoio, mesmo que ele não esteja na janela.
5. "dependeDeImagem": true se a questão depende de gráfico, figura, tabela ou planilha que não veio legível no texto.
6. NÃO indique gabarito e NÃO resolva nada.

Responda APENAS com JSON:
{"questoes":[{"numero":1,"disciplina":"lingua_portuguesa","textoBase":null,"referenciaTexto":false,"enunciado":"...","alternativas":{"A":"...","B":"...","C":"...","D":"...","E":"..."},"dependeDeImagem":false,"completa":true}]}`;

export function extratorUser(textoJanela: string, secaoAtual: string) {
  return `SEÇÃO ATUAL (no início desta janela): ${secaoAtual}\n\n${textoJanela}`;
}

// ============================================================
// 5. EXPLICADOR — material didático para questões OFICIAIS
// ============================================================
export const ExplicacaoZ = z.object({
  alternativas: z
    .array(
      z.object({
        letra: LetraZ,
        explicacao: z.string().min(20),
        pegadinha: z.string().nullish(),
      })
    )
    .length(5),
  explicacaoGeral: z.string().min(60),
  dicaDeProva: z.string().nullish(),
  dificuldade: z.coerce.number().int().min(1).max(5),
});

export const EXPLICADOR_SYSTEM = `Você é um professor de cursinho preparatório, especialista no concurso do Banco do Brasil. Você recebe uma questão OFICIAL com o GABARITO OFICIAL DEFINITIVO. O gabarito é a verdade: nunca o contradiga nem sugira outra resposta.

Sua tarefa é escrever o material didático da questão:
- "alternativas": para cada letra A–E, uma "explicacao" de por que ela está certa ou errada, apontando o conceito exato. Em questões de cálculo, mostre a conta passo a passo na correta e onde a conta das erradas "escorrega". Em "pegadinha", diga o erro de raciocínio que leva o candidato a marcar aquela errada (null na correta).
- "explicacaoGeral": o conceito por trás da questão, em 3 a 6 frases, para o aluno acertar qualquer variação dela.
- "dicaDeProva": um macete curto.
- "dificuldade": de 1 a 5, para um candidato médio.

Use as FONTES quando existirem. Se precisar de algo fora delas, use apenas conhecimento consolidado e NÃO cite número de norma, artigo, prazo ou percentual de que você não tenha certeza; explique o conceito sem o número.

Responda APENAS com JSON:
{"alternativas":[{"letra":"A","explicacao":"...","pegadinha":"..."}, ...],"explicacaoGeral":"...","dicaDeProva":"...","dificuldade":3}`;

export function explicadorUser(q: QuestaoParaResolver & { gabarito: string }, fontes: string[]) {
  return `FONTES:\n${blocoFontes(fontes)}\n\nQUESTÃO OFICIAL:\n${blocoQuestao(q)}\n\nGABARITO OFICIAL: ${q.gabarito}`;
}
