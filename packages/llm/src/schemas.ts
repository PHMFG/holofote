// Schemas Zod da saída de cada job, com os limites de tamanho do plano.
// Campos opcionais aceitam null (modelos costumam mandar null) e saem como undefined.
import { z } from 'zod';
import type { NomeJob } from './jobs';

const texto = (max: number) => z.string().trim().min(1).max(max);

/** Opcional que aceita null e sai como undefined. */
const opcional = <T extends z.ZodType>(schema: T) =>
  schema.nullish().transform((v) => v ?? undefined);

/** Lista opcional que aceita null ou ausência e sai como []. */
const lista = <T extends z.ZodType>(item: T, max: number) =>
  z
    .array(item)
    .max(max)
    .nullish()
    .transform((v) => v ?? []);

/** Id recebido no prompt (uuid no banco, qualquer texto curto nos testes). */
const idRecebido = z.string().trim().min(1).max(64);

/** Handle no formato @nome. Aceita sem @ e com maiúsculas e normaliza. */
export const Handle = z
  .string()
  .trim()
  .toLowerCase()
  .transform((h) => (h.startsWith('@') ? h : `@${h}`))
  .pipe(
    z
      .string()
      .regex(
        /^@[a-z0-9_.]{2,24}$/,
        'handle precisa ser @ seguido de 2 a 24 letras, números, _ ou .',
      ),
  );

/** Nome de exibição: sem @, parênteses ou barras (o handle vai no campo próprio). */
const Nome = texto(40).refine((n) => !/[@()/\\]/.test(n), {
  message: 'o nome não leva @, parênteses nem barra; o handle vai no campo handle',
});

export const TipoVinculo = z.enum([
  'rival',
  'amizade',
  'parceria',
  'mentor',
  'interesse',
  'fofoca',
]);
export type TipoVinculo = z.infer<typeof TipoVinculo>;

/** Vínculos que contam como aliado na criação do mundo. */
export const VINCULOS_ALIADOS: readonly TipoVinculo[] = ['amizade', 'parceria', 'mentor'];

export const TomAvatarGerado = z.enum(['claro', 'medio']);

export const Moderacao = z.object({
  ok: z.boolean(),
  motivo: opcional(texto(200)),
});

/** Alvo de delta: atributo do jogador ou relação com um personagem recebido. */
const AlvoDelta = z
  .string()
  .trim()
  .regex(
    /^(fama|carisma|polemica|seguidores|relacao:.+)$/,
    'alvo precisa ser fama, carisma, polemica, seguidores ou relacao:<id>',
  );

const AtrasoSeg = z.number().int().min(20).max(900);

// ---------- criar_mundo ----------

export const MembroElenco = z.object({
  nome: Nome,
  handle: Handle,
  ficha: texto(600),
  tipoVinculo: TipoVinculo,
  verificado: z.boolean(),
  tomAvatar: TomAvatarGerado,
});

export const Figurante = z.object({
  nome: Nome,
  handle: Handle,
  ficha: texto(200),
  tipo: texto(30),
});

export const MarcoGerado = z.object({ titulo: texto(60), descricao: texto(200) });

export const EventoGerado = z.object({
  tipo: z.enum(['premio', 'show', 'crise']),
  titulo: texto(60),
  categoria: texto(60),
});

/** Mundo aceito: a moderação liberou o universo (ok true). Com ok false vale a recusa, mesmo com elenco. */
const ModeracaoLiberada = z.object({ ok: z.literal(true), motivo: opcional(texto(200)) });

