import { useLocalSearchParams } from 'expo-router';
import { TelaEvento } from '../../../telas/evento/TelaEvento';

/** 16 · Evento (Figma 55:1385 claro, 58:2106 escuro). */
export default function Evento() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <TelaEvento id={id} />;
}
