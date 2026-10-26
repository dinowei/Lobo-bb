import test from "node:test";
import assert from "node:assert/strict";
import { comandoBloqueadoNaJanelaNoturna, outroNoturnoRodando, travaOrfa, VENCE_EM_MS } from "./fila.js";

test("trava de concorrência: com outro noturno vivo, o segundo sai; trava de outro job ou órfã não conta", () => {
  const agora = Date.now();
  const vivo = () => true;
  const trava = (comando: string, pid = 10, desde = new Date(agora - 60_000)) => ({ _id: "job_de_ia", pid, host: "pc", comando, desde });
  assert.equal(outroNoturnoRodando(trava("bb noturno --ate 05:25"), agora, "pc", vivo), true);
  assert.equal(outroNoturnoRodando(trava("bb esteira --n 3"), agora, "pc", vivo), false, "outro job: o noturno espera na fila");
  assert.equal(outroNoturnoRodando(trava("bb noturno"), agora, "pc", () => false), false, "processo morto: trava órfã");
  assert.equal(outroNoturnoRodando(trava("bb noturno", 10, new Date(agora - VENCE_EM_MS - 1)), agora, "pc", vivo), false, "trava vencida");
  assert.equal(outroNoturnoRodando(null, agora, "pc", vivo), false);
});

test("trava de IA com dono e validade: PID morto nesta máquina ou mais de 6 h = órfã; viva e recente fica", () => {
  const agora = Date.UTC(2026, 9, 22, 12);
  const vivo = (pid: number) => pid === 100;
  const desde = (h: number) => new Date(agora - h * 3_600_000);
  assert.equal(VENCE_EM_MS, 6 * 3_600_000);
  assert.equal(travaOrfa(null, agora, "R0", vivo), null);
  assert.equal(travaOrfa({ pid: 100, host: "R0", desde: desde(1) }, agora, "R0", vivo), null, "viva e recente");
  assert.match(travaOrfa({ pid: 200, host: "R0", desde: desde(1) }, agora, "R0", vivo)!, /já terminou/);
  // outra máquina: não dá para saber se o PID vive; só a validade conta
  assert.equal(travaOrfa({ pid: 200, host: "OUTRA", desde: desde(5) }, agora, "R0", vivo), null);
  assert.match(travaOrfa({ pid: 100, host: "R0", desde: desde(6.1) }, agora, "R0", vivo)!, /mais velha que 6 h/);
});

const instanteBrt = (hora: number, minuto: number) =>
  new Date(Date.UTC(2026, 9, 20, hora + 3, minuto));

test("a janela noturna protege os outros comandos entre 01:00 e 05:30 BRT", () => {
  assert.equal(comandoBloqueadoNaJanelaNoturna("bb gerar --assunto matemática", instanteBrt(1, 0)), true);
  assert.equal(comandoBloqueadoNaJanelaNoturna("api explicação alternativa", instanteBrt(3, 15)), true);
  assert.equal(comandoBloqueadoNaJanelaNoturna("bb status", instanteBrt(5, 29)), true);
});

test("o noturno passa durante a janela protegida", () => {
  assert.equal(comandoBloqueadoNaJanelaNoturna("bb noturno --ate 05:30", instanteBrt(2, 0)), false);
  assert.equal(comandoBloqueadoNaJanelaNoturna("noturno", instanteBrt(5, 29)), false);
});

test("a janela não bloqueia antes de 01:00 nem a partir de 05:30 BRT", () => {
  assert.equal(comandoBloqueadoNaJanelaNoturna("bb gerar", instanteBrt(0, 59)), false);
  assert.equal(comandoBloqueadoNaJanelaNoturna("bb gerar", instanteBrt(5, 30)), false);
  assert.equal(comandoBloqueadoNaJanelaNoturna("bb gerar", instanteBrt(8, 0)), false);
});
