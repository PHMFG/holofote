// Roteador: escolhe o modelo do job, confere o teto diário, chama, valida, repara uma vez e cai
// para o modelo reserva em falha do provedor ou quando o reparo também falha (a reserva faz o
// mesmo ciclo, com o seu próprio reparo) e registra cada chamada.
// Nunca devolve texto pronto: se tudo falhar, lança um erro tipado e o worker reagenda o job.
//
// O registro (`registrar`) é melhor esforço: se ele lançar, a falha é engolida (e avisada em
// `aoFalharRegistro`, se houver) para não perder um resultado já pago nem mascarar o erro do
// provedor. A chamada continua em `chamadas` do resultado, para o worker regravar se quiser.
import type { ConfigLlm, PapelModelo } from './config';
import { estimarCusto } from './custo';
import { JOBS, papelDoJob, type NomeJob } from './jobs';
import { VERSAO_PROMPTS, idsDaEntrada, montarPrefixo, montarPromptDoJob } from './prompts';
import type { EntradasJobs } from './prompts/tipos';
import {
  ErroJsonInvalido,
  ErroLimite,
  ErroLlm,
  ErroOrcamento,
  ErroProvedor,
  rotuloDeFalha,
  type MensagemChat,
  type Provedor,
  type RespostaBruta,
} from './provedor';
import type { IdsPermitidos, SaidasJobs } from './schemas';
import { analisarResposta } from './validacao';

/** Uma linha de `chamada_llm`. O worker acrescenta o eventoId e grava. */
export interface ChamadaLlm {
  job: NomeJob;
  mundoId: string;
  provedor: string;
  /** Papel efetivo: o do job ou "reserva". */
  papel: PapelModelo;
  modelo: string;
  tentativa: 'inicial' | 'reparo';
  tokensEntrada: number;
  tokensCache: number;
  tokensSaida: number;
  custoUsd: number;
  latenciaMs: number;
  ok: boolean;
  /** Código e motivo curto ("limite: ...", "json_invalido: ..."); null quando ok. */
  erro: string | null;
  versaoPrompts: number;
}

export interface ArgsChamarJob<J extends NomeJob> {
  job: J;
  mundoId: string;
  /** Bíblia do mundo (prefixo fixo). Null só no criar_mundo. */
  biblia: string | null;
  entrada: EntradasJobs[J];
  provedor: Provedor;
  config: ConfigLlm;
  /** Soma de custoUsd de chamada_llm no dia (UTC). */
  gastoHojeUsd: () => Promise<number>;
  /** Grava a chamada em `chamada_llm`. Melhor esforço: uma falha aqui não derruba o job. */
  registrar: (chamada: ChamadaLlm) => Promise<void>;
  /** Avisado quando `registrar` lança (para logar). Nunca lança de volta. */
  aoFalharRegistro?: (erro: unknown, chamada: ChamadaLlm) => void;
  /** Ids aceitos na resposta. Padrão: os que foram no prompt (idsDaEntrada). */
  idsValidos?: IdsPermitidos | string[];
}

export interface ResultadoJob<J extends NomeJob> {
  dados: SaidasJobs[J];
  chamadas: ChamadaLlm[];
}

const MAX_TEXTO_REPARO = 8000;

export function mensagemDeReparo(problemas: string[]): string {
  return [
    'REPARO',
    'Sua resposta anterior não passou na validação:',
    ...problemas.map((p) => `- ${p}`),
    'Responda de novo só com o objeto JSON completo e corrigido, no FORMATO da tarefa, sem texto fora do JSON.',
  ].join('\n');
}

