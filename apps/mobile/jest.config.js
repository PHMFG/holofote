/** @type {import('jest').Config} */
module.exports = {
  preset: 'jest-expo',
  // lucide e standard-navigation (do expo-router) publicam ESM; o resto é a lista do jest-expo.
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|react-native-svg|lucide-react-native|standard-navigation)',
  ],
  // O build ESM do lucide (.mjs) não passa pelo Babel do Jest; o CommonJS passa.
  moduleNameMapper: {
    '^lucide-react-native$': require.resolve('lucide-react-native'),
  },
  setupFiles: ['<rootDir>/src/testes/preparar.ts'],
};
