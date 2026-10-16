import { useLocalSearchParams } from 'expo-router';
import { TelaDM } from '../../telas/dm/TelaDM';

/** 04 · Mensagem direta (Figma 18:218 claro, 30:962 escuro). */
export default function MensagemDireta() {
  const { conversaId } = useLocalSearchParams<{ conversaId: string }>();
  return <TelaDM conversaId={conversaId} />;
}