export const MundoGerado = z
  .object({
    nomeMundo: texto(60),
    biblia: texto(3000),
    objetivoAto: texto(120),
    elenco: z.array(MembroElenco).length(5),
    figurantes: z.array(Figurante).length(4),
    marcos: z.array(MarcoGerado).length(5),
    evento: EventoGerado,
    moderacao: ModeracaoLiberada,
  })
  .superRefine((mundo, ctx) => {
    if (!mundo.elenco.some((p) => p.tipoVinculo === 'rival')) {
      ctx.addIssue({
        code: 'custom',
        path: ['elenco'],
        message: 'o elenco precisa de 1 rival',
        params: { codigo: 'sem_rival' },
      });
    }
    if (!mundo.elenco.some((p) => VINCULOS_ALIADOS.includes(p.tipoVinculo))) {
      ctx.addIssue({
        code: 'custom',
        path: ['elenco'],
        message: 'o elenco precisa de 1 aliado (amizade, parceria ou mentor)',
        params: { codigo: 'sem_aliado' },
      });
    }
    const pessoas = [...mundo.elenco, ...mundo.figurantes];
    const handles = pessoas.map((p) => p.handle);
    const nomes = pessoas.map((p) => p.nome.toLowerCase());
    if (new Set(handles).size !== handles.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['elenco'],
        message: 'handles repetidos',
        params: { codigo: 'repetido' },
      });
    }
    if (new Set(nomes).size !== nomes.length) {
      ctx.addIssue({
        code: 'custom',
        path: ['elenco'],
        message: 'nomes repetidos',
        params: { codigo: 'repetido' },
      });
    }
    // A bíblia vira o prefixo de todo prompt do mundo: precisa das três partes e do elenco.
    const biblia = mundo.biblia.toLowerCase();
    const faltando = ['universo:', 'tom:', 'elenco:'].filter((parte) => !biblia.includes(parte));
    if (faltando.length > 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['biblia'],
        message: `a bíblia precisa das partes "Universo:", "Tom:" e "Elenco:" (faltou ${faltando.join(', ')})`,
        params: { codigo: 'biblia_incompleta' },
      });
    }
    const semLinha = mundo.elenco.filter((p) => !biblia.includes(p.handle));
    if (semLinha.length > 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['biblia'],
        message: `a bíblia precisa de uma linha para cada personagem do elenco (faltou ${semLinha.map((p) => p.handle).join(', ')})`,
        params: { codigo: 'biblia_incompleta' },
      });
    }
  });

/** Universo recusado pela moderação (pessoa real, conteúdo acima de 12 anos). */
export const RecusaMundo = z.object({
  moderacao: z.object({ ok: z.literal(false), motivo: texto(200) }),
});

export const SaidaCriarMundo = z.union([MundoGerado, RecusaMundo]);

export type MundoGerado = z.output<typeof MundoGerado>;
export type RecusaMundo = z.output<typeof RecusaMundo>;
export type SaidaCriarMundo = z.output<typeof SaidaCriarMundo>;

export function mundoFoiRecusado(saida: SaidaCriarMundo): saida is RecusaMundo {
  return !saida.moderacao.ok;
}

// ---------- feed_inicial e lote_diario ----------

export const PostGerado = z.object({
  autorId: idRecebido,
  texto: texto(220),
  /** Número: posição de outro post desta mesma lista (começa em 0). Texto: id de um post recente. */
  respondeA: opcional(z.union([z.number().int().min(0), idRecebido])),
});

export const HistoriaGerada = z.object({
  autorId: idRecebido,
  texto: texto(160),
  enquete: opcional(z.object({ pergunta: texto(80), opcoes: z.array(texto(40)).min(2).max(4) })),
});

export const ResumoGerado = z.object({
  manchete: texto(120),
  pendencias: lista(z.object({ texto: texto(120), personagemId: opcional(idRecebido) }), 5),
});

export const MemoriaLonga = z.object({
  personagemId: idRecebido,
  sobreId: idRecebido,
  fatos: texto(300),
});

export const SaidaFeed = z.object({
  posts: z.array(PostGerado).min(1).max(30),
  historias: lista(HistoriaGerada, 8),
  resumo: opcional(ResumoGerado),
  memorias: lista(MemoriaLonga, 20),
  puxaConversa: opcional(z.object({ personagemId: idRecebido, texto: texto(220) })),
});

