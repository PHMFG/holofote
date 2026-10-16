// Gera src/gerado.ts a partir de figma/variaveis.json (exportado por figma/exportar.js).
// Uso: pnpm --filter @holofote/tokens gerar
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

type Valor = string | { alias: string };

interface Exportacao {
  colecoes: {
    nome: string;
    modos: string[];
    variaveis: { nome: string; valores: Record<string, Valor> }[];
  }[];
  estilosCor: {
    nome: string;
    tintas: {
      tipo: string;
      transform?: number[][];
      paradas?: { pos: number; cor: string }[];
    }[];
  }[];
  estilosTexto: {
    nome: string;
    familia: string;
    estilo: string;
    tamanho: number;
    altura: { unit: string; value: number };
    espaco: { unit: string; value: number };
  }[];
  estilosEfeito: {
    nome: string;
    efeitos: {
      tipo: string;
      cor: string;
      variavelCor?: string;
      x: number;
      y: number;
      raio: number;
      espalhar: number;
      visivel: boolean;
    }[];
  }[];
  assinatura: string;
}

const MODOS = { Claro: 'claro', Escuro: 'escuro' } as const;
const PREFIXO_ESTILO = { claro: 'Cromo/', escuro: 'Cromo Escuro/' } as const;
const FONTES: Record<string, string> = {
  Regular: 'PlusJakartaSans-Regular',
  Medium: 'PlusJakartaSans-Medium',
  SemiBold: 'PlusJakartaSans-SemiBold',
  Bold: 'PlusJakartaSans-Bold',
};

/** "Esfera média" → "esferaMedia", "texto-suave" → "textoSuave". */
export function camelo(nome: string): string {
  const semAcento = nome.normalize('NFD').replace(/[̀-ͯ]/g, '');
  const partes = semAcento.split(/[\s\-/]+/).filter(Boolean);
  return partes
    .map((p, i) => (i === 0 ? p.toLowerCase() : p[0]!.toUpperCase() + p.slice(1).toLowerCase()))
    .join('');
}

/** djb2 sobre o JSON canônico, igual ao de figma/exportar.js. */
export function assinatura(conteudo: unknown): string {
  const texto = JSON.stringify(conteudo);
  let hash = 5381;
  for (let i = 0; i < texto.length; i++) hash = ((hash * 33) ^ texto.charCodeAt(i)) >>> 0;
  return hash.toString(16);
}

function falha(mensagem: string): never {
  throw new Error(`gerar tokens: ${mensagem}`);
}

const arredonda = (n: number, casas = 4) => Number(n.toFixed(casas));

/** Inverte a matriz afim 2x3 do Figma e aplica a um ponto do espaço do gradiente. */
function inverterTransform(t: number[][]) {
  const [[a, b, c], [d, e, f]] = t as [[number, number, number], [number, number, number]];
  const det = a * e - b * d;
  if (Math.abs(det) < 1e-9) falha('gradientTransform sem inversa');
  return (x: number, y: number) => {
    const px = x - c;
    const py = y - f;
    return { x: arredonda((e * px - b * py) / det), y: arredonda((-d * px + a * py) / det) };
  };
}

function colecao(dados: Exportacao, nome: string) {
  return dados.colecoes.find((c) => c.nome === nome) ?? falha(`coleção ${nome} não encontrada`);
}

