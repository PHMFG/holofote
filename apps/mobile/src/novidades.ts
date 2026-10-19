// Notas de atualização do app. Cada update publicado (pnpm publicar) ganha uma entrada no topo:
// ela viaja junto com o update e o app a mostra uma vez, na folha "Novidades".
import { armazenamento } from './estado/armazenamento';

export interface Novidade {
  /** Identificador único e crescente da entrada (data e número do dia). */
  id: string;
  /** Data mostrada ao jogador. */
  data: string;
  itens: readonly string[];
}

/** Da mais nova para a mais antiga. */
export const NOVIDADES: readonly Novidade[] = [
  {
    id: '2026-10-19.2',
    data: '19 de outubro',
    itens: [
      'Os comentários do elenco chegam bem mais rápido: o primeiro sai logo depois do aviso de digitando.',
      'A conversa de um post se atualiza sozinha enquanto está aberta, mesmo com a rede oscilando.',
      'Notas de atualização: a cada versão nova, o app abre mostrando o que mudou. O histórico inteiro fica no perfil.',
    ],
  },
  {
    id: '2026-10-19.1',
    data: '19 de outubro',
    itens: [
      'Seus posts ganharam uma seção no perfil, com a lista completa em Ver todos.',
      'As curtidas sobem aos poucos depois que um post sai, em vez de aparecerem todas de uma vez.',
      'Nas conversas aparecem as respostas mais novas de cada comentário, com a marca de para quem é cada uma.',
      'O app se atualiza sozinho: a versão nova baixa ao abrir e entra quando você sai e volta.',
    ],
  },
];

/** Última entrada que o jogador já viu (id). */
export const CHAVE_NOVIDADES_VISTAS = 'novidades.vistas';

/**
 * Entradas que o jogador ainda não viu, da mais nova para a mais antiga. Sem registro, todas
 * contam como novas (quem já jogava antes desta folha existir vê o que mudou).
 */
export function novidadesNaoVistas(
  vista: string | undefined,
  lista: readonly Novidade[] = NOVIDADES,
): readonly Novidade[] {
  const indice = vista === undefined ? -1 : lista.findIndex((n) => n.id === vista);
  return indice === -1 ? lista : lista.slice(0, indice);
}

export function lerNovidadesVistas(): string | undefined {
  return armazenamento.getString(CHAVE_NOVIDADES_VISTAS);
}

/** Marca tudo como visto (a entrada mais nova). */
export function marcarNovidadesVistas(lista: readonly Novidade[] = NOVIDADES): void {
  const maisNova = lista[0];
  if (maisNova) armazenamento.set(CHAVE_NOVIDADES_VISTAS, maisNova.id);
}
