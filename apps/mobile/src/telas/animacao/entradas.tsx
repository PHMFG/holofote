// Entrada de itens de lista: a primeira carga entra em cascata, o que chega depois entra com
// deslize e o resto nunca anima de novo. Vale para listas que remontam itens ao rolar (FlashList)
// e para as que mantêm tudo montado (ScrollView): quem decide é um registro de ids já vistos.
import { useEffect, useState, type ComponentProps, type ReactNode } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import Animated from 'react-native-reanimated';
import { CASCATA } from '../../ui/movimento';
import { useAnimacoes } from './animacoes';

export type MarcaDeEntrada = { tipo: 'cascata'; indice: number } | { tipo: 'nova' };

export interface OpcoesDoRegistro {
  /**
   * Onde um item desconhecido conta como novo depois da primeira carga: no topo da lista
   * (feed, alertas), no fim (conversa) ou em qualquer lugar (respostas ordenadas por relevância).
   */
  novos?: 'topo' | 'fim' | 'qualquer';
  /** Quantos itens da primeira carga entram em cascata (os visíveis); o resto aparece quieto. */
  cascataInicial?: number;
}

/**
 * Guarda quais ids a tela já viu. `registrar` é idempotente (chamar de novo com os mesmos ids não
 * muda nada), então pode rodar a cada renderização. Cada item lê a sua marca ao montar e a
 * consome depois: remontar mais tarde (rolagem, reciclagem) não anima de novo.
 */
export class RegistroDeEntradas {
  private readonly conhecidos = new Set<string>();
  private readonly marcas = new Map<string, MarcaDeEntrada>();
  private primeiraCarga = true;
  private readonly novos: 'topo' | 'fim' | 'qualquer';
  private readonly cascataInicial: number;

  constructor(opcoes: OpcoesDoRegistro = {}) {
    this.novos = opcoes.novos ?? 'topo';
    this.cascataInicial = opcoes.cascataInicial ?? CASCATA.maxItens;
  }

  registrar(ids: readonly string[]): void {
    if (ids.length === 0) return;
    if (this.primeiraCarga) {
      this.primeiraCarga = false;
      ids.forEach((id, indice) => {
        this.conhecidos.add(id);
        if (indice < this.cascataInicial) this.marcas.set(id, { tipo: 'cascata', indice });
      });
      return;
    }
    const primeiro = ids.findIndex((id) => this.conhecidos.has(id));
    const ultimo = ids.findLastIndex((id) => this.conhecidos.has(id));
    ids.forEach((id, indice) => {
      if (this.conhecidos.has(id)) return;
      this.conhecidos.add(id);
      const nova =
        this.novos === 'qualquer' ||
        (this.novos === 'topo' && primeiro > 0 && indice < primeiro) ||
        (this.novos === 'fim' && ultimo >= 0 && indice > ultimo);
      if (nova) this.marcas.set(id, { tipo: 'nova' });
    });
  }

  marca(id: string): MarcaDeEntrada | undefined {
    return this.marcas.get(id);
  }

  consumir(id: string): void {
    this.marcas.delete(id);
  }
}

/** Registro da tela, atualizado com os ids na ordem em que a lista os mostra. */
export function useRegistroDeEntradas(
  ids: readonly string[],
  opcoes?: OpcoesDoRegistro,
): RegistroDeEntradas {
  const [registro] = useState(() => new RegistroDeEntradas(opcoes));
  registro.registrar(ids);
  return registro;
}

/** Como um item novo chega: de cima, de baixo ou como balão de mensagem. */
export type TipoDeNovo = 'topo' | 'subida' | 'balaoMeu' | 'balaoDela' | 'pop';

export interface ItemAnimadoProps {
  registro: RegistroDeEntradas;
  id: string;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Como um item novo entra (padrão: sobe com mola). */
  tipoDeNovo?: TipoDeNovo;
  /** Item sem marca também aparece com um fade curto (listas que não remontam ao rolar). */
  fadePadrao?: boolean;
  /** Os vizinhos acomodam quando este item muda de lugar ou de tamanho. */
  comLayout?: boolean;
  /** Fade ao sair. */
  comSaida?: boolean;
}

type Entrada = ComponentProps<typeof Animated.View>['entering'];

/** Bloco de uma lista com a entrada certa para o momento em que o item chegou. */
export function ItemAnimado({
  registro,
  id,
  children,
  style,
  tipoDeNovo = 'subida',
  fadePadrao = false,
  comLayout = true,
  comSaida = true,
}: ItemAnimadoProps) {
  const animacoes = useAnimacoes();
  // A marca é lida uma vez, na primeira renderização deste item, e consumida logo depois.
  const [marca] = useState(() => registro.marca(id));
  useEffect(() => {
    registro.consumir(id);
  }, [registro, id]);

  let entering: Entrada;
  if (marca?.tipo === 'cascata') entering = animacoes.entrada(marca.indice);
  else if (marca?.tipo === 'nova') entering = entradaDoNovo(animacoes, tipoDeNovo);
  else if (fadePadrao) entering = animacoes.fade();

  return (
    <Animated.View
      entering={entering}
      exiting={comSaida ? animacoes.saida : undefined}
      layout={comLayout ? animacoes.layout : undefined}
      style={style}
    >
      {children}
    </Animated.View>
  );
}

function entradaDoNovo(animacoes: ReturnType<typeof useAnimacoes>, tipo: TipoDeNovo): Entrada {
  switch (tipo) {
    case 'topo':
      return animacoes.doTopo();
    case 'balaoMeu':
      return animacoes.balao(true);
    case 'balaoDela':
      return animacoes.balao(false);
    case 'pop':
      return animacoes.pop();
    case 'subida':
      return animacoes.deSubida();
  }
}
