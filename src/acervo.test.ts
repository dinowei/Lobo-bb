import assert from "node:assert/strict";
import test from "node:test";
import { classificarArquivo, escolherTrechos, melhorFaixa, numeroDeLei, pontosDaPagina, tiposPermitidos, type TrechoMapa } from "./acervo.js";

test("camada pelo caminho do acervo: lei/prova/gabarito/edital = A, livro do BCB/CVM = B, cursinho = C", () => {
  assert.deepEqual(classificarArquivo("00_Legislacao Comum (todos os concursos)/Lei 14.133-2021 - Licitacoes e Contratos.pdf"), { camada: "A", tipo: "lei" });
  assert.deepEqual(classificarArquivo("02_Banco do Brasil/Provas e Gabaritos/2023 Cesgranrio - Escriturario Agente Comercial - PROVA A (caderno 1).pdf"), { camada: "A", tipo: "prova" });
  assert.deepEqual(classificarArquivo("02_Banco do Brasil/Provas e Gabaritos/2023 Cesgranrio - Escriturario Agente Comercial - GABARITO PROVA A.pdf"), { camada: "A", tipo: "gabarito" });
  assert.deepEqual(classificarArquivo("01_BACEN - Banco Central/Editais/edital.pdf"), { camada: "A", tipo: "edital" });
  // caderno nº 1 com "gabarito" no nome é prova; o gabarito de verdade continua gabarito
  assert.deepEqual(classificarArquivo("05_CNU/Provas e Gabaritos/2024 Cesgranrio - prova-8-gabarito-1-nivel-intermediario-manha.pdf"), { camada: "A", tipo: "prova" });
  assert.deepEqual(classificarArquivo("02_Banco do Brasil/Outros Bancos (mesmo conteudo)/Provas Cesgranrio/BASA 2025 Cesgranrio - PROVAS - TECNICO BANCARIO - PROVA A - GABARITO 1.pdf"), { camada: "A", tipo: "prova" });
  assert.deepEqual(classificarArquivo("02_Banco do Brasil/Outros Bancos (mesmo conteudo)/Provas Cesgranrio/Banese 2025 Cesgranrio - GABARITOS - Gabarito Prova A - TECNICO BANCARIO I.pdf"), { camada: "A", tipo: "gabarito" });
  assert.deepEqual(classificarArquivo("04_SUSEP/Apostilas e Livros/Decreto 60.459-1967 (regulamenta DL 73-66).pdf"), { camada: "A", tipo: "lei" });
  assert.deepEqual(classificarArquivo("03_CVM/Apostilas e Livros/CVM - Livro TOP Analise de Investimentos.pdf"), { camada: "B", tipo: "livro_oficial" });
  assert.deepEqual(classificarArquivo("04_SUSEP/Apostilas e Livros/SINDSEG-SP - Indice da Legislacao de Seguros.pdf"), { camada: "C", tipo: "cursinho" });
  assert.deepEqual(classificarArquivo("02_Banco do Brasil/Materiais de Cursinhos (gratuitos)/Estrategia - Revisao de Vespera Banco do Brasil 2023.pdf"), { camada: "C", tipo: "cursinho" });
});

test("pontos da página: nome 3, frase de tópico 2, palavra-chave 1; só no início de palavra", () => {
  assert.equal(pontosDaPagina("A CRASE é a fusão… o acento grave indica crase.", { nome: "Crase", palavras: ["crase", "acento grave"] }), 2 * 3 + 2 + 1);
  assert.equal(pontosDaPagina("nada a ver", { nome: "Crase", palavras: ["crase"] }), 0);
  // "acao" não conta dentro de "contratação"/"previdenciação"; conta em "ação" e "ações"
  assert.equal(pontosDaPagina("contratação e licitação", { nome: "Mercado de capitais", palavras: ["acao"] }), 0);
  assert.equal(pontosDaPagina("a ação e as ações", { nome: "X", palavras: ["acao", "acoes"] }), 2);
  // nome sem o parêntese ("licitações") 3 + frase do tópico ("licitações e contratos") 2
  assert.equal(pontosDaPagina("licitações e contratos administrativos", { nome: "Licitações (14.133)", palavras: [], topicos: ["Licitações e contratos (Lei 14.133/2021)"] }), 5);
  assert.equal(numeroDeLei({ nome: "Licitações (14.133)", topicos: [] }), "14.133");
  assert.equal(numeroDeLei({ nome: "Crase", topicos: ["Regência verbal e nominal e crase"] }), null);
  assert.deepEqual(classificarArquivo("02_Banco do Brasil/Outros Bancos (mesmo conteudo)/Banese 2025 Cesgranrio - Edital No 1.pdf"), { camada: "A", tipo: "edital" });
});

test("melhor faixa junta páginas vizinhas fortes (máx. 10) e trechos seguem A > B > C entre os fortes", () => {
  assert.deepEqual(melhorFaixa([0, 5, 6, 0, 9, 0]), { de: 1, ate: 2, total: 11 });
  assert.equal(melhorFaixa([1, 2, 3]), null);
  const t = (arquivo: string, camada: TrechoMapa["camada"], tipo: TrechoMapa["tipo"], pontos: number): TrechoMapa => ({ arquivo, paginas: "1", pagina: 1, camada, tipo, pontos });
  const escolha = escolherTrechos([t("curso", "C", "cursinho", 100), t("lei", "A", "lei", 40), t("lei-fraca", "A", "lei", 5), t("bcb", "B", "livro_oficial", 60), t("prova", "A", "prova", 999)]);
  assert.deepEqual(escolha.map((x) => x.arquivo), ["lei", "bcb", "curso"]); // a lei fraca (< 30% do melhor) e a prova ficam de fora
  // Português: lei e livro jurídico não servem ("concordância" na lei é outra coisa); LGPD sim, mesmo em Informática
  const pt = escolherTrechos([t("curso", "C", "cursinho", 20), t("lei", "A", "lei", 90)], 3, tiposPermitidos("lingua_portuguesa", "concordancia"));
  assert.deepEqual(pt.map((x) => x.arquivo), ["curso"]);
  assert.ok(tiposPermitidos("informatica", "seguranca_lgpd").has("lei"));
  assert.deepEqual([...tiposPermitidos("matematica_financeira", "juros_compostos")].sort(), ["cursinho", "livro_oficial"]);
});
