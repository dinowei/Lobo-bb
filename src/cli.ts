// ============================================================
// BB Estudos — linha de comando
// Uso: npm run bb -- <comando> [opções]
// ============================================================
import "./env.js"; // precisa ser o primeiro import
import mongoose from "mongoose";
import { parseArgs } from "node:util";
import {
  testarConexoes,
  criarIndice,
  semearTopicos,
  ingerirFonte,
  vincularFonteAoTopico,
  ingerirProva,
  explicarOficiais,
  explicarItensCE,
  ingerirProvaCE,
  anularOficial,
  recuperarQuestao,
  revogarFonte,
  mostrarStatus,
  type MetaFonte,
} from "./ingestao.js";
import { gerarQuestao, reabastecerEstoque } from "./pipeline.js";
import { Topic, Source, Chunk, User, Question, Relatorio, Aula, Tarefa, Cartao } from "./models.js";
import { createInterface } from "node:readline";
import { hashSenha, migrarProgresso, donoAntigoId, criarConvite, gerarSenhaProvisoria } from "./auth.js";
import { forcaSenha, NOTA_MINIMA, emailValido, normalizarEmail } from "../shared/senha.js";

// pergunta no terminal; com "oculto", não ecoa o que é digitado (senha)
function perguntar(texto: string, oculto = false): Promise<string> {
  return new Promise((ok) => {
    const rl = createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    if (oculto) {
      const escrever = (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput;
      (rl as unknown as { _writeToOutput: (s: string) => void })._writeToOutput = (s: string) => escrever.call(rl, s.startsWith(texto) ? texto : "");
    }
    rl.question(texto, (r) => {
      rl.close();
      if (oculto) process.stdout.write("\n");
      ok(r);
    });
  });
}
import { join } from "node:path";
import { listarModelos } from "./llm.js";
import { limparTravaOrfa, naFila } from "./fila.js";
import { extrairFigurasOficiais } from "./figuras.js";
import { indexarQuestoes, calibrar } from "./similaridade.js";
import { carregarCatalogo, CORRENTE_DEFINITIVA } from "./catalogo.js";
import { aprovarCorrentes, desfazerCorrentes, correnteAtiva } from "./corrente.js";
import { sondarModelos, verificarModelos } from "./sondagem.js";
import { alvosDaTrilha, calcularAteFila, planejarEtapasDaNoite, planejarNoite, rodarFila } from "./noturno.js";
import { rodarJanelaB } from "./janelaB.js";
import { importarCursinho } from "./cursinho.js";
import { enfileirarIngestao, etapa, etapaAcervo, etapaBackup, etapaClassificacao, etapaDerivacao, etapaFichas, etapaIngestao, filaIngestao, sobraTempo, type EtapaNoite, type ItemIngestao } from "./noiteCompleta.js";
import { planejarPregeracoes } from "./outroJeito.js";
import { gerarTemas, planejarTemasRedacao } from "./redacao.js";
import { gerarAulas, planejarAulas } from "./aulas.js";
import { gerarCartoesAgora, planejarCartoes } from "./cartoes.js";
import { conferirFontesAgora, migrarReferencias, planejarFontesAtuais, reclassificarSemFonte, relatorioFontesAtuais } from "./fontesAtuais.js";
import { limparAudios, limparCacheDeOutrasVozes, planejarVoz, tetoAudioMB } from "./voz.js";
import { perguntarAoBinho } from "./chatBinho.js";
import { executarEvalChat } from "./evalChat.js";
import { ajustarTTLTelemetria, bancosDoCluster, medirColecoes, usoBanco } from "./usoBanco.js";
import type { Disciplina, MotivoContestacao } from "../shared/tipos.js";
import { executarEvalGerador } from "./evalGerador.js";
import { cancelarConvite, listarConvites } from "./admin.js";
import { migrarConcursos, simularMigracaoConcursos } from "./migracaoConcursos.js";
import { migrarSimulados, simularMigracaoSimulados } from "./simulados.js";
import { escreverMapa, indexarAcervo, mapearTemas } from "./acervo.js";
import { gerarFicha } from "./fichas.js";
import { desempatarPendentes } from "./desempate.js";
import { TRILHA } from "../shared/trilha.js";
import { aplicarArvore, auditarAmostra, classificarBanco, itensClassificados, reclassificarOficiais, simularArvore } from "./subtopicos.js";
import { migrarRatings, relatorioCalibragem } from "./rating.js";
import { ordenarTrilhaUnica, relatorioIncidencia } from "./incidencia.js";
import { migrarInicioTrilha } from "./temas.js";
import { derivarCE } from "./certoErrado.js";
import { relatorioDaNoite, META_BANCO } from "./adminTelas.js";
import { rodarAuditor, rodarJuiz, rodarEscritor, escreverRelatorio } from "./benchmark.js";
import { baixarFontes, type Registro } from "./baixar.js";
import { telemetriaPendente } from "./telemetria.js";
import { criarBackupAtlas, simularRestauracao, restaurarBackupAtlas } from "./backup.js";
import { readFile, writeFile } from "node:fs/promises";

const AJUDA = `
BB Estudos — comandos (npm run bb -- <comando>)

  modelos [--filtro nemotron]   lista os modelos que sua chave acessa
  modelos-sondar [id ...]       testa cada modelo do catálogo (JSON, latência, parâmetros aceitos)
  testar                        testa IA e embeddings, mostra o EMBED_DIM
  indice                        cria o índice vetorial no Atlas (uma vez)
  topicos <arquivo.json>        cadastra/atualiza os tópicos do edital
  fonte <arquivo> --tipo <t> --titulo "<título>"
        [--disciplina <d>] [--orgao BACEN] [--ano 2020] [--url ...] [--vigente 2020-11-16]
        tipos: lei | norma_bacen_cmn | edital | material_proprio
  prova <prova.pdf> --gabarito <gabarito.pdf|txt> --nome "<nome>" [--banca cesgranrio] [--ano 2023] [--caderno 1] [--questoes 1-35]
  prova-ce <prova.pdf> --gabarito <gabarito.pdf> --nome "<nome>" [--ano 2024] [--questoes 1-50]   prova Certo/Errado (Cebraspe)
  explicar-ce [--limite 50]       itens C/E oficiais: julgamento às cegas + explicação com o gabarito oficial travado
  explicar [--limite 50]        IA escreve as explicações das oficiais pendentes
  anular --prova "<parte do nome>" --numero <n>   oficial anulada no gabarito definitivo sai de circulação
  recuperar <prova.pdf> --gabarito <txt> --nome "<nome exato>" --numero <n>   traz uma oficial que ficou de fora
  figuras-oficiais [config.json]  extrai as figuras das provas (data/figuras-oficiais.json) para conferência
  gerar --assunto "<parte do nome>" [--n 3] [--tipo "<tipo>"]   gera questões novas de um tópico
  aulas [--assunto "<parte do nome>"] [--n 3]   prepara aulas curtas aprovadas por tópico
  cartoes [--assunto "<parte do nome>"] [--n 3] prepara cartões (normas com fonte e vocabulário de Inglês)
  fontes-atuais migrar|conferir [--n 5] [--disciplina id]|relatorio  fonte da prova + fonte atual de cada questão
  vincular-fonte --fonte "<título exato>" --assunto "<tópico exato>" --simular|--confirmar  prévia e vínculo aditivo
  eval-chat [--n 12] [--casos a,b]  roda o golden set do Binho em série, sem guardar respostas de avaliação
  eval-gerador [--n 1] [--assuntos "A;B"]  gera nos 8 tópicos de maior peso e mostra aprovação e motivos
  binho --assunto "<tópico>" --pergunta "<texto>"  o chat "Pergunte ao Binho" como o dono
  contestar <id> --motivo <m> [--comentario "..."] --simular|--confirmar  tira a questão de circulação
  uso-banco [ajustar]           espaço no Atlas por coleção; "ajustar" aplica TTL de 30 dias e teto do áudio
  corrente definitiva|desfazer  ativa a corrente de modelos aprovada pelo dono (ou volta à anterior)
  voz limpar                    tira do cache o áudio de vozes fora da lista aprovada
  rating-migrar                                  recalcula o rating Elo de questões e aluno a partir das tentativas
  calibragem                                     onde o rótulo de dificuldade da IA mais erra (questões com 5+ respostas)
  importar-cursinho <pdf> --nome "<nome>" [--formato multipla|ce] [--banca x] [--disciplina x]   questões de cursinho (camada C, fora do simulado fiel)
  janela-b [--forcar]                            Janela B (padrão 18:00–19:00): sem noite = essencial; com noite = recupera pendentes
  fila-ingestao [--add itens.json]               provas/leis que o noturno ingere, uma por noite (lista ou acrescenta)
  derivar-ce [--n 6]                             itens Certo/Errado de múltiplas aprovadas (código monta, IA reescreve, auditor julga às cegas)
  migrar-trilha-unica --simular|--confirmar      início da trilha: nº do tema (por concurso) → subtópico (por aluno); rodar ANTES do trilha-ordenar
  trilha-ordenar --simular|--confirmar           trilha única: ordem por código (comuns, peso × incidência, pré-requisitos) → data/trilha.json
  incidencia                                     quantas vezes cada subtópico caiu nas oficiais, por banca e ano → docs/INCIDENCIA.md
  estoque [--min 30]            completa o estoque mínimo de todos os tópicos
  noturno [--max 20] [--ate 05:00]  planeja a noite e roda a fila persistida (tela Fila)
  backup                        exporta as coleções críticas do Atlas para backups/ (gzip + manifest)
  restaurar <pasta> --simular   valida o backup e mostra contagens, sem alterar o banco
  restaurar <pasta> --confirmar valida, cria rollback, pede confirmação digitada e restaura
  limpar-trava-orfa <pid>       só libera a trava local se o processo já terminou
  temas [--n 10]                prepara temas inéditos para redação
  criar-admin <email>           sua conta de administrador (pede a senha) e leva seu progresso para ela
  convite [--max 7]             código de cadastro de uso único (validade em dias)
  senha <email>                 senha provisória para quem esqueceu
  liberar-fonte "Glossário de Vendas"   seu OK: ingere a fonte doutrinária escrita por IA (antes não gera)
  ingerir-fontes <id> --simular|--confirmar  simula contagens; confirma uma fonte oficial por vez
  baixar-fontes [id ...]        baixa as leis e normas de data/fontes-oficiais.json (só sites oficiais) para fontes/
  verificar-modelos             1 chamada curta por modelo do catálogo (a verificação semanal)
  benchmark auditor|juiz|escritor|relatorio [--max N]   compara os modelos grátis (docs/BENCHMARK-MODELOS.md)
  revogar <id | parte do título>  norma mudou: tira fonte e questões de circulação
  status                        raio-x: trechos, questões, cenários e descartes por repetição por tópico
  similaridade indexar          calcula o embedding das questões que ainda não têm (filtro anti-repetição)
  similaridade calibrar         gera docs/CALIBRAGEM-SIMILARIDADE.md com os pares perto dos limites
  convites [cancelar-validos --simular|--confirmar]   lista os convites; usuário único cancela os válidos
  migrar-concursos --simular|--confirmar   concurso e banca como dado (contagens iguais antes e depois)
  arvore --simular|--confirmar  árvore de subtópicos: tópicos do BACEN e concursos de cada tópico
  classificar-subtopicos --simular|--confirmar [--ia] [--oficiais] [--n 40]   subtópico de cada questão; --n audita amostra
  migrar-simulados --simular|--confirmar   simulados antigos ganham o resumo recalculado das tentativas
  acervo indexar                índice local do acervo por hash (só leitura no OneDrive; pula o que está só na nuvem)
  acervo mapa                   mapa tema → páginas (A > B > C) em docs/CRONOGRAMA-MATERIAL.md e data/temas.json (automático)
  desempatar-pendentes          Português por construção aguardando juiz independente: desempate às cegas, o código decide
  fichas [--tema crase] [--n 3]  ficha do tema com o acervo: gerador → código confere cada trecho → auditor de outra família
`;

function exigir(v: string | undefined, nome: string): string {
  if (!v) throw new Error(`Faltou ${nome}. Veja "npm run bb -- ajuda".`);
  return v;
}

async function main() {
  const [comando, ...resto] = process.argv.slice(2);
  if (!comando || ["ajuda", "help", "--help", "-h"].includes(comando)) {
    console.log(AJUDA);
    return;
  }

  const { values: o, positionals: args } = parseArgs({
    args: resto,
    allowPositionals: true,
    options: {
      pergunta: { type: "string" },
      casos: { type: "string" },
      motivo: { type: "string" },
      assuntos: { type: "string" },
      ia: { type: "boolean" },
      oficiais: { type: "boolean" },
      tema: { type: "string" },
      add: { type: "string" },
      formato: { type: "string" },
      forcar: { type: "boolean" },
      comentario: { type: "string" },
      tipo: { type: "string" },
      titulo: { type: "string" },
      disciplina: { type: "string" },
      orgao: { type: "string" },
      ano: { type: "string" },
      url: { type: "string" },
      vigente: { type: "string" },
      gabarito: { type: "string" },
      nome: { type: "string" },
      banca: { type: "string", default: "cesgranrio" },
      caderno: { type: "string" },
      questoes: { type: "string" },
      limite: { type: "string" },
      assunto: { type: "string" },
      n: { type: "string" },
      min: { type: "string" },
      filtro: { type: "string" },
      prova: { type: "string" },
      numero: { type: "string" },
      fonte: { type: "string" },
      max: { type: "string" },
      ate: { type: "string" },
      simular: { type: "boolean" },
      confirmar: { type: "boolean" },
    },
  });

  if (comando === "testar") return testarConexoes();
  if (comando === "modelos") {
    const f = (o.filtro ?? "").toLowerCase();
    const ids = (await listarModelos("GERADOR")).filter((id) => id.toLowerCase().includes(f));
    console.log(ids.join("\n") || "Nenhum modelo com esse filtro.");
    console.log(`\n${ids.length} modelo(s). Copie o id exato para o .env.`);
    return;
  }

  await mongoose.connect(exigir(process.env.MONGODB_URI, "MONGODB_URI no .env"));
  // jobs de IA entram na fila (um por vez); o rótulo aparece para quem estiver esperando
  const rotulo = `bb ${[comando, ...resto].join(" ")}`.slice(0, 160);
  try {
    switch (comando) {
      case "limpar-trava-orfa": {
        const pid = Number(args[0]);
        const limpa = await limparTravaOrfa(pid);
        return console.log(limpa ? `✔ Trava órfã do PID ${pid} liberada.` : `Nenhuma trava órfã do PID ${pid} foi removida.`);
      }

      case "indice":
        return await criarIndice();

      case "topicos":
        return await semearTopicos(exigir(args[0], "o arquivo JSON de tópicos"));

      case "fonte": {
        const tipos = ["lei", "norma_bacen_cmn", "edital", "material_proprio"];
        const tipo = exigir(o.tipo, "--tipo");
        if (!tipos.includes(tipo)) throw new Error(`--tipo deve ser: ${tipos.join(" | ")}`);
        return await naFila(rotulo, () =>
          ingerirFonte(exigir(args[0], "o arquivo da fonte"), {
            tipo: tipo as MetaFonte["tipo"],
            titulo: exigir(o.titulo, "--titulo"),
            disciplina: o.disciplina,
            orgao: o.orgao,
            ano: o.ano ? Number(o.ano) : undefined,
            url: o.url,
            vigenteDesde: o.vigente ? new Date(o.vigente) : undefined,
          })
        );
      }

      case "prova":
        return await naFila(rotulo, () =>
          ingerirProva(exigir(args[0], "o PDF da prova"), exigir(o.gabarito, "--gabarito"), {
            nome: exigir(o.nome, "--nome"),
            banca: o.banca!,
            ano: o.ano ? Number(o.ano) : undefined,
            caderno: o.caderno,
            questoes: o.questoes,
          })
        );

      case "explicar":
        return await naFila(rotulo, () => explicarOficiais(o.limite ? Number(o.limite) : 50));

      case "prova-ce":
        return await naFila(rotulo, async () => {
          await ingerirProvaCE(exigir(args[0], "o PDF da prova"), exigir(o.gabarito, "--gabarito"), {
            nome: exigir(o.nome, "--nome"),
            banca: o.banca === "cesgranrio" ? "cebraspe" : o.banca!, // padrão do CLI é cesgranrio; C/E é Cebraspe
            ano: o.ano ? Number(o.ano) : undefined,
            caderno: o.caderno,
            questoes: o.questoes,
          });
        });

      case "explicar-ce":
        return await naFila(rotulo, () => explicarItensCE(o.limite ? Number(o.limite) : 50));

      case "figuras-oficiais":
        return await extrairFigurasOficiais(args[0] ?? "data/figuras-oficiais.json");

      case "recuperar": {
        const numero = Number(exigir(o.numero, "--numero"));
        return await naFila(rotulo, () =>
          recuperarQuestao(exigir(args[0], "o PDF da prova"), exigir(o.gabarito, "--gabarito"), exigir(o.nome, "--nome"), numero)
        );
      }

      case "acervo": {
        // índice local por hash (só leitura no OneDrive) e mapa tema → páginas, A > B > C, marcado como automático
        if (args[0] === "indexar") {
          const r = await indexarAcervo();
          console.log(`PDFs: ${r.total} · novos indexados ${r.novos} · já no índice ${r.jaIndexados} · só na nuvem ${r.nuvem.length} · erros ${r.erros.length} · páginas ${r.paginas}`);
          for (const n of r.nuvem) console.log(`  ☁ pulado (só na nuvem): ${n}`);
          for (const e of r.erros) console.log(`  ✖ ${e}`);
          return;
        }
        if (args[0] === "mapa") {
          const r = escreverMapa(mapearTemas());
          return console.log(`✔ docs/CRONOGRAMA-MATERIAL.md · temas com material: ${r.comMaterial}/${r.total} · data/temas.json: ${r.novos} tema(s) novo(s) (automáticos), ${r.mantidos} conferido(s) mantido(s)`);
        }
        throw new Error('Use "acervo indexar" ou "acervo mapa".');
      }

      case "desempatar-pendentes": {
        // V2 Janela B: questões de Português por construção que esperavam juiz independente
        return await naFila(rotulo, async () => {
          const r = await desempatarPendentes();
          console.log(`Aguardando juiz: ${r.total} · aprovadas ${r.aprovadas} · rejeitadas ${r.rejeitadas} · continuam aguardando ${r.aguardando}`);
        });
      }

      case "fichas": {
        // F11: ficha por subtópico com o acervo (gerador → código confere trecho → auditor de outra família)
        const alvo = o.tema ? [o.tema] : TRILHA.map((t) => t.subtopico).slice(0, o.n ? Number(o.n) : 3);
        return await naFila(rotulo, async () => {
          for (const s of alvo) {
            const r = await gerarFicha(s);
            console.log(`${r.status === "aprovada" ? "✔" : "·"} ${s}: ${r.status}${"afirmacoes" in r && r.afirmacoes !== undefined ? ` (${r.afirmacoes} afirmações)` : ""}${r.motivos.length ? ` — ${r.motivos.join("; ")}` : ""}`);
          }
        });
      }

      case "migrar-simulados": {
        // simulados antigos ganham o resumo recalculado das tentativas (nada é apagado)
        if (o.simular === o.confirmar) throw new Error("Escolha exatamente uma opção: --simular ou --confirmar.");
        if (o.simular) {
          const s = await simularMigracaoSimulados();
          return console.log(`Tentativas ${s.tentativas} (${s.tentativasSimulado} de simulado) · simulados ${s.simulados} · com resumo ${s.comResumo} · faltam ${s.faltam}`);
        }
        const r = await migrarSimulados();
        console.log(`Antes: tentativas ${r.antes.tentativas} · simulados ${r.antes.simulados} · com resumo ${r.antes.comResumo}`);
        console.log(`Depois: tentativas ${r.depois.tentativas} · simulados ${r.depois.simulados} · com resumo ${r.depois.comResumo} · criados ${r.criados}`);
        if (!r.ok) throw new Error("As contagens não bateram: confira antes de seguir.");
        return console.log("✔ Simulados com resumo; tentativas intactas.");
      }

      case "migrar-concursos": {
        // concurso e banca como dado: só preenche o que falta; --simular conta, --confirmar migra e confere
        if (o.simular === o.confirmar) throw new Error("Escolha exatamente uma opção: --simular ou --confirmar.");
        if (o.simular) {
          const s = await simularMigracaoConcursos();
          console.log(`Contagens: ${Object.entries(s.contagens).map(([c, n]) => `${c} ${n}`).join(" · ")}`);
          for (const p of s.passos) console.log(`  ${String(p.afetados).padStart(4)} ${p.colecao}: ${p.descricao}`);
          return console.log(`Índice antigo do Elo (aluno + disciplina): ${s.indiceAntigoElo ? "existe, sai na migração" : "já não existe"}`);
        }
        const r = await migrarConcursos();
        for (const f of r.feitos) console.log(`  ${String(f.alterados).padStart(4)} ${f.colecao}: ${f.descricao}`);
        console.log(`Antes: ${Object.entries(r.antes).map(([c, n]) => `${c} ${n}`).join(" · ")}`);
        console.log(`Depois: ${Object.entries(r.depois).map(([c, n]) => `${c} ${n}`).join(" · ")}`);
        if (!r.iguais) throw new Error("As contagens mudaram: confira com o backup antes de seguir.");
        return console.log("✔ Migração concluída com as mesmas contagens.");
      }

      case "arvore": {
        // árvore de subtópicos: --simular mostra; --confirmar cria os tópicos do BACEN e liga os concursos
        if (o.simular === o.confirmar) throw new Error("Escolha exatamente uma opção: --simular ou --confirmar.");
        const r: Awaited<ReturnType<typeof simularArvore>> & { ligados?: number; questoes?: number } = o.simular ? await simularArvore() : await naFila(rotulo, () => aplicarArvore());
        console.log(`Tópicos: ${r.topicos}; sem subtópico: ${r.semSubtopico.length ? r.semSubtopico.join(", ") : "nenhum"}`);
        for (const m of r.mudancas.slice(0, 80)) console.log(`  ${m.assunto}: [${m.antes}] → [${m.depois}]`);
        if (r.ligados !== undefined) console.log(`✔ ${r.ligados} tópico(s) ligados aos concursos; ${r.questoes} questão(ões) herdaram os concursos do tópico.`);
        return;
      }

      case "classificar-subtopicos": {
        // código primeiro; --ia manda os ambíguos ao modelo; --confirmar grava; --auditar N confere amostra
        if (o.simular === o.confirmar) throw new Error("Escolha exatamente uma opção: --simular ou --confirmar.");
        const ia = !!o.ia;
        const rodar = async () => {
          if (o.oficiais) {
            const ro = await reclassificarOficiais(!!o.confirmar);
            console.log(`Oficiais: ${ro.total}; iguais ${ro.iguais}; mudaram ${ro.mudaram}; falhou ${ro.falhou}${o.confirmar ? " (gravado)" : " (simulação)"}`);
            for (const m of ro.mudancas) console.log(`  ↻ ${m}`);
          }
          const r = await classificarBanco({ ia, gravar: !!o.confirmar });
          console.log(`Sem subtópico: ${r.total}; por método: ${Object.entries(r.porMetodo).map(([m, n]) => `${m} ${n}`).join(" · ")}; ambíguas restantes: ${r.ambiguas}; modelo falhou: ${r.iaFalhou}; gravadas: ${r.gravadas}`);
          if (o.n) {
            // nada novo para classificar → audita o que já está classificado
            const a = await auditarAmostra(r.classificadas.length ? r.classificadas : await itensClassificados(), Number(o.n));
            console.log(`Auditoria da amostra: ${a.ok}/${a.julgadas} = ${Math.round(a.taxa * 100)}%`);
            for (const e of a.erros) console.log(`  ✖ ${e}`);
          }
        };
        return ia || o.n || o.oficiais ? await naFila(rotulo, rodar) : await rodar();
      }

      case "convites": {
        // usuário único: lista os convites e cancela os que ainda valem (--simular mostra, --confirmar cancela)
        const lista = await listarConvites();
        const validos = lista.filter((c) => c.situacao === "valido");
        console.log(`Convites: ${lista.length} (${["valido", "usado", "expirado", "cancelado"].map((s) => `${s} ${lista.filter((c) => c.situacao === s).length}`).join(" · ")})`);
        if (args[0] !== "cancelar-validos") return;
        if (o.simular === o.confirmar) throw new Error("Escolha exatamente uma opção: --simular ou --confirmar.");
        for (const c of validos) console.log(`  ${c.codigo} · criado ${c.criadoEm.slice(0, 10)} · expira ${c.expiraEm.slice(0, 10)}`);
        if (o.simular) return console.log(`Simulação: ${validos.length} convite(s) válido(s) seriam cancelados.`);
        let n = 0;
        for (const c of validos) n += (await cancelarConvite(c.id)) ? 1 : 0;
        return console.log(`✔ ${n} convite(s) cancelado(s).`);
      }

      case "eval-gerador": {
        // F4: 1 (ou --n) questão em cada um dos 8 tópicos de maior peso; --assuntos "A;B" repete só esses
        // (separador ";": nome de tópico tem vírgula, ex.: "Atendimento, satisfação e experiência do cliente")
        const n = o.n ? Number(o.n) : 1;
        return await naFila(rotulo, async () => {
          const r = await executarEvalGerador(n, o.assuntos ? o.assuntos.split(";").map((s) => s.trim()).filter(Boolean) : []);
          console.log("\nAprovação por tópico:");
          for (const l of r.linhas) console.log(`  ${l.aprovadas}/${l.total}  ${l.assunto} (${l.disciplina}) · ${Math.round(l.segundos / Math.max(1, l.total))}s/questão${l.motivos.length ? ` · ${l.motivos.join(", ")}` : ""}`);
          console.log(`Total: ${r.linhas.reduce((s, l) => s + l.aprovadas, 0)}/${r.linhas.reduce((s, l) => s + l.total, 0)}${r.parouNoTeto ? " (parou no teto diário)" : ""}`);
          console.log(`Motivos de descarte mais comuns: ${r.motivos.map((m) => `${m.motivo} (${m.n})`).join(", ") || "nenhum"}`);
        });
      }

      case "contestar": {
        // tira uma questão de circulação pelo mesmo caminho do botão "Contestar" (Report + status contestada)
        const id = exigir(args[0], "o id da questão");
        const motivos = ["gabarito_errado", "duas_corretas", "desatualizada", "ambigua", "explicacao_ruim"];
        const motivo = o.motivo ?? "ambigua";
        if (!motivos.includes(motivo)) throw new Error(`--motivo deve ser: ${motivos.join(" | ")}`);
        if (o.simular === o.confirmar) throw new Error("Escolha exatamente uma opção: --simular ou --confirmar.");
        const q = await Question.findById(id).select("status enunciado").lean();
        if (!q) throw new Error("Questão não encontrada.");
        console.log(`${id} · status ${q.status} · ${q.enunciado.replace(/\s+/g, " ").slice(0, 100)}…`);
        if (o.simular) return console.log(`Simulação: viraria "contestada" (motivo ${motivo}). Desfazer depois: status "${q.status}".`);
        const { apiServidor } = await import("./estudo.js");
        await apiServidor.contestar(id, motivo as MotivoContestacao, o.comentario);
        return console.log(`✔ contestada (antes: ${q.status}).`);
      }

      case "anular": {
        const numero = Number(exigir(o.numero, "--numero"));
        if (!Number.isInteger(numero) || numero < 1) throw new Error("--numero deve ser o nº da questão na prova (ex.: 7)");
        return await anularOficial(exigir(o.prova, "--prova"), numero);
      }

      case "gerar": {
        const busca = exigir(o.assunto, "--assunto");
        const topico = await Topic.findOne({
          assunto: new RegExp(busca.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
        });
        if (!topico) throw new Error(`Nenhum tópico com "${busca}" no nome. Veja "npm run bb -- status".`);
        const n = o.n ? Number(o.n) : 1;
        return await naFila(rotulo, async () => {
          console.log(`Gerando ${n} questão(ões) de "${topico.assunto}"…`);
          let aprovadas = 0;
          const t0 = Date.now();
          for (let i = 0; i < n; i++) {
            const ti = Date.now();
            const r = await gerarQuestao(String(topico._id), 3, { tipo: o.tipo });
            const seg = Math.round((Date.now() - ti) / 1000);
            const v = r.variacao ? ` [${r.variacao.tipo} · ${r.variacao.contexto}${r.variacao.duasEtapas ? " · 2 etapas" : ""}]` : "";
            if (r.ok) aprovadas++;
            console.log(r.ok ? `✔ aprovada: ${r.questionId}${v} (${seg}s)` : `✖ ${r.motivo}${v} (${seg}s) ${r.detalhes?.join(" | ") ?? ""}`);
            if (!r.ok && r.motivo === "teto_diario") break; // GERACAO_MAX_DIA: amanhã tem mais
          }
          console.log(`\n${aprovadas}/${n} aprovadas · ${Math.round((Date.now() - t0) / 1000 / n)}s em média por questão`);
        });
      }

      case "temas": {
        return await naFila(rotulo, async () => {
          const n = o.n ? Number(o.n) : 10;
          const r = await gerarTemas(n);
          console.log(`Temas: ${r.concluidas} tarefa(s) concluída(s), ${r.descartadas} descartada(s), ${r.aguardando} aguardando nova tentativa.`);
        });
      }

      case "rating-migrar": {
        const r = await migrarRatings();
        console.log(`✔ Ratings recalculados: ${r.tentativas} tentativas, ${r.questoes} questões, ${r.alunos} rating(s) de aluno por disciplina.`);
        return;
      }

      case "importar-cursinho": {
        // E7: questões de cursinho (origem "cursinho", camada C, gabarito do material por código, fora do simulado fiel)
        const formato = o.formato === "ce" ? "ce" : "multipla";
        return await naFila(rotulo, async () => {
          const r = await importarCursinho(exigir(args[0], "o PDF do material"), { nome: exigir(o.nome, "--nome"), formato, banca: o.banca, disciplina: o.disciplina });
          if (r.ja) return console.log("↷ esse material já foi importado — pulando");
          console.log(JSON.stringify(r, (k, v) => (k === "recusados" ? (v as unknown[]).length : v)));
          for (const x of ("recusados" in r ? r.recusados ?? [] : []).slice(0, 10)) console.log(`  ✖ nº ${x.numero}: ${x.motivo}`);
          console.log('Próximo passo: "explicar" (múltipla) ou "explicar-ce" (C/E).');
        });
      }

      case "janela-b": {
        // E8: recuperação/enriquecimento no horário da Janela B (Config "janelas"); --forcar roda fora do horário
        return await naFila(rotulo, async () => {
          const r = await rodarJanelaB({ forcar: !!o.forcar });
          console.log(`Janela B (${r.rodou ? "a noite rodou: recuperação" : "a noite NÃO rodou: essencial"}): ${r.etapas.map((e) => `${e.etapa} ${e.status}`).join(" · ")} · ${r.chamadas} chamada(s)`);
        });
      }

      case "fila-ingestao": {
        // E6: fila de provas/leis que o noturno ingere, uma por noite. "--add" lê um JSON (lista de ItemIngestao)
        if (o.add) {
          const itens = JSON.parse(await readFile(o.add, "utf8")) as ItemIngestao[];
          const r = await enfileirarIngestao(itens);
          return console.log(`Fila de ingestão: ${r.antes} → ${r.depois}`);
        }
        const fila = await filaIngestao();
        console.log(`Fila de ingestão: ${fila.length} item(ns)`);
        for (const [i, it] of fila.entries()) console.log(`  ${i + 1}. [${it.comando}] ${it.nome}`);
        return;
      }

      case "derivar-ce": {
        // F10: itens Certo/Errado a partir de múltiplas aprovadas (--n = nº de questões; 5 itens cada)
        return await naFila(rotulo, async () => {
          const r = await derivarCE({ questoes: o.n ? Number(o.n) : 6 });
          console.log(`\nDerivação C/E: ${r.questoes} questão(ões), ${r.itens} itens, ${r.aprovados} aprovados (${r.itens ? Math.round((r.aprovados / r.itens) * 100) : 0}%)`);
          for (const [m, n] of Object.entries(r.motivos)) console.log(`  ✖ ${m}: ${n}`);
        });
      }

      case "migrar-trilha-unica": {
        // onde a trilha começa: número do tema (ordem antiga, por concurso) → subtópico (por aluno). Antes do trilha-ordenar.
        if (o.simular === o.confirmar) throw new Error("Escolha exatamente uma opção: --simular ou --confirmar.");
        const r = await migrarInicioTrilha(!!o.confirmar);
        console.log(`Início da trilha: ${r.antigos} registro(s) antigo(s) de ${r.alunos} aluno(s); novos antes ${r.jaNovos}, depois ${r.depois}${o.confirmar ? "" : " (simulação)"}`);
        for (const p of r.plano) console.log(`  ${p.aluno}: ${p.de} → ${p.para.subtopico} (desde ${p.para.desde})`);
        if (o.confirmar && r.depois < r.alunos) throw new Error(`Contagem não bate: ${r.alunos} aluno(s) e ${r.depois} registro(s) novo(s)`);
        return;
      }

      case "trilha-ordenar": {
        // trilha única: só lê o banco (incidência); --confirmar reescreve data/trilha.json
        if (o.simular === o.confirmar) throw new Error("Escolha exatamente uma opção: --simular ou --confirmar.");
        const r = await ordenarTrilhaUnica(!!o.confirmar);
        console.log(`Trilha única: ${r.antes} → ${r.nova.length} temas; entram ${r.entram.length}, saem ${r.saem.length}${o.confirmar ? " (gravado em data/trilha.json)" : " (simulação)"}`);
        if (r.saem.length) console.log(`  ⚠ saem: ${r.saem.join(", ")}`);
        for (const t of r.nova) console.log(`${String(t.n).padStart(3)}. ${t.nome} [${t.concursos.join(", ")}] · ${t.prioridade}`);
        return;
      }

      case "incidencia": {
        // só leitura do banco + docs/INCIDENCIA.md (F8: quantas vezes cada subtópico caiu, por banca e ano)
        const r = await relatorioIncidencia();
        console.log(`Top 10 de incidência (${r.linhas.length} subtópicos com questão oficial; ${r.semSubtopico} oficiais sem subtópico)\n`);
        for (const [i, l] of r.linhas.slice(0, 10).entries())
          console.log(`${String(i + 1).padStart(2)}. ${l.chave}: ${l.total} questões em ${l.provas} prova(s) · ${Object.entries(l.porBanca).map(([b, n]) => `${b} ${n}`).join(", ")}`);
        console.log(`\n✔ ${r.arquivo}`);
        return;
      }

      case "calibragem": {
        const linhas = await relatorioCalibragem();
        if (!linhas.length) return console.log(`Ainda não há questões com 5+ respostas para comparar o rótulo com o rating.`);
        console.log("Rótulo da dificuldade × dificuldade medida pelo rating (erro > 0: o rótulo exagera a dificuldade)\n");
        for (const l of linhas) console.log(`${l.erroMedio >= 0 ? "+" : ""}${l.erroMedio.toFixed(2)}  n=${l.n}  ↑${l.superestima} ↓${l.subestima}  ${l.grupo}`);
        return;
      }

      case "uso-banco": {
        // espaço no Atlas por coleção (só leitura); "uso-banco ajustar" aplica o TTL de 30 dias e o teto do áudio
        if (args[0] === "ajustar") {
          console.log(await ajustarTTLTelemetria() ? "✔ Telemetria: TTL ajustado para 30 dias." : "Telemetria: TTL já está em 30 dias.");
          const l = await limparAudios();
          console.log(`Áudio: ${l.removidos} removido(s); cache em ${l.mb} MB (teto ${tetoAudioMB()} MB).`);
        }
        const [total, cols] = await Promise.all([usoBanco(), medirColecoes()]);
        console.log(`Atlas: ${total.usadoMB} MB de ${total.limiteMB} MB (${Math.round(total.fracao * 100)}%) · dbStats: dados ${total.dadosMB} · índices ${total.indicesMB} · em disco ${total.discoMB} MB`);
        console.log(`Índice vetorial estimado: ${total.indiceVetorMB} MB · ${total.chunks} chunks × ${total.vetorKBPorChunk} KB (${total.dimensoesVetor} dimensões)`);
        console.log(`Projeção: +${total.crescimentoKBPorChunk} KB por chunk novo · ~${total.novosChunksAteAlerta.toLocaleString("pt-BR")} chunks até o alerta de 80% · ~${total.novosChunksAteLimite.toLocaleString("pt-BR")} até ${total.limiteMB} MB\n`);
        console.log("coleção                     docs     dados MB  índices MB  disco MB  média KB");
        for (const c of cols) console.log(`${c.nome.padEnd(26)} ${String(c.docs).padStart(6)}  ${String(c.dadosMB).padStart(9)}  ${String(c.indicesMB).padStart(10)}  ${String(c.discoMB).padStart(8)}  ${String(c.mediaKB).padStart(8)}`);
        const bancos = await bancosDoCluster();
        if (bancos) {
          console.log("\nBancos no cluster (todos contam no limite do Atlas grátis):");
          for (const b of bancos) console.log(`  ${b.nome.padEnd(24)} dados ${b.dadosMB} MB · índices ${b.indicesMB} MB${b.app ? "  ← o do app" : ""}`);
        }
        return;
      }

      case "binho": {
        // binho --assunto "<parte do tópico>" --pergunta "...": o chat "Pergunte ao Binho" como o dono (ALUNO_ID)
        const busca = exigir(o.assunto, "--assunto");
        const topico = await Topic.findOne({ assunto: new RegExp(busca.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i") }).select("_id assunto").lean();
        if (!topico) throw new Error(`Nenhum tópico com "${busca}" no nome.`);
        const r = await perguntarAoBinho(String(topico._id), process.env.ALUNO_ID || "000000000000000000000001", exigir(o.pergunta, "--pergunta"));
        console.log(`Tópico: ${topico.assunto}`);
        if (r.mensagem) return console.log(`(aviso) ${r.mensagem}`);
        console.log(`\n${r.resposta}\n`);
        for (const c of r.citacoes ?? []) console.log(`  · ${c.titulo}: “${c.trecho}”`);
        return console.log(`origem: ${r.origem}${r.restantesHoje !== undefined ? ` · restam ${r.restantesHoje} hoje` : ""}`);
      }

      case "eval-chat": {
        const r = await executarEvalChat(o.n ? Number(o.n) : 12, o.casos ? o.casos.split(",").map((s) => s.trim()).filter(Boolean) : []);
        console.log(`\nChat Binho: ${r.respostasAprovadas}/${r.casos} resultados aprovados; ${r.naoAcheiCorretos} "não achei" corretos; ${r.invencoesAceitas} invenção(ões) ACEITA(S); ${r.invencoesBarradas} invenção(ões) barrada(s); ${r.reescritas} reescrita(s).`);
        console.log(`Respostas úteis com base: ${r.respostasUteisComBase}/${r.perguntasComBase}; artigos esperados citados: ${r.artigosEsperadosEncontrados}; úteis sem base declarada: ${r.respostasUteisSemBaseDeclarada}; falhas de infraestrutura: ${r.falhasInfraestrutura}; tempo: ${r.segundos}s.`);
        for (const item of r.itens) console.log(`  ${item.estado.padEnd(9)} ${item.id} (${item.segundos}s) — ${item.resumo}`);
        return;
      }

      case "voz": {
        // voz limpar: só remove IDs fora da lista aprovada; preserva cache de escolhas explícitas.
        if (args[0] !== "limpar") throw new Error('Use "voz limpar".');
        return console.log(`✔ ${await limparCacheDeOutrasVozes()} áudio(s) de vozes desconhecidas removido(s); cache de Louise, Diego e Isabela preservado.`);
      }

      case "fontes-atuais": {
        // fonte da prova + fonte atual de cada questão: migrar (sem IA) · conferir [--n 5] (fila de IA) · relatorio
        if (args[0] === "migrar") {
          console.log(`✔ ${await migrarReferencias()} questão(ões) ganharam a camada de fontes (nada foi apagado).`);
          return console.log(`✔ ${await reclassificarSemFonte()} pendente(s) viraram "não se aplica" (Informática sem lei aplicável e conceitos estáveis).`);
        }
        if (args[0] === "relatorio") {
          const r = await relatorioFontesAtuais();
          for (const [d, s] of Object.entries(r.porDisciplina)) console.log(`${d}: ${Object.entries(s).map(([k, v]) => `${k} ${v}`).join(" · ")}`);
          if (r.mudancas.length) console.log(`\n${r.mudancas.length} mudança(s) esperando seu OK (Admin → Pendências).`);
          if (r.faltaIngerir.length) console.log(`\nNormas a ingerir (tópicos com questões sem base atual):\n${r.faltaIngerir.slice(0, 15).map((t) => `  ${t.questoes} · ${t.topico} (${t.disciplina})`).join("\n")}`);
          // --disciplina X: uma linha por questão OFICIAL dessa disciplina (prova, nº, situação, tópico) — só leitura
          if (o.disciplina) {
            const tops = await Topic.find({ disciplina: o.disciplina as Disciplina }).select("assunto").lean();
            const assunto = new Map(tops.map((t) => [String(t._id), t.assunto]));
            const qs = await Question.find({ topicId: { $in: tops.map((t) => t._id) }, origem: "oficial" }).select("prova numeroOriginal situacaoFonte topicId status").sort({ prova: 1, numeroOriginal: 1 }).lean();
            console.log(`\nOficiais de ${o.disciplina} (${qs.length}):`);
            for (const q of qs) console.log(`  ${(q.prova ?? "").slice(0, 34).padEnd(34)} Q${String(q.numeroOriginal ?? "?").padEnd(3)} ${String(q.situacaoFonte ?? "—").padEnd(13)} ${q.status.padEnd(12)} ${assunto.get(String(q.topicId)) ?? ""}`);
          }
          return;
        }
        if (args[0] !== "conferir") throw new Error('Use "fontes-atuais migrar", "fontes-atuais conferir [--n 5]" ou "fontes-atuais relatorio".');
        return await naFila(rotulo, async () => {
          const r = await conferirFontesAgora(o.n ? Number(o.n) : 5, o.disciplina);
          console.log(`Fontes atuais: ${r.concluidas} conferida(s), ${r.descartadas} sem base atual ou com erro, ${r.aguardando} aguardando.`);
        });
      }

      case "cartoes": {
        return await naFila(rotulo, async () => {
          const r = await gerarCartoesAgora({ assunto: o.assunto, n: o.n ? Number(o.n) : 3 });
          console.log(`Cartões: ${r.concluidas} lote(s) com aprovados, ${r.descartadas} descartado(s), ${r.aguardando} aguardando nova tentativa.`);
          const amostra = await Cartao.find({ status: "aprovado" }).sort({ createdAt: -1 }).limit(3).lean();
          for (const c of amostra) console.log(`\n  ${c.frente}\n  → ${c.verso}\n  [${c.titulo}] "${c.trecho}"`);
        });
      }

      case "aulas": {
        return await naFila(rotulo, async () => {
          const r = await gerarAulas({ assunto: o.assunto, n: o.n ? Number(o.n) : 3 });
          console.log(`Aulas: ${r.concluidas} tarefa(s) concluída(s), ${r.descartadas} descartada(s), ${r.aguardando} aguardando nova tentativa.`);
          const tarefa = await Tarefa.findOne({ tipo: "aula", status: "concluida" }).sort({ updatedAt: -1 }).lean();
          const amostra = tarefa?.resultadoId ? await Aula.findOne({ _id: tarefa.resultadoId, status: "aprovada" }).lean() : null;
          const topico = amostra ? await Topic.findById(amostra.topicId).select("assunto").lean() : null;
          if (amostra && topico) console.log(`\nAmostra aprovada — ${topico.assunto}:\n\n${amostra.conteudo}`);
        });
      }

      case "estoque":
        return await naFila(rotulo, () => reabastecerEstoque(o.min ? Number(o.min) : 30));

      case "revogar":
        return await revogarFonte(exigir(args[0], "o id ou parte do título da fonte"));

      case "status":
        return await mostrarStatus();

      case "backup": {
        const backup = await criarBackupAtlas(mongoose.connection.db!);
        const quantidade = backup.manifesto.colecoes.reduce((soma, c) => soma + c.quantidade, 0);
        console.log(`Backup concluído: ${backup.manifesto.colecoes.length} coleções, ${quantidade} documentos; manifest e hashes validados.`);
        return;
      }

      case "restaurar": {
        const pasta = exigir(args[0], "a pasta do backup");
        if (o.simular === o.confirmar) throw new Error("Escolha exatamente uma opção: --simular ou --confirmar.");
        const db = mongoose.connection.db!;
        const plano = await simularRestauracao(db, pasta);
        console.log(`${o.simular ? "Simulação" : "Prévia"} do backup ${plano.banco} para o banco atual ${db.databaseName}, sem alterações:`);
        for (const c of plano.colecoes) console.log(`  ${c.nome}: atual ${c.atual} → backup ${c.backup}`);
        if (o.simular) return;
        if (!process.stdin.isTTY) throw new Error("A restauração real exige um terminal interativo para confirmar o banco e a data.");
        const data = plano.criadoEm.slice(0, 10);
        const frase = `RESTAURAR ${db.databaseName} ${data}`;
        if ((await perguntar(`Para aplicar e criar um snapshot de rollback, digite exatamente \"${frase}\": `)).trim() !== frase) {
          throw new Error("Confirmação não corresponde; nenhuma alteração foi feita.");
        }
        const resultado = await restaurarBackupAtlas(db, pasta);
        console.log(`Restauração concluída. Snapshot de rollback preservado em backups/${resultado.diretorioRollback.split(/[\\/]/).at(-1)}.`);
        for (const c of resultado.depois) {
          const anterior = resultado.antes.find((a) => a.nome === c.nome)?.atual ?? 0;
          console.log(`  ${c.nome}: ${anterior} → ${c.quantidade}`);
        }
        return;
      }

      case "noturno": {
        // planeja a noite (tópicos abaixo do estoque + verificação semanal) e roda a fila persistida
        const max = o.max ? Number(o.max) : undefined;
        let ate: Date | undefined;
        if (o.ate) {
          const [h, m] = o.ate.split(":").map(Number);
          ate = new Date();
          ate.setHours(h, m || 0, 0, 0);
          if (+ate <= Date.now()) ate.setDate(ate.getDate() + 1);
        }
        return await naFila(rotulo, async () => {
          const inicio = new Date();
          const lote = `noite ${inicio.toISOString().slice(0, 10)}`;
          // E6 (F12): a noite completa, etapa por etapa, cada uma no relatório (ok / pulada / falhou)
          const etapas: EtapaNoite[] = [];
          await etapa(etapas, "backup", etapaBackup);
          await etapa(etapas, "acervo", etapaAcervo);
          await etapa(etapas, "ingestão", async () => (sobraTempo(ate, 120) ? etapaIngestao() : null));
          // questão/tópico novos ganham concurso, banca, formato e camada (idempotente: só o que falta)
          const preenchidos = (await migrarConcursos()).feitos.reduce((s, f) => s + f.alterados, 0);
          if (preenchidos) console.log(`✔ Concurso/banca preenchidos em ${preenchidos} registro(s) novo(s).`);
          // subtópico das questões novas: código primeiro, ambíguas com o modelo
          await etapa(etapas, "classificação", etapaClassificacao);
          // ordem da noite: questões → explicações alternativas → aulas → cartões → fontes atuais → temas → áudio
          // (a fila roda na ordem de criação, então esta é também a ordem de execução)
          const { gerar: n, explicar_outro_jeito: extras, aula: aulas, cartoes, fonte_atual: fontesAtuais, tema: temas, voz: audios } = await planejarEtapasDaNoite({
            gerar: () => planejarNoite(lote, { max }),
            explicar_outro_jeito: () => planejarPregeracoes(lote),
            aula: () => planejarAulas(lote),
            cartoes: () => planejarCartoes(lote),
            fonte_atual: () => planejarFontesAtuais(lote),
            tema: () => planejarTemasRedacao(lote),
            voz: async () => {
              // espaço do Atlas grátis: telemetria em 30 dias e teto do áudio antes de planejar áudio novo
              if (await ajustarTTLTelemetria()) console.log("✔ Telemetria: TTL ajustado para 30 dias.");
              const limpeza = await limparAudios();
              if (limpeza.removidos) console.log(`✔ Áudio: ${limpeza.removidos} menos ouvido(s) removido(s); cache em ${limpeza.mb} MB (teto ${tetoAudioMB()} MB).`);
              return planejarVoz(lote);
            },
          });
          console.log(`Plano: ${n} questão(ões), ${extras} explicação(ões) alternativa(s), ${aulas} aula(s), ${cartoes} lote(s) de cartões, ${fontesAtuais} conferência(s) de fonte atual, ${temas} tema(s) de redação e ${audios} áudio(s) do Binho (${lote})${ate ? `, até ${ate.toLocaleTimeString("pt-BR")}` : ""}`);
          // reserva 45 min antes do fim para a derivação C/E e as fichas
          const ateFila = calcularAteFila(ate ? new Date(+ate - 45 * 60_000) : undefined, inicio);
          const r = await rodarFila({ ate: ateFila, max: max !== undefined ? max + extras + aulas + cartoes + fontesAtuais + temas + audios + 1 : undefined, geradores: (await correnteAtiva()).correntes.gerador });
          console.log(`\n${r.rodadas} tarefa(s): ${r.aprovadas} questão(ões) aprovada(s), ${r.concluidas} concluída(s), ${r.descartadas} descartada(s), ${r.aguardando} aguardando nova tentativa, ${r.esgotadas} esgotada(s)${r.orfas ? `, ${r.orfas} recuperada(s) de processo que caiu` : ""}`);
          etapas.push({ etapa: "geração e pré-geração", status: "ok", detalhe: `${n} questão(ões) planejada(s) (tema de amanhã primeiro), ${r.aprovadas} aprovada(s); ${extras} explicação(ões), ${aulas} aula(s), ${cartoes} lote(s) de cartões, ${audios} áudio(s) na fila`, ms: Date.now() - +inicio });
          await etapa(etapas, "derivação C/E", async () => (sobraTempo(ate, 25) ? etapaDerivacao(4) : null));
          await etapa(etapas, "fichas", async () => {
            if (!sobraTempo(ate, 20)) return null;
            const alvos = await alvosDaTrilha(await Topic.find({ ativo: true }).select("_id assunto").lean());
            return etapaFichas(alvos[0]?.subtopico ?? null, 2);
          });
          try {
            const noite = await relatorioDaNoite(inicio);
            const aprovadas = await Question.countDocuments({ status: "aprovada" });
            await Relatorio.create({ lote, inicio, fim: new Date(), resumo: r, noite, progresso: { aprovadas, meta: META_BANCO }, etapas, janela: "A" });
            console.log(`Banco: ${aprovadas} de ${META_BANCO} aprovadas (meta)`);
            console.log(`Etapas: ${etapas.map((e) => `${e.etapa} ${e.status}`).join(" · ")}`);
          } catch (e) {
            console.error("Falha ao salvar relatório da noite:", e);
          }
          try {
            const backup = await criarBackupAtlas(mongoose.connection.db!);
            const totalBackup = backup.manifesto.colecoes.reduce((soma, c) => soma + c.quantidade, 0);
            console.log(`Backup noturno concluído: ${backup.manifesto.colecoes.length} coleções, ${totalBackup} documentos.`);
          } catch (e) {
            console.error("Falha ao criar backup noturno:", e);
          }
        });
      }

      case "baixar-fontes": {
        // Etapa 2.1: só sites oficiais (planalto.gov.br, bcb.gov.br, in.gov.br); grava em fontes/ (fora do Git)
        const r = await baixarFontes(args);
        return console.log(`\n${r.length} fonte(s) em fontes/LEIAME.json`);
      }

      case "corrente": {
        // CORRENTE DEFINITIVA (decisão do dono em 18/10/2026, depois do benchmark do auditor com 60 amostras).
        // A regra de família continua: quem confere nunca é da família de quem gerou/escreveu (corrente.ts).
        // Step 5 Preview fica fora (preview); DeepSeek saiu do escritor. "corrente desfazer" volta à anterior.
        if (args[0] === "desfazer") return console.log(`✔ voltou para: ${(await desfazerCorrentes()).modo}`);
        if (args[0] !== "definitiva") throw new Error('Use "corrente definitiva" ou "corrente desfazer".');
        const r = await aprovarCorrentes(CORRENTE_DEFINITIVA);
        if (!r.ok) throw new Error(r.erros.join(" · "));
        console.log("✔ Corrente definitiva ativa:");
        for (const [f, ids] of Object.entries(CORRENTE_DEFINITIVA)) console.log(`  ${f}: ${ids.map((i) => i.split("/")[1]).join(" → ")}`);
        return r.avisos.forEach((a) => console.log(`  aviso: ${a}`));
      }

      case "criar-admin": {
        // a conta do dono: pede a senha no terminal (sem mostrar), cria o admin e leva o progresso
        // do modo dono único (ALUNO_ID) para ela. A partir daí o site pede login.
        const email = normalizarEmail(exigir(args[0], "o seu e-mail"));
        if (!emailValido(email)) throw new Error("Esse e-mail não parece certo.");
        if (await User.exists({ email })) throw new Error("Já existe conta com esse e-mail.");
        const nome = (await perguntar("Seu nome (como o app vai te chamar): ")).trim() || "Dono";
        const senha = await perguntar("Senha (não aparece enquanto digita): ", true);
        const f = forcaSenha(senha);
        if (f.nota < NOTA_MINIMA) throw new Error(`Senha fraca: ${f.dica ?? f.rotulo}`);
        if ((await perguntar("Repita a senha: ", true)) !== senha) throw new Error("As senhas não conferem.");
        const u = await User.create({ nome, email, senhaHash: await hashSenha(senha), papel: "admin" });
        const migrado = await migrarProgresso(donoAntigoId(), u._id);
        console.log(`✔ Conta de administrador criada para ${email}.`);
        console.log(`  Progresso levado para ela: ${Object.entries(migrado).map(([k, n]) => `${k} ${n}`).join(", ")}.`);
        return console.log("  O site agora pede login. Convide amigos com: npm run bb -- convite");
      }

      case "convite": {
        const admin = await User.findOne({ papel: "admin" }).select("_id").lean();
        const c = await criarConvite(admin?._id, o.max ? Number(o.max) : 7);
        return console.log(`Convite: ${c.codigo} (uso único, vale até ${c.expiraEm.toLocaleDateString("pt-BR")})`);
      }

      case "senha": {
        // esqueci a senha (sem serviço de e-mail): senha provisória para o dono repassar
        const email = normalizarEmail(exigir(args[0], "o e-mail da conta"));
        const u = await User.findOne({ email }).select("_id").lean();
        if (!u) throw new Error("Não existe conta com esse e-mail.");
        const r = await gerarSenhaProvisoria(u._id);
        return console.log(`Senha provisória de ${email}: ${r!.provisoria}\n(passe para a pessoa; ela troca em Ajustes → Minha conta)`);
      }

      case "liberar-fonte": {
        // Fonte doutrinária escrita por IA só entra depois do OK do dono (regra 3): este comando É o OK
        const docs: Record<string, { arquivo: string; titulo: string; disciplina: string }> = {
          "glossário de vendas": { arquivo: "docs/fontes-vendas/glossario.md", titulo: "Glossário de Vendas (doutrina, revisado pelo dono)", disciplina: "vendas_negociacao" },
        };
        const d = docs[exigir(args[0], "o nome da fonte").toLowerCase()];
        if (!d) throw new Error(`Fonte desconhecida. Opções: ${Object.keys(docs).join(", ")}`);
        return await naFila(rotulo, () => ingerirFonte(d.arquivo, { tipo: "material_proprio", titulo: d.titulo, disciplina: d.disciplina, ano: new Date().getFullYear() }));
      }

      case "ingerir-fontes": {
        // Fonte é escrita em isolamento: primeiro simula páginas/trechos e duplicidade; depois confirma só um ID.
        if (args.length !== 1) throw new Error('Informe exatamente um ID de fonte. Use "ingerir-fontes <id> --simular" antes de "--confirmar".');
        const manifesto = JSON.parse(await readFile("fontes/LEIAME.json", "utf8")) as { fontes: Registro[] };
        const f = manifesto.fontes.find((x) => x.id === args[0]);
        if (!f) throw new Error(`Fonte ${args[0]} não encontrada em fontes/LEIAME.json. Baixe primeiro apenas esse ID.`);
        if (!o.simular && !o.confirmar) throw new Error('Faça a prévia com --simular e, após conferir as contagens, repita com --confirmar.');
        const caminho = join("fontes", f.arquivo);
        if (o.simular) {
          const { lerArquivo, fatiar } = await import("./extrair.js");
          const { paginas, hash } = await lerArquivo(caminho);
          const n = fatiar(paginas).length;
          const duplicada = await Source.findOne({ $or: [{ titulo: f.titulo }, { hashArquivo: hash }] }).select("_id").lean();
          console.log(JSON.stringify({ modo: "simulação", id: f.id, titulo: f.titulo, páginas: paginas.length, caracteres: paginas.join("").length, trechos: n, incrementoEstimadoMB: Number((n * 0.0381).toFixed(2)), jáExiste: !!duplicada }));
          return;
        }
        if (await Source.exists({ titulo: f.titulo })) {
          return console.log(`↷ ${f.id}: já ingerida; nenhuma fonte ou trecho foi alterado.`);
        }
        return await naFila(rotulo, async () => {
          console.log(`Ingerindo uma única fonte: ${f.id} (${f.titulo}).`);
          await ingerirFonte(caminho, {
            tipo: f.tipo,
            titulo: f.titulo,
            disciplina: f.disciplina,
            orgao: f.orgao,
            ano: f.ano,
            url: f.url,
          });
        });
      }

      case "vincular-fonte": {
        const titulo = exigir(o.fonte, "--fonte");
        const assunto = exigir(o.assunto, "--assunto");
        if (o.simular) {
          const [fonte, topico] = await Promise.all([
            Source.findOne({ titulo }).select("_id titulo").lean(),
            Topic.findOne({ assunto, ativo: true }).select("_id assunto").lean(),
          ]);
          if (!fonte) throw new Error(`Fonte não encontrada: ${titulo}`);
          if (!topico) throw new Error(`Tópico ativo não encontrado: ${assunto}`);
          const filtro = { sourceId: fonte._id, revogada: false };
          const [total, vinculados] = await Promise.all([
            Chunk.countDocuments(filtro),
            Chunk.countDocuments({ ...filtro, topicIds: topico._id }),
          ]);
          console.log(JSON.stringify({ modo: "simulação", fonte: titulo, assunto, trechosVigentes: total, jáVinculados: vinculados, novosVínculos: total - vinculados }));
          return;
        }
        if (!o.confirmar) throw new Error('Faça a prévia com --simular e, após conferir as contagens, repita com --confirmar.');
        const r = await vincularFonteAoTopico(titulo, assunto);
        return console.log(`✔ ${r.total} trecho(s) de "${r.fonte}" ligados a "${r.assunto}" (${r.novos} vínculo(s) novo(s)).`);
      }

      case "benchmark": {
        // R2.3: auditor às cegas, juiz e escritor de Português; retomável (cada modelo × item uma vez)
        const max = o.max ? Number(o.max) : Infinity;
        const qual = args[0];
        if (qual === "relatorio") {
          await escreverRelatorio();
          return console.log("✔ docs/BENCHMARK-MODELOS.md");
        }
        const rodar = { auditor: () => rodarAuditor(undefined, 60, max), juiz: () => rodarJuiz(undefined, max), escritor: () => rodarEscritor(undefined, 6, max) }[qual ?? ""];
        if (!rodar) throw new Error('Use "benchmark auditor | juiz | escritor | relatorio" [--max N].');
        return await naFila(rotulo, async () => {
          console.log(`${await rodar()} chamada(s) novas`);
          await escreverRelatorio();
          console.log("✔ docs/BENCHMARK-MODELOS.md atualizado");
        });
      }

      case "verificar-modelos":
        return await naFila(rotulo, async () => {
          const r = await verificarModelos();
          console.log(`\n${r.filter((x) => x.http === 200 && x.json).length}/${r.length} modelos responderam`);
        });

      case "modelos-sondar": {
        // R2.1: o que cada endpoint grátis aceita (só modelos de chat do catálogo, fora descontinuados)
        const cat = carregarCatalogo();
        const alvos = args.length ? args : [...cat.values()].filter((m) => m.status !== "descontinuado" && !m.funcoes.includes("embed")).map((m) => m.id);
        return await naFila(rotulo, async () => {
          const r = await sondarModelos(alvos);
          await writeFile("docs/sondagem-modelos.json", JSON.stringify({ em: new Date().toISOString(), resultados: r }, null, 2), "utf8");
          console.log(`\n✔ ${r.length} chamadas; detalhes em docs/sondagem-modelos.json`);
        });
      }

      case "similaridade":
        if (args[0] === "indexar") return await naFila(rotulo, () => indexarQuestoes());
        if (args[0] === "calibrar") return await calibrar();
        throw new Error('Use "similaridade indexar" ou "similaridade calibrar".');

      default:
        throw new Error(`Comando desconhecido: ${comando}. Veja "npm run bb -- ajuda".`);
    }
  } finally {
    await telemetriaPendente(); // as últimas linhas de telemetria antes de fechar a conexão
    await mongoose.disconnect();
  }
}

main().catch((e) => {
  console.error(`✖ ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
