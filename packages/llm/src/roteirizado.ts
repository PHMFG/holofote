// Provedor roteirizado: devolve respostas programadas, em ordem. Para testes do roteador e do worker
// (reparo, reserva, limite, orçamento) sem rede e sem depender do provedor falso.
import type { PedidoGeracao, Provedor, RespostaBruta, UsoTokens } from './provedor';

/**
 * Um passo do roteiro:
 * - string: texto bruto devolvido pelo "modelo";
 * - objeto: vira JSON;
 * - Error: é lançado (use ErroLimite / ErroProvedor);
 * - função: recebe o pedido e devolve qualquer um dos anteriores.
 */
export type PassoRoteiro =
  | string
  | Error
  | Record<string, unknown>
  | ((
      pedido: PedidoGeracao,
    ) => string | Error | Record<string, unknown> | Promise<string | Record<string, unknown>>);

export interface ProvedorRoteirizado extends Provedor {
  /** Pedidos recebidos, em ordem. */
  readonly pedidos: PedidoGeracao[];
  /** Passos que ainda não foram usados. */
  restantes(): number;
}

export function criarProvedorRoteirizado(
  passos: PassoRoteiro[],
  opcoes: { uso?: UsoTokens; latenciaMs?: number } = {},
): ProvedorRoteirizado {
  const fila = [...passos];
  const pedidos: PedidoGeracao[] = [];
  return {
    nome: 'roteirizado',
    pedidos,
    restantes: () => fila.length,
    async gerar(pedido: PedidoGeracao): Promise<RespostaBruta> {
      pedidos.push(pedido);
      const passo = fila.shift();
      if (passo === undefined) throw new Error('provedor roteirizado: roteiro esgotado');
      const valor = typeof passo === 'function' ? await passo(pedido) : passo;
      if (valor instanceof Error) throw valor;
      const texto = typeof valor === 'string' ? valor : JSON.stringify(valor);
      return {
        texto,
        uso: opcoes.uso ?? { entrada: 2000, cache: 1500, saida: 350 },
        modelo: pedido.modelo,
        latenciaMs: opcoes.latenciaMs ?? 5,
      };
    },
  };
}
