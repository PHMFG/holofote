// Hápticos leves dos controles do design system. Falha em silêncio (simulador, aparelho sem motor).
import * as Haptics from 'expo-haptics';

/** Troca de seleção: interruptor, segmentado, chip de escolha, aba. */
export function toqueDeSelecao(): void {
  try {
    void Haptics.selectionAsync().catch(() => {});
  } catch {
    // Sem háptico, a animação já diz o que mudou.
  }
}
