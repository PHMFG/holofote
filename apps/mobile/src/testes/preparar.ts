// Ambiente do Jest: módulos nativos que não existem fora do aparelho.
import { Appearance } from 'react-native';

jest.spyOn(Appearance, 'setColorScheme').mockImplementation(() => {});

// O react-native-mmkv importa o Nitro nativo já no carregamento; usa o mock em memória da própria lib.
jest.mock('react-native-mmkv', () => {
  const { createMockMMKV } = jest.requireActual('react-native-mmkv/lib/createMMKV/createMockMMKV');
  return { createMMKV: createMockMMKV };
});
