import { describe, expect, it } from 'vitest';
import { contraste } from './contraste';
import { NOMES_DESTAQUE, montarTema, type NomeCor } from './tema';

// Pares de texto que os componentes de apps/mobile/src/ui usam de fato. O plano pede 4,5:1 em todos.
// texto-fraco não entra: o componente Texto não aceita essa cor (só elementos decorativos a usam).
const PARES: [texto: NomeCor, fundo: NomeCor][] = [
  ['texto', 'fundo'],
  ['texto', 'superficie'],
  ['texto', 'superficie2'],
  ['textoSuave', 'fundo'],
  ['textoSuave', 'superficie'],
  ['textoSuave', 'superficie2'],
  ['primarioTexto', 'primario'],
  ['destaqueSobre', 'destaque'],
  ['destaqueTinta', 'fundo'],
  ['destaqueTinta', 'superficie'],
  ['destaqueTinta', 'destaqueSuave'],
];

describe('contraste', () => {
  it('calcula o par preto e branco', () => {
    expect(contraste('#000000', '#ffffff')).toBeCloseTo(21, 5);
  });

  for (const modo of ['claro', 'escuro'] as const) {
    for (const destaque of NOMES_DESTAQUE) {
      const { cores } = montarTema(modo, destaque);
      it.each(PARES)(`${modo}/${destaque}: %s sobre %s passa de 4,5:1`, (texto, fundo) => {
        expect(contraste(cores[texto], cores[fundo])).toBeGreaterThanOrEqual(4.5);
      });
    }
  }
});
