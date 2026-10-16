import { useLocalSearchParams } from 'expo-router';
import { TelaHistoria } from '../../telas/historia/TelaHistoria';

/** 15 · História (Figma 54:1460 claro, 58:2027 escuro), modal em tela cheia. */
export default function Historia() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <TelaHistoria key={id} id={id} />;
}