export async function chamarJob<J extends NomeJob>(
  args: ArgsChamarJob<J>,
): Promise<ResultadoJob<J>> {
  const { job, mundoId, entrada, provedor, config } = args;
  const papelNaDm =
    job === 'dm' && (entrada as EntradasJobs['dm']).personagem.papel === 'figurante'
      ? 'figurante'
      : 'elenco';
  const papel = papelDoJob(job, papelNaDm);
  const sistema = montarPrefixo({ biblia: args.biblia });
  const usuario = montarPromptDoJob(job, entrada);
  const idsValidos = args.idsValidos ?? idsDaEntrada(job, entrada);
  const ids: IdsPermitidos = Array.isArray(idsValidos) ? { personagens: idsValidos } : idsValidos;
  const chamadas: ChamadaLlm[] = [];

  const alvos: { papel: PapelModelo; modelo: string }[] = [
    { papel, modelo: config.modelos[papel] },
  ];
  if (config.modelos.reserva !== config.modelos[papel]) {
    alvos.push({ papel: 'reserva', modelo: config.modelos.reserva });
  }

  const registrar = async (
    chamada: Omit<ChamadaLlm, 'job' | 'mundoId' | 'provedor' | 'versaoPrompts'>,
  ) => {
    const completa: ChamadaLlm = {
      job,
      mundoId,
      provedor: provedor.nome,
      versaoPrompts: VERSAO_PROMPTS,
      ...chamada,
    };
    chamadas.push(completa);
    try {
      await args.registrar(completa);
    } catch (erroRegistro) {
      try {
        args.aoFalharRegistro?.(erroRegistro, completa);
      } catch {
        // O aviso também é melhor esforço.
      }
    }
  };

  /** Uma ida ao provedor: confere o teto, chama e registra a falha do provedor, se houver. */
  const gerar = async (
    alvo: { papel: PapelModelo; modelo: string },
    mensagens: MensagemChat[],
    tentativa: ChamadaLlm['tentativa'],
  ): Promise<RespostaBruta> => {
    const gasto = await args.gastoHojeUsd();
    if (gasto >= config.orcamentoDiarioUsd)
      throw new ErroOrcamento(gasto, config.orcamentoDiarioUsd);
    const inicio = performance.now();
    try {
      return await provedor.gerar({
        modelo: alvo.modelo,
        sistema,
        mensagens,
        maxTokens: JOBS[job].maxTokens,
        sessao: mundoId,
        json: true,
      });
    } catch (erro) {
      const tipado =
        erro instanceof ErroLlm
          ? erro
          : // Erro sem tipo vindo de um provedor: só o nome, a mensagem pode citar o pedido.
            new ErroProvedor(alvo.modelo, null, rotuloDeFalha(erro));
      await registrar({
        papel: alvo.papel,
        modelo: alvo.modelo,
        tentativa,
        tokensEntrada: 0,
        tokensCache: 0,
        tokensSaida: 0,
        custoUsd: 0,
        latenciaMs: Math.round(performance.now() - inicio),
        ok: false,
        erro: `${tipado.codigo}: ${tipado.message}`.slice(0, 500),
      });
      throw tipado;
    }
  };

  /** Chama e valida; devolve os dados ou os problemas (e registra a chamada). */
  const tentar = async (
    alvo: { papel: PapelModelo; modelo: string },
    mensagens: MensagemChat[],
    tentativa: ChamadaLlm['tentativa'],
  ) => {
    const resposta = await gerar(alvo, mensagens, tentativa);
    const analise = analisarResposta(job, resposta.texto, { ids, entrada });
    await registrar({
      papel: alvo.papel,
      modelo: resposta.modelo,
      tentativa,
      tokensEntrada: resposta.uso.entrada,
      tokensCache: resposta.uso.cache,
      tokensSaida: resposta.uso.saida,
      // Custo pelo modelo pedido: o id devolvido pelo provedor pode vir com sufixo de versão.
      custoUsd: estimarCusto(alvo.modelo, resposta.uso),
      latenciaMs: resposta.latenciaMs,
      ok: analise.ok,
      erro: analise.ok
        ? null
        : `json_invalido: ${analise.falhas.slice(0, 3).join('; ')}`.slice(0, 500),
    });
    return { resposta, analise };
  };

  let ultimoErro: ErroLimite | ErroProvedor | ErroJsonInvalido | undefined;
  for (const alvo of alvos) {
    try {
      const mensagens: MensagemChat[] = [{ papel: 'usuario', conteudo: usuario }];
      const primeira = await tentar(alvo, mensagens, 'inicial');
      if (primeira.analise.ok && primeira.analise.dados) {
        return { dados: primeira.analise.dados, chamadas };
      }
      const reparo = await tentar(
        alvo,
        [
          ...mensagens,
          {
            papel: 'assistente',
            conteudo: primeira.resposta.texto.slice(0, MAX_TEXTO_REPARO) || '(resposta vazia)',
          },
          { papel: 'usuario', conteudo: mensagemDeReparo(primeira.analise.problemas) },
        ],
        'reparo',
      );
      if (reparo.analise.ok && reparo.analise.dados) {
        return { dados: reparo.analise.dados, chamadas };
      }
      throw new ErroJsonInvalido(job, alvo.modelo, reparo.analise.falhas);
    } catch (erro) {
      // Falha do provedor, limite ou JSON inválido depois do reparo: tenta o próximo modelo
      // (a reserva). O resto (teto diário, erro de programação) sobe.
      if (
        erro instanceof ErroLimite ||
        erro instanceof ErroProvedor ||
        erro instanceof ErroJsonInvalido
      ) {
        ultimoErro = erro;
        continue;
      }
      throw erro;
    }
  }
  // Só chega aqui se todos os modelos falharam (provedor ou JSON); sobe o erro do último.
  throw ultimoErro ?? new ErroProvedor(config.modelos[papel], null, 'nenhum modelo disponível');
}
