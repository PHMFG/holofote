import { router } from 'expo-router';

/** Volta uma tela; sem histórico (abriu por link ou depois de recomeçar), vai para o feed. */
export function voltarOuInicio() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}
