// Prova local da fumaça sem tocar no Atlas: sobe o servidor de PRODUÇÃO (Express + web/dist) num MongoDB em
// memória com um tópico e uma questão, e roda `npm run smoke` contra ele. Modo dono único (sem conta).
// uso: npm run build && npx tsx scripts/smoke-local.ts
import { spawn, execFileSync } from "node:child_process";
import { MongoMemoryServer } from "mongodb-memory-server";
import mongoose from "mongoose";

const PORTA = 3402;
const memoria = await MongoMemoryServer.create({ instance: { launchTimeout: 90_000 } });
const uri = memoria.getUri("smoke-local");
await mongoose.connect(uri);
const { Topic, Question } = await import("../src/models.js");
const topico = await Topic.create({ disciplina: "lingua_portuguesa", assunto: "Crase", ativo: true, peso: 5 });
await Question.create({
  topicId: topico._id, origem: "gerada", dificuldade: 3, enunciado: "O acento grave está correto em:", gabarito: "B", explicacaoGeral: "g", status: "aprovada", subtopico: "crase",
  alternativas: ["A", "B", "C", "D", "E"].map((l) => ({ letra: l, texto: `frase ${l}`, correta: l === "B", explicacao: `porque ${l}` })),
});
await mongoose.disconnect();

const servidor = spawn(process.execPath, ["--import", "tsx", "src/server.ts"], { env: { ...process.env, PORT: String(PORTA), MONGODB_URI: uri, NODE_ENV: "production" }, stdio: "ignore" });
let codigo = 1;
try {
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch(`http://localhost:${PORTA}/api/saude`)).ok) break; } catch { /* subindo */ }
    await new Promise((r) => setTimeout(r, 2000));
  }
  execFileSync(process.execPath, ["--import", "tsx", "scripts/smoke.ts"], { stdio: "inherit", env: { ...process.env, SMOKE_URL: `http://localhost:${PORTA}` } });
  codigo = 0;
} catch {
  codigo = 1;
} finally {
  servidor.kill();
  await memoria.stop();
}
process.exit(codigo);
