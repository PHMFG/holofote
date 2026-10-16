// Evals dos prompts: 30 ações no mundo "Pop Brasil" contra o provedor configurado.
//
//   pnpm --filter @holofote/llm evals                      (LLM_PROVIDER=falso: prova o script)
//   pnpm --filter @holofote/llm evals --env ../../apps/worker/.env   (com a chave real)
//   pnpm --filter @holofote/llm evals --so dm              (só as ações cujo id começa com "dm")
//
// Sai com código 1 se algum critério do plano falhar.
import { parseArgs } from 'node:util';
import { criarProvedor, lerConfigLlm, verificarModelos } from '../src/index';
import { VERSAO_PROMPTS } from '../src/prompts';
import { ACOES_EVAL } from './acoes';
import { executarEvals } from './executar';
import { avaliarCriterios, calcularMetricas, type ResultadoAcao } from './metricas';

const { values } = parseArgs({
  options: {
    env: { type: 'string' },
    so: { type: 'string' },
  },
});

if (values.env) process.loadEnvFile(values.env);

const config = lerConfigLlm();
const acoes = values.so ? ACOES_EVAL.filter((a) => a.id.startsWith(values.so ?? '')) : ACOES_EVAL;

console.log(
  `Evals · provedor ${config.provedor} · prompts v${VERSAO_PROMPTS} · ${acoes.length} ações\n` +
    `Modelos: diretor ${config.modelos.diretor}, principal ${config.modelos.principal}, ` +
    `lote ${config.modelos.lote}, reserva ${config.modelos.reserva}\n`,
);

if (config.provedor === 'opencode-go') {
  await verificarModelos(config);
}

const linha = (r: ResultadoAcao) => {
  const custo = r.chamadas.reduce((n, c) => n + c.custoUsd, 0);
  const latencia = r.chamadas.reduce((n, c) => n + c.latenciaMs, 0);
  const modelos = [...new Set(r.chamadas.map((c) => c.modelo))].join(', ');
  const status = r.ok ? (r.chamadas.length > 1 ? 'ok*' : 'ok ') : 'ERRO';
  console.log(
    `${status} ${r.id.padEnd(20)} ${r.job.padEnd(9)} ${modelos.padEnd(22)} ` +
      `US$ ${custo.toFixed(6)} ${String(latencia).padStart(6)} ms`,
  );
  for (const a of r.analises) {
    for (const p of a.problemas) console.log(`       - ${p}`);
  }
  if (r.erro) console.log(`       ${r.erro}`);
};

const resultados = await executarEvals(acoes, criarProvedor(config), config, linha);
const m = calcularMetricas(resultados);
const criterios = avaliarCriterios(m);

console.log('\nok* = precisou de reparo ou de reserva\n');
console.log(`Ações: ${m.acoes} · chamadas: ${m.chamadas} · respostas: ${m.respostas}`);
console.log(
  `Aceitas de primeira: ${m.aceitasDePrimeiraPct.toFixed(1)} % · sucesso final: ${m.sucessoPct.toFixed(1)} %`,
);
console.log(`Textos com emoji: ${m.textosComEmoji} · ids inválidos: ${m.idsInvalidos}`);
console.log(`Custo total: US$ ${m.custoTotalUsd.toFixed(6)}`);
console.log(
  `Latência média: ${m.latenciaMediaMs.toFixed(0)} ms · p95: ${m.latenciaP95Ms.toFixed(0)} ms\n`,
);
for (const c of criterios) {
  console.log(`${c.ok ? 'PASSOU' : 'FALHOU'}  ${c.nome}: ${c.valor} (alvo ${c.alvo})`);
}
if (config.provedor === 'falso') {
  console.log(
    '\nProvedor falso: mede o script, não a qualidade. Tokens estimados em 4 caracteres por token.',
  );
}

process.exitCode = criterios.every((c) => c.ok) ? 0 : 1;
