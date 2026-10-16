import { armazenamento } from './armazenamento';
import { useAparencia } from './aparencia';

describe('useAparencia', () => {
  it('começa no tema do sistema com destaque laranja', () => {
    expect(useAparencia.getState()).toMatchObject({ tema: 'sistema', destaque: 'laranja' });
  });

  it('persiste a escolha no MMKV', () => {
    useAparencia.getState().definirTema('escuro');
    useAparencia.getState().definirDestaque('menta');
    expect(JSON.parse(armazenamento.getString('aparencia') ?? '{}')).toMatchObject({
      state: { tema: 'escuro', destaque: 'menta' },
    });
  });

  it('restaura uma escolha válida salva antes', async () => {
    armazenamento.set(
      'aparencia',
      JSON.stringify({ state: { tema: 'claro', destaque: 'lima' }, version: 1 }),
    );
    await useAparencia.persist.rehydrate();
    expect(useAparencia.getState()).toMatchObject({ tema: 'claro', destaque: 'lima' });
  });

  it('completa um valor salvo parcial com o estado atual', async () => {
    useAparencia.setState({ tema: 'escuro', destaque: 'menta' });
    armazenamento.set('aparencia', JSON.stringify({ state: { destaque: 'rosa' }, version: 1 }));
    await useAparencia.persist.rehydrate();
    expect(useAparencia.getState()).toMatchObject({ tema: 'escuro', destaque: 'rosa' });
  });

  it('ignora valor salvo que não existe mais', async () => {
    useAparencia.setState({ tema: 'escuro', destaque: 'menta' });
    armazenamento.set(
      'aparencia',
      JSON.stringify({ state: { tema: 'neon', destaque: 'ouro' }, version: 1 }),
    );
    await useAparencia.persist.rehydrate();
    expect(useAparencia.getState()).toMatchObject({ tema: 'escuro', destaque: 'menta' });
  });
});
