import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useCartoes } from '../../api/cartoes';
import { requisitar } from '../../api/cliente';

/**
 * Recomeçar: apaga o mundo atual (energia e gemas ficam na conta), esquece o cache do mundo
 * velho e volta ao onboarding. Rota em docs/CONTRATOS.md (`DELETE /mundos/atual`, 204).
 *
 * `cliente.clear()` deixaria os observadores das telas montadas presos às queries antigas (o
 * cache cria queries novas e eles não as veem): o tempo real e as consultas ficariam mortos.
 * Por isso: remove as queries sem observador e reinicia (`resetQueries`) as que têm, que voltam
 * ao estado inicial e são buscadas de novo.
 */
export function useRecomecarMundo() {
  const cliente = useQueryClient();
  return useMutation({
    mutationFn: () => requisitar('/mundos/atual', { metodo: 'DELETE' }),
    onSuccess: () => {
      router.replace('/criar-mundo');
      cliente.removeQueries({ predicate: (consulta) => consulta.getObserversCount() === 0 });
      useCartoes.setState({ porEvento: {} });
      void cliente.resetQueries();
    },
  });
}
