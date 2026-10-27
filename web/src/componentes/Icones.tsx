// Ícones de traço (desenhados à mão, 16–20px)
import type { SVGProps } from "react";

type P = SVGProps<SVGSVGElement> & { tam?: number };
const base = ({ tam = 18, ...p }: P) => ({
  width: tam,
  height: tam,
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.7,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
  ...p,
});

export const ICasa = (p: P) => (<svg {...base(p)}><path d="M4 10.5 12 4l8 6.5V20H4z" /><path d="M10 20v-5h4v5" /></svg>);
export const IBalao = (p: P) => (<svg {...base(p)}><path d="M5 5h14v10H10l-5 4z" /></svg>);
export const IGrade = (p: P) => (<svg {...base(p)}><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M4 9.5h16M4 14.5h16M9.5 4v16" /></svg>);
export const ICalendario =(p: P) => (<svg {...base(p)}><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M4 10h16M9 3v4M15 3v4" /></svg>);
export const IRelogio = (p: P) => (<svg {...base(p)}><circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" /></svg>);
export const IAlvo = (p: P) => (<svg {...base(p)}><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r=".6" fill="currentColor" /></svg>);
export const ISino = (p: P) => (<svg {...base(p)}><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" /><path d="M10 20a2 2 0 0 0 4 0" /></svg>);
export const ITrofeu = (p: P) => (<svg {...base(p)}><path d="M8 4h8v5a4 4 0 0 1-8 0z" /><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20h7" /></svg>);
export const IEngrenagem = (p: P) => (<svg {...base(p)}><path d="m12 3 7.8 4.5v9L12 21l-7.8-4.5v-9z" /><circle cx="12" cy="12" r="3" /></svg>);
export const ILupa = (p: P) => (<svg {...base({ tam: 15, ...p })}><circle cx="11" cy="11" r="6" /><path d="m20 20-4.5-4.5" /></svg>);
export const ISeta = (p: P) => (<svg {...base({ tam: 14, ...p })}><path d="M7 17 17 7M9 7h8v8" /></svg>);
export const IEsq = (p: P) => (<svg {...base({ tam: 14, ...p })}><path d="m15 6-6 6 6 6" /></svg>);
export const IDir = (p: P) => (<svg {...base({ tam: 14, ...p })}><path d="m9 6 6 6-6 6" /></svg>);
export const ICheck = (p: P) => (<svg {...base({ tam: 9, strokeWidth: 3.2, ...p })}><path d="m5 12 4.5 4.5L19 7" /></svg>);
export const IFogo = (p: P) => (<svg {...base({ tam: 12, strokeWidth: 2.2, ...p })}><path d="M12 3c1 3 5 5 5 10a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5 0 2 1 3 2 3 0-3-1-5 1-8.5z" /></svg>);
export const IRaio = (p: P) => (<svg {...base({ tam: 12, strokeWidth: 2.2, ...p })}><path d="M13 3 5 13h6l-1 8 8-10h-6z" /></svg>);
export const IMedalha = (p: P) => (<svg {...base(p)}><circle cx="12" cy="14" r="5" /><path d="m9 9.5-3-6.5h4l2 4 2-4h4l-3 6.5" /></svg>);
export const IBandeira = (p: P) => (<svg {...base(p)}><path d="M5 21V4M5 4h11l-2 4 2 4H5" /></svg>);
export const IMais = (p: P) => (<svg {...base(p)}><circle cx="5" cy="12" r="1.2" /><circle cx="12" cy="12" r="1.2" /><circle cx="19" cy="12" r="1.2" /></svg>);
export const IEscudo = (p: P) => (<svg {...base(p)}><path d="M12 3 19 6v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z" /><path d="m9 12 2 2 4-4" /></svg>);
export const IFolha = (p: P) => (<svg {...base({ tam: 15, ...p })}><path d="M7 3h7l4 4v14H7z" /><path d="M14 3v4h4M10 12h5M10 16h5" /></svg>);
export const ICartoes = (p: P) => (<svg {...base(p)}><rect x="3" y="7" width="13" height="13" rx="2" /><path d="M8 7V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-3" /></svg>);
export const IFone = (p: P) => (<svg {...base(p)}><path d="M4 15v-3a8 8 0 0 1 16 0v3" /><rect x="3" y="14" width="4" height="6" rx="1.5" /><rect x="17" y="14" width="4" height="6" rx="1.5" /></svg>);
export const IRedacao =(p: P) => (<svg {...base(p)}><path d="M6 4h9l4 4v7" /><path d="M15 4v4h4M8 12h7M8 16h4" /><path d="m14 20 5.8-5.8 1.5 1.5L15.5 22H14z" /></svg>);
