import type { ConfigContext, ExpoConfig } from 'expo/config';

// Fontes embutidas no build (sem carregar em tempo de execução). No iOS, o nome
// usado em fontFamily é o PostScript do arquivo: veja src/fontes.ts.
// O plugin do expo-font resolve o caminho pelo nome do pacote, onde quer que ele esteja instalado.
const PESOS = ['400Regular', '500Medium', '600SemiBold', '700Bold'];
const fontes = PESOS.map(
  (peso) => `@expo-google-fonts/plus-jakarta-sans/${peso}/PlusJakartaSans_${peso}.ttf`,
);

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Holofote',
  slug: 'holofote',
  version: '0.1.0',
  scheme: 'holofote',
  platforms: ['ios'],
  orientation: 'portrait',
  userInterfaceStyle: 'automatic',
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
    './plugins/caminho-utf8.js',
  ],
});
