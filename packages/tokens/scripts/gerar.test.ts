import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  CAMINHO_SAIDA,
  assinatura as assinaturaDe,
  camelo,
  gerarCodigo,
  lerExportacao,
} from './gerar';

describe('gerar tokens', () => {
  it('src/gerado.ts está em dia com figma/variaveis.json', () => {
    // Se falhar: rode `pnpm --filter @holofote/tokens gerar`.
    expect(readFileSync(CAMINHO_SAIDA, 'utf8')).toBe(gerarCodigo(lerExportacao()));
  });

  it('recusa uma exportação alterada à mão', () => {
    const dados = lerExportacao();
    dados.estilosTexto[0]!.tamanho += 1;
    expect(() => gerarCodigo(dados)).toThrow(/assinatura/);
  });

  it('recusa estilo que existe só em um modo', () => {
    const dados = lerExportacao();
    dados.estilosCor = dados.estilosCor.filter((s) => s.nome !== 'Cromo Escuro/Capa');
    // Re-assina para o teste chegar na conferência de modos, depois da checagem da assinatura.
    const conteudo: Partial<typeof dados> = { ...dados };
    delete conteudo.assinatura;
    expect(() => gerarCodigo({ ...dados, assinatura: assinaturaDe(conteudo) })).toThrow(
      /diferentes/,
    );
  });

  it('converte nomes do Figma em camelCase sem acento', () => {
    expect(camelo('Esfera média')).toBe('esferaMedia');
    expect(camelo('texto-suave')).toBe('textoSuave');
    expect(camelo('Botão metal')).toBe('botaoMetal');
    expect(camelo('superficie-2')).toBe('superficie2');
  });
});
