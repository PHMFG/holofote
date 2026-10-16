import { useLocalSearchParams } from 'expo-router';
import { TelaPersonagem } from '../../telas/personagem/TelaPersonagem';

/** 08 · Perfil de personagem (Figma 26:354 claro, 31:911 escuro). */
export default function PerfilPersonagem() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <TelaPersonagem id={id} />;
}
