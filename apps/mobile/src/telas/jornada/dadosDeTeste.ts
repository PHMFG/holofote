// Dados de exemplo de jornada e marcos para os testes de 06 e 18, no formato do contrato.
import type { Jornada, Marco } from '@holofote/shared';
import { uuid } from '../../testes/dados';

export const marco = (p: Partial<Marco> = {}): Marco => ({
  id: uuid(),
  ordem: 1,
  titulo: 'Primeiro single',
  descricao: 'Sua primeira música chega às rádios.',
  estado: 'futuro',
  requisitos: [],
  recompensa: { gemas: 25, energiaCheia: true, acaoNova: null, personagemNovo: false },
  liberadoEm: null,
  resgatado: false,
  ...p,
});

/** Ato 1 do Figma (06): marco 1 concluído e resgatado, marco 2 em andamento, 3 a 5 futuros. */
export function marcosDoAto(): Marco[] {
  return [
    marco({
      ordem: 1,
      titulo: 'Primeiro single',
      estado: 'concluido',
      liberadoEm: '2026-10-14T12:00:00Z',
      resgatado: true,
    }),
    marco({
      ordem: 2,
      titulo: 'Primeiro show lotado',
      descricao: 'Libera a turnê e o personagem "empresário".',
      estado: 'atual',
      requisitos: [
        { chave: 'escandalos', rotulo: 'Escândalos administrados', atual: 2, alvo: 4 },
        { chave: 'carisma', rotulo: 'Carisma', atual: 61, alvo: 70 },
        { chave: 'seguidores', rotulo: 'Seguidores', atual: 7100, alvo: 10000 },
      ],
      recompensa: {
        gemas: 25,
        energiaCheia: true,
        acaoNova: 'Anunciar a turnê',
        personagemNovo: true,
      },
    }),
    marco({ ordem: 3, titulo: 'Primeiro feat', estado: 'futuro' }),
    marco({ ordem: 4, titulo: 'Capa de revista', estado: 'futuro' }),
    marco({ ordem: 5, titulo: 'Disco de ouro', estado: 'futuro' }),
  ];
}

export const jornada = (p: Partial<Jornada> = {}): Jornada => ({
  ato: 1,
  objetivo: 'Dominar o pop nacional',
  progressoAto: 0.04,
  marcos: marcosDoAto(),
  proximoEvento: null,
  ...p,
});
