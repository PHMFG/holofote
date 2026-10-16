import { aliasesDestaque, destaques, gradientes, neutros, sombras, tipografia } from './gerado';
import { medidas } from './medidas';

export type Modo = keyof typeof neutros;
export type NomeDestaque = keyof typeof destaques;
export type NomeGradiente = keyof (typeof gradientes)['claro'];
// Sombras que aparecem nas telas sem estilo de efeito no Figma; ficam aqui para nenhuma tela
// escrever a sombra à mão. `variavel` liga a cor ao token, como no Figma.
const SOMBRAS_EXTRAS = {
  // Chips em destaque (13 · Respostas 53:1438, 17 · Evento ao vivo 55:1573): 0/6/8 no brilho.
  brilhoDestaque: [
    {
      offsetX: 0,
      offsetY: 6,
      blurRadius: 8,
      spreadDistance: 0,
      color: '',
      variavel: 'destaqueBrilho',
    },
  ],
} as const;

export type NomeSombra = keyof (typeof sombras)['claro'] | keyof typeof SOMBRAS_EXTRAS;
export type NomeTipografia = keyof typeof tipografia;

type ChaveNeutra = keyof (typeof neutros)['claro'];
type ChaveDestaque = keyof (typeof aliasesDestaque)['claro'];
export type NomeCor = ChaveNeutra | ChaveDestaque;
export type Cores = Record<NomeCor, string>;

export interface GradienteLinear {
  tipo: 'linear';
  cores: readonly string[];
  posicoes: readonly number[];
  inicio: { x: number; y: number };
  fim: { x: number; y: number };
}

export interface GradienteRadial {
  tipo: 'radial';
  cores: readonly string[];
  posicoes: readonly number[];
  centro: { x: number; y: number };
  raioX: number;
  raioY: number;
}

export type Gradiente = GradienteLinear | GradienteRadial;

/** Mesmo formato do BoxShadowValue do React Native. */
export interface Sombra {
  offsetX: number;
  offsetY: number;
  blurRadius: number;
  spreadDistance: number;
  color: string;
  inset?: boolean;
}

export interface Tema {
  modo: Modo;
  destaque: NomeDestaque;
  cores: Cores;
  gradientes: Record<NomeGradiente, Gradiente>;
  sombras: Record<NomeSombra, readonly Sombra[]>;
  tipografia: typeof tipografia;
  medidas: typeof medidas;
}

export const NOMES_DESTAQUE = Object.keys(destaques) as NomeDestaque[];
export const DESTAQUE_PADRAO: NomeDestaque = 'laranja';

/** Resolve os aliases do Figma para o modo e o destaque escolhidos. */
export function montarTema(modo: Modo, destaque: NomeDestaque): Tema {
  const paleta = destaques[destaque];
  const cores = { ...neutros[modo] } as Cores;
  for (const [chave, alvo] of Object.entries(aliasesDestaque[modo]) as [
    ChaveDestaque,
    keyof typeof paleta,
  ][]) {
    cores[chave] = paleta[alvo];
  }

  // No Figma o brilho do botão metal é ligado a cromo/destaque-brilho; aqui ele segue o destaque.
  const sombrasDoModo = {} as Record<NomeSombra, readonly Sombra[]>;
  for (const [nome, camadas] of Object.entries({ ...sombras[modo], ...SOMBRAS_EXTRAS }) as [
    NomeSombra,
    readonly (Sombra & { variavel?: string })[],
  ][]) {
    sombrasDoModo[nome] = camadas.map(({ variavel, ...camada }) =>
      variavel ? { ...camada, color: cores[variavel as NomeCor] } : camada,
    );
  }

  return {
    modo,
    destaque,
    cores,
    gradientes: gradientes[modo] as Record<NomeGradiente, Gradiente>,
    sombras: sombrasDoModo,
    tipografia,
    medidas,
  };
}
