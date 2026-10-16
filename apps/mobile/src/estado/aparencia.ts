import { DESTAQUE_PADRAO, NOMES_DESTAQUE, type NomeDestaque } from '@holofote/tokens';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { armazenamentoZustand } from './armazenamento';

export type PreferenciaTema = 'sistema' | 'claro' | 'escuro';
export const PREFERENCIAS_TEMA: PreferenciaTema[] = ['sistema', 'claro', 'escuro'];

interface EstadoAparencia {
  tema: PreferenciaTema;
  destaque: NomeDestaque;
  definirTema: (tema: PreferenciaTema) => void;
  definirDestaque: (destaque: NomeDestaque) => void;
}

export const useAparencia = create<EstadoAparencia>()(
  persist(
    (set) => ({
      tema: 'sistema',
      destaque: DESTAQUE_PADRAO,
      definirTema: (tema) => set({ tema }),
      definirDestaque: (destaque) => set({ destaque }),
    }),
    {
      name: 'aparencia',
      version: 1,
      storage: createJSONStorage(() => armazenamentoZustand),
      partialize: ({ tema, destaque }) => ({ tema, destaque }),
      // Valor salvo que não existe mais (destaque removido, versão antiga) volta ao padrão.
      merge: (salvo, atual) => {
        const { tema, destaque } = (salvo ?? {}) as Partial<EstadoAparencia>;
        return {
          ...atual,
          tema: tema && PREFERENCIAS_TEMA.includes(tema) ? tema : atual.tema,
          destaque: destaque && NOMES_DESTAQUE.includes(destaque) ? destaque : atual.destaque,
        };
      },
    },
  ),
);
