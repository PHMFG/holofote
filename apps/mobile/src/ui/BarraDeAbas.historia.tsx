import { Bell, Home, MessageSquare, Target, User } from 'lucide-react-native';
import { useState } from 'react';
import { BarraDeAbas } from './BarraDeAbas';
import type { Historia } from './historias/tipos';

const ABAS = [
  { chave: 'inicio', rotulo: 'Início', icone: Home },
  { chave: 'jornada', rotulo: 'Jornada', icone: Target },
  { chave: 'mensagens', rotulo: 'Mensagens', icone: MessageSquare },
  { chave: 'alertas', rotulo: 'Alertas', icone: Bell, novidade: true },
  { chave: 'perfil', rotulo: 'Perfil', icone: User },
] as const;

function Exemplo() {
  const [ativa, setAtiva] = useState<(typeof ABAS)[number]['chave']>('inicio');
  return <BarraDeAbas abas={ABAS} ativa={ativa} onSelecionar={setAtiva} />;
}

export const historia: Historia = { titulo: 'BarraDeAbas', figma: '12:26', Exemplo };
