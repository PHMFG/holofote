import { router } from 'expo-router';
import { Alert } from 'react-native';
import { z } from 'zod';
import { ErroDaApi } from '../api/cliente';
import { tratarErroDeAcao } from './erros';

jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  router: { push: jest.fn() },
}));

let alerta: jest.SpyInstance;
beforeEach(() => {
  jest.clearAllMocks();
  alerta = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
});

describe('tratarErroDeAcao', () => {
  it('sem energia abre a folha 19, sem alerta', () => {
    tratarErroDeAcao(new ErroDaApi(409, 'sem_energia', 'Sem energia.'));
    expect(router.push).toHaveBeenCalledWith('/sem-energia');
    expect(alerta).not.toHaveBeenCalled();
  });

  it('moderação e regras mostram a mensagem do servidor', () => {
    tratarErroDeAcao(new ErroDaApi(422, 'moderacao', 'Esse texto não passou.'));
    expect(alerta).toHaveBeenLastCalledWith('Não dá para publicar isso', 'Esse texto não passou.');
    tratarErroDeAcao(new ErroDaApi(409, 'desfazer_expirado', 'Passou de uma hora.'));
    expect(alerta).toHaveBeenLastCalledWith('Não deu certo', 'Passou de uma hora.');
  });

  it('falha de rede (TypeError do fetch) pede a internet', () => {
    tratarErroDeAcao(new TypeError('Network request failed'));
    expect(alerta).toHaveBeenCalledWith('Sem conexão', 'Confira a internet e tente de novo.');
  });

  it('erro de contrato (ZodError) não diz que a internet caiu', () => {
    const erroDeContrato = z.object({ id: z.string() }).safeParse({}).error;
    tratarErroDeAcao(erroDeContrato);
    tratarErroDeAcao(new Error('qualquer outra coisa'));
    for (const chamada of alerta.mock.calls) {
      expect(chamada).toEqual([
        'Resposta inesperada',
        'Recebemos uma resposta inesperada. Confira o registro antes de repetir.',
      ]);
    }
    expect(alerta).toHaveBeenCalledTimes(2);
  });
});
