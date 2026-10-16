import { tituloDoEvento } from './BannerEvento';

describe('título do próximo evento', () => {
  const evento = {
    id: '00000000-0000-4000-8000-000000000001',
    titulo: 'Prêmio Holofote',
    quando: { dia: 8, periodo: 'noite' as const },
    estado: 'anunciado' as const,
  };

  it('conta os dias pelo dia do mundo', () => {
    expect(tituloDoEvento(evento, 6)).toBe('Prêmio Holofote em 2 dias');
    expect(tituloDoEvento(evento, 7)).toBe('Prêmio Holofote amanhã');
    expect(tituloDoEvento(evento, 8)).toBe('Prêmio Holofote hoje');
    expect(tituloDoEvento({ ...evento, estado: 'ao_vivo' }, 8)).toBe('Prêmio Holofote ao vivo');
  });
});
