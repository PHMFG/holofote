import { describe, expect, it } from 'vitest';
import { contraste } from './contraste';
import { NOMES_DESTAQUE, montarTema, type Modo, type NomeCor } from './tema';

// Pares de texto que os componentes de apps/mobile/src/ui usam de fato. O plano pede 4,5:1 em todos.
const PARES: [texto: NomeCor, fundo: NomeCor][] = [
  ['texto', 'fundo'],
  ['texto', 'superficie'],
  ['texto', 'superficie2'],
  ['textoSuave', 'fundo'],
  ['textoSuave', 'superficie'],
  ['textoSuave', 'superficie2'],
  ['textoFraco', 'superficie'],
  ['primarioTexto', 'primario'],
  ['destaqueSobre', 'destaque'],
  ['destaqueTinta', 'fundo'],
  ['destaqueTinta', 'superficie'],
  ['destaqueTinta', 'destaqueSuave'],
];

// Pares que vêm assim do Figma e ficam abaixo de 4,5:1. Aguardam decisão do dono (docs/DECISOES.md):
// ajustar o token ou aceitar a exceção. Não acrescente pares aqui sem registrar a decisão.
const EXCECOES: { modo: Modo; texto: NomeCor; fundo: NomeCor }[] = [
  // Segmentado (opção não selecionada) e Rotulo neutro e de data: 4,20:1.
  { modo: 'claro', texto: 'textoSuave', fundo: 'superficie2' },
  // Terceira linha de LinhaDeLista (14 · Mensagens): 1,89:1 no claro e 2,42:1 no escuro.
  { modo: 'claro', texto: 'textoFraco', fundo: 'superficie' },
  { modo: 'escuro', texto: 'textoFraco', fundo: 'superficie' },
];

const ehExcecao = (modo: Modo, texto: NomeCor, fundo: NomeCor) =>
  EXCECOES.some((e) => e.modo === modo && e.texto === texto && e.fundo === fundo);

describe('contraste', () => {
  it('calcula o par preto e branco', () => {
    expect(contraste('#000000', '#ffffff')).toBeCloseTo(21, 5);
  });

  for (const modo of ['claro', 'escuro'] as const) {
    for (const destaque of NOMES_DESTAQUE) {
      const { cores } = montarTema(modo, destaque);
      const pares = PARES.filter(([texto, fundo]) => !ehExcecao(modo, texto, fundo));
      it.each(pares)(`${modo}/${destaque}: %s sobre %s passa de 4,5:1`, (texto, fundo) => {
        expect(contraste(cores[texto], cores[fundo])).toBeGreaterThanOrEqual(4.5);
      });
    }
  }

  it.each(EXCECOES)(
    'exceção ainda abaixo de 4,5:1: $modo $texto sobre $fundo',
    ({ modo, texto, fundo }) => {
      // Se este teste falhar, o token foi corrigido: tire o par da lista de exceções.
      const { cores } = montarTema(modo, 'laranja');
      expect(contraste(cores[texto], cores[fundo])).toBeLessThan(4.5);
    },
  );
});
