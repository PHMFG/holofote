import type { PersonagemResumo, Relacao } from '@holofote/shared';
import type { NomeCor } from '@holofote/tokens';

export interface NoDoMapa {
  personagem: PersonagemResumo;
  relacao: Relacao;
  lembra: string[];
}

export type FiltroRelacoes = 'todos' | 'elenco' | 'rivais';

/** Rival (0 a 24) e Rivais com respeito (25 a 44), pelas faixas do motor (docs/PLANO.md). */
export const LIMITE_RIVAIS = 45;
/** Abaixo disso a linha é tracejada: rivalidade aberta. */
export const LIMITE_TRACEJADO = 25;
/** Parceria, Amizade e Aliança: linha em destaque. */
export const LIMITE_PROXIMO = 60;

export function filtrarNos<T extends NoDoMapa>(nos: readonly T[], filtro: FiltroRelacoes): T[] {
  if (filtro === 'elenco') return nos.filter((n) => n.personagem.papel === 'elenco');
  if (filtro === 'rivais') return nos.filter((n) => n.relacao.afinidade < LIMITE_RIVAIS);
  return [...nos];
}

export interface EstiloLaco {
  cor: NomeCor;
  largura: number;
  tracejado: boolean;
}

/** Espessura cresce com a afinidade (1 a 3,5); cor de destaque nas relações próximas. */
export function estiloDoLaco(afinidade: number): EstiloLaco {
  const largura = Math.round((1 + afinidade / 40) * 2) / 2;
  if (afinidade >= LIMITE_PROXIMO) return { cor: 'destaqueGrafico', largura, tracejado: false };
  if (afinidade < LIMITE_TRACEJADO) return { cor: 'textoSuave', largura, tracejado: true };
  // Neutra em textoSuave (contraste de 3:1 ou mais sobre a superfície); textoFraco some no claro.
  return { cor: 'textoSuave', largura, tracejado: false };
}

export interface Ponto {
  x: number;
  y: number;
}

/** Até este número de nós, um anel só; acima, dois anéis alternados. */
export const LIMITE_UM_ANEL = 6;
/** A partir deste número de nós o mapa fica denso: avatar menor e rótulo sem percentual. */
export const LIMITE_DENSO = 10;
/** Com tantos nós até o avatar encolhe mais. */
export const LIMITE_MUITO_DENSO = 14;
/**
 * Altura do rótulo: a pílula (linha de legenda de 18, padding de 2 e borda de 1) mais o halo de
 * 2 pt da cor do cartão, que não deixa a linha do mapa encostar no texto.
 */
export const ALTURA_ROTULO = 28;
/** Folga horizontal do rótulo além do texto: padding de 8, borda de 1 e halo de 2, dos dois lados. */
const FOLGA_HORIZONTAL_ROTULO = 22;
/**
 * Larguras da legenda (13 pt, Plus Jakarta Sans Medium) um pouco por excesso, para o nome nunca
 * ser cortado: letra de nome, dígito do percentual e o "%".
 */
const LARGURA_DA_LETRA = 8.8;
const LARGURA_DO_DIGITO = 8.3;
const LARGURA_DO_PERCENTO = 11.4;
/** Espaço entre o nome e o percentual dentro do rótulo. */
const ESPACO_NOME_PERCENTUAL = 4;
/** Distância entre o avatar e o rótulo. */
const FOLGA_ROTULO = 2;

export interface DimensoesDosNos {
  avatar: number;
  /** Largura padrão do rótulo, a de reserva: o nome encolhe (reticências) para caber nela. */
  larguraRotulo: number;
  /** Rótulo com o percentual de afinidade ("Duda 72%"); no mapa denso o percentual fica no cartão. */
  comPercentual: boolean;
  denso: boolean;
}

