import { montarTema } from '@holofote/tokens';
import type { Conversa, RespostaRelacoes } from '@holofote/shared';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { ErroDaApi } from '../../api/cliente';
import { chamadas, simularApi } from '../../testes/api';
import { personagem, uuid } from '../../testes/dados';
import { renderizarTela } from '../../testes/renderizarTela';
import {
  ALTURA_ROTULO,
  alturaDoMapa,
  dimensoesDosNos,
  estiloDoLaco,
  filtrarNos,
  larguraDoRotulo,
  posicionarNos,
  retangulosDosAvatares,
  retangulosDosRotulos,
  sobrepoem,
} from './layout';
import { TelaRelacoes } from './TelaRelacoes';

jest.mock('../../api/cliente', () => require('../../testes/api').moduloClienteSimulado());
jest.mock('expo-router', () => ({
  ...jest.requireActual('expo-router'),
  router: { push: jest.fn(), back: jest.fn(), replace: jest.fn() },
}));

const lua = personagem({
  nome: 'Lua Prado',
  iniciais: 'LP',
  papel: 'jogador',
  tomAvatar: 'escuro',
});
const bento = personagem({ nome: 'Bento Lima', iniciais: 'BL' });
const duda = personagem({ nome: 'Duda Marques', iniciais: 'DM' });
const rafa = personagem({ nome: 'Rafa Souza', iniciais: 'RS', tomAvatar: 'escuro' });
const vic = personagem({ nome: 'Vic Ferraz', iniciais: 'VF', tomAvatar: 'medio' });
const fofoca = personagem({ nome: 'fofocalizei', iniciais: 'FO', papel: 'figurante' });

const relacoes: RespostaRelacoes = {
  jogador: lua,
  nos: [
    { personagem: bento, relacao: { afinidade: 88, rotulo: 'Aliança' }, lembra: [] },
    {
      personagem: duda,
      relacao: { afinidade: 72, rotulo: 'Parceria criativa' },
      lembra: ['Dia 2 · elogiou o clipe dela', 'Dia 6 · topou o estúdio na quinta'],
    },
    { personagem: rafa, relacao: { afinidade: 50, rotulo: 'Conhecidos' }, lembra: [] },
    { personagem: vic, relacao: { afinidade: 38, rotulo: 'Rivais com respeito' }, lembra: [] },
    { personagem: fofoca, relacao: { afinidade: 20, rotulo: 'Rival' }, lembra: [] },
  ],
};

function simular(rotas: Record<string, unknown> = {}) {
  const conversa: Conversa = {
    id: uuid(),
    personagem: duda,
    relacao: { afinidade: 72, rotulo: 'Parceria criativa' },
    ultima: null,
    naoLidas: 0,
    puxouConversa: false,
  };
  simularApi({
    'GET /relacoes': relacoes,
    [`POST /personagens/${duda.id}/conversa`]: conversa,
    ...rotas,
  });
  return conversa;
}

// Só os nós do grafo (o cartão do selecionado tem "Ver perfil de ...").
const nos = () =>
  screen
    .getAllByRole('button', { name: /^(?!Ver perfil).*, \d+%$/ })
    .map((b) => b.props.accessibilityLabel);

beforeEach(() => jest.clearAllMocks());

