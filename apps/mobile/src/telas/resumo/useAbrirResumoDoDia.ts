import { router } from 'expo-router';
import { useEffect } from 'react';
import { useMundo, useResumoDia } from '../../api/consultas';
import { armazenamento } from '../../estado/armazenamento';

/** Último dia do mundo em que o resumo abriu sozinho: "<mundoId>:<dia>". */
export const CHAVE_DIA_VISTO = 'resumoDoDia.diaVisto';
/** Último resumo mostrado, pelo dia do próprio resumo: "<mundoId>:<dia>". */
export const CHAVE_RESUMO_MOSTRADO = 'resumoDoDia.mostrado';

/**
 * Abre /resumo-do-dia sozinho na primeira visita de cada dia do mundo. Só abre quando o GET do
 * resumo responde 200 nesta montagem; um 404 (lote ainda não rodou) deixa para a próxima
 * visita. O servidor devolve o resumo mais recente, então um resumo já mostrado não reabre no
 * dia seguinte antes de o lote gerar o novo. Ligado no layout das abas.
 */
export function useAbrirResumoDoDia() {
  const mundo = useMundo();
  const pronto = mundo.data?.estado === 'pronto' ? mundo.data : undefined;
  const diaAtual = pronto ? `${pronto.id}:${pronto.dia}` : undefined;
  const jaAbriuHoje =
    diaAtual !== undefined && armazenamento.getString(CHAVE_DIA_VISTO) === diaAtual;
  const resumo = useResumoDia(diaAtual !== undefined && !jaAbriuHoje);

  const mundoId = pronto?.id;
  const diaDoResumo =
    resumo.isSuccess && !resumo.isFetching && resumo.isFetchedAfterMount
      ? resumo.data.dia
      : undefined;

  useEffect(() => {
    if (!diaAtual || !mundoId || diaDoResumo === undefined) return;
    if (armazenamento.getString(CHAVE_DIA_VISTO) === diaAtual) return;
    const marcaDoResumo = `${mundoId}:${diaDoResumo}`;
    if (armazenamento.getString(CHAVE_RESUMO_MOSTRADO) === marcaDoResumo) return;
    armazenamento.set(CHAVE_DIA_VISTO, diaAtual);
    armazenamento.set(CHAVE_RESUMO_MOSTRADO, marcaDoResumo);
    router.push('/resumo-do-dia');
  }, [diaAtual, mundoId, diaDoResumo]);
}
