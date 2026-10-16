import { randomUUID } from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';

// Login anônimo por aparelho (Sign in with Apple fica fora do MVP; ver docs/DECISOES.md).
const CHAVE_APARELHO = 'holofote.aparelho';
const CHAVE_TOKEN = 'holofote.token';

export function aparelhoId(): string {
  let id = SecureStore.getItem(CHAVE_APARELHO);
  if (!id) {
    id = randomUUID();
    SecureStore.setItem(CHAVE_APARELHO, id);
  }
  return id;
}

export const tokenSalvo = (): string | null => SecureStore.getItem(CHAVE_TOKEN);
export const salvarToken = (token: string): void => SecureStore.setItem(CHAVE_TOKEN, token);
export const esquecerToken = (): Promise<void> => SecureStore.deleteItemAsync(CHAVE_TOKEN);
