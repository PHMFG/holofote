// API simulada para testes de tela. Uso, no topo do arquivo de teste:
//   jest.mock('../../api/cliente', () => require('../../testes/api').moduloClienteSimulado());
// e, em cada teste: simularApi({ 'GET /mundos/atual': mundo, 'POST /posts': (corpo) => resposta }).
// A resposta é validada pelo schema da rota, como no app. ErroDaApi vem do módulo real (este arquivo roda dentro do jest.mock do próprio cliente).
const { ErroDaApi } = jest.requireActual('../api/cliente') as typeof import('../api/cliente');

type Resposta = unknown | ((corpo: unknown) => unknown);

let rotas: Record<string, Resposta> = {};
export const chamadas: { metodo: string; rota: string; corpo: unknown }[] = [];

export function simularApi(novas: Record<string, Resposta>) {
  rotas = novas;
  chamadas.length = 0;
}

async function requisitarSimulado(
  rota: string,
  opcoes: { metodo?: string; corpo?: unknown; schema?: { parse: (v: unknown) => unknown } } = {},
) {
  const metodo = opcoes.metodo ?? 'GET';
  chamadas.push({ metodo, rota, corpo: opcoes.corpo });
  const chave = `${metodo} ${rota.split('?')[0]}`;
  if (!(chave in rotas)) throw new ErroDaApi(404, 'nao_encontrado', `rota não simulada: ${chave}`);
  const resposta = rotas[chave];
  const valor = await (typeof resposta === 'function'
    ? (resposta as (c: unknown) => unknown)(opcoes.corpo)
    : resposta);
  if (valor instanceof ErroDaApi) throw valor;
  // Como o requisitar de verdade: a resposta passa pelo schema do contrato. Um fixture fora do
  // contrato (campo faltando, id que não é UUID) quebra o teste em vez de passar despercebido.
  if (opcoes.schema && valor !== undefined) return opcoes.schema.parse(valor);
  return valor;
}

export function moduloClienteSimulado() {
  const real = jest.requireActual('../api/cliente') as typeof import('../api/cliente');
  return {
    ...real,
    requisitar: jest.fn(requisitarSimulado),
    garantirToken: jest.fn(async () => 'token-de-teste'),
  };
}
