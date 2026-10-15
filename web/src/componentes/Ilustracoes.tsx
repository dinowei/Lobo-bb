// Ilustrações de traço para os cartões de disciplina (estilo "line art", cortadas pela borda do cartão)
import type { Disciplina } from "../../../shared/tipos";

const s = { fill: "none", stroke: "currentColor", strokeWidth: 2.2, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

const desenhos: Record<Disciplina, JSX.Element> = {
  conhecimentos_bancarios: (
    <g {...s}>
      <path d="M18 62 80 30l62 32z" />
      <path d="M24 62h112M28 70h104" />
      {[40, 64, 88, 112].map((x) => (<path key={x} d={`M${x} 74v52M${x + 8} 74v52`} />))}
      <path d="M22 128h116M14 136h132" />
      <circle cx="80" cy="50" r="5" />
    </g>
  ),
  matematica_financeira: (
    <g {...s}>
      {[0, 1, 2, 3].map((i) => (
        <g key={i}>
          <ellipse cx="58" cy={122 - i * 14} rx="32" ry="9" fill="var(--fundo-ilu, transparent)" />
          <path d={`M26 ${122 - i * 14}v8M90 ${122 - i * 14}v8`} />
        </g>
      ))}
      <path d="M100 118 118 92l12 10 18-34" />
      <path d="M136 66h12v12" />
    </g>
  ),
  matematica: (
    <g {...s}>
      <rect x="46" y="34" width="70" height="110" rx="10" />
      <rect x="56" y="46" width="50" height="22" rx="4" />
      {[0, 1, 2].map((r) => [0, 1, 2].map((c) => (<rect key={`${r}${c}`} x={57 + c * 17} y={78 + r * 17} width="12" height="11" rx="3" />)))}
      <path d="M93 54h8M64 54h12" />
    </g>
  ),
  probabilidade_estatistica: (
    <g {...s}>
      <rect x="22" y="70" width="52" height="52" rx="10" transform="rotate(-12 48 96)" />
      <rect x="84" y="56" width="52" height="52" rx="10" transform="rotate(10 110 82)" />
      {[[38, 86], [48, 96], [58, 106]].map(([x, y]) => (<circle key={`${x}`} cx={x} cy={y} r="3.4" fill="currentColor" />))}
      {[[98, 70], [122, 74], [96, 92], [120, 96]].map(([x, y]) => (<circle key={`${x}${y}`} cx={x} cy={y} r="3.4" fill="currentColor" />))}
      <path d="M20 140h120" />
    </g>
  ),
  lingua_portuguesa: (
    <g {...s}>
      <path d="M80 56c-14-10-36-12-56-8v80c20-4 42-2 56 8 14-10 36-12 56-8V48c-20-4-42-2-56 8z" />
      <path d="M80 56v80" />
      <path d="M36 66c12-2 24 0 34 4M36 80c12-2 24 0 34 4M36 94c12-2 24 0 34 4M90 70c10-4 22-6 34-4M90 84c10-4 22-6 34-4" />
      <path d="m122 22 14 14-36 36-18 4 4-18z" />
    </g>
  ),
  lingua_inglesa: (
    <g {...s}>
      <path d="M20 40h76a10 10 0 0 1 10 10v30a10 10 0 0 1-10 10H50l-18 16V90H20a10 10 0 0 1-10-10V50a10 10 0 0 1 10-10z" />
      <path d="M64 92h56a10 10 0 0 1 10 10v24a10 10 0 0 1-10 10h-6v14l-16-14H64a10 10 0 0 1-10-10v-4" />
      <path d="M34 56v18M34 65h12M46 56v18M60 60v14M60 54v.5" />
      <path d="M78 112h34M78 122h22" />
    </g>
  ),
  atualidades_mercado_financeiro: (
    <g {...s}>
      <rect x="50" y="26" width="62" height="118" rx="12" />
      <path d="M72 36h18" />
      <path d="M60 104 72 90l10 8 20-26" />
      <path d="M92 72h10v10" />
      <circle cx="81" cy="128" r="5" />
      <path d="M18 70a24 24 0 0 1 24-24M126 116a24 24 0 0 0 24-24" />
    </g>
  ),
  informatica: (
    <g {...s}>
      <rect x="34" y="40" width="92" height="64" rx="8" />
      <path d="M18 112h124l-8 14H26z" />
      <rect x="68" y="66" width="24" height="20" rx="4" />
      <path d="M72 66v-6a8 8 0 0 1 16 0v6" />
      <circle cx="80" cy="76" r="2.5" fill="currentColor" />
    </g>
  ),
  vendas_negociacao: (
    <g {...s}>
      <path d="M28 52h48l52 52-44 44-56-56z" />
      <circle cx="48" cy="72" r="7" />
      <path d="M48 65c-8-18 4-36 22-38" />
      <path d="m70 110 26-26M72 88a4 4 0 1 0 0 .1M94 108a4 4 0 1 0 0 .1" />
    </g>
  ),
};

export function Ilustracao({ disciplina }: { disciplina: Disciplina }) {
  return (
    <svg viewBox="0 0 160 150" aria-hidden="true">
      {desenhos[disciplina]}
    </svg>
  );
}
