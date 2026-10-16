import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { armazenamentoZustand } from '../../estado/armazenamento';

interface EstadoAjustes {
  /** "Reduzir animações" da tela 10, guardado só no aparelho (MMKV). */
  reduzirAnimacoes: boolean;
  definirReduzirAnimacoes: (valor: boolean) => void;
}

export const useAjustes = create<EstadoAjustes>()(
  persist(
    (set) => ({
      reduzirAnimacoes: false,
      definirReduzirAnimacoes: (reduzirAnimacoes) => set({ reduzirAnimacoes }),
    }),
    {
      name: 'ajustes',
      version: 1,
      storage: createJSONStorage(() => armazenamentoZustand),
      partialize: ({ reduzirAnimacoes }) => ({ reduzirAnimacoes }),
      merge: (salvo, atual) => {
        const { reduzirAnimacoes } = (salvo ?? {}) as Partial<EstadoAjustes>;
        return {
          ...atual,
          reduzirAnimacoes:
            typeof reduzirAnimacoes === 'boolean' ? reduzirAnimacoes : atual.reduzirAnimacoes,
        };
      },
    },
  ),
);

/** "Reduzir movimento" do iOS (Ajustes > Acessibilidade > Movimento), acompanhado ao vivo. */
export function useReduzirMovimentoDoSistema(): boolean {
  const [ligado, setLigado] = useState(false);
  useEffect(() => {
    let ativo = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((valor) => {
      if (ativo) setLigado(valor);
    });
    const assinatura = AccessibilityInfo.addEventListener('reduceMotionChanged', setLigado);
    return () => {
      ativo = false;
      assinatura.remove();
    };
  }, []);
  return ligado;
}

/** Animações reduzidas pelo ajuste do app ou pelo do sistema. */
export function useReduzirMovimento(): boolean {
  const local = useAjustes((s) => s.reduzirAnimacoes);
  const sistema = useReduzirMovimentoDoSistema();
  return local || sistema;
}
