import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EJSON, ObjectId } from "bson";
import type { Db, Document } from "mongodb";
import { gunzipSync } from "node:zlib";
import { Attempt, Config, Ficha, RatingAluno, Redacao, ReviewState, User } from "./models.js";
import { COLECOES_BACKUP, criarBackupAtlas, restaurarBackupAtlas, simularRestauracao } from "./backup.js";

// as coleções do banco falso seguem a lista do backup (questões e tópicos entraram antes da migração BB + BACEN)
const nomes = COLECOES_BACKUP;
const copiar = <T>(v: T): T => EJSON.parse(EJSON.stringify(v, { relaxed: false }), { relaxed: false }) as T;

class ColecaoFalsa {
  documentos: Document[];
  falharLeitura = false;
  falharProximaInsercao = false;

  constructor(documentos: Document[] = []) { this.documentos = copiar(documentos); }

  find(filtro: Document = {}): AsyncIterable<Document> {
    const documentos = this.documentos.filter((d) => Object.entries(filtro).every(([k, v]) => d[k] === v));
    const falhar = this.falharLeitura;
    return {
      async *[Symbol.asyncIterator]() {
        for (const doc of documentos) yield copiar(doc);
        if (falhar) throw new Error("erro de leitura simulado");
      },
    };
  }

  async countDocuments(filtro: Document = {}): Promise<number> {
    return this.documentos.filter((d) => Object.entries(filtro).every(([k, v]) => d[k] === v)).length;
  }

  async deleteMany(filtro: Document = {}): Promise<void> {
    this.documentos = this.documentos.filter((d) => !Object.entries(filtro).every(([k, v]) => d[k] === v));
  }

  async insertMany(docs: Document[]): Promise<void> {
    if (this.falharProximaInsercao) {
      this.falharProximaInsercao = false;
      throw new Error("erro de escrita simulado");
    }
    this.documentos.push(...copiar(docs));
  }
}

class BancoFalso {
  readonly databaseName = "bb-backup-test";
  readonly colecoes = new Map(nomes.map((nome) => [nome, new ColecaoFalsa()]));
  collection(nome: string): ColecaoFalsa {
    const c = this.colecoes.get(nome);
    if (!c) throw new Error("coleção de teste desconhecida");
    return c;
  }
}

function bancoComDados(): BancoFalso {
  const db = new BancoFalso();
  db.collection(User.collection.name).documentos = [{ _id: new ObjectId("6ad19950d40dcba3f8f47f20"), email: "aluno@example.test", senhaHash: "hash-scrypt-de-teste", criadoEm: new Date("2026-10-19T12:00:00Z"), tokenOperacional: "TOKEN_USER_SENTINEL" }];
  db.collection(Attempt.collection.name).documentos = [{ _id: new ObjectId("6ad19950d40dcba3f8f47f21"), userId: new ObjectId("6ad19950d40dcba3f8f47f20"), xp: 7 }];
  db.collection(ReviewState.collection.name).documentos = [{ _id: new ObjectId("6ad19950d40dcba3f8f47f22"), repeticoes: 3 }];
  db.collection(Redacao.collection.name).documentos = [{ _id: new ObjectId("6ad19950d40dcba3f8f47f23"), texto: "texto local de teste" }];
  db.collection(RatingAluno.collection.name).documentos = [{ _id: new ObjectId("6ad19950d40dcba3f8f47f24"), rating: 1210 }];
  db.collection(Config.collection.name).documentos = [
    { _id: "correntes", em: new Date("2026-10-19T12:00:00Z"), valor: { ativa: true, aprovadaEm: "2026-10-19T12:00:00.000Z", correntes: { gerador: ["vendor/model-a"], auditor: ["vendor/model-b"] }, token: "TOKEN_SENTINEL_NAO_EXPORTAR" } },
    { _id: "outro-config", valor: { apiKey: "OUTRA_CHAVE_SENTINEL" } },
  ];
  return db;
}

