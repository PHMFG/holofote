/// <reference types="node" />
// O Expo lê este arquivo no Node, que não resolve o `./gerado` sem extensão do index do pacote:
// importa direto o arquivo gerado dos tokens (ele não tem imports).
import { neutros } from '../../packages/tokens/src/gerado.ts';
import { createRequire } from 'node:module';
import type { ConfigContext, ExpoConfig } from 'expo/config';

// Fontes embutidas no build (sem carregar em tempo de execução). No iOS, o nome
// usado em fontFamily é o PostScript do arquivo: veja src/fontes.ts.
// O plugin do expo-font resolve o caminho pelo nome do pacote, onde quer que ele esteja instalado.
const PESOS = ['400Regular', '500Medium', '600SemiBold', '700Bold'];
const fontes = PESOS.map(
  (peso) => `@expo-google-fonts/plus-jakarta-sans/${peso}/PlusJakartaSans_${peso}.ttf`,
);

// Splash: esfera do ícone sobre o fundo do tema, claro e escuro (cores dos tokens, sem hex aqui).
// O pacote expo-splash-screen precisa estar instalado (`npx expo install expo-splash-screen`);
// sem ele o app abre normalmente, só que com a splash padrão do template.
const splash = {
  image: './assets/splash-icon.png',
  // Esfera de 128 pt: ela ocupa 56 % do lado da imagem de 1024 px.
  imageWidth: 230,
  backgroundColor: neutros.claro.fundo,
  dark: {
    image: './assets/splash-icon.png',
    backgroundColor: neutros.escuro.fundo,
  },
};

function pluginSplash(): [string, typeof splash][] {
  try {
    createRequire(import.meta.url).resolve('expo-splash-screen/package.json');
    return [['expo-splash-screen', splash]];
  } catch {
    console.warn('[app.config] expo-splash-screen não está instalado: splash sem configuração.');
    return [];
  }
}

// Atualizações por ar (expo-updates), servidas pela nossa API (protocolo Expo Updates v1, sem EAS):
// ver apps/server/src/rotas/atualizacoes.ts e scripts/publicar-atualizacao.sh. Só ligam quando a
// URL da API está definida no build; os builds locais de desenvolvimento ficam como estavam.
const apiUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/+$/, '');
const atualizacoes: ExpoConfig['updates'] = apiUrl
  ? {
      url: `${apiUrl}/v1/atualizacoes/manifesto`,
      checkAutomatically: 'ON_LOAD',
      fallbackToCacheTimeout: 0,
    }
  : { enabled: false };

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Holofote',
  slug: 'holofote',
  version: '0.1.0',
  scheme: 'holofote',
  platforms: ['ios'],
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
  // Texto fixo: só muda quando o código nativo muda (novo módulo, plugin ou SDK). Nesse caso,
  // suba o número e instale um .ipa novo; atualizações por ar só chegam a builds do mesmo valor.
  runtimeVersion: '1',
  updates: atualizacoes,
  icon: './assets/icon.png',
  ios: {
    // Provisório: ver docs/DECISOES.md
    bundleIdentifier: 'app.holofote',
    supportsTablet: false,
  },
  plugins: [
    'expo-router',
    ['expo-build-properties', { ios: { deploymentTarget: '26.0' } }],
    ['expo-font', { ios: { fonts: fontes } }],
    ...pluginSplash(),
    './plugins/caminho-utf8.js',
  ],
});
