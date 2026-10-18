// Converte linhas do banco nos DTOs do contrato (@holofote/shared), com carregamento em lote.
// Compartilhado pela API (respostas HTTP) e pelo worker (eventos de tempo real).
import type {
  Alerta,
  Mensagem,
  Mundo,
  Periodo,
  Personagem,
  PersonagemResumo,
  Post,
} from '@holofote/shared';
import { and, eq, inArray, sql } from 'drizzle-orm';
import type { Db } from './cliente';
import {
  curtida,
  memoria,
  personagem,
  relacao,
  voto,
  type LinhaAlerta,
  type LinhaMensagem,
  type LinhaMundo,
  type LinhaPersonagem,
  type LinhaPost,
} from './schema';

/** O banco guarda o handle sem "@"; o contrato e o app mostram com. */
export const comArroba = (handle: string) => `@${handle}`;

/** "@LuaPrado" vira "luaprado", como o banco exige. */
export const normalizarHandle = (handle: string) => handle.replace(/^@/, '').toLowerCase();

/** Iniciais para o avatar: primeira letra das duas primeiras palavras. */
export function iniciaisDe(nome: string): string {
  const partes = nome
    .replace(/^@/, '')
    .trim()
    .split(/[\s_.]+/)
    .filter(Boolean);
  const letras =
    partes.length >= 2 ? partes[0]![0]! + partes[1]![0]! : (partes[0] ?? '?').slice(0, 2);
  return letras.toUpperCase();
}

export const iso = (data: Date) => data.toISOString();

export function personagemResumoDto(p: LinhaPersonagem): PersonagemResumo {
  return {
    id: p.id,
    nome: p.nome,
    handle: comArroba(p.handle),
    iniciais: p.iniciais,
    tomAvatar: p.tomAvatar,
    verificado: p.verificado,
    papel: p.papel,
  };
}

export function mensagemDto(m: LinhaMensagem, jogadorId: string): Mensagem {
  return {
    id: m.id,
    conversaId: m.conversaId,
    minha: m.autorId === jogadorId,
    texto: m.texto,
    criadoEm: iso(m.entregarEm),
  };
}

export function alertaDto(a: LinhaAlerta, autor: LinhaPersonagem | null): Alerta {
  return {
    id: a.id,
    tipo: a.tipo,
    texto: a.texto,
    criadoEm: iso(a.entregarEm),
    lido: a.lidoEm !== null,
    personagem: autor ? personagemResumoDto(autor) : null,
    destino: { rota: a.destino },
  };
}

/** Personagem completo: números, relação com o jogador e o que lembra dele. */
export async function personagemDto(
  db: Db,
  p: LinhaPersonagem,
  jogadorId: string,
): Promise<Personagem> {
  const [rel] =
    p.id === jogadorId
      ? []
      : await db
          .select()
          .from(relacao)
          .where(and(eq(relacao.deId, jogadorId), eq(relacao.paraId, p.id)));
  const [lembranca] =
    p.id === jogadorId
      ? []
      : await db
          .select({ fatos: memoria.fatos })
          .from(memoria)
          .where(and(eq(memoria.personagemId, p.id), eq(memoria.sobreId, jogadorId)));
  return {
    ...personagemResumoDto(p),
    ficha: p.ficha,
    fama: p.fama,
    carisma: p.carisma,
    polemica: p.polemica,
    seguidores: p.seguidores,
    relacao: rel ? { afinidade: rel.afinidade, rotulo: rel.rotulo } : null,
    lembra: lembranca ? lembranca.fatos.split('\n').filter(Boolean) : [],
    silenciado: p.silenciado,
  };
}

/** Mundo do contrato. Dia e período vêm do motor (relógio do mundo e fuso do usuário). */
export async function mundoDto(
  db: Db,
  m: LinhaMundo,
  jogadorId: string,
  momento: { dia: number; periodo: Periodo; agora: Date },
): Promise<Mundo> {
  const [jogador] = await db.select().from(personagem).where(eq(personagem.id, jogadorId));
  if (!jogador) throw new Error(`mundoDto: jogador ${jogadorId} não existe`);
  return {
    id: m.id,
    universo: m.universo,
    tomCaos: m.tomCaos,
    dia: momento.dia,
    periodo: momento.periodo,
    ato: m.ato,
    objetivoAto: m.objetivoAto,
    estado: m.estado,
    jogador: await personagemDto(db, jogador, jogadorId),
    agora: iso(momento.agora),
  };
}

export async function personagensPorId(
  db: Db,
  ids: readonly string[],
): Promise<Map<string, LinhaPersonagem>> {
  const unicos = [...new Set(ids)];
  if (unicos.length === 0) return new Map();
  const linhas = await db.select().from(personagem).where(inArray(personagem.id, unicos));
  return new Map(linhas.map((p) => [p.id, p]));
}

/** Monta os DTOs de vários posts com 4 consultas no total (autores, curtidas, votos). */
export async function postsDto(
  db: Db,
  linhas: readonly LinhaPost[],
  jogadorId: string,
): Promise<Post[]> {
  if (linhas.length === 0) return [];
  const ids = linhas.map((p) => p.id);
  const pessoas = await personagensPorId(
    db,
    linhas.flatMap((p) => [p.autorId, ...p.marcados]),
  );
  const curtidos = new Set(
    (
      await db
        .select({ postId: curtida.postId })
        .from(curtida)
        .where(and(eq(curtida.personagemId, jogadorId), inArray(curtida.postId, ids)))
    ).map((c) => c.postId),
  );
  const comEnquete = linhas.filter((p) => p.enquete).map((p) => p.id);
  const votos =
    comEnquete.length > 0
      ? await db
          .select({
            postId: voto.postId,
            opcao: voto.opcao,
            total: sql<number>`count(*)::int`,
            meu: sql<boolean>`bool_or(${voto.personagemId} = ${jogadorId})`,
          })
          .from(voto)
          .where(inArray(voto.postId, comEnquete))
          .groupBy(voto.postId, voto.opcao)
      : [];

  return linhas.map((p) => {
    const autor = pessoas.get(p.autorId);
    if (!autor) throw new Error(`autor ${p.autorId} do post ${p.id} não encontrado`);
    const dosVotos = votos.filter((v) => v.postId === p.id);
    return {
      id: p.id,
      autor: personagemResumoDto(autor),
      texto: p.texto,
      tipo: p.tipo,
      tom: p.tom,
      respondeA: p.respondeA,
      marcados: p.marcados.flatMap((id) => {
        const marcado = pessoas.get(id);
        return marcado ? [personagemResumoDto(marcado)] : [];
      }),
      curtidas: p.curtidas,
      reposts: p.reposts,
      respostas: p.respostas,
      curtidoPorMim: curtidos.has(p.id),
      criadoEm: iso(p.entregarEm),
      enquete: p.enquete
        ? {
            pergunta: p.enquete.pergunta,
            opcoes: p.enquete.opcoes.map((o) => ({
              ...o,
              votos: dosVotos.find((v) => v.opcao === o.id)?.total ?? 0,
            })),
            meuVoto: dosVotos.find((v) => v.meu)?.opcao ?? null,
          }
        : null,
      expiraEm: p.expiraEm ? iso(p.expiraEm) : null,
    };
  });
}

export async function postDto(db: Db, linha: LinhaPost, jogadorId: string): Promise<Post> {
  const [dto] = await postsDto(db, [linha], jogadorId);
  return dto!;
}
