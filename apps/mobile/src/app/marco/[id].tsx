import { useLocalSearchParams } from 'expo-router';
import { TelaMarco } from '../../telas/marco/TelaMarco';

/** 18 · Marco liberado (Figma 56:1445 claro, 58:2353 escuro). */
export default function MarcoLiberado() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <TelaMarco id={id} />;
}
