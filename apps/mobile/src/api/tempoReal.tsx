import { EventoTempoReal, type Consequencia, type PersonagemResumo } from '@holofote/shared';
import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';
import { create } from 'zustand';
import { useCartoes } from './cartoes';
import { garantirToken } from './cliente';
import { WS_URL } from './config';
import { adicionarMensagem, chaves } from './consultas';

type Ouvinte = (evento: EventoTempoReal) => void;

/** Quem está "digitando" agora, por conversa ou por post; some sozinho depois de alguns segundos. */
interface EstadoDigitando {
  porAlvo: Record<string, PersonagemResumo[]>;
  marcar: (alvo: string, personagem: PersonagemResumo) => void;
  limpar: (alvo: string, personagemId: string) => void;
}

const DURACAO_DIGITANDO_MS = 8000;

export const useDigitando = create<EstadoDigitando>((set) => ({
  porAlvo: {},
  marcar: (alvo, personagem) =>
    set((s) => ({
      porAlvo: {
        ...s.porAlvo,
        [alvo]: [...(s.porAlvo[alvo] ?? []).filter((p) => p.id !== personagem.id), personagem],
      },
    })),
  limpar: (alvo, personagemId) =>
    set((s) => ({
      porAlvo: {
        ...s.porAlvo,
        [alvo]: (s.porAlvo[alvo] ?? []).filter((p) => p.id !== personagemId),
      },
    })),
}));

const ContextoTempoReal = createContext<{ ouvir: (fn: Ouvinte) => () => void } | null>(null);

/** Um temporizador por (alvo, personagem): um aviso novo renova a contagem em vez de somar outra. */
const temporizadoresDigitando = new Map<string, ReturnType<typeof setTimeout>>();

function limparDigitando(alvo: string, personagemId: string) {
  const chave = `${alvo}:${personagemId}`;
  clearTimeout(temporizadoresDigitando.get(chave));
  temporizadoresDigitando.delete(chave);
  useDigitando.getState().limpar(alvo, personagemId);
}

function marcarDigitando(alvo: string, personagem: PersonagemResumo) {
  const chave = `${alvo}:${personagem.id}`;
  clearTimeout(temporizadoresDigitando.get(chave));
  useDigitando.getState().marcar(alvo, personagem);
  temporizadoresDigitando.set(
    chave,
    setTimeout(() => limparDigitando(alvo, personagem.id), DURACAO_DIGITANDO_MS),
  );
}

/** Aplica no cache o efeito global de cada evento; as telas ouvem o resto (ex.: contagem de novos posts). */
export function aplicarNoCache(cliente: QueryClient, evento: EventoTempoReal) {
  const invalidar = (...chavesAfetadas: readonly (readonly unknown[])[]) => {
    for (const queryKey of chavesAfetadas) void cliente.invalidateQueries({ queryKey });
  };
  switch (evento.tipo) {
    case 'energia':
      cliente.setQueryData(chaves.energia, evento.energia);
      invalidar(chaves.conta);
      break;
    case 'alerta':
      invalidar(chaves.alertas);
      // O resumo do dia muda o dia e o período do mundo: relê o mundo e o próprio resumo.
      if (evento.alerta.tipo === 'resumo') invalidar(chaves.mundo, chaves.resumo);
      // Marco liberado pode trazer personagem novo.
      if (evento.alerta.tipo === 'marco') invalidar(chaves.relacoes, chaves.jornada);
      break;
    case 'mensagem': {
      const { mensagem } = evento;
      adicionarMensagem(cliente, mensagem);
      for (const p of useDigitando.getState().porAlvo[mensagem.conversaId] ?? []) {
        limparDigitando(mensagem.conversaId, p.id);
      }
      invalidar(chaves.conversas);
      break;
    }
    case 'post': {
      const { post } = evento;
      // Uma história nova muda a fileira do topo do feed.
      if (post.tipo === 'historia') invalidar(chaves.feed);
      if (post.respondeA) {
        limparDigitando(post.respondeA, post.autor.id);
        // A thread se atualiza sozinha (não há aviso de "novas respostas"); o resto muda com a
        // contagem de respostas e com a relação de quem respondeu.
        invalidar(
          chaves.post(post.respondeA),
          ['thread'],
          chaves.feed,
          chaves.relacoes,
          chaves.conversas,
          chaves.personagem(post.autor.id),
        );
      }
      break;
    }
    case 'cartao':
      useCartoes.getState().guardar(evento.eventoId, evento.cartao);
      cliente.setQueryData(chaves.consequencia(evento.eventoId), (c: Consequencia | undefined) =>
        c ? { ...c, cartao: evento.cartao, reacoesPendentes: 0 } : c,
      );
      // O cartão fecha a reação da IA: os deltas de relação já gravados no motor aparecem.
      invalidar(chaves.registro, chaves.relacoes, ['personagem']);
      break;
    case 'mundo':
      cliente.setQueryData(chaves.mundo, evento.mundo);
      // Pronto: o feed inicial chegou. Também é o aviso de ato novo: a jornada passa a ser a nova.
      if (evento.mundo.estado === 'pronto') invalidar(chaves.feed, chaves.jornada);
      break;
    case 'evento':
      cliente.setQueryData(chaves.evento(evento.evento.id), evento.evento);
      invalidar(chaves.jornada);
      break;
    case 'digitando': {
      const alvo = evento.conversaId ?? evento.postId;
      if (alvo) marcarDigitando(alvo, evento.personagem);
      break;
    }
  }
}

