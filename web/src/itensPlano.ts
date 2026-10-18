// Texto e destino de cada item do plano (usados no Painel e na tela Plano)
import { NOME_DISCIPLINA } from "../../shared/tipos";
import type { ItemPlano } from "../../shared/plano";
import type { FiltroPratica, Tela } from "./estado";

export function textoItem(i: ItemPlano) {
  switch (i.tipo) {
    case "questoes": return `${i.questoes} questões de ${NOME_DISCIPLINA[i.disciplina]}`;
    case "revisao": return `Revisão espaçada (${i.minutos} min)`;
    case "erros": return `Caderno de erros (${i.minutos} min)`;
    case "redacao": return `Uma redação (${i.minutos} min)`;
    case "simulado": return `Simulado de ${i.questoes} questões`;
  }
}

export function destinoItem(i: ItemPlano): [Tela, FiltroPratica?] {
  switch (i.tipo) {
    case "questoes": return ["praticar", { disciplina: i.disciplina }];
    case "revisao": return ["praticar", { revisao: true }];
    case "erros": return ["erros"];
    case "redacao": return ["redacao"];
    case "simulado": return ["simulados"];
  }
}