export function dimensoesDosNos(quantidade: number): DimensoesDosNos {
  if (quantidade >= LIMITE_MUITO_DENSO)
    return { avatar: 28, larguraRotulo: 52, comPercentual: false, denso: true };
  if (quantidade >= LIMITE_DENSO)
    return { avatar: 32, larguraRotulo: 60, comPercentual: false, denso: true };
  return {
    avatar: quantidade > LIMITE_UM_ANEL ? 36 : 44,
    larguraRotulo: 84,
    comPercentual: true,
    denso: false,
  };
}

/**
 * Largura do rótulo de um nó: o primeiro nome inteiro (mais o percentual, no mapa folgado) e a
 * folga da pílula. O texto da legenda é medido por uma largura média de caractere, um pouco
 * generosa, porque o layout precisa dela antes de o texto ser desenhado.
 */
export function larguraDoRotulo(nome: string, afinidade: number, comPercentual: boolean): number {
  const digitos = `${afinidade}`.length;
  const percentual = comPercentual
    ? ESPACO_NOME_PERCENTUAL + digitos * LARGURA_DO_DIGITO + LARGURA_DO_PERCENTO
    : 0;
  return Math.ceil(nome.length * LARGURA_DA_LETRA + percentual + FOLGA_HORIZONTAL_ROTULO);
}

/** Altura do cartão do mapa: mais alto quando há dois anéis. */
export const alturaDoMapa = (quantidade: number) => (quantidade > LIMITE_UM_ANEL ? 440 : 330);

export interface Posicionamento {
  centro: Ponto;
  nos: Ponto[];
  /** Largura de cada rótulo: a natural do primeiro nome, ou menor (reticências) só no último caso. */
  larguras: number[];
  /** Rótulo com o percentual; sai quando nome e percentual não cabem juntos sem sobrepor. */
  comPercentual: boolean;
}

/** Tetos de largura tentados, depois da largura natural, quando nem sem percentual coube inteiro. */
const TETOS_DE_LARGURA = [96, 88, 80, 72, 64];

/**
 * Layout em volta do jogador, começando no topo e em sentido horário (a API manda do mais
 * próximo ao mais distante). Até 6 nós, um anel só, e quem tem mais afinidade fica um pouco mais
 * perto do centro. De 7 em diante, dois anéis com os nós alternados, o interno defasado meio
 * passo do externo. Reserva espaço para o rótulo embaixo de cada avatar, como no Figma
 * (57:1729). Nenhum rótulo se sobrepõe a outro nem ao avatar de outro (ver o teste do mapa).
 *
 * O primeiro nome vai inteiro sempre que couber. Passando os `nomes`, o desenho tenta, na ordem:
 * nome e percentual (só no mapa folgado), só o nome e, por fim, o nome com tetos de largura cada
 * vez menores, até a largura padrão, que sempre coube. Sem os `nomes`, vale a largura padrão.
 */
export function posicionarNos(
  afinidades: readonly number[],
  largura: number,
  altura: number,
  nomes?: readonly string[],
): Posicionamento {
  const n = afinidades.length;
  const dim = dimensoesDosNos(n);
  const centro = { x: largura / 2, y: Math.round(altura * (n > LIMITE_UM_ANEL ? 0.5 : 0.46)) };
  const padraoSemPercentual = dim.comPercentual ? 60 : dim.larguraRotulo;

  const tentativas: { comPercentual: boolean; larguras: number[] }[] = [];
  if (nomes) {
    const naturais = (comPercentual: boolean) =>
      afinidades.map((a, i) => larguraDoRotulo(nomes[i] ?? '', a, comPercentual));
    if (dim.comPercentual) tentativas.push({ comPercentual: true, larguras: naturais(true) });
    const semPercentual = naturais(false);
    tentativas.push({ comPercentual: false, larguras: semPercentual });
    for (const teto of TETOS_DE_LARGURA)
      tentativas.push({
        comPercentual: false,
        larguras: semPercentual.map((w) => Math.min(w, teto)),
      });
    tentativas.push({
      comPercentual: false,
      larguras: semPercentual.map((w) => Math.min(w, padraoSemPercentual)),
    });
  } else {
    tentativas.push({
      comPercentual: dim.comPercentual,
      larguras: afinidades.map(() => dim.larguraRotulo),
    });
  }

  let ultimo: Posicionamento | null = null;
  for (const { comPercentual, larguras } of tentativas) {
    const desenho = desenhar(afinidades, centro, largura, altura, larguras);
    ultimo = { centro, nos: desenho.nos, larguras, comPercentual };
    if (desenho.conflitos === 0) return ultimo;
  }
  return ultimo!;
}