describe('21 · Mapa de relações', () => {
  it('mostra o jogador no centro e cada personagem como botão acessível', async () => {
    simular();
    await renderizarTela(<TelaRelacoes />);

    expect(await screen.findByLabelText('Você, Lua Prado')).toBeTruthy();
    expect(nos()).toEqual([
      'Bento Lima, Aliança, 88%',
      'Duda Marques, Parceria criativa, 72%',
      'Rafa Souza, Conhecidos, 50%',
      'Vic Ferraz, Rivais com respeito, 38%',
      'fofocalizei, Rival, 20%',
    ]);
    expect(
      screen.getByText('Toque num nome para ver a relação e o que a pessoa lembra de você.'),
    ).toBeTruthy();
  });

  it('tocar num nome mostra o cartão com rótulo, afinidade e memórias', async () => {
    simular();
    await renderizarTela(<TelaRelacoes />);

    const no = await screen.findByRole('button', { name: 'Duda Marques, Parceria criativa, 72%' });
    await fireEvent.press(no);
    expect(
      screen.getByRole('button', { name: 'Duda Marques, Parceria criativa, 72%' }),
    ).toBeSelected();
    expect(screen.getByText('Parceria criativa · 72%')).toBeTruthy();
    expect(screen.getByText('O que Duda lembra de você')).toBeTruthy();
    // Mesma pílula de dia da tela 08 (separarDia): a data fica fora do texto da lembrança.
    expect(screen.getByText('Dia 2')).toBeTruthy();
    expect(screen.getByText('elogiou o clipe dela')).toBeTruthy();
    expect(screen.getByLabelText('Dia 6: topou o estúdio na quinta')).toBeTruthy();

    await fireEvent.press(
      screen.getByRole('button', { name: 'Ver perfil de Duda Marques, Parceria criativa, 72%' }),
    );
    expect(router.push).toHaveBeenCalledWith(`/personagem/${duda.id}`);
  });

  it('sem memórias, o cartão diz que ainda não lembra de nada', async () => {
    simular();
    await renderizarTela(<TelaRelacoes />);
    await fireEvent.press(await screen.findByRole('button', { name: /^Vic Ferraz/ }));
    expect(screen.getByText('Ainda não lembra de nada sobre você.')).toBeTruthy();
  });

  it('mandar mensagem pelo cartão abre a DM', async () => {
    const conversa = simular();
    await renderizarTela(<TelaRelacoes />);
    await fireEvent.press(await screen.findByRole('button', { name: /^Duda Marques/ }));
    await fireEvent.press(screen.getByRole('button', { name: 'Mandar mensagem para Duda' }));
    await waitFor(() => expect(router.push).toHaveBeenCalledWith(`/dm/${conversa.id}`));
    expect(chamadas).toContainEqual({
      metodo: 'POST',
      rota: `/personagens/${duda.id}/conversa`,
      corpo: undefined,
    });
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Mandar mensagem para Duda' })).toBeEnabled(),
    );
  });

  it('filtra por elenco e por rivais, e tira a seleção que some', async () => {
    simular();
    await renderizarTela(<TelaRelacoes />);
    await fireEvent.press(await screen.findByRole('button', { name: /^Duda Marques/ }));

    await fireEvent.press(screen.getByRole('radio', { name: 'Rivais' }));
    expect(nos()).toEqual(['Vic Ferraz, Rivais com respeito, 38%', 'fofocalizei, Rival, 20%']);
    expect(screen.queryByText('O que Duda lembra de você')).toBeNull();

    await fireEvent.press(screen.getByRole('radio', { name: 'Elenco' }));
    expect(nos()).not.toContain('fofocalizei, Rival, 20%');
    expect(nos()).toHaveLength(4);
    // Duda voltou ao mapa: a seleção dela volta junto.
    expect(screen.getByText('O que Duda lembra de você')).toBeTruthy();
  });

  it('filtro sem ninguém mostra uma frase', async () => {
    simular({ 'GET /relacoes': { ...relacoes, nos: relacoes.nos.slice(0, 3) } });
    await renderizarTela(<TelaRelacoes />);
    await screen.findByLabelText('Você, Lua Prado');
    await fireEvent.press(screen.getByRole('radio', { name: 'Rivais' }));
    expect(screen.getByText('Nenhum rival por enquanto.')).toBeTruthy();
  });

  it('no tema escuro a afinidade alta usa a tinta do escuro', async () => {
    simular();
    await renderizarTela(<TelaRelacoes />, { modo: 'escuro', destaque: 'cobalto' });
    expect((await screen.findAllByText('88%'))[0]).toHaveStyle({
      color: montarTema('escuro', 'cobalto').cores.destaqueTinta,
    });
  });

  it('erro ao carregar mostra tentar de novo', async () => {
    simular({ 'GET /relacoes': new ErroDaApi(500, 'interno', 'falhou') });
    await renderizarTela(<TelaRelacoes />);
    expect(await screen.findByText('Não deu para carregar o mapa.')).toBeTruthy();
    simular();
    await fireEvent.press(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByLabelText('Você, Lua Prado')).toBeTruthy();
  });
});

