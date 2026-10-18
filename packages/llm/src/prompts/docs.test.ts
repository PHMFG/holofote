// docs/PROMPTS.md tem de mostrar exatamente os textos que vão para o modelo.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import * as prompts from './index';

const doc = readFileSync(new URL('../../../../docs/PROMPTS.md', import.meta.url), 'utf8');

describe('docs/PROMPTS.md', () => {
  it('cita a versão atual dos prompts', () => {
    expect(doc).toContain(`**v${prompts.VERSAO_PROMPTS}**`);
  });

  it.each([
    'REGRAS_ESTILO',
    'TAREFA_DIRETOR',
    'TAREFA_DM',
    'TAREFA_DISCURSO',
    'TAREFA_CRIAR_MUNDO',
    'TAREFA_FEED_INICIAL',
    'TAREFA_LOTE_DIARIO',
    'TAREFA_MEMORIA',
    'TAREFA_FICHA',
    'TAREFA_NOVO_ATO',
  ] as const)('traz %s igual ao código', (nome) => {
    expect(doc).toContain(prompts[nome]);
  });
});
