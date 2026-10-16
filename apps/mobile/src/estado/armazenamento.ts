import { createMMKV } from 'react-native-mmkv';
import type { StateStorage } from 'zustand/middleware';

// Preferências locais do aparelho (tema, destaque, rascunhos). O token de login fica no
// expo-secure-store, nunca aqui.
export const armazenamento = createMMKV({ id: 'holofote' });

export const armazenamentoZustand: StateStorage = {
  getItem: (chave) => armazenamento.getString(chave) ?? null,
  setItem: (chave, valor) => armazenamento.set(chave, valor),
  removeItem: (chave) => {
    armazenamento.remove(chave);
  },
};
