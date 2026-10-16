import type { EventoResumo, Marco } from '@holofote/shared';
import type { z } from 'zod';
import { formatarNumero } from '../../formatar';
import { NOME_PERIODO } from '../../tempo';

type Requisito = Marco['requisitos'][number];
type Evento = z.infer<typeof EventoResumo>;

export const ordenarMarcos = (marcos: readonly Marco[]) =>
  [...marcos].sort((a, b) => a.ordem - b.ordem);

/** Marco em andamento (o primeiro ainda não liberado). */
export const marcoAtual = (marcos: readonly Marco[]) => marcos.find((m) => m.estado === 'atual');

/** Marco liberado cujas recompensas o jogador ainda não pegou. */
export const marcoParaResgatar = (marcos: readonly Marco[]) =>
  marcos.find((m) => m.estado === 'concluido' && !m.resgatado);

export const proporcao = (r: Requisito) =>
  r.alvo <= 0 ? 1 : Math.min(1, Math.max(0, r.atual / r.alvo));

/** Média dos requisitos de um marco, de 0 a 1 (barra pequena do topo de 06). */
export function progressoDoMarco(marco: Marco | undefined): number {
  if (!marco) return 1;
  if (marco.requisitos.length === 0) return 0;
  return marco.requisitos.reduce((soma, r) => soma + proporcao(r), 0) / marco.requisitos.length;
}

/** "2 de 4", "7,1 mil de 10 mil"; passou da meta, mostra a meta ("9 de 9", não "13 de 9"). */
export const textoRequisito = (r: Requisito) =>
  `${formatarNumero(Math.min(r.atual, r.alvo))} de ${formatarNumero(r.alvo)}`;

/** Itens da recompensa, como no plano: gemas, energia cheia, ação nova e personagem novo. */
export function itensDaRecompensa(recompensa: Marco['recompensa']): string[] {
  return [
    recompensa.gemas > 0 ? `+${recompensa.gemas} gemas` : '',
    recompensa.energiaCheia ? 'energia cheia' : '',
    recompensa.acaoNova ? `ação nova: ${recompensa.acaoNova}` : '',
    recompensa.personagemNovo ? 'personagem novo' : '',
  ].filter(Boolean);
}

const ESTADO_EVENTO: Record<Evento['estado'], string> = {
  anunciado: 'anunciado',
  campanha: 'campanha aberta',
  ao_vivo: 'ao vivo agora',
  encerrado: 'encerrado',
};

/** "Prêmio Holofote em 2 dias", contado pelo dia do mundo. */
export function tituloDoEvento(evento: Evento, diaDoMundo: number | undefined): string {
  if (evento.estado === 'ao_vivo') return `${evento.titulo} ao vivo`;
  if (diaDoMundo === undefined) return evento.titulo;
  const faltam = evento.quando.dia - diaDoMundo;
  if (faltam <= 0) return `${evento.titulo} hoje`;
  if (faltam === 1) return `${evento.titulo} amanhã`;
  return `${evento.titulo} em ${faltam} dias`;
}

export const detalheDoEvento = (evento: Evento) =>
  `Dia ${evento.quando.dia}, ${NOME_PERIODO[evento.quando.periodo]} · ${ESTADO_EVENTO[evento.estado]}`;