function gerarCores(dados: Exportacao) {
  const cromo = colecao(dados, 'Cromo');
  const destaque = colecao(dados, 'Destaque');
  const neutros: Record<string, Record<string, string>> = { claro: {}, escuro: {} };
  const aliases: Record<string, Record<string, string>> = { claro: {}, escuro: {} };
  for (const v of cromo.variaveis) {
    const chave = camelo(v.nome.replace(/^cromo\//, ''));
    for (const [modoFigma, modo] of Object.entries(MODOS)) {
      const valor = v.valores[modoFigma] ?? falha(`${v.nome} sem modo ${modoFigma}`);
      if (typeof valor === 'string') {
        neutros[modo]![chave] = valor;
      } else {
        if (!valor.alias.startsWith('destaque/'))
          falha(`${v.nome}: alias inesperado ${valor.alias}`);
        aliases[modo]![chave] = camelo(valor.alias.replace(/^destaque\//, ''));
      }
    }
  }
  const destaques: Record<string, Record<string, string>> = {};
  for (const modoFigma of destaque.modos) destaques[camelo(modoFigma)] = {};
  for (const v of destaque.variaveis) {
    const chave = camelo(v.nome.replace(/^destaque\//, ''));
    for (const modoFigma of destaque.modos) {
      const valor = v.valores[modoFigma];
      if (typeof valor !== 'string') falha(`${v.nome} sem cor em ${modoFigma}`);
      destaques[camelo(modoFigma)]![chave] = valor;
    }
  }
  for (const modo of Object.values(MODOS)) {
    for (const [chave, alvo] of Object.entries(aliases[modo]!)) {
      if (!(alvo in destaques.laranja!))
        falha(`alias ${chave} aponta para ${alvo}, que não existe`);
    }
  }
  return { neutros, aliases, destaques };
}

function gerarGradientes(dados: Exportacao) {
  const saida: Record<string, Record<string, unknown>> = { claro: {}, escuro: {} };
  for (const [modo, prefixo] of Object.entries(PREFIXO_ESTILO)) {
    for (const estilo of dados.estilosCor.filter((s) => s.nome.startsWith(prefixo))) {
      if (estilo.tintas.length !== 1) falha(`${estilo.nome}: esperava uma tinta`);
      const tinta = estilo.tintas[0]!;
      const paradas = tinta.paradas ?? falha(`${estilo.nome}: sem paradas`);
      const inv = inverterTransform(tinta.transform ?? falha(`${estilo.nome}: sem transform`));
      const base = {
        cores: paradas.map((p) => p.cor),
        posicoes: paradas.map((p) => arredonda(p.pos)),
      };
      const chave = camelo(estilo.nome.slice(prefixo.length));
      if (tinta.tipo === 'GRADIENT_LINEAR') {
        saida[modo]![chave] = { tipo: 'linear', ...base, inicio: inv(0, 0.5), fim: inv(1, 0.5) };
      } else if (tinta.tipo === 'GRADIENT_RADIAL') {
        // raioX/raioY em espaço normalizado só valem sem rotação nem cisalhamento.
        const [[, b], [d]] = tinta.transform as [[number, number], [number]];
        if (Math.abs(b) > 1e-6 || Math.abs(d) > 1e-6) falha(`${estilo.nome}: radial com rotação`);
        const centro = inv(0.5, 0.5);
        const borda = inv(1, 0.5);
        const baixo = inv(0.5, 1);
        saida[modo]![chave] = {
          tipo: 'radial',
          ...base,
          centro,
          raioX: arredonda(Math.hypot(borda.x - centro.x, borda.y - centro.y)),
          raioY: arredonda(Math.hypot(baixo.x - centro.x, baixo.y - centro.y)),
        };
      } else {
        falha(`${estilo.nome}: tipo ${tinta.tipo} não suportado`);
      }
    }
  }
  return saida;
}

/** Claro e escuro precisam ter os mesmos estilos: os tipos do tema saem do claro. */
function conferirModos(tipo: string, porModo: Record<string, Record<string, unknown>>) {
  const claro = Object.keys(porModo.claro!).sort().join(', ');
  const escuro = Object.keys(porModo.escuro!).sort().join(', ');
  if (claro !== escuro)
    falha(`${tipo} diferentes entre os modos: claro [${claro}], escuro [${escuro}]`);
  return porModo;
}

function gerarSombras(dados: Exportacao) {
  const saida: Record<string, Record<string, unknown[]>> = { claro: {}, escuro: {} };
  for (const [modo, prefixo] of Object.entries(PREFIXO_ESTILO)) {
    for (const estilo of dados.estilosEfeito.filter((s) => s.nome.startsWith(prefixo))) {
      saida[modo]![camelo(estilo.nome.slice(prefixo.length))] = estilo.efeitos
        .filter((e) => e.visivel)
        .map((e) => {
          if (e.tipo !== 'DROP_SHADOW' && e.tipo !== 'INNER_SHADOW')
            falha(`${estilo.nome}: ${e.tipo}`);
          return {
            offsetX: e.x,
            offsetY: e.y,
            blurRadius: e.raio,
            spreadDistance: e.espalhar,
            color: e.cor,
            ...(e.tipo === 'INNER_SHADOW' ? { inset: true } : {}),
            ...(e.variavelCor ? { variavel: camelo(e.variavelCor.replace(/^cromo\//, '')) } : {}),
          };
        });
    }
  }
  return saida;
}

function gerarTipografia(dados: Exportacao) {
  const saida: Record<string, unknown> = {};
  for (const estilo of dados.estilosTexto.filter((s) => s.nome.startsWith('Cromo/'))) {
    if (estilo.familia !== 'Plus Jakarta Sans') falha(`${estilo.nome}: família ${estilo.familia}`);
    if (estilo.altura.unit !== 'PIXELS') falha(`${estilo.nome}: altura em ${estilo.altura.unit}`);
    const espaco =
      estilo.espaco.unit === 'PERCENT'
        ? (estilo.tamanho * estilo.espaco.value) / 100
        : estilo.espaco.value;
    saida[camelo(estilo.nome.slice('Cromo/'.length))] = {
      fontFamily:
        FONTES[estilo.estilo] ?? falha(`${estilo.nome}: peso ${estilo.estilo} não embutido`),
      fontSize: estilo.tamanho,
      lineHeight: estilo.altura.value,
      letterSpacing: arredonda(espaco, 3),
    };
  }
  return saida;
}

export function gerarCodigo(dados: Exportacao): string {
  const { assinatura: esperada, ...conteudo } = dados;
  const calculada = assinatura(conteudo);
  if (calculada !== esperada)
    falha(`assinatura ${calculada} não bate com ${esperada}: exportação incompleta?`);

  const { neutros, aliases, destaques } = gerarCores(dados);
  const blocos: [string, unknown][] = [
    ['neutros', neutros],
    ['aliasesDestaque', aliases],
    ['destaques', destaques],
    ['gradientes', conferirModos('gradientes', gerarGradientes(dados))],
    ['sombras', conferirModos('sombras', gerarSombras(dados))],
    ['tipografia', gerarTipografia(dados)],
  ];
  return [
    '// GERADO por scripts/gerar.ts a partir de figma/variaveis.json. Não edite à mão.',
    '',
    `export const ASSINATURA_FIGMA = '${esperada}';`,
    '',
    ...blocos.map(
      ([nome, valor]) => `export const ${nome} = ${JSON.stringify(valor, null, 2)} as const;\n`,
    ),
  ].join('\n');
}

export const CAMINHO_JSON = fileURLToPath(new URL('../figma/variaveis.json', import.meta.url));
export const CAMINHO_SAIDA = fileURLToPath(new URL('../src/gerado.ts', import.meta.url));

export function lerExportacao(): Exportacao {
  return JSON.parse(readFileSync(CAMINHO_JSON, 'utf8')) as Exportacao;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  writeFileSync(CAMINHO_SAIDA, gerarCodigo(lerExportacao()));
  console.log(`tokens gerados em ${CAMINHO_SAIDA}`);
}