async function pastaTemporaria(): Promise<string> {
  return mkdtemp(join(tmpdir(), "bb-backup-test-"));
}

const opcoes = (rootDir: string, agora = new Date("2026-10-19T23:00:00.000Z")) => ({
  rootDir,
  agora,
  protegerDiretorio: () => undefined,
});

test("exporta gzip íntegro, manifest com hashes e simulação com as mesmas contagens", async () => {
  const root = await pastaTemporaria();
  try {
    const db = bancoComDados();
    const backup = await criarBackupAtlas(db as unknown as Db, opcoes(root));
    assert.equal(backup.manifesto.colecoes.length, COLECOES_BACKUP.length); // inclui questões e tópicos (vazios aqui)
    assert.equal(backup.manifesto.colecoes.reduce((s, c) => s + c.quantidade, 0), 6);

    const config = backup.manifesto.colecoes.find((c) => c.nome === Config.collection.name)!;
    const caminho = join(backup.diretorio, config.arquivo);
    const bytes = await readFile(caminho);
    assert.equal(bytes.length, config.bytesGzip);
    assert.equal(createHash("sha256").update(bytes).digest("hex"), config.sha256);
    const jsonConfig = gunzipSync(bytes).toString("utf8");
    assert.equal(jsonConfig.includes("TOKEN_SENTINEL_NAO_EXPORTAR"), false);
    assert.equal(jsonConfig.includes("OUTRA_CHAVE_SENTINEL"), false);
    const usuarios = backup.manifesto.colecoes.find((c) => c.nome === User.collection.name)!;
    const jsonUsuario = gunzipSync(await readFile(join(backup.diretorio, usuarios.arquivo))).toString("utf8");
    assert.equal(jsonUsuario.includes("TOKEN_USER_SENTINEL"), false);
    const docsUsuario = EJSON.parse(jsonUsuario, { relaxed: false }) as Document[];
    assert.ok(docsUsuario[0]._id instanceof ObjectId);
    assert.ok(docsUsuario[0].criadoEm instanceof Date);
    assert.equal(docsUsuario[0].senhaHash, "hash-scrypt-de-teste");

    const simulacao = await simularRestauracao(db as unknown as Db, backup.diretorio, opcoes(root));
    assert.deepEqual(simulacao.colecoes.map((c) => c.backup), backup.manifesto.colecoes.map((c) => c.quantidade));
    assert.deepEqual(await readdir(backup.diretorio), [...backup.manifesto.colecoes.map((c) => c.arquivo).sort(), "manifest.json"].sort());
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("erro de leitura parcial remove o temporário e não deixa backup concluído", async () => {
  const root = await pastaTemporaria();
  try {
    const db = bancoComDados();
    db.collection(ReviewState.collection.name).falharLeitura = true;
    await assert.rejects(criarBackupAtlas(db as unknown as Db, opcoes(root)), /Falha ao gerar o arquivo da coleção reviewstates/);
    assert.deepEqual(await readdir(root), []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("restauração exige dados validados, mostra contagens e preserva rollback automático", async () => {
  const root = await pastaTemporaria();
  try {
    const db = bancoComDados();
    const backup = await criarBackupAtlas(db as unknown as Db, opcoes(root));
    const alvo = db.collection(User.collection.name);
    alvo.documentos = [{ _id: new ObjectId("6ad19950d40dcba3f8f47f30"), email: "outro@example.test" }];
    const previa = await simularRestauracao(db as unknown as Db, backup.diretorio, opcoes(root));
    assert.equal(previa.colecoes.find((c) => c.nome === User.collection.name)?.atual, 1);

    const resultado = await restaurarBackupAtlas(db as unknown as Db, backup.diretorio, opcoes(root, new Date("2026-10-20T03:00:00.000Z")));
    assert.ok(resultado.diretorioRollback.includes("rollback-"));
    assert.equal(alvo.documentos[0].email, "aluno@example.test");
    assert.equal(resultado.depois.find((c) => c.nome === User.collection.name)?.quantidade, 1);

    alvo.documentos = [{ _id: new ObjectId("6ad19950d40dcba3f8f47f30"), email: "estado-antes-do-rollback@example.test" }];
    const tentativas = db.collection(Attempt.collection.name);
    tentativas.documentos = [{ _id: new ObjectId("6ad19950d40dcba3f8f47f31"), xp: 99 }];
    tentativas.falharProximaInsercao = true;
    await assert.rejects(
      restaurarBackupAtlas(db as unknown as Db, backup.diretorio, opcoes(root, new Date("2026-10-20T04:00:00.000Z"))),
      /dados anteriores foram repostos/,
    );
    assert.equal(alvo.documentos[0].email, "estado-antes-do-rollback@example.test");
    assert.equal(tentativas.documentos[0].xp.toString(), "99");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("backup antigo (sem as coleções novas) continua restaurável e não mexe no que não tem", async () => {
  const root = await pastaTemporaria();
  try {
    const db = bancoComDados();
    const backup = await criarBackupAtlas(db as unknown as Db, opcoes(root));
    // simula um backup de antes do fechamento v1.0: o manifesto não tinha "fichas"
    const caminho = join(backup.diretorio, "manifest.json");
    const manifesto = JSON.parse(await readFile(caminho, "utf8")) as { colecoes: { nome: string }[] };
    manifesto.colecoes = manifesto.colecoes.filter((c) => c.nome !== Ficha.collection.name);
    await writeFile(caminho, JSON.stringify(manifesto));
    const fichas = db.collection(Ficha.collection.name);
    fichas.documentos = [{ _id: new ObjectId("6ad19950d40dcba3f8f47f40"), subtopico: "crase" }];
    const r = await restaurarBackupAtlas(db as unknown as Db, backup.diretorio, opcoes(root, new Date("2026-10-26T03:00:00.000Z")));
    assert.ok(!r.depois.some((c) => c.nome === Ficha.collection.name));
    assert.equal(fichas.documentos.length, 1, "a coleção que o backup não tinha ficou como estava");
    // coleção desconhecida no manifesto derruba tudo antes de escrever
    manifesto.colecoes.push({ nome: "invasora" } as never);
    await writeFile(caminho, JSON.stringify(manifesto));
    await assert.rejects(restaurarBackupAtlas(db as unknown as Db, backup.diretorio, opcoes(root)), /inesperadas|inválido/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("segundo backup no mesmo dia ganha a hora no nome; nada é sobrescrito; retenção é por dia", async () => {
  const root = await pastaTemporaria();
  try {
    const db = bancoComDados() as unknown as Db;
    const manha = await criarBackupAtlas(db, opcoes(root, new Date("2026-01-16T12:00:00.000Z")));
    const tarde = await criarBackupAtlas(db, opcoes(root, new Date("2026-01-16T17:45:00.000Z")));
    assert.match(manha.diretorio, /2026-01-16$/);
    assert.match(tarde.diretorio, /2026-01-16-1445$/); // 17:45 UTC = 14:45 em Brasília
    assert.deepEqual((await readdir(root)).filter((n) => n.startsWith("2026-")).sort(), ["2026-01-16", "2026-01-16-1445"]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("retenção mantém os 14 diretórios diários mais recentes", async () => {
  const root = await pastaTemporaria();
  try {
    for (let dia = 1; dia <= 15; dia++) await mkdir(join(root, `2026-01-${String(dia).padStart(2, "0")}`));
    await criarBackupAtlas(bancoComDados() as unknown as Db, opcoes(root, new Date("2026-01-16T15:00:00.000Z")));
    const diarios = (await readdir(root)).filter((nome) => /^\d{4}-\d{2}-\d{2}$/.test(nome)).sort();
    assert.equal(diarios.length, 14);
    assert.equal(diarios[0], "2026-01-03");
    assert.equal(diarios.at(-1), "2026-01-16");
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
