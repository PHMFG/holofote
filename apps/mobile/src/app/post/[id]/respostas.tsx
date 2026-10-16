import { useLocalSearchParams } from 'expo-router';
import { TelaRespostas } from '../../../telas/respostas/TelaRespostas';

/** 13 · Respostas (Figma 53:1397 claro, 58:1746 escuro). */
export default function Respostas() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <TelaRespostas postId={id} />;
}
