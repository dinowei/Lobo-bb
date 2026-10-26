import { createHash, randomUUID } from "node:crypto";
import { execFileSync } from "node:child_process";
import { createWriteStream } from "node:fs";
import { chmod, mkdtemp, mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { createGzip, gunzipSync } from "node:zlib";
import { type Document, type Filter, type Db } from "mongodb";
import { EJSON } from "bson";
import { z } from "zod";
import { Transform, Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { isAbsolute, join, relative, resolve } from "node:path";
import { FUNCOES } from "./catalogo.js";
import { Attempt, CartaoRevisao, Config, EspacoLo, Ficha, ItemCE, Question, Redacao, Report, RespostaCE, ReviewState, RatingAluno, Simulado, Topic, User } from "./models.js";

const RETENCAO_PADRAO = 14;
const specColecoes: { nome: string; filtro: Filter<any>; sanitizar?: (doc: Document) => Document | null }[] = [
  { nome: User.collection.name, filtro: {}, sanitizar: contaSegura },
  { nome: Attempt.collection.name, filtro: {} },
  { nome: ReviewState.collection.name, filtro: {} },
  { nome: Redacao.collection.name, filtro: {} },
  { nome: RatingAluno.collection.name, filtro: {} },
  { nome: Config.collection.name, filtro: { _id: "correntes" }, sanitizar: configCorrenteSegura },
  // banco de questões e árvore de tópicos: a migração para BB + BACEN mexe neles (backup antes de migrar)
  { nome: Question.collection.name, filtro: {} },
  { nome: Topic.collection.name, filtro: {} },
  { nome: CartaoRevisao.collection.name, filtro: {} },
  { nome: Report.collection.name, filtro: {} },
  // fechamento v1.0 (26/10/2026): progresso que surgiu depois (Certo/Errado, simulados, posição dos áudios)
  // e o conteúdo que a IA levou noites para aprovar (itens C/E, fichas)
  { nome: RespostaCE.collection.name, filtro: {} },
  { nome: Simulado.collection.name, filtro: {} },
  { nome: EspacoLo.collection.name, filtro: {} },
  { nome: ItemCE.collection.name, filtro: {} },
  { nome: Ficha.collection.name, filtro: {} },
];

export const COLECOES_BACKUP = specColecoes.map((c) => c.nome);

const ColecaoManifestoZ = z.object({
  nome: z.string().min(1),
  arquivo: z.string().min(1),
  quantidade: z.number().int().nonnegative(),
  bytesGzip: z.number().int().nonnegative(),
  sha256: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();

const ManifestoZ = z.object({
  versao: z.literal(1),
  criadoEm: z.string().datetime(),
  banco: z.string().min(1),
  colecoes: z.array(ColecaoManifestoZ),
}).strict();

export type ManifestoBackup = z.infer<typeof ManifestoZ>;
type BackupOptions = {
  rootDir?: string;
  agora?: Date;
  retencao?: number;
  protegerDiretorio?: (diretorio: string) => Promise<void> | void;
};

function registro(valor: unknown): Record<string, unknown> | null {
  return valor !== null && typeof valor === "object" && !Array.isArray(valor) ? valor as Record<string, unknown> : null;
}

function contaSegura(doc: Document): Document {
  const permitidos = ["_id", "email", "nome", "senhaHash", "papel", "plano", "ultimoLogin", "criadoEm"] as const;
  const resultado: Document = {};
  for (const chave of permitidos) if (Object.hasOwn(doc, chave)) resultado[chave] = doc[chave];
  return resultado;
}

function limparCorrente(valor: unknown, profundidade = 0): Record<string, unknown> | null {
  const origem = registro(valor);
  if (!origem || profundidade > 3) return null;
  const limpo: Record<string, unknown> = {};
  if (typeof origem.ativa === "boolean") limpo.ativa = origem.ativa;
  if (typeof origem.aprovadaEm === "string" && origem.aprovadaEm.length <= 80) limpo.aprovadaEm = origem.aprovadaEm;

  const correntes = registro(origem.correntes);
  if (correntes) {
    const porFuncao: Record<string, string[]> = {};
    for (const funcao of FUNCOES) {
      const ids = correntes[funcao];
      if (Array.isArray(ids)) porFuncao[funcao] = ids.filter((id): id is string => typeof id === "string" && /^[a-zA-Z0-9._/-]{3,160}$/.test(id));
    }
    limpo.correntes = porFuncao;
  }

  if (Object.hasOwn(origem, "anterior")) {
    limpo.anterior = origem.anterior === null ? null : limparCorrente(origem.anterior, profundidade + 1);
  }
  return limpo;
}

function configCorrenteSegura(doc: Document): Document | null {
  if (doc._id !== "correntes") return null;
  const valor = limparCorrente(doc.valor);
  if (!valor) return null;
  const seguro: Document = { _id: "correntes", valor };
  if (doc.em instanceof Date) seguro.em = doc.em;
  return seguro;
}

function dataBrt(data: Date): string {
  const partes = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(data);
  const p = Object.fromEntries(partes.map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}

function horaBrt(data: Date): string {
  const partes = new Intl.DateTimeFormat("en-GB", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(data);
  const p = Object.fromEntries(partes.map((x) => [x.type, x.value]));
  return `${p.hour}${p.minute}`;
}

function erroSeguro(mensagem: string): Error {
  return new Error(mensagem);
}

async function protegerDiretorioLocal(diretorio: string): Promise<void> {
  if (process.platform === "win32") {
    try {
      const identidade = execFileSync("whoami.exe", [], { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
      if (!identidade) throw new Error("identidade indisponível");
      execFileSync("icacls.exe", [diretorio, "/inheritance:r", "/grant:r", `${identidade}:(OI)(CI)F`], { stdio: "ignore" });
    } catch {
      throw erroSeguro("Não foi possível aplicar ACL restrita ao diretório de backup.");
    }
  } else {
    try {
      await chmod(diretorio, 0o700);
    } catch {
      throw erroSeguro("Não foi possível restringir as permissões do diretório de backup.");
    }
  }
}

function nomeSeguroColecao(nome: string): string {
  if (!COLECOES_BACKUP.includes(nome) || /[\\/]/.test(nome)) throw erroSeguro("Manifesto de backup contém uma coleção não permitida.");
  return nome;
}

async function* jsonEjson(db: Db, spec: (typeof specColecoes)[number], contar: (n: number) => void) {
  yield "[";
  let quantidade = 0;
  try {
    const cursor = db.collection(spec.nome).find(spec.filtro);
    for await (const bruto of cursor) {
      const doc = spec.sanitizar ? spec.sanitizar(bruto) : bruto;
      if (!doc) continue;
      if (quantidade) yield ",";
      yield EJSON.stringify(doc, { relaxed: false });
      quantidade++;
      contar(quantidade);
    }
  } catch {
    throw erroSeguro(`Falha ao ler a coleção ${spec.nome}; o backup parcial será descartado.`);
  }
  yield "]";
}

async function gravarColecao(db: Db, spec: (typeof specColecoes)[number], destino: string) {
  let quantidade = 0;
  let bytesGzip = 0;
  const sha = createHash("sha256");
  const medir = new Transform({
    transform(chunk: Buffer, _encoding, callback) {
      bytesGzip += chunk.length;
      sha.update(chunk);
      callback(null, chunk);
    },
  });
  try {
    await pipeline(
      Readable.from(jsonEjson(db, spec, (n) => { quantidade = n; })),
      createGzip({ level: 9 }),
      medir,
      createWriteStream(destino, { flags: "wx", mode: 0o600 }),
    );
    if (process.platform !== "win32") await chmod(destino, 0o600);
  } catch {
    throw erroSeguro(`Falha ao gerar o arquivo da coleção ${spec.nome}; o backup parcial será descartado.`);
  }
  return { nome: spec.nome, arquivo: `${spec.nome}.json.gz`, quantidade, bytesGzip, sha256: sha.digest("hex") };
}

function dentroDe(raiz: string, destino: string): boolean {
  const rel = relative(raiz, destino);
  return rel !== "" && !rel.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) && rel !== ".." && !isAbsolute(rel);
}

async function aplicarRetencao(raiz: string, manter: number): Promise<void> {
  if (!Number.isInteger(manter) || manter < 1) throw erroSeguro("A retenção do backup precisa ser um inteiro positivo.");
  const entradas = await readdir(raiz, { withFileTypes: true });
  // retenção por DIA: os backups extras do mesmo dia ("AAAA-MM-DD-HHmm") saem junto com o dia
  const backups = entradas.filter((e) => e.isDirectory() && /^\d{4}-\d{2}-\d{2}(-\d{4})?$/.test(e.name)).map((e) => e.name);
  const dias = [...new Set(backups.map((n) => n.slice(0, 10)))].sort().reverse();
  const mantidos = new Set(dias.slice(0, manter));
  for (const nome of backups.filter((n) => !mantidos.has(n.slice(0, 10)))) {
    const destino = resolve(raiz, nome);
    if (relative(resolve(raiz), destino) !== nome) throw erroSeguro("Destino de retenção inválido.");
    await rm(destino, { recursive: true, force: false });
  }
}

async function exportarPara(db: Db, raiz: string, nomeDiretorio: string, agora: Date, opcoes: BackupOptions, aplicarLimpeza: boolean) {
  if (!/^(?:\d{4}-\d{2}-\d{2}(?:-\d{4})?|rollback-[0-9a-fA-FTZ._-]+)$/.test(nomeDiretorio)) throw erroSeguro("Nome de diretório de backup inválido.");
  await mkdir(raiz, { recursive: true, mode: 0o700 });
  const proteger = opcoes.protegerDiretorio ?? protegerDiretorioLocal;
  await proteger(raiz);
  const final = resolve(raiz, nomeDiretorio);
  if (!dentroDe(resolve(raiz), final)) throw erroSeguro("Destino de backup fora da pasta permitida.");
  try {
    await stat(final);
    throw erroSeguro("Já existe um backup para esse diretório; nenhum arquivo foi sobrescrito.");
  } catch (e) {
    if (e instanceof Error && e.message.includes("Já existe")) throw e;
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw erroSeguro("Não foi possível verificar o destino do backup.");
  }

  const temporario = await mkdtemp(join(raiz, `.${nomeDiretorio}.tmp-`));
  try {
    await proteger(temporario);
    const colecoes = [];
    for (const spec of specColecoes) {
      colecoes.push(await gravarColecao(db, spec, join(temporario, `${spec.nome}.json.gz`)));
    }
    const manifesto: ManifestoBackup = {
      versao: 1,
      criadoEm: agora.toISOString(),
      banco: db.databaseName,
      colecoes,
    };
    await writeFile(join(temporario, "manifest.json"), JSON.stringify(manifesto), { encoding: "utf8", flag: "wx", mode: 0o600 });
    if (process.platform !== "win32") await chmod(temporario, 0o700);
    await rename(temporario, final);
  } catch (e) {
    await rm(temporario, { recursive: true, force: true }).catch(() => undefined);
    if (e instanceof Error && /Falha ao (?:ler|gerar)/.test(e.message)) throw e;
    throw erroSeguro("Backup incompleto; os arquivos parciais foram removidos e nenhum sucesso foi registrado.");
  }
  if (aplicarLimpeza) {
    try {
      await aplicarRetencao(raiz, opcoes.retencao ?? RETENCAO_PADRAO);
    } catch {
      throw erroSeguro("O backup foi gravado, mas a retenção falhou; confira a pasta de backups.");
    }
  }
  const manifesto = JSON.parse(await readFile(join(final, "manifest.json"), "utf8")) as ManifestoBackup;
  return { diretorio: final, manifesto };
}

export async function criarBackupAtlas(db: Db, opcoes: BackupOptions = {}) {
  const raiz = resolve(opcoes.rootDir ?? join(process.cwd(), "backups"));
  const agora = opcoes.agora ?? new Date();
  // um backup por dia; se o do dia já existe (migração à tarde, noite com backup no começo e no fim), o novo
  // ganha a hora no nome. Nada é sobrescrito.
  let nome = dataBrt(agora);
  if (await stat(resolve(raiz, nome)).then(() => true, () => false)) nome = `${nome}-${horaBrt(agora)}`;
  return exportarPara(db, raiz, nome, agora, opcoes, true);
}

type ConteudoBackup = { diretorio: string; manifesto: ManifestoBackup; documentos: Map<string, Document[]> };

async function lerBackup(raizOriginal: string, caminhoOriginal: string): Promise<ConteudoBackup> {
  const raiz = resolve(raizOriginal);
  let diretorio = resolve(caminhoOriginal);
  if (!dentroDe(raiz, diretorio)) diretorio = resolve(raiz, caminhoOriginal);
  if (!dentroDe(raiz, diretorio)) throw erroSeguro("A pasta de backup precisa ficar dentro da pasta backups/.");
  let brutoManifesto: unknown;
  try {
    brutoManifesto = JSON.parse(await readFile(join(diretorio, "manifest.json"), "utf8"));
  } catch {
    throw erroSeguro("Manifesto ausente ou inválido; nenhum dado foi restaurado.");
  }
  const validacao = ManifestoZ.safeParse(brutoManifesto);
  if (!validacao.success) throw erroSeguro("Manifesto inválido; nenhum dado foi restaurado.");
  const manifesto = validacao.data;
  // backup antigo (antes das coleções novas) continua restaurável: o que não está nele fica como está;
  // coleção desconhecida ou repetida derruba tudo antes de qualquer escrita
  const nomes = manifesto.colecoes.map((c) => c.nome);
  if (!nomes.length || new Set(nomes).size !== nomes.length || nomes.some((n) => !COLECOES_BACKUP.includes(n))) {
    throw erroSeguro("Manifesto com coleções inesperadas; nenhum dado foi restaurado.");
  }

  const documentos = new Map<string, Document[]>();
  for (const item of manifesto.colecoes) {
    const nome = nomeSeguroColecao(item.nome);
    if (item.arquivo !== `${nome}.json.gz`) throw erroSeguro("Nome de arquivo inesperado no manifesto.");
    let comprimido: Buffer;
    let descomprimido: Buffer;
    try {
      comprimido = await readFile(join(diretorio, item.arquivo));
      if (comprimido.length !== item.bytesGzip || createHash("sha256").update(comprimido).digest("hex") !== item.sha256) {
        throw new Error("integridade");
      }
      descomprimido = gunzipSync(comprimido);
    } catch {
      throw erroSeguro(`Arquivo de backup inválido para ${nome}; nenhum dado foi restaurado.`);
    }
    let docs: unknown;
    try {
      docs = EJSON.parse(descomprimido.toString("utf8"), { relaxed: false });
    } catch {
      throw erroSeguro(`JSON inválido para ${nome}; nenhum dado foi restaurado.`);
    }
    if (!Array.isArray(docs) || docs.length !== item.quantidade || docs.some((d) => !registro(d))) {
      throw erroSeguro(`Contagem inválida para ${nome}; nenhum dado foi restaurado.`);
    }
    documentos.set(nome, docs as Document[]);
  }
  return { diretorio, manifesto, documentos };
}

async function contagens(db: Db, dados: ConteudoBackup) {
  const resultado: { nome: string; atual: number; backup: number }[] = [];
  for (const spec of specColecoes) {
    const atual = await db.collection(spec.nome).countDocuments(spec.filtro);
    resultado.push({ nome: spec.nome, atual, backup: dados.documentos.get(spec.nome)?.length ?? 0 });
  }
  return resultado;
}

export async function simularRestauracao(db: Db, pasta: string, opcoes: Pick<BackupOptions, "rootDir"> = {}) {
  const raiz = resolve(opcoes.rootDir ?? join(process.cwd(), "backups"));
  const dados = await lerBackup(raiz, pasta);
  return { diretorio: dados.diretorio, banco: dados.manifesto.banco, criadoEm: dados.manifesto.criadoEm, colecoes: await contagens(db, dados) };
}

async function aplicarDocumentos(db: Db, documentos: Map<string, Document[]>) {
  const contagemFinal: { nome: string; quantidade: number }[] = [];
  for (const spec of specColecoes) {
    const docs = documentos.get(spec.nome);
    if (!docs) continue; // coleção que não existia quando o backup foi feito: fica como está
    const colecao = db.collection(spec.nome);
    await colecao.deleteMany(spec.filtro);
    if (docs.length) await colecao.insertMany(docs, { ordered: true });
    const quantidade = await colecao.countDocuments(spec.filtro);
    if (quantidade !== docs.length) throw erroSeguro("A contagem pós-restauração não corresponde ao backup.");
    contagemFinal.push({ nome: spec.nome, quantidade });
  }
  return contagemFinal;
}

// "Backup que nunca foi restaurado não conta como backup" (fechamento v1.0): restaura numa base TEMPORÁRIA,
// compara a contagem de cada coleção com o manifesto e apaga a temporária (e o rollback vazio dela).
export async function testarRestauracao(dbReal: Db, temporaria: Db, opcoes: BackupOptions = {}) {
  if (temporaria.databaseName === dbReal.databaseName || !temporaria.databaseName.startsWith("restauro_teste")) {
    throw erroSeguro("A base temporária precisa se chamar restauro_teste* e ser diferente da real.");
  }
  const backup = await criarBackupAtlas(dbReal, opcoes);
  await temporaria.dropDatabase();
  let resultado: Awaited<ReturnType<typeof restaurarBackupAtlas>> | null = null;
  try {
    resultado = await restaurarBackupAtlas(temporaria, backup.diretorio, opcoes);
    const comparacao = backup.manifesto.colecoes.map((c) => ({
      nome: c.nome, backup: c.quantidade, restaurado: resultado!.depois.find((d) => d.nome === c.nome)?.quantidade ?? -1,
    }));
    return { diretorio: backup.diretorio, comparacao, ok: comparacao.every((c) => c.backup === c.restaurado) };
  } finally {
    await temporaria.dropDatabase();
    if (resultado) await rm(resultado.diretorioRollback, { recursive: true, force: true });
  }
}

export async function restaurarBackupAtlas(db: Db, pasta: string, opcoes: BackupOptions = {}) {
  const raiz = resolve(opcoes.rootDir ?? join(process.cwd(), "backups"));
  const dados = await lerBackup(raiz, pasta); // valida todos os arquivos antes de qualquer escrita
  const antes = await contagens(db, dados);
  const agora = opcoes.agora ?? new Date();
  const nomeRollback = `rollback-${agora.toISOString().replace(/[:]/g, "-")}-${randomUUID().slice(0, 8)}`;
  const rollback = await exportarPara(db, raiz, nomeRollback, agora, opcoes, false);
  try {
    const final = await aplicarDocumentos(db, dados.documentos);
    return { diretorioRollback: rollback.diretorio, antes, depois: final };
  } catch {
    try {
      const dadosRollback = await lerBackup(raiz, rollback.diretorio);
      await aplicarDocumentos(db, dadosRollback.documentos);
    } catch {
      throw erroSeguro(`A restauração falhou e o rollback automático também. O snapshot de recuperação está em ${rollback.diretorio}.`);
    }
    throw erroSeguro(`A restauração falhou; os dados anteriores foram repostos pelo rollback em ${rollback.diretorio}.`);
  }
}
