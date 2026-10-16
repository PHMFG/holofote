import { montarTema } from '@holofote/tokens';
import { fireEvent, screen } from '@testing-library/react-native';
import { renderizar } from '../testes/renderizar';
import { Post } from './Post';

const base = {
  nome: 'Vic Ferraz',
  handle: '@vicferraz',
  tempo: '2h',
  texto: 'tem gente copiando meu figurino de novo',
  iniciais: 'VF',
  respostas: 12,
  reposts: 4,
  curtidas: 7_100,
};

describe('Post', () => {
  it('mostra autor, texto e métricas formatadas', async () => {
    await renderizar(<Post {...base} verificado onAbrir={() => {}} />);
    expect(screen.getByText('Vic Ferraz')).toBeTruthy();
    expect(screen.getByText('@vicferraz · 2h')).toBeTruthy();
    expect(screen.getByText('7,1 mil')).toBeTruthy();
    expect(
      screen.getByRole('button', { name: /^Vic Ferraz, verificado, @vicferraz, 2h: tem gente/ }),
    ).toBeTruthy();
  });

  it('as métricas continuam alcançáveis pelo VoiceOver com o post tocável', async () => {
    await renderizar(
      <Post {...base} onAbrir={() => {}} onResponder={() => {}} onSalvar={() => {}} />,
    );
    expect(screen.getByRole('button', { name: '12 respostas' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeTruthy();
  });

  it('sem ações, post e métricas são texto, não botões apagados', async () => {
    await renderizar(<Post {...base} />);
    expect(screen.queryAllByRole('button')).toHaveLength(0);
    expect(screen.getByRole('text', { name: '12 respostas' })).toBeTruthy();
  });

  it('Repostar e Salvar só aparecem com handler', async () => {
    const { unmount } = await renderizar(<Post {...base} />);
    expect(screen.queryByLabelText('4 reposts')).toBeNull();
    expect(screen.queryByLabelText('Salvar')).toBeNull();
    await unmount();
    await renderizar(<Post {...base} onRepostar={() => {}} onSalvar={() => {}} />);
    expect(screen.getByRole('button', { name: '4 reposts' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeTruthy();
  });

  it('curtir chama o callback e a curtida ativa fica no destaque', async () => {
    const aoCurtir = jest.fn();
    await renderizar(<Post {...base} curtido onCurtir={aoCurtir} />);
    const curtir = screen.getByRole('button', { name: '7,1 mil curtidas' });
    await fireEvent.press(curtir);
    expect(aoCurtir).toHaveBeenCalled();
    expect(curtir).toBeSelected();
    expect(screen.getByText('7,1 mil')).toHaveStyle({
      color: montarTema('claro', 'laranja').cores.destaqueTinta,
    });
  });
});
