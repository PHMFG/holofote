import { describe, expect, it } from 'vitest';
import * as contratos from '@holofote/shared';
import * as s from './schema';

// Os enums do banco e os dos contratos da API têm de andar juntos: a API devolve o valor da coluna
// direto no DTO. Se um mudar sem o outro, este teste quebra antes do Zod quebrar em produção.
describe('enums do banco batem com os contratos', () => {
  const pares: [string, readonly string[], readonly string[]][] = [
    ['plano', s.planoEnum.enumValues, contratos.Plano.options],
    ['preferencia_tema', s.preferenciaTemaEnum.enumValues, contratos.PreferenciaTema.options],
    ['destaque', s.destaqueEnum.enumValues, contratos.NomeDestaque.options],
    ['estado_mundo', s.estadoMundoEnum.enumValues, contratos.EstadoMundo.options],
    ['papel', s.papelEnum.enumValues, contratos.Papel.options],
    ['tom_avatar', s.tomAvatarEnum.enumValues, contratos.TomAvatar.options],
    ['tipo_post', s.tipoPostEnum.enumValues, contratos.Post.shape.tipo.options],
    ['tom', s.tomEnum.enumValues, contratos.Tom.options],
    ['tipo_acao', s.tipoAcaoEnum.enumValues, contratos.TipoAcao.options],
    ['tipo_evento', s.tipoEventoEnum.enumValues, contratos.TipoEventoAgendado.options],
    ['periodo', s.periodoEnum.enumValues, contratos.Periodo.options],
    ['estado_evento', s.estadoEventoEnum.enumValues, contratos.EstadoEventoAgendado.options],
    ['opcao_discurso', s.opcaoDiscursoEnum.enumValues, contratos.OpcaoDiscursoId.options],
    ['tipo_alerta', s.tipoAlertaEnum.enumValues, contratos.TipoAlerta.options],
  ];

  it.each(pares)('%s', (_nome, banco, contrato) => {
    expect([...banco].sort()).toEqual([...contrato].sort());
  });

  it('as recargas da API têm motivo no livro-caixa de energia', () => {
    for (const via of contratos.ViaRecarga.options) {
      expect(s.motivoEnergiaEnum.enumValues).toContain(via);
    }
  });
});
