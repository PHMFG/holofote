import type { Alerta } from '@holofote/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { chamadas, simularApi } from '../../testes/api';
import { mundo, personagem, uuid } from '../../testes/dados';
import { renderizarTela } from '../../testes/renderizarTela';
import { TelaAlertas } from './TelaAlertas';

jest.mock('../../api/cliente', () => require('../../testes/api').moduloClienteSimulado());
// Sem navegador nos testes: o foco da aba vira um efeito comum (sair = desmontar).
jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  router: { push: jest.fn(), back: jest.fn() },
  useFocusEffect: (efeito: () => void | (() => void)) =>
    require('react').useEffect(efeito, [efeito]),
}));

// Só o relógio é falso (16/10/2026, 21:07): os grupos "Hoje" e "Ontem" não dependem da hora do teste.
const AGORA = new Date(2026, 9, 16, 21, 7);
const antes = (minutos: number) => new Date(AGORA.getTime() - minutos * 60_000).toISOString();

const vic = personagem();
const duda = personagem({ nome: 'Duda Marques', iniciais: 'DM' });
const bento = personagem({ nome: 'Bento Lima', iniciais: 'BL' });
const fofoca = personagem({ nome: 'fofocalizei', iniciais: 'FO', papel: 'figurante' });

const alerta = (p: Partial<Alerta>): Alerta => ({
  id: uuid(),
  tipo: 'resposta',
  texto: '',
  criadoEm: antes(1),
  lido: true,
  personagem: null,
  destino: { rota: '/registro' },
  ...p,
});

const doVic = alerta({
  texto: 'Vic Ferraz respondeu seu post',
  personagem: vic,
  criadoEm: antes(0.5),
  lido: false,
  destino: { rota: '/post/abc/respostas' },
});
const daFofoca = alerta({
  tipo: 'mencao',
  texto: 'fofocalizei citou você numa fofoca',
  personagem: fofoca,
  criadoEm: antes(12),
  lido: false,
});
const seguidores = alerta({
  tipo: 'seguidores',
  texto: '+214 seguidores depois do seu post',
  criadoEm: antes(14),
  lido: false,
});
const daDuda = alerta({
  tipo: 'dm',
  texto: 'Duda Marques quer marcar um estúdio',
  personagem: duda,
  criadoEm: antes(60),
});
const premio = alerta({
  tipo: 'evento',
  texto: 'Prêmio Holofote anunciou as indicações',
  criadoEm: antes(24 * 60),
});
const doBento = alerta({
  tipo: 'seguidores',
  texto: 'Bento Lima curtiu 3 posts seus',
  personagem: bento,
  criadoEm: antes(24 * 60 + 5),
});
const todos = [premio, daDuda, doVic, doBento, seguidores, daFofoca];

function simular(lista: Alerta[] = todos) {
  simularApi({
    'GET /mundos/atual': mundo(),
    'GET /alertas': lista,
    'POST /alertas/lidos': undefined,
  });
}

const rotulos = () => screen.getAllByRole('button', { name: /, (agora|\d+ min|\d+ h|Dia \d+)/ });
const lidos = () => chamadas.filter((c) => c.metodo === 'POST' && c.rota === '/alertas/lidos');

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers({
    now: AGORA,
    doNotFake: [
      'nextTick',
      'setImmediate',
      'clearImmediate',
      'setInterval',
      'clearInterval',
      'setTimeout',
      'clearTimeout',
      'queueMicrotask',
      'hrtime',
      'performance',
      'requestAnimationFrame',
      'cancelAnimationFrame',
      'requestIdleCallback',
      'cancelIdleCallback',
    ],
  });
});
afterEach(() => jest.useRealTimers());

