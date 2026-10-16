import type { Post } from '@holofote/shared';

/** Resposta de primeiro nível com as respostas a ela (em qualquer profundidade) em ordem de chegada. */
export interface NoThread {
  resposta: Post;
  filhas: Post[];
}

export type FiltroThread = 'relevantes' | 'recentes' | 'elenco';

const instante = (p: Post) => new Date(p.criadoEm).getTime();

/**
 * Monta a conversa de 13 · Respostas: respostas ao post em primeiro nível e, embaixo de cada uma,
 * as respostas a ela. Respostas a respostas aninhadas sobem para o comentário de primeiro nível
 * (o Figma só tem um nível de recuo); as órfãs (pai fora da lista) ficam de fora.
 */
export function montarArvore(postId: string, respostas: readonly Post[]): NoThread[] {
  const porId = new Map(respostas.map((r) => [r.id, r]));
  const raizDe = (resposta: Post): string | null => {
    let atual = resposta;
    const vistos = new Set<string>();
    while (atual.respondeA && atual.respondeA !== postId) {
      if (vistos.has(atual.id)) return null;
      vistos.add(atual.id);
      const pai = porId.get(atual.respondeA);
      if (!pai) return null;
      atual = pai;
    }
    return atual.respondeA === postId ? atual.id : null;
  };

  const nos = new Map<string, NoThread>();
  for (const r of respostas) if (r.respondeA === postId) nos.set(r.id, { resposta: r, filhas: [] });
  for (const r of respostas) {
    if (r.respondeA === postId) continue;
    const raiz = raizDe(r);
    if (raiz) nos.get(raiz)?.filhas.push(r);
  }
  for (const no of nos.values()) no.filhas.sort((a, b) => instante(a) - instante(b));
  return [...nos.values()];
}

const porRelevancia = (a: NoThread, b: NoThread) =>
  b.resposta.curtidas - a.resposta.curtidas ||
  b.filhas.length - a.filhas.length ||
  instante(b.resposta) - instante(a.resposta);

/** Relevantes por curtidas, recentes por data e elenco só com autores do elenco (filtro no app). */
export function filtrarThread(nos: readonly NoThread[], filtro: FiltroThread): NoThread[] {
  if (filtro === 'recentes')
    return [...nos].sort((a, b) => instante(b.resposta) - instante(a.resposta));
  const base = filtro === 'elenco' ? nos.filter((n) => n.resposta.autor.papel === 'elenco') : nos;
  return [...base].sort(porRelevancia);
}
