import type { Cartao, Consequencia } from '@holofote/shared';
import { create } from 'zustand';

/** Quantos cartões lembrar: só os das ações recentes importam para as telas abertas. */
const MAXIMO = 50;

interface EstadoCartoes {
  porEvento: Record<string, Cartao>;
  guardar: (eventoId: string, cartao: Cartao) => void;
}

/**
 * Cartões de consequência escritos pela IA, por `eventoId` da ação. O evento "cartao" do tempo
 * real pode chegar antes da resposta do POST que cria a consequência; sem este lugar próprio, o
 * cartão cairia no vazio (a consequência ainda não está no cache) e seria sobrescrito depois.
 */
export const useCartoes = create<EstadoCartoes>((set) => ({
  porEvento: {},
  guardar: (eventoId, cartao) =>
    set((s) => ({
      porEvento: Object.fromEntries(
        Object.entries({ ...s.porEvento, [eventoId]: cartao }).slice(-MAXIMO),
      ),
    })),
}));

/**
 * Junta o cartão já recebido à consequência. Quem já tem cartão fica como está: a resposta do
 * servidor nunca apaga um cartão que chegou pelo tempo real.
 */
export function comCartaoRecebido(
  consequencia: Consequencia,
  cartao: Cartao | undefined,
): Consequencia {
  if (!cartao || consequencia.cartao) return consequencia;
  return { ...consequencia, cartao, reacoesPendentes: 0 };
}
