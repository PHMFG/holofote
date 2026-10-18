// Ambiente do Jest: módulos nativos que não existem fora do aparelho.
import { notifyManager } from '@tanstack/react-query';
import { act } from 'react';
import { Appearance } from 'react-native';

jest.spyOn(Appearance, 'setColorScheme').mockImplementation(() => {});

// Reanimated nos testes: src/testes/reanimado.ts (moduleNameMapper do jest.config.js).

// O react-native-mmkv importa o Nitro nativo já no carregamento; usa o mock em memória da própria lib.
jest.mock('react-native-mmkv', () => {
  const { createMockMMKV } = jest.requireActual('react-native-mmkv/lib/createMMKV/createMockMMKV');
  return { createMMKV: createMockMMKV };
});

// O TanStack Query avisa os componentes num setTimeout; sem act, toda mutação que termina depois
// do último await do teste gera o aviso "not wrapped in act". Com o aviso dentro de act, os
// testes esperam só o estado final (findBy/waitFor), sem pausas de tempo fixo. O Testing Library
// desliga IS_REACT_ACT_ENVIRONMENT fora das suas chamadas; aqui ele liga só durante o aviso.
notifyManager.setNotifyFunction((callback) => {
  const ambiente = globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean };
  const anterior = ambiente.IS_REACT_ACT_ENVIRONMENT;
  ambiente.IS_REACT_ACT_ENVIRONMENT = true;
  try {
    act(callback);
  } finally {
    ambiente.IS_REACT_ACT_ENVIRONMENT = anterior;
  }
});
