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
  ingerirProva,
  explicarOficiais,
  revogarFonte,
  mostrarStatus,
  type MetaFonte,
} from "./ingestao.js";
import { gerarQuestao, reabastecerEstoque } from "./pipeline.js";
import { Topic } from "./models.js";
import { listarModelos } from "./llm.js";

const AJUDA = `
BB Estudos — comandos (npm run bb -- <comando>)

  modelos [--filtro nemotron]   lista os modelos que sua chave acessa
  testar                        testa IA e embeddings, mostra o EMBED_DIM
  indice                        cria o índice vetorial no Atlas (uma vez)
  topicos <arquivo.json>        cadastra/atualiza os tópicos do edital
  fonte <arquivo> --tipo <t> --titulo "<título>"
        [--disciplina <d>] [--orgao BACEN] [--ano 2020] [--url ...] [--vigente 2020-11-16]
        tipos: lei | norma_bacen_cmn | edital | material_proprio
  prova <prova.pdf> --gabarito <gabarito.pdf|txt> --nome "<nome>" [--banca cesgranrio] [--ano 2023]
  explicar [--limite 50]        IA escreve as explicações das oficiais pendentes
  gerar --assunto "<parte do nome>" [--n 3]   gera questões novas de um tópico
  estoque [--min 30]            completa o estoque mínimo de todos os tópicos
  revogar <id | parte do título>  norma mudou: tira fonte e questões de circulação
  status                        raio-x: trechos e questões por tópico
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
        return await ingerirFonte(exigir(args[0], "o arquivo da fonte"), {
          tipo: tipo as MetaFonte["tipo"],
          titulo: exigir(o.titulo, "--titulo"),
          disciplina: o.disciplina,
          orgao: o.orgao,
          ano: o.ano ? Number(o.ano) : undefined,
          url: o.url,
          vigenteDesde: o.vigente ? new Date(o.vigente) : undefined,
        });
      }

      case "prova":
        return await ingerirProva(exigir(args[0], "o PDF da prova"), exigir(o.gabarito, "--gabarito"), {
          nome: exigir(o.nome, "--nome"),
          banca: o.banca!,
          ano: o.ano ? Number(o.ano) : undefined,
        });

      case "explicar":
        return await explicarOficiais(o.limite ? Number(o.limite) : 50);

      case "gerar": {
        const busca = exigir(o.assunto, "--assunto");
        const topico = await Topic.findOne({
          assunto: new RegExp(busca.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"),
        });
        if (!topico) throw new Error(`Nenhum tópico com "${busca}" no nome. Veja "npm run bb -- status".`);
        const n = o.n ? Number(o.n) : 1;
        console.log(`Gerando ${n} questão(ões) de "${topico.assunto}"…`);
        for (let i = 0; i < n; i++) {
          const r = await gerarQuestao(String(topico._id));
          const v = r.variacao ? ` [${r.variacao.tipo} · ${r.variacao.contexto}${r.variacao.duasEtapas ? " · 2 etapas" : ""}]` : "";
          console.log(r.ok ? `✔ aprovada: ${r.questionId}${v}` : `✖ ${r.motivo}${v} ${r.detalhes?.join(" | ") ?? ""}`);
        }
        return;
      }

      case "estoque":
        return await reabastecerEstoque(o.min ? Number(o.min) : 30);

      case "revogar":
        return await revogarFonte(exigir(args[0], "o id ou parte do título da fonte"));

      case "status":
        return await mostrarStatus();

      default:
        throw new Error(`Comando desconhecido: ${comando}. Veja "npm run bb -- ajuda".`);
    }
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((e) => {
  console.error(`✖ ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
});
