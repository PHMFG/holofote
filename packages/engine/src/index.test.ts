import { describe, expect, it } from 'vitest';
import * as motor from './index';

describe('@holofote/engine', () => {
  it('exporta os módulos pelo índice', () => {
    for (const nome of [
      'criarRng',
      'calcularEnergia',
      'calcularPost',
      'previa',
      'escolherReatores',
      'podeDesfazer',
      'requisitosDoMarco',
      'chancesIndicados',
      'periodoDe',
      'moderarTexto',
      'numerosDoPersonagem',
      'rotuloRelacao',
      'TONS',
      'CUSTOS',
    ]) {
      expect(motor, nome).toHaveProperty(nome);
    }
  });
});
