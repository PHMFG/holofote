import type { Enquete } from '@holofote/shared';

/**
 * Divide o texto da história no "adesivo" do Figma: uma frase de título e o resto embaixo.
 * Quebra de linha manda; sem ela, corta na primeira frase se o título não ficar longo demais.
 */
export function dividirTexto(texto: string): { titulo: string; resto: string | null } {
  const limpo = texto.trim();
  const quebra = limpo.indexOf('\n');
  if (quebra > 0) {
    const resto = limpo.slice(quebra + 1).trim();
    return { titulo: limpo.slice(0, quebra).trim(), resto: resto || null };
  }
  const frase = /^(.{4,80}?[.!?])\s+(\S.*)$/s.exec(limpo);
  if (frase?.[1] && frase[2]) return { titulo: frase[1], resto: frase[2] };
  return { titulo: limpo, resto: null };
}

export interface OpcaoComParcela {
  id: string;
  texto: string;
  /** De 0 a 1. */
  parcela: number;
  porcentagem: number;
}

/** Parcela de cada opção pelos votos; sem votos, tudo em 0%. */
export function parcelasDaEnquete(enquete: Enquete): OpcaoComParcela[] {
  const total = enquete.opcoes.reduce((soma, o) => soma + o.votos, 0);
  return enquete.opcoes.map((o) => {
    const parcela = total > 0 ? o.votos / total : 0;
    return { id: o.id, texto: o.texto, parcela, porcentagem: Math.round(parcela * 100) };
  });
}
