// Poses do Binho (mascote) e da Lo (assistente). Uma pose por tela, no máximo.
// WebP com PNG de reserva, 240/520 px (1x/2x), recortadas por código (scripts/binho-recortar.py).
import dimensoes from "../assets/lobos/dimensoes.json";

const WEBP = import.meta.glob("../assets/lobos/*-{240,520}.webp", { eager: true, query: "?url", import: "default" }) as Record<string, string>;
const PNG = import.meta.glob("../assets/lobos/*-{240,520}.png", { eager: true, query: "?url", import: "default" }) as Record<string, string>;

export type NomePose =
  | "em-pe" | "acenando" | "lendo" | "notebook" | "mesa" | "escrevendo" | "pensativo" | "apontando" | "comemorando" | "confiante" | "andando"
  | "lo-e-binho" | "lo-quadro" | "lo-narrando" | "lo-lendo" | "lo-acenando";

const ALT: Record<NomePose, string> = {
  "em-pe": "Binho em pé",
  acenando: "Binho acenando",
  lendo: "Binho lendo",
  notebook: "Binho no notebook",
  mesa: "Binho na mesa de estudo",
  escrevendo: "Binho escrevendo",
  pensativo: "Binho pensando",
  apontando: "Binho apontando",
  comemorando: "Binho comemorando",
  confiante: "Binho confiante",
  andando: "Binho andando",
  "lo-e-binho": "Lo e Binho",
  "lo-quadro": "Lo no quadro",
  "lo-narrando": "Lo narrando",
  "lo-lendo": "Lo lendo",
  "lo-acenando": "Lo acenando",
};

const arquivo = (nome: NomePose) => (nome.startsWith("lo-") ? nome : `binho-${nome}`);
const url = (tabela: Record<string, string>, nome: NomePose, larg: number, ext: string) => tabela[`../assets/lobos/${arquivo(nome)}-${larg}.${ext}`];

// largura = tamanho mostrado (px); no celular o CSS pode reduzir (max-width), a proporção segue
export function Pose({ nome, largura, alt, carregar = "lazy", pular = false, className }: {
  nome: NomePose;
  largura: number;
  alt?: string; // "" = decorativa (o texto ao lado já diz tudo)
  carregar?: "lazy" | "eager";
  pular?: boolean; // pulinho: só em comemoração (respeita prefers-reduced-motion)
  className?: string;
}) {
  const [w, h] = (dimensoes as Record<string, number[]>)[nome] ?? [1, 1];
  const srcset = (tabela: Record<string, string>, ext: string) => `${url(tabela, nome, 240, ext)} 240w, ${url(tabela, nome, 520, ext)} 520w`;
  return (
    <picture className={`pose${pular ? " pose-pula" : ""}${className ? ` ${className}` : ""}`}>
      <source type="image/webp" srcSet={srcset(WEBP, "webp")} sizes={`${largura}px`} />
      <img
        src={url(PNG, nome, 240, "png")}
        srcSet={srcset(PNG, "png")}
        sizes={`${largura}px`}
        width={largura}
        height={Math.round((largura * h) / w)}
        alt={alt ?? ALT[nome]}
        loading={carregar}
        decoding="async"
      />
    </picture>
  );
}
