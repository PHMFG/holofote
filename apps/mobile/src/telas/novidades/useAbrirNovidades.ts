import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { ErroDaApi } from '../../api/cliente';
import { useMundo } from '../../api/consultas';
import { lerNovidadesVistas, marcarNovidadesVistas, novidadesNaoVistas } from '../../novidades';

/** Espera depois de abrir o app, para a folha não disputar a entrada do feed (e do resumo). */
const ESPERA_MS = 1200;

/**
 * Abre /novidades uma vez quando o app tem notas que o jogador ainda não viu. Quem ainda não
 * tem mundo é jogador novo: nada mudou para ele, então tudo conta como visto. Ligado no layout
 * das abas, junto com o resumo do dia (a folha abre por cima dele).
 */
export function useAbrirNovidades() {
  const mundo = useMundo();
  const pronto = mundo.data?.estado === 'pronto';
  // Só o 404 diz que não há mundo; falha de rede não marca nada.
  const semMundo = mundo.error instanceof ErroDaApi && mundo.error.status === 404;
  const abriu = useRef(false);

  useEffect(() => {
    if (abriu.current) return;
    if (semMundo) {
      marcarNovidadesVistas();
      abriu.current = true;
      return;
    }
    if (!pronto || novidadesNaoVistas(lerNovidadesVistas()).length === 0) return;
    abriu.current = true;
    const espera = setTimeout(() => router.push('/novidades'), ESPERA_MS);
    return () => clearTimeout(espera);
  }, [pronto, semMundo]);
}
