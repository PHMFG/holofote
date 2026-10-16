// Dados de exemplo das telas 16 e 17 no formato dos contratos (packages/shared).
import type { Consequencia, EventoAgendado } from '@holofote/shared';
import { energia, personagem, uuid } from '../../testes/dados';

export const vic = personagem({ nome: 'Vic Ferraz', handle: '@vicferraz', iniciais: 'VF' });
export const nina = personagem({ nome: 'Nina Costa', handle: '@ninacosta', iniciais: 'NC' });
export const lua = personagem({
  nome: 'Lua Prado',
  handle: '@luaprado',
  iniciais: 'LP',
  tomAvatar: 'escuro',
  papel: 'jogador',
  verificado: false,
});

export const eventoAgendado = (p: Partial<EventoAgendado> = {}): EventoAgendado => ({
  id: uuid(),
  tipo: 'premio',
  titulo: 'Prêmio Holofote',
  categoria: 'Revelação do ano',
  quando: { dia: 8, periodo: 'noite' },
  estado: 'campanha',
  indicados: [
    { personagem: vic, chance: 0.41 },
    { personagem: lua, chance: 0.34 },
    { personagem: nina, chance: 0.25 },
  ],
  acoes: [
    {
      id: 'ensaiar',
      titulo: 'Ensaiar o discurso',
      descricao: 'Libera o discurso ousado.',
      custo: 1,
      feita: false,
    },
    {
      id: 'bastidores',
      titulo: 'Postar bastidores',
      descricao: 'Gera um post e reações do mundo.',
      custo: 2,
      feita: false,
    },
  ],
  discurso: [
    { id: 'seguro', titulo: 'Seguro', liberada: true, motivo: null },
    { id: 'ousado', titulo: 'Ousado', liberada: false, motivo: 'Ensaie o discurso na campanha.' },
    { id: 'especial', titulo: 'Especial', liberada: false, motivo: 'Libere o marco 2 da jornada.' },
  ],
  vencedor: null,
  prazoAoVivo: null,
  ...p,
});

export const consequencia = (p: Partial<Consequencia> = {}): Consequencia => ({
  eventoId: uuid(),
  deltas: [],
  seguidoresGanhos: 0,
  curtidasSimuladas: 0,
  cartao: null,
  reacoesPendentes: 0,
  energia: energia(7),
  marcoLiberado: null,
  desfazivelAte: null,
  ...p,
});