describe('desenho do mapa', () => {
  it('a linha engrossa com a afinidade, fica em destaque nas próximas e tracejada na rivalidade', () => {
    expect(estiloDoLaco(88)).toEqual({ cor: 'destaqueGrafico', largura: 3, tracejado: false });
    expect(estiloDoLaco(60).cor).toBe('destaqueGrafico');
    expect(estiloDoLaco(50)).toEqual({ cor: 'textoSuave', largura: 2.5, tracejado: false });
    expect(estiloDoLaco(24)).toEqual({ cor: 'textoSuave', largura: 1.5, tracejado: true });
    expect(estiloDoLaco(0).largura).toBeLessThan(estiloDoLaco(100).largura);
  });

  it('nós em volta do centro, dentro do cartão, os mais próximos mais perto', () => {
    const { centro, nos: pontos } = posicionarNos([88, 72, 50, 38, 20, 10], 358, 330);
    expect(centro).toEqual({ x: 179, y: 152 });
    expect(pontos[0]!.x).toBe(179);
    expect(pontos[0]!.y).toBeLessThan(centro.y);
    for (const p of pontos) {
      expect(p.x).toBeGreaterThanOrEqual(40);
      expect(p.x).toBeLessThanOrEqual(318);
      expect(p.y).toBeGreaterThanOrEqual(22);
      expect(p.y + 22 + 2 + ALTURA_ROTULO).toBeLessThanOrEqual(330);
    }
    const distancia = (i: number) => Math.hypot(pontos[i]!.x - centro.x, pontos[i]!.y - centro.y);
    const [perto] = posicionarNos([100], 358, 330).nos;
    const [longe] = posicionarNos([0], 358, 330).nos;
    expect(centro.y - perto!.y).toBeLessThan(centro.y - longe!.y);
    expect(distancia(0)).toBeGreaterThan(0);
  });

  // Cartão do mapa: largura da tela (390 ou 320 pt) menos as margens de 16 pt.
  const NOMES = [
    'Dona',
    'Lila',
    'Caio',
    'Marcinha',
    'Nina',
    'Chef',
    'Bruno',
    'Duda',
    'Tio',
    'Benedito',
    'Vic',
    'Rafa',
    'Fofocalizei',
    'Bento',
    'Lua',
    'Zé',
  ];

  describe.each([358, 288])('sem sobreposição com o cartão de %i pt', (largura) => {
    describe.each([
      ['largura padrão', false],
      ['largura natural do primeiro nome', true],
    ])('com %s', (_, naturais) => {
      it.each([1, 3, 6, 7, 8, 9, 10, 12, 14, 16])('com %i nós', (quantidade) => {
        // Afinidades que alternam entre os extremos: o pior caso para o raio de cada nó.
        const afinidades = Array.from({ length: quantidade }, (_, i) => (i % 2 === 0 ? 100 : 0));
        const altura = alturaDoMapa(quantidade);
        const nomes = naturais ? NOMES.slice(0, quantidade) : undefined;
        const { centro, nos: pontos, larguras } = posicionarNos(afinidades, largura, altura, nomes);
        const rotulos = retangulosDosRotulos(pontos, larguras);
        const avatares = retangulosDosAvatares(pontos);
        const jogador = {
          x: centro.x - 30,
          y: centro.y - 30,
          largura: 60,
          altura: 60 + 2 + ALTURA_ROTULO,
        };
        for (let i = 0; i < quantidade; i++) {
          // Tudo dentro do cartão.
          for (const r of [rotulos[i]!, avatares[i]!]) {
            expect(r.x).toBeGreaterThanOrEqual(0);
            expect(r.x + r.largura).toBeLessThanOrEqual(largura);
            expect(r.y).toBeGreaterThanOrEqual(0);
            expect(r.y + r.altura).toBeLessThanOrEqual(altura);
          }
          expect(sobrepoem(avatares[i]!, jogador)).toBe(false);
          expect(sobrepoem(rotulos[i]!, jogador)).toBe(false);
          for (let j = i + 1; j < quantidade; j++) {
            expect(sobrepoem(rotulos[i]!, rotulos[j]!)).toBe(false);
            expect(sobrepoem(avatares[i]!, avatares[j]!)).toBe(false);
            expect(sobrepoem(rotulos[i]!, avatares[j]!)).toBe(false);
            expect(sobrepoem(avatares[i]!, rotulos[j]!)).toBe(false);
          }
        }
      });
    });
  });

  it('o rótulo mostra o primeiro nome inteiro quando cabe, no mapa folgado e no denso', () => {
    const curtos = ['Dona', 'Lila', 'Caio', 'Nina', 'Chef', 'Duda', 'Tio', 'Vic', 'Marcos'];
    for (const quantidade of [3, 6, 7, 9, 10, 12, 16]) {
      const nomes = Array.from({ length: quantidade }, (_, i) => curtos[i % curtos.length]!);
      const afinidades = nomes.map((_, i) => 20 + ((i * 37) % 80));
      const { larguras, comPercentual } = posicionarNos(
        afinidades,
        358,
        alturaDoMapa(quantidade),
        nomes,
      );
      // Nenhum nome é encurtado: cada rótulo tem a largura do nome inteiro, ao menos.
      nomes.forEach((nome, i) =>
        expect(larguras[i]).toBeGreaterThanOrEqual(larguraDoRotulo(nome, afinidades[i]!, false)),
      );
      // O percentual só aparece quando o rótulo inteiro, com ele, coube.
      if (comPercentual)
        nomes.forEach((nome, i) =>
          expect(larguras[i]).toBe(larguraDoRotulo(nome, afinidades[i]!, true)),
        );
    }
    // Com poucos nós há lugar para o percentual; com muitos ele fica para o cartão.
    const poucos = posicionarNos([90, 70, 50], 358, alturaDoMapa(3), ['Dona', 'Lila', 'Caio']);
    expect(poucos.comPercentual).toBe(true);
    const muitos = Array.from({ length: 12 }, () => 50);
    expect(
      posicionarNos(
        muitos,
        358,
        alturaDoMapa(12),
        muitos.map(() => 'Duda'),
      ).comPercentual,
    ).toBe(false);
  });

  it('a largura do rótulo cresce com o nome e com o percentual', () => {
    expect(larguraDoRotulo('Duda', 100, true)).toBeGreaterThan(larguraDoRotulo('Duda', 100, false));
    expect(larguraDoRotulo('Marcinha', 50, false)).toBeGreaterThan(
      larguraDoRotulo('Duda', 50, false),
    );
    expect(larguraDoRotulo('Duda', 100, true)).toBeGreaterThan(larguraDoRotulo('Duda', 5, true));
  });

  it('a partir de 10 nós o avatar diminui e o rótulo perde o percentual', () => {
    expect(dimensoesDosNos(9)).toMatchObject({ comPercentual: true, denso: false });
    expect(dimensoesDosNos(10)).toMatchObject({ comPercentual: false, denso: true });
    expect(dimensoesDosNos(10).avatar).toBeLessThan(dimensoesDosNos(9).avatar);
  });

  it('filtros', () => {
    expect(filtrarNos(relacoes.nos, 'rivais').map((n) => n.relacao.afinidade)).toEqual([38, 20]);
    expect(filtrarNos(relacoes.nos, 'elenco')).toHaveLength(4);
    expect(filtrarNos(relacoes.nos, 'todos')).toHaveLength(5);
  });
});