/** Tipo comum dos dois feeds: `resumo` é opcional aqui; os schemas abaixo o tornam obrigatório. */
export type SaidaFeed = z.output<typeof SaidaFeed>;

// O feed de estreia (manchete e pendências da primeira tela) e o lote diário (resumo da manhã)
// dependem do `resumo`: sem ele o job falha na validação e o roteador pede reparo.
export const SaidaFeedInicial = SaidaFeed.extend({ resumo: ResumoGerado });
export const SaidaLoteDiario = SaidaFeed.extend({ resumo: ResumoGerado });

export type SaidaFeedInicial = z.output<typeof SaidaFeedInicial>;
export type SaidaLoteDiario = z.output<typeof SaidaLoteDiario>;

// ---------- diretor ----------

/** Uma reação por reator: personagemId repetido vira problema de validação (o roteador repara). */
function semReatorRepetido(reacoes: { personagemId: string }[], ctx: z.core.$RefinementCtx): void {
  const vistos = new Set<string>();
  reacoes.forEach((r, i) => {
    if (vistos.has(r.personagemId)) {
      ctx.addIssue({
        code: 'custom',
        path: [i, 'personagemId'],
        message: 'cada reator reage no máximo uma vez; este personagemId já apareceu',
        params: { codigo: 'repetido' },
      });
    }
    vistos.add(r.personagemId);
  });
}

export const SaidaDiretor = z.object({
  reacoes: z
    .array(
      z.object({
        personagemId: idRecebido,
        tipo: z.enum(['resposta', 'citacao', 'dm']),
        texto: texto(220),
        atrasoSeg: AtrasoSeg,
      }),
    )
    .max(5)
    .superRefine(semReatorRepetido),
  // O prompt pede até 240 caracteres; o schema tolera um pouco mais para não pagar um reparo
  // por 20 caracteres (nos evals com o Go, 1 em cada 3 cartões passava de 240).
  cartao: z.object({ titulo: texto(60), texto: texto(320) }),
  deltasSugeridos: lista(z.object({ alvo: AlvoDelta, valor: z.number() }), 10),
  memorias: lista(z.object({ personagemId: idRecebido, fato: texto(140) }), 5),
  moderacao: Moderacao,
});

export type SaidaDiretor = z.output<typeof SaidaDiretor>;

// ---------- dm ----------

export const SaidaDm = z.object({
  mensagens: z.array(texto(220)).min(1).max(3),
  resumoConversa: texto(400),
  deltaSugerido: z.number().min(-3).max(3),
  memoria: opcional(texto(100)),
});

export type SaidaDm = z.output<typeof SaidaDm>;

// ---------- discurso ----------

export const SaidaDiscurso = z.object({
  manchete: texto(120),
  reacoes: z
    .array(z.object({ personagemId: idRecebido, texto: texto(220), atrasoSeg: AtrasoSeg }))
    .max(5)
    .superRefine(semReatorRepetido),
});

export type SaidaDiscurso = z.output<typeof SaidaDiscurso>;

// ---------- memoria ----------

export const SaidaMemoria = z.object({ memorias: z.array(MemoriaLonga).min(1).max(20) });

export type SaidaMemoria = z.output<typeof SaidaMemoria>;

// ---------- ficha ----------

export const SaidaFicha = z.object({
  nome: Nome,
  handle: Handle,
  ficha: texto(600),
  tipoVinculo: TipoVinculo,
  tomAvatar: TomAvatarGerado,
  verificado: z.boolean(),
});

export type SaidaFicha = z.output<typeof SaidaFicha>;

// ---------- novo_ato ----------

export const SaidaNovoAto = z.object({
  objetivoAto: texto(120),
  marcos: z.array(MarcoGerado).length(5),
});

export type SaidaNovoAto = z.output<typeof SaidaNovoAto>;

// ---------- tabela ----------