describe('07 · Alertas', () => {
  it('agrupa por dia, do mais novo ao mais velho, com hora e não lidos', async () => {
    simular();
    await renderizarTela(<TelaAlertas />);

    expect(await screen.findByText('Hoje')).toBeTruthy();
    expect(screen.getByText('Ontem')).toBeTruthy();
    expect(rotulos().map((b) => b.props.accessibilityLabel)).toEqual([
      'Vic Ferraz respondeu seu post, Resposta ao seu post, agora, não lido',
      'fofocalizei citou você numa fofoca, Menção, 12 min, não lido',
      '+214 seguidores depois do seu post, Seguidores, 14 min, não lido',
      'Duda Marques quer marcar um estúdio, Mensagem direta, 1 h',
      'Prêmio Holofote anunciou as indicações, Evento, Dia 5',
      'Bento Lima curtiu 3 posts seus, Seguidores, Dia 5',
    ]);
    // O nome do personagem vai em negrito dentro do texto.
    expect(screen.getByText('Vic Ferraz')).toHaveStyle({ fontFamily: 'PlusJakartaSans-SemiBold' });
  });

  it('filtra por menções, relações e sistema', async () => {
    simular();
    await renderizarTela(<TelaAlertas />);
    await screen.findByText('Hoje');
    const textos = () => rotulos().map((b) => String(b.props.accessibilityLabel).split(',')[0]);

    await fireEvent.press(screen.getByRole('radio', { name: 'Menções' }));
    expect(textos()).toEqual([
      'Vic Ferraz respondeu seu post',
      'fofocalizei citou você numa fofoca',
    ]);

    await fireEvent.press(screen.getByRole('radio', { name: 'Relações' }));
    expect(textos()).toEqual([
      'Duda Marques quer marcar um estúdio',
      'Bento Lima curtiu 3 posts seus',
    ]);

    await fireEvent.press(screen.getByRole('radio', { name: 'Sistema' }));
    expect(textos()).toEqual([
      '+214 seguidores depois do seu post',
      'Prêmio Holofote anunciou as indicações',
    ]);
  });

  it('tocar num alerta abre o destino dele', async () => {
    simular();
    await renderizarTela(<TelaAlertas />);

    await fireEvent.press(await screen.findByRole('button', { name: /^Vic Ferraz respondeu/ }));
    expect(router.push).toHaveBeenCalledWith('/post/abc/respostas');
  });

  it('"Marcar como lidos" marca na hora', async () => {
    simular();
    await renderizarTela(<TelaAlertas />);

    await fireEvent.press(await screen.findByRole('button', { name: 'Marcar como lidos' }));
    await waitFor(() => expect(lidos()).toHaveLength(1));
  });

  it('ao sair da aba, marca os não lidos como lidos', async () => {
    simular();
    const { unmount } = await renderizarTela(<TelaAlertas />);
    await screen.findByText('Hoje');
    expect(lidos()).toHaveLength(0);

    await unmount();
    await waitFor(() => expect(lidos()).toHaveLength(1));
  });

  it('sem não lidos, sair não chama a API e o botão some', async () => {
    simular([daDuda, premio]);
    const { unmount } = await renderizarTela(<TelaAlertas />);
    await screen.findByText('Hoje');
    expect(screen.queryByRole('button', { name: 'Marcar como lidos' })).toBeNull();

    await unmount();
    expect(lidos()).toHaveLength(0);
  });

  it('vazio mostra uma frase por filtro', async () => {
    simular([]);
    await renderizarTela(<TelaAlertas />);

    expect(
      await screen.findByText('Nenhum alerta ainda. Poste algo e o elenco reage.'),
    ).toBeTruthy();
    await fireEvent.press(screen.getByRole('radio', { name: 'Menções' }));
    expect(screen.getByText('Ninguém respondeu nem citou você ainda.')).toBeTruthy();
  });

  it('erro ao carregar oferece tentar de novo', async () => {
    simularApi({ 'GET /mundos/atual': mundo() });
    await renderizarTela(<TelaAlertas />);

    expect(await screen.findByText('Não deu para abrir seus alertas.')).toBeTruthy();
  });
});
