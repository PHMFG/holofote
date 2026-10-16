import type { EventoAgendado } from '@holofote/shared';
import {
  Flame,
  Heart,
  Megaphone,
  Mic,
  Music,
  Newspaper,
  Ticket,
  TriangleAlert,
  Trophy,
  Users,
  type LucideIcon,
} from 'lucide-react-native';
import type { OpcaoDiscurso } from './formatar';

/** Esfera do cartão do evento por tipo (16: troféu no Prêmio Holofote). */
export const ICONE_DO_EVENTO: Record<EventoAgendado['tipo'], LucideIcon> = {
  premio: Trophy,
  show: Music,
  crise: TriangleAlert,
};

/** Ícone de cada ação de campanha do catálogo do motor; id novo cai no megafone. */
const ICONE_DA_CAMPANHA: Record<string, LucideIcon> = {
  ensaiar: Mic,
  pedir_votos: Users,
  bastidores: Megaphone,
  entrevista: Newspaper,
};

export const iconeDaCampanha = (acaoId: string): LucideIcon =>
  ICONE_DA_CAMPANHA[acaoId] ?? Megaphone;

/** Discurso: coração no seguro, chama no ousado (esfera preta), ingresso no especial (17). */
export const DISCURSO: Record<
  OpcaoDiscurso,
  { icone: LucideIcon; tom: 'claro' | 'escuro'; descricao: string }
> = {
  seguro: { icone: Heart, tom: 'claro', descricao: 'O caminho mais seguro' },
  ousado: { icone: Flame, tom: 'escuro', descricao: 'Arrisca mais' },
  especial: {
    icone: Ticket,
    tom: 'claro',
    descricao: 'Só com o marco especial',
  },
};