function desenhar(
  afinidades: readonly number[],
  centro: Ponto,
  largura: number,
  altura: number,
  larguras: readonly number[],
): { nos: Ponto[]; conflitos: number } {
  const n = afinidades.length;
  const dim = dimensoesDosNos(n);
  const meio = dim.avatar / 2;
  const maior = Math.max(0, ...larguras);
  const ladoMax = largura / 2 - maior / 2 - 2;
  const topoMax = centro.y - meio - 2;
  const baseMax = altura - centro.y - (meio + FOLGA_ROTULO + ALTURA_ROTULO + 4);

  if (n <= LIMITE_UM_ANEL) {
    const rx = Math.max(40, Math.min(ladoMax, 125));
    const ry = Math.max(40, Math.min(topoMax, baseMax, 118));
    const nos = afinidades.map((afinidade, i) => {
      const angulo = -Math.PI / 2 + (2 * Math.PI * i) / n;
      const fator = 0.82 + (1 - Math.min(100, Math.max(0, afinidade)) / 100) * 0.18;
      return {
        x: Math.round(centro.x + Math.cos(angulo) * rx * fator),
        y: Math.round(centro.y + Math.sin(angulo) * ry * fator),
      };
    });
    return { nos, conflitos: contarConflitos(nos, centro, largura, altura, larguras) };
  }

  // Dois anéis. O externo fica perto das bordas do cartão; o interno, depois do avatar e do rótulo
  // do jogador. As medidas dos anéis e a divisão dos nós entre eles saem de uma busca por um
  // desenho em que nada se sobrepõe (a mesma checagem do teste do mapa).
  const externo = { rx: Math.max(40, ladoMax), ry: Math.max(40, Math.min(topoMax, baseMax)) };
  let melhor: { nos: Ponto[]; conflitos: number } | null = null;
  const base = Math.ceil(n / 2);
  for (const quantidadeExterno of [base, base + 1, base - 1, base + 2, base - 2, base + 3]) {
    for (const rxInterno of [72, 64, 80, 88, 56, 96, 48, 104]) {
      for (const ryInterno of [96, 104, 112, 88, 120, 130, 140, 150, 160]) {
        for (const defasagem of [0.5, 0.25, 0.75, 0.4, 0.6]) {
          const nos = anelDuplo(
            n,
            centro,
            externo,
            { rx: rxInterno, ry: ryInterno },
            quantidadeExterno,
            defasagem,
          );
          const conflitos = contarConflitos(nos, centro, largura, altura, larguras);
          if (conflitos === 0) return { nos, conflitos };
          if (!melhor || conflitos < melhor.conflitos) melhor = { nos, conflitos };
        }
      }
    }
  }
  return melhor!;
}

interface Elipse {
  rx: number;
  ry: number;
}

