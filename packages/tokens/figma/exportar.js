// Exporta variáveis e estilos do arquivo Figma do Holofote (fileKey z4hwlJgPHTikSzQ9yfjAI9).
//
// Como rodar: pelo Figma MCP, ferramenta `use_figma`, com este arquivo inteiro como `code`
// (é só leitura). Salve o objeto devolvido, sem editar, em figma/variaveis.json e rode
// `pnpm --filter @holofote/tokens gerar`. O retorno inclui `assinatura`, um hash do conteúdo
// que o gerador confere para pegar cópias incompletas.
//
// Roda no ambiente do Plugin API: `figma` é global, `await` e `return` no topo são permitidos.

const hex = (c) => {
  const h = (v) =>
    Math.round(v * 255)
      .toString(16)
      .padStart(2, '0');
  return '#' + h(c.r) + h(c.g) + h(c.b) + (c.a !== undefined && c.a < 1 ? h(c.a) : '');
};
const valor = (v) => {
  if (v && typeof v === 'object' && 'r' in v) return hex(v);
  if (v && typeof v === 'object' && v.type === 'VARIABLE_ALIAS') return { alias: v.id };
  return v;
};
const colecoes = await figma.variables.getLocalVariableCollectionsAsync();
const vars = await figma.variables.getLocalVariablesAsync();
const porId = Object.fromEntries(vars.map((v) => [v.id, v.name]));
const saidaColecoes = colecoes.map((c) => ({
  nome: c.name,
  modos: c.modes.map((m) => m.name),
  variaveis: c.variableIds.map((id) => {
    const v = vars.find((x) => x.id === id);
    const valores = {};
    for (const m of c.modes) {
      const val = valor(v.valuesByMode[m.modeId]);
      valores[m.name] = val && val.alias ? { alias: porId[val.alias] } : val;
    }
    return { nome: v.name, tipo: v.resolvedType, valores };
  }),
}));
const tinta = async (p) => {
  const base = { tipo: p.type, opacidade: p.opacity };
  if (p.type === 'SOLID') {
    const b = p.boundVariables && p.boundVariables.color;
    return { ...base, cor: hex(p.color), variavel: b ? porId[b.id] : undefined };
  }
  if (p.type.startsWith('GRADIENT')) {
    return {
      ...base,
      transform: p.gradientTransform,
      paradas: p.gradientStops.map((s) => ({
        pos: s.position,
        cor: hex(s.color),
        variavel:
          s.boundVariables && s.boundVariables.color ? porId[s.boundVariables.color.id] : undefined,
      })),
    };
  }
  return base;
};
const estilosCor = [];
for (const s of await figma.getLocalPaintStylesAsync()) {
  estilosCor.push({ nome: s.name, tintas: await Promise.all(s.paints.map(tinta)) });
}
const estilosTexto = (await figma.getLocalTextStylesAsync()).map((s) => ({
  nome: s.name,
  familia: s.fontName.family,
  estilo: s.fontName.style,
  tamanho: s.fontSize,
  altura: s.lineHeight,
  espaco: s.letterSpacing,
  caixa: s.textCase,
}));
const estilosEfeito = (await figma.getLocalEffectStylesAsync()).map((s) => ({
  nome: s.name,
  efeitos: s.effects.map((e) => ({
    tipo: e.type,
    cor: e.color ? hex(e.color) : undefined,
    variavelCor:
      e.boundVariables && e.boundVariables.color ? porId[e.boundVariables.color.id] : undefined,
    x: e.offset && e.offset.x,
    y: e.offset && e.offset.y,
    raio: e.radius,
    espalhar: e.spread,
    visivel: e.visible,
  })),
}));

const conteudo = { colecoes: saidaColecoes, estilosCor, estilosTexto, estilosEfeito };
// djb2 sobre o JSON canônico; scripts/gerar.ts calcula o mesmo hash.
const texto = JSON.stringify(conteudo);
let hash = 5381;
for (let i = 0; i < texto.length; i++) hash = ((hash * 33) ^ texto.charCodeAt(i)) >>> 0;
return { ...conteudo, assinatura: hash.toString(16) };
