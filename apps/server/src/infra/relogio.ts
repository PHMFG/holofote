/** Relógio do mundo: hora real mais o deslocamento do relógio simulado (POST /v1/dev/relogio). */
export function agoraDoMundo(deslocamentoMin: number, agoraReal: Date = new Date()): Date {
  return new Date(agoraReal.getTime() + deslocamentoMin * 60_000);
}