/** Os nós de índice par vão para o anel externo e os ímpares para o interno, até esgotar cada anel. */
function anelDuplo(
  n: number,
  centro: Ponto,
  externo: Elipse,
  interno: Elipse,
  quantidadeExterno: number,
  defasagem: number,
): Ponto[] {
  const quantidadeInterno = n - quantidadeExterno;
  const nos: Ponto[] = [];
  let noExterno = 0;
  let noInterno = 0;
  for (let i = 0; i < n; i++) {
    const doExterno =
      (i % 2 === 0 && noExterno < quantidadeExterno) || noInterno >= quantidadeInterno;
    const anel = doExterno ? externo : interno;
    const posicao = doExterno ? noExterno++ : noInterno++;
    const total = doExterno ? quantidadeExterno : quantidadeInterno;
    const passo = (2 * Math.PI) / total;
    const angulo =
      -Math.PI / 2 +
      (doExterno ? 0 : (defasagem * (2 * Math.PI)) / quantidadeExterno) +
      passo * posicao;
    nos.push({
      x: Math.round(centro.x + Math.cos(angulo) * anel.rx),
      y: Math.round(centro.y + Math.sin(angulo) * anel.ry),
    });
  }
  return nos;
}

/** Retângulo do jogador: avatar de 60 e o rótulo "Você" embaixo. */
function retanguloDoJogador(centro: Ponto): Retangulo {
  return {
    x: centro.x - 30,
    y: centro.y - 30,
    // O rótulo "Você" é mais estreito que o avatar de 60 mais a folga: vale o avatar.
    largura: 60,
    altura: 60 + FOLGA_ROTULO + ALTURA_ROTULO,
  };
}

/** Quantos pares de elementos (avatares, rótulos, jogador) se sobrepõem ou saem do cartão. */
export function contarConflitos(
  pontos: readonly Ponto[],
  centro: Ponto,
  largura: number,
  altura: number,
  larguras?: readonly number[],
): number {
  const rotulos = retangulosDosRotulos(pontos, larguras);
  const avatares = retangulosDosAvatares(pontos);
  const jogador = retanguloDoJogador(centro);
  const dentro = (r: Retangulo) =>
    r.x >= 0 && r.y >= 0 && r.x + r.largura <= largura && r.y + r.altura <= altura;
  let conflitos = 0;
  for (let i = 0; i < pontos.length; i++) {
    if (!dentro(rotulos[i]!) || !dentro(avatares[i]!)) conflitos++;
    if (sobrepoem(avatares[i]!, jogador) || sobrepoem(rotulos[i]!, jogador)) conflitos++;
    for (let j = i + 1; j < pontos.length; j++) {
      if (sobrepoem(rotulos[i]!, rotulos[j]!)) conflitos++;
      if (sobrepoem(avatares[i]!, avatares[j]!)) conflitos++;
      if (sobrepoem(rotulos[i]!, avatares[j]!)) conflitos++;
      if (sobrepoem(avatares[i]!, rotulos[j]!)) conflitos++;
    }
  }
  return conflitos;
}

export interface Retangulo {
  x: number;
  y: number;
  largura: number;
  altura: number;
}

/** Retângulo do rótulo de cada nó (embaixo do avatar), na largura máxima: base do teste de sobreposição. */
export function retangulosDosRotulos(
  pontos: readonly Ponto[],
  larguras?: readonly number[],
): Retangulo[] {
  const { avatar, larguraRotulo } = dimensoesDosNos(pontos.length);
  return pontos.map((p, i) => {
    const w = larguras?.[i] ?? larguraRotulo;
    return {
      x: p.x - w / 2,
      y: p.y + avatar / 2 + FOLGA_ROTULO,
      largura: w,
      altura: ALTURA_ROTULO,
    };
  });
}

/** Retângulo do avatar de cada nó. */
export function retangulosDosAvatares(pontos: readonly Ponto[]): Retangulo[] {
  const { avatar } = dimensoesDosNos(pontos.length);
  return pontos.map((p) => ({
    x: p.x - avatar / 2,
    y: p.y - avatar / 2,
    largura: avatar,
    altura: avatar,
  }));
}

export function sobrepoem(a: Retangulo, b: Retangulo): boolean {
  return (
    a.x < b.x + b.largura && b.x < a.x + a.largura && a.y < b.y + b.altura && b.y < a.y + a.altura
  );
}
