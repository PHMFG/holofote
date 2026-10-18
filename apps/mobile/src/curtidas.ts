// Curtidas que sobem aos poucos na tela: o post traz o total (packages/engine decide a curva) e
// a contagem acompanha a idade dele enquanto ainda está subindo.
import { curtidasNoInstante, FIM_SUBIDA_CURTIDAS_MS } from '@holofote/engine';
import type { Post } from '@holofote/shared';
import { useCallback, useSyncExternalStore } from 'react';

/** De quanto em quanto tempo a contagem anda enquanto o post ainda ganha curtidas. */
const PASSO_MS = 2500;

// Um relógio só para a tela inteira, na hora do mundo: a idade do post sai de `criadoEm`, que o
// servidor grava no relógio do mundo (adiantado em desenvolvimento por POST /v1/dev/relogio).
let desvio = 0;
let instante = Date.now();
const ouvintes = new Set<(forcado: boolean) => void>();
let relogio: ReturnType<typeof setInterval> | undefined;

function avisarTodos(forcado: boolean) {
  for (const o of ouvintes) o(forcado);
}

/** Acerta a diferença entre a hora do mundo (Mundo.agora) e a do aparelho. */
export function acertarRelogioDoMundo(agoraDoMundo: string): void {
  const novo = Date.parse(agoraDoMundo) - Date.now();
  if (!Number.isFinite(novo) || Math.abs(novo - desvio) < 1000) return;
  desvio = novo;
  instante = Date.now() + desvio;
  avisarTodos(true);
}

function assinarRelogio(ouvinte: (forcado: boolean) => void): () => void {
  if (ouvintes.size === 0) {
    instante = Date.now() + desvio;
    relogio = setInterval(() => {
      instante = Date.now() + desvio;
      avisarTodos(false);
    }, PASSO_MS);
  }
  ouvintes.add(ouvinte);
  return () => {
    ouvintes.delete(ouvinte);
    if (ouvintes.size === 0) clearInterval(relogio);
  };
}

const lerRelogio = () => instante;

/**
 * Contagem de curtidas do post agora. A curtida do jogador entra na hora, fora da curva; o resto
 * sobe com a idade do post (criadoEm é a hora em que ele chegou). Depois do fim da subida o post
 * só renderiza de novo pelo relógio se a hora do mundo for acertada.
 */
export function useCurtidas(post: Pick<Post, 'curtidas' | 'curtidoPorMim' | 'criadoEm'>): number {
  const chegada = Date.parse(post.criadoEm);
  const fim = chegada + FIM_SUBIDA_CURTIDAS_MS;
  const assinar = useCallback(
    (avisar: () => void) =>
      assinarRelogio((forcado) => {
        // Um passo a mais para o último valor (o total) chegar à tela.
        if (forcado || instante < fim + PASSO_MS) avisar();
      }),
    [fim],
  );
  const agora = useSyncExternalStore(assinar, lerRelogio);
  const minha = post.curtidoPorMim ? 1 : 0;
  return curtidasNoInstante(post.curtidas - minha, agora - chegada) + minha;
}
