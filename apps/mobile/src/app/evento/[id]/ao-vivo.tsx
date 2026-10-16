import { useLocalSearchParams } from 'expo-router';
import { TelaAoVivo } from '../../../telas/evento/TelaAoVivo';

/** 17 · Evento ao vivo (Figma 55:1554 claro, 58:2263 escuro), modal em tela cheia. */
export default function EventoAoVivo() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <TelaAoVivo id={id} />;
}
