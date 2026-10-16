// Roda as ações de eval contra um provedor e junta as respostas brutas para medir.
import type { ConfigLlm } from '../src/config';
import { idsDaEntrada } from '../src/prompts';
import type { Provedor, RespostaBruta } from '../src/provedor';
import { chamarJob, type ChamadaLlm } from '../src/roteador';
import { analisarResposta } from '../src/validacao';
import type { AcaoEval } from './acoes';
import type { ResultadoAcao } from './metricas';
import { BIBLIA_POP_BRASIL, MUNDO_ID } from './pop-brasil';

/** Envolve o provedor para guardar cada resposta bruta (o roteador só devolve os dados aceitos). */
function espiar(provedor: Provedor) {
  let respostas: RespostaBruta[] = [];
  const espiao: Provedor = {
    nome: provedor.nome,
    async gerar(pedido) {
      const resposta = await provedor.gerar(pedido);
      respostas.push(resposta);
      return resposta;
    },
  };
  return {
    espiao,
    colher: () => {
      const colhidas = respostas;
      respostas = [];
      return colhidas;
    },
  };
}

export async function executarEvals(
  acoes: AcaoEval[],
  provedor: Provedor,
  config: ConfigLlm,
  aoTerminarAcao?: (resultado: ResultadoAcao) => void,
): Promise<ResultadoAcao[]> {
  const { espiao, colher } = espiar(provedor);
  let gasto = 0;
  const resultados: ResultadoAcao[] = [];
  for (const acao of acoes) {
    const chamadas: ChamadaLlm[] = [];
    const comum = {
      mundoId: MUNDO_ID,
      biblia: BIBLIA_POP_BRASIL,
      provedor: espiao,
      config,
      gastoHojeUsd: async () => gasto,
      registrar: async (c: ChamadaLlm) => {
        gasto += c.custoUsd;
        chamadas.push(c);
      },
    };
    let ok = false;
    let erro: string | undefined;
    try {
      // O switch mantém o par job/entrada tipado em cada ramo.
      switch (acao.job) {
        case 'diretor':
          await chamarJob({ ...comum, job: acao.job, entrada: acao.entrada });
          break;
        case 'dm':
          await chamarJob({ ...comum, job: acao.job, entrada: acao.entrada });
          break;
        case 'discurso':
          await chamarJob({ ...comum, job: acao.job, entrada: acao.entrada });
          break;
      }
      ok = true;
    } catch (e) {
      erro = e instanceof Error ? `${e.name}: ${e.message}` : String(e);
    }
    const ids = idsDaEntrada(acao.job, acao.entrada);
    const analises = colher().map((r) =>
      analisarResposta(acao.job, r.texto, { ids, entrada: acao.entrada }),
    );
    const resultado: ResultadoAcao = {
      id: acao.id,
      job: acao.job,
      descricao: acao.descricao,
      ok,
      erro,
      analises,
      chamadas,
    };
    resultados.push(resultado);
    aoTerminarAcao?.(resultado);
  }
  return resultados;
}
