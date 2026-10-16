// Peças de texto comuns aos prompts. Formato estável: seções com título em maiúsculas numa
// linha só, personagens como `[id:<id>] Nome (@handle)` e falas sempre entre aspas numa linha.
import type { NomeJob } from '../jobs';
import type {
  JogadorPrompt,
  MomentoPrompt,
  NumerosMotor,
  PessoaCurta,
  ReatorPrompt,
  RelacaoPrompt,
} from './tipos';

/** Junta espaços e quebras de linha e corta no limite (texto de jogador ou do banco). */
export function limpar(texto: string, max = 600): string {
  const uma = texto.replace(/\s+/g, ' ').trim();
  return uma.length <= max ? uma : `${uma.slice(0, max - 1).trimEnd()}…`;
}

/** Fala entre aspas, numa linha só. Aspas internas viram aspas curvas para não fechar a fala. */
export function aspas(texto: string, max = 600): string {
  return `"${limpar(texto, max).replace(/"/g, '”')}"`;
}

export function arroba(handle: string): string {
  const h = limpar(handle, 40);
  return h.startsWith('@') ? h : `@${h}`;
}

export function pessoa(p: PessoaCurta): string {
  return `[id:${p.id}] ${limpar(p.nome, 60)} (${arroba(p.handle)})`;
}

const NUMERO = new Intl.NumberFormat('pt-BR');

export function numero(n: number): string {
  return NUMERO.format(n);
}

export function sinal(n: number): string {
  return n > 0 ? `+${numero(n)}` : numero(n);
}

const PERIODOS = { manha: 'manhã', tarde: 'tarde', noite: 'noite' } as const;

export function momento(m: MomentoPrompt): string {
  return `dia ${m.dia}, ${PERIODOS[m.periodo]}`;
}

export function secao(titulo: string, linhas: (string | null | undefined | false)[]): string {
  const corpo = linhas.filter((l): l is string => typeof l === 'string' && l !== '');
  return `${titulo}\n${corpo.length > 0 ? corpo.join('\n') : 'nada'}`;
}

/** Monta o prompt de usuário: a linha `JOB: <nome>` e as seções, separadas por linha em branco. */
export function montarUsuario(job: NomeJob, partes: (string | null | undefined | false)[]): string {
  const corpo = partes.filter((p): p is string => typeof p === 'string' && p !== '');
  return `JOB: ${job}\n\n${corpo.join('\n\n')}\n`;
}

export function linhaJogador(j: JogadorPrompt): string {
  const atributos = `fama ${j.fama} · carisma ${j.carisma} · polêmica ${j.polemica} · ${numero(j.seguidores)} seguidores`;
  return `${pessoa(j)} · ${atributos}`;
}

export function secaoJogador(j: JogadorPrompt): string {
  return secao('JOGADOR', [
    linhaJogador(j),
    j.descricao ? `bio: ${aspas(j.descricao, 200)}` : null,
  ]);
}

export function linhaRelacao(r: RelacaoPrompt | null | undefined): string | null {
  if (!r) return null;
  const vinculo = r.tipoVinculo ? `${r.tipoVinculo}, ` : '';
  return `relação com o jogador: ${vinculo}afinidade ${r.afinidade} de 100 (${r.rotulo})`;
}

export function blocoReator(r: ReatorPrompt): string {
  const cabeca = [pessoa(r), r.papel, r.motivo ? `motivo: ${limpar(r.motivo, 80)}` : null]
    .filter(Boolean)
    .join(' · ');
  const memorias = (r.memorias ?? []).map((m) => limpar(m, 300)).filter(Boolean);
  return [
    cabeca,
    linhaRelacao(r.relacao),
    `ficha: ${limpar(r.ficha, 700)}`,
    memorias.length > 0 ? `lembra do jogador: ${memorias.join('; ')}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

export function secaoReatores(titulo: string, reatores: ReatorPrompt[]): string {
  return `${titulo}\n${reatores.length > 0 ? reatores.map(blocoReator).join('\n\n') : 'nada'}`;
}

/** Números do motor. `pessoas` dá nome aos alvos `relacao:<id>`. */
export function secaoNumeros(
  titulo: string,
  n: NumerosMotor | null | undefined,
  pessoas: PessoaCurta[] = [],
): string | null {
  if (!n) return null;
  const nomes = new Map(pessoas.map((p) => [p.id, limpar(p.nome, 60)]));
  const linhas: string[] = [];
  if (n.seguidoresGanhos !== undefined) linhas.push(`- seguidores: ${sinal(n.seguidoresGanhos)}`);
  if (n.curtidas !== undefined) linhas.push(`- curtidas: ${numero(n.curtidas)}`);
  for (const d of n.deltas ?? []) {
    const nome = d.alvo.startsWith('relacao:') ? nomes.get(d.alvo.slice('relacao:'.length)) : null;
    linhas.push(`- ${d.alvo}${nome ? ` (afinidade com ${nome})` : ''}: ${sinal(d.valor)}`);
  }
  for (const [rotulo, valor] of Object.entries(n.outros ?? {})) {
    linhas.push(
      `- ${limpar(rotulo, 60)}: ${typeof valor === 'number' ? numero(valor) : limpar(valor, 60)}`,
    );
  }
  return linhas.length > 0 ? secao(titulo, linhas) : null;
}

export function secaoEstado(resumo: string | null | undefined): string {
  return secao('ESTADO DO MUNDO', [resumo ? limpar(resumo, 1200) : 'sem resumo ainda']);
}
