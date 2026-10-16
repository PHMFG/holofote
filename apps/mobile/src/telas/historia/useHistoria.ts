import { Post, type RespostaFeed } from '@holofote/shared';
import { useQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { useState } from 'react';
import { requisitar } from '../../api/cliente';
import { chaves } from '../../api/consultas';

/**
 * GET /historias/:id. O servidor marca a história como vista, então o feed é invalidado para o
 * anel da fileira de histórias apagar. Usa a chave do post para o useVotar atualizar a tela.
 */
export function useHistoria(id: string) {
  const cliente = useQueryClient();
  return useQuery({
    queryKey: chaves.post(id),
    queryFn: async () => {
      const historia = await requisitar(`/historias/${id}`, { schema: Post });
      void cliente.invalidateQueries({ queryKey: chaves.feed });
      return historia;
    },
  });
}

/**
 * Ordem das histórias da fileira do feed (lida uma vez, ao abrir), para os segmentos de
 * progresso e para ir à anterior ou à próxima. Sem o feed no cache, a história fica sozinha.
 */
export function useSequenciaDeHistorias(id: string) {
  const cliente = useQueryClient();
  const [ids] = useState(() => {
    const feed = cliente.getQueryData<InfiniteData<RespostaFeed>>(chaves.feed);
    return feed?.pages[0]?.historias.map((h) => h.id) ?? [];
  });
  const lista = ids.includes(id) ? ids : [id];
  const posicao = lista.indexOf(id);
  return {
    total: lista.length,
    posicao,
    anterior: posicao > 0 ? lista[posicao - 1] : undefined,
    proxima: posicao < lista.length - 1 ? lista[posicao + 1] : undefined,
  };
}
