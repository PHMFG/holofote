import { formatarNumero } from './formatar';

describe('formatarNumero', () => {
  it('mantém números pequenos', () => {
    expect(formatarNumero(128)).toBe('128');
  });

  it('usa mil e mi como nas telas, sem arredondar para cima', () => {
    expect(formatarNumero(7_100)).toBe('7,1 mil');
    expect(formatarNumero(10_000)).toBe('10 mil');
    expect(formatarNumero(7_199)).toBe('7,1 mil');
    expect(formatarNumero(1_250_000)).toBe('1,2 mi');
  });
});
