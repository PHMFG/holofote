import { Stack } from 'expo-router';
import { ProvedorTema } from '../tema/ProvedorTema';

export default function LayoutRaiz() {
  return (
    <ProvedorTema>
      <Stack screenOptions={{ headerShown: false }} />
    </ProvedorTema>
  );
}
