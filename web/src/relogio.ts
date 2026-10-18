// Relógio que só anda com a aba visível: base das horas líquidas (tempo de cada questão)
export class RelogioAtivo {
  private acumuladoMs = 0;
  private desde: number | null = null;

  constructor() {
    this.desde = this.visivel() ? Date.now() : null;
    document.addEventListener("visibilitychange", this.trocar);
  }

  private visivel = () => typeof document === "undefined" || document.visibilityState === "visible";

  private trocar = () => {
    if (this.visivel()) {
      if (this.desde === null) this.desde = Date.now();
    } else if (this.desde !== null) {
      this.acumuladoMs += Date.now() - this.desde;
      this.desde = null;
    }
  };

  segundos() {
    return Math.round((this.acumuladoMs + (this.desde !== null ? Date.now() - this.desde : 0)) / 1000);
  }

  zerar() {
    this.acumuladoMs = 0;
    this.desde = this.visivel() ? Date.now() : null;
  }

  desligar() {
    document.removeEventListener("visibilitychange", this.trocar);
  }
}
