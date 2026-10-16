/** Erro de negócio com código estável do contrato (docs/CONTRATOS.md). */
export class ErroApi extends Error {
  constructor(
    readonly status: number,
    readonly codigo: string,
    mensagem: string,
  ) {
    super(mensagem);
  }
}

export const naoEncontrado = (o_que = 'Não encontrado') =>
  new ErroApi(404, 'nao_encontrado', o_que);