export const SCHEMAS = {
  diretor: SaidaDiretor,
  dm: SaidaDm,
  discurso: SaidaDiscurso,
  criar_mundo: SaidaCriarMundo,
  feed_inicial: SaidaFeedInicial,
  lote_diario: SaidaLoteDiario,
  memoria: SaidaMemoria,
  ficha: SaidaFicha,
  novo_ato: SaidaNovoAto,
} satisfies Record<NomeJob, z.ZodType>;

export type SaidasJobs = { [J in NomeJob]: z.output<(typeof SCHEMAS)[J]> };

/**
 * Schema usado para validar uma resposta bruta. No criar_mundo escolhe o ramo pelo conteúdo,
 * para a mensagem de reparo falar dos campos certos em vez de um erro de união.
 */
export function schemaParaValidar(job: NomeJob, bruto: unknown): z.ZodType {
  if (job === 'criar_mundo') {
    const objeto = bruto as { moderacao?: { ok?: unknown } } | null;
    // moderacao.ok false vale como recusa mesmo que o modelo tenha mandado elenco junto:
    // o universo barrado pela moderação não vira mundo.
    return objeto?.moderacao?.ok === false ? RecusaMundo : MundoGerado;
  }
  return SCHEMAS[job];
}

// ---------- ids ----------

export interface IdsPermitidos {
  /** Ids aceitos em personagemId, autorId e relacao:<id>. */
  personagens: Iterable<string>;
  /** Ids aceitos em sobreId (padrão: os de personagens). */
  sobre?: Iterable<string>;
  /** Ids de posts aceitos em respondeA quando é texto. */
  posts?: Iterable<string>;
}

/** Um id fora do permitido. `mensagem` cita o id do modelo (só para o reparo); o resto é seguro. */
export interface ProblemaDeId {
  caminho: string;
  codigo: 'id_invalido';
  mensagem: string;
}

/**
 * Confere se todo id devolvido pelo modelo veio no prompt. Devolve a lista de problemas
 * (vazia quando está tudo certo). Aceita a lista simples de ids como atalho.
 */
export function validarIds(dados: unknown, ids: IdsPermitidos | Iterable<string>): string[] {
  return validarIdsDetalhado(dados, ids).map((p) => p.mensagem);
}

export function validarIdsDetalhado(
  dados: unknown,
  ids: IdsPermitidos | Iterable<string>,
): ProblemaDeId[] {
  const permitidos: IdsPermitidos = 'personagens' in ids ? ids : { personagens: ids };
  const personagens = new Set(permitidos.personagens);
  const sobre = new Set(permitidos.sobre ?? personagens);
  const posts = new Set(permitidos.posts ?? []);
  const problemas: ProblemaDeId[] = [];
  const achar = (caminho: string, mensagem: string) =>
    problemas.push({ caminho, codigo: 'id_invalido', mensagem: `${caminho}: ${mensagem}` });

  const visitar = (valor: unknown, caminho: string) => {
    if (Array.isArray(valor)) {
      valor.forEach((item, i) => visitar(item, `${caminho}.${i}`));
      return;
    }
    if (typeof valor !== 'object' || valor === null) return;
    for (const [chave, filho] of Object.entries(valor)) {
      const aqui = caminho ? `${caminho}.${chave}` : chave;
      if (typeof filho === 'string') {
        if ((chave === 'personagemId' || chave === 'autorId') && !personagens.has(filho)) {
          achar(aqui, `id "${filho}" não está entre os personagens enviados`);
        } else if (chave === 'sobreId' && !sobre.has(filho)) {
          achar(aqui, `id "${filho}" não está entre os ids enviados`);
        } else if (chave === 'respondeA' && !posts.has(filho)) {
          achar(aqui, `"${filho}" não é um post recente enviado`);
        } else if (chave === 'alvo' && filho.startsWith('relacao:')) {
          const alvo = filho.slice('relacao:'.length);
          if (!personagens.has(alvo)) {
            achar(aqui, `relação com id "${alvo}" que não está entre os enviados`);
          }
        }
      } else {
        visitar(filho, aqui);
      }
    }
  };
  visitar(dados, '');
  return problemas;
}
