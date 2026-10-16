import { useEffect, useState } from 'react';

/** Folga além da janela antes de tratar a diferença como relógio do mundo adiantado. */
const FOLGA_DO_RELOGIO_SEGUNDOS = 5;

/**
 * Segundos que faltam até o prazo (arredondados para cima), atualizados enquanto houver tempo.
 * Sem prazo, devolve null.
 *
 * O prazo vem na hora do mundo e o aparelho conta pela hora real. Com o relógio de
 * desenvolvimento adiantado (POST /v1/dev/relogio) os dois divergem em dias, e o cronômetro
 * mostraria milhares de minutos. Com `janela` (a duração do prazo), o que passar dela na
 * primeira leitura vira o desvio entre os relógios e é descontado dali em diante.
 */
export function useSegundosRestantes(prazo: string | null, janela?: number): number | null {
  const [agora, setAgora] = useState(() => Date.now());
  const [desvio, setDesvio] = useState<{ prazo: string; ms: number } | null>(null);
  const fim = prazo ? Date.parse(prazo) : null;

  // Prazo novo: mede o desvio uma vez (ajuste de estado durante a renderização).
  if (prazo && fim !== null && janela !== undefined && desvio?.prazo !== prazo) {
    const sobra = (fim - agora) / 1000 - janela;
    setDesvio({ prazo, ms: sobra > FOLGA_DO_RELOGIO_SEGUNDOS ? Math.round(sobra * 1000) : 0 });
  }
  const ajuste = prazo && desvio?.prazo === prazo ? desvio.ms : 0;
  const restante = fim === null ? null : Math.max(0, Math.ceil((fim - ajuste - agora) / 1000));
  const correndo = restante !== null && restante > 0;

  useEffect(() => {
    if (!correndo) return;
    const id = setInterval(() => setAgora(Date.now()), 250);
    return () => clearInterval(id);
  }, [correndo]);

  return restante;
}

/** "0:24" para o cronômetro do ao vivo. */
export function relogio(segundos: number): string {
  const minutos = Math.floor(segundos / 60);
  return `${minutos}:${String(segundos % 60).padStart(2, '0')}`;
}
