// Atualizações por ar (expo-updates, servidor próprio em apps/server/src/rotas/atualizacoes.ts).
// O expo-updates baixa a versão nova ao abrir o app; aqui ela é aplicada quando o jogador volta
// para o app, e quem fica muito tempo fora também procura uma versão nova ao voltar.
import * as Updates from 'expo-updates';
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

/** Intervalo mínimo entre duas procuras por atualização ao voltar para o app. */
const INTERVALO_PROCURA_MS = 5 * 60_000;

export function useAplicarAtualizacao(): void {
  const { isUpdatePending } = Updates.useUpdates();
  const ultimaProcura = useRef(0);

  useEffect(() => {
    if (!Updates.isEnabled) return;
    const assinatura = AppState.addEventListener('change', (estado) => {
      if (estado !== 'active') return;
      // Já baixada: recarrega agora, que o jogador acabou de voltar e não perde nada no meio.
      if (isUpdatePending) {
        void Updates.reloadAsync();
        return;
      }
      const agora = Date.now();
      if (agora - ultimaProcura.current < INTERVALO_PROCURA_MS) return;
      ultimaProcura.current = agora;
      // Baixa em segundo plano; a próxima volta ao app aplica. Falha de rede fica para depois.
      void Updates.checkForUpdateAsync()
        .then((r) => (r.isAvailable ? Updates.fetchUpdateAsync() : undefined))
        .catch(() => undefined);
    });
    return () => assinatura.remove();
  }, [isUpdatePending]);
}