/**
 * Mantém o WebSocket aberto do mundo `mundoId` enquanto o app está ativo, com reconexão de espera
 * crescente. O servidor liga o socket ao canal do mundo no momento da conexão: trocar de mundo
 * (criar ou recomeçar) fecha o socket e abre outro. Sem `mundoId`, fica fechado.
 */
export function ProvedorTempoReal({
  children,
  mundoId,
}: {
  children: ReactNode;
  mundoId: string | undefined;
}) {
  const cliente = useQueryClient();
  // Conjunto estável de ouvintes; useState evita ler ref durante o render.
  const [ouvintes] = useState(() => new Set<Ouvinte>());
  const [emPrimeiroPlano, setEmPrimeiroPlano] = useState(AppState.currentState === 'active');
  // Mundo da última conexão aberta: reabrir para o mesmo mundo relê tudo; o primeiro não precisa.
  const abriuPara = useRef<string | null>(null);

  useEffect(() => {
    const assinatura = AppState.addEventListener('change', (estado) => {
      setEmPrimeiroPlano(estado === 'active');
      // O dia e o período do mundo andam com o relógio, não só com eventos.
      if (estado === 'active') void cliente.invalidateQueries({ queryKey: chaves.mundo });
    });
    return () => assinatura.remove();
  }, [cliente]);

  useEffect(() => {
    if (!mundoId || !emPrimeiroPlano) return;
    let socket: WebSocket | null = null;
    let encerrado = false;
    let tentativas = 0;
    let espera: ReturnType<typeof setTimeout> | undefined;

    const tentarDeNovo = () => {
      if (encerrado) return;
      tentativas += 1;
      espera = setTimeout(() => void conectar(), Math.min(30_000, 1000 * 2 ** tentativas));
    };

    const conectar = async () => {
      try {
        const token = await garantirToken();
        if (encerrado) return;
        socket = new WebSocket(`${WS_URL}/v1/tempo-real?token=${encodeURIComponent(token)}`);
        socket.onopen = () => {
          tentativas = 0;
          // Ao voltar, o que chegou com o socket fechado entra pelas consultas.
          if (abriuPara.current === mundoId) void cliente.invalidateQueries();
          abriuPara.current = mundoId;
        };
        socket.onmessage = (mensagem) => {
          let bruto: unknown;
          try {
            bruto = JSON.parse(String(mensagem.data));
          } catch {
            return;
          }
          const evento = EventoTempoReal.safeParse(bruto);
          if (!evento.success) return;
          aplicarNoCache(cliente, evento.data);
          ouvintes.forEach((fn) => fn(evento.data));
        };
        socket.onclose = tentarDeNovo;
      } catch {
        // Sem rede ou sem token agora: tenta de novo com a espera crescente.
        tentarDeNovo();
      }
    };

    void conectar();
    return () => {
      encerrado = true;
      clearTimeout(espera);
      socket?.close();
    };
  }, [mundoId, emPrimeiroPlano, cliente, ouvintes]);

  const [valor] = useState(() => ({
    ouvir: (fn: Ouvinte) => {
      ouvintes.add(fn);
      return () => {
        ouvintes.delete(fn);
      };
    },
  }));

  return <ContextoTempoReal.Provider value={valor}>{children}</ContextoTempoReal.Provider>;
}

/** Ouve eventos de tempo real dentro de uma tela (ex.: contar "novas respostas"). */
export function useTempoReal(fn: Ouvinte) {
  const contexto = useContext(ContextoTempoReal);
  const atual = useRef(fn);
  useEffect(() => {
    atual.current = fn;
  });
  useEffect(() => contexto?.ouvir((evento) => atual.current(evento)), [contexto]);
}
