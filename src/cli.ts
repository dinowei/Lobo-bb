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
  reclassificarFonte,
  ingerirProva,
  explicarOficiais,
  anularOficial,
  recuperarQuestao,
  revogarFonte,
  mostrarStatus,
  type MetaFonte,
} from "./ingestao.js";
import { gerarQuestao, reabastecerEstoque } from "./pipeline.js";
import { Topic, Source } from "./models.js";
import { join } from "node:path";
import { listarModelos } from "./llm.js";
import { naFila } from "./fila.js";
import { extrairFigurasOficiais } from "./figuras.js";
import { indexarQuestoes, calibrar } from "./similaridade.js";
import { carregarCatalogo } from "./catalogo.js";
import { sondarModelos, verificarModelos } from "./sondagem.js";
import { planejarNoite, rodarFila } from "./noturno.js";
import { rodarAuditor, rodarJuiz, rodarEscritor, escreverRelatorio } from "./benchmark.js";
import { baixarFontes, type Registro } from "./baixar.js";
import { telemetriaPendente } from "./telemetria.js";
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
  prova <prova.pdf> --gabarito <gabarito.pdf|txt> --nome "<nome>" [--banca cesgranrio] [--ano 2023]
  explicar [--limite 50]        IA escreve as explicações das oficiais pendentes
  anular --prova "<parte do nome>" --numero <n>   oficial anulada no gabarito definitivo sai de circulação
  recuperar <prova.pdf> --gabarito <txt> --nome "<nome exato>" --numero <n>   traz uma oficial que ficou de fora
  figuras-oficiais [config.json]  extrai as figuras das provas (data/figuras-oficiais.json) para conferência
  gerar --assunto "<parte do nome>" [--n 3] [--tipo "<tipo>"]   gera questões novas de um tópico
  estoque [--min 30]            completa o estoque mínimo de todos os tópicos
  noturno [--max 20] [--ate 05:00]  planeja a noite e roda a fila persistida (tela Fila)
  ingerir-fontes [id ...]       ingere o que o baixar-fontes gravou (pula a que já existe)
  baixar-fontes [id ...]        baixa as leis e normas de data/fontes-oficiais.json (só sites oficiais) para fontes/
  verificar-modelos             1 chamada curta por modelo do catálogo (a verificação semanal)
  benchmark auditor|juiz|escritor|relatorio [--max N]   compara os modelos grátis (docs/BENCHMARK-MODELOS.md)
  revogar <id | parte do título>  norma mudou: tira fonte e questões de circulação
  status                        raio-x: trechos, questões, cenários e descartes por repetição por tópico
  similaridade indexar          calcula o embedding das questões que ainda não têm (filtro anti-repetição)
  similaridade calibrar         gera docs/CALIBRAGEM-SIMILARIDADE.md com os pares perto dos limites
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
      limite: { type: "string" },
      assunto: { type: "string" },
      n: { type: "string" },
      min: { type: "string" },
      filtro: { type: "string" },
      prova: { type: "string" },
      numero: { type: "string" },
      max: { type: "string" },
      ate: { type: "string" },
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
          })
        );

      case "explicar":
        return await naFila(rotulo, () => explicarOficiais(o.limite ? Number(o.limite) : 50));

      case "figuras-oficiais":
        return await extrairFigurasOficiais(args[0] ?? "data/figuras-oficiais.json");

      case "recuperar": {
        const numero = Number(exigir(o.numero, "--numero"));
        return await naFila(rotulo, () =>
          recuperarQuestao(exigir(args[0], "o PDF da prova"), exigir(o.gabarito, "--gabarito"), exigir(o.nome, "--nome"), numero)
        );
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

      case "estoque":
        return await naFila(rotulo, () => reabastecerEstoque(o.min ? Number(o.min) : 30));

      case "revogar":
        return await revogarFonte(exigir(args[0], "o id ou parte do título da fonte"));

      case "status":
        return await mostrarStatus();

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
          const lote = `noite ${new Date().toISOString().slice(0, 10)}`;
          const n = await planejarNoite(lote, { max });
          console.log(`Plano: ${n} questão(ões) para gerar (${lote})${ate ? `, até ${ate.toLocaleTimeString("pt-BR")}` : ""}`);
          const r = await rodarFila({ ate, max: max !== undefined ? max + 1 : undefined });
          console.log(`\n${r.rodadas} tarefa(s): ${r.concluidas} concluída(s), ${r.descartadas} descartada(s), ${r.aguardando} aguardando nova tentativa, ${r.esgotadas} esgotada(s)${r.orfas ? `, ${r.orfas} recuperada(s) de processo que caiu` : ""}`);
        });
      }

      case "baixar-fontes": {
        // Etapa 2.1: só sites oficiais (planalto.gov.br, bcb.gov.br, in.gov.br); grava em fontes/ (fora do Git)
        const r = await baixarFontes(args);
        return console.log(`\n${r.length} fonte(s) em fontes/LEIAME.json`);
      }

      case "ingerir-fontes": {
        // Etapa 2.2: ingere o que o baixar-fontes gravou (fontes/LEIAME.json); fonte com o mesmo título é pulada
        const manifesto = JSON.parse(await readFile("fontes/LEIAME.json", "utf8")) as { fontes: Registro[] };
        return await naFila(rotulo, async () => {
          for (const f of manifesto.fontes.filter((x) => !args.length || args.includes(x.id))) {
            if (await Source.exists({ titulo: f.titulo })) {
              const n = await reclassificarFonte(f.titulo, f.disciplina);
              console.log(`↷ ${f.id}: já ingerida${n ? ` (${n} trecho(s) sem tópico foram para o mais próximo da disciplina)` : ""}`);
              continue;
            }
            console.log(`\n## ${f.id}`);
            await ingerirFonte(join("fontes", f.arquivo), {
              tipo: f.tipo,
              titulo: f.titulo,
              disciplina: f.disciplina,
              orgao: f.orgao,
              ano: f.ano,
              url: f.url,
            });
          }
        });
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
