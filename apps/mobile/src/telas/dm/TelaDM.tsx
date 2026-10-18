import type { Conversa, Mensagem } from '@holofote/shared';
import { useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { ArrowLeft, Check, Ellipsis } from 'lucide-react-native';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View, type ScrollViewInstance } from 'react-native';
import Animated from 'react-native-reanimated';
import { tratarErroDeAcao } from '../../acoes/erros';
import {
  chaves,
  useConversas,
  useEnviarMensagem,
  useMensagens,
  useMundo,
} from '../../api/consultas';
import { useDigitando, useTempoReal } from '../../api/tempoReal';
import { primeiroNome } from '../../formatar';
import { diaDoMundo, diasEntre, horaMinuto } from '../../tempo';
import { useTema } from '../../tema/ProvedorTema';
import { Avatar } from '../../ui/Avatar';
import { BarraProgresso } from '../../ui/BarraProgresso';
import { BotaoSuave } from '../../ui/BotaoSuave';
import { Compositor } from '../../ui/Compositor';
import { EstadoTela } from '../../ui/EstadoTela';
import { Icone } from '../../ui/Icone';
import { ComEspacosDaTela, Tela } from '../../ui/Tela';
import { Texto } from '../../ui/Texto';
import { Verificado } from '../../ui/Verificado';
import { useAnimacoes } from '../animacao/animacoes';
import { ItemAnimado, useRegistroDeEntradas } from '../animacao/entradas';
import { Balao, BalaoDigitando } from './Balao';
import { TecladoEvitavel } from './TecladoEvitavel';

/** Intervalo que abre um novo separador "DIA 6 · 21:40" entre mensagens. */
const PAUSA_MS = 60 * 60_000;

type Item =
  | { tipo: 'separador'; chave: string; texto: string }
  | { tipo: 'mensagem'; chave: string; mensagem: Mensagem; trocaDeLado: boolean };

/** Separador no começo, depois de uma pausa longa ou na virada do dia; espaço extra ao trocar de lado. */
export function montarItens(mensagens: readonly Mensagem[], diaAtual: number | undefined): Item[] {
  const itens: Item[] = [];
  let anterior: Mensagem | undefined;
  for (const mensagem of mensagens) {
    const quando = new Date(mensagem.criadoEm);
    const novoBloco =
      !anterior ||
      quando.getTime() - new Date(anterior.criadoEm).getTime() > PAUSA_MS ||
      diasEntre(new Date(anterior.criadoEm), quando) !== 0;
    if (novoBloco) {
      const dia = diaDoMundo(mensagem.criadoEm, diaAtual);
      const hora = horaMinuto(mensagem.criadoEm);
      itens.push({
        tipo: 'separador',
        chave: `sep-${mensagem.id}`,
        texto: dia !== undefined ? `Dia ${dia} · ${hora}` : hora,
      });
    }
    itens.push({
      tipo: 'mensagem',
      chave: mensagem.id,
      mensagem,
      trocaDeLado: !novoBloco && !!anterior && anterior.minha !== mensagem.minha,
    });
    anterior = mensagem;
  }
  return itens;
}

/** "relação +2%" a partir do delta que o motor aplicou na última mensagem enviada. */
function textoEntrega(delta: number | undefined) {
  if (!delta) return 'Entregue';
  const valor = delta.toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  return `Entregue · relação ${delta > 0 ? '+' : ''}${valor}%`;
}

/**
 * 04 · Mensagem direta: conversa com um personagem; as respostas chegam aos poucos pelo WS.
 * Mensagem nova entra como balão: o do jogador sobe do compositor e cresce a partir do canto de
 * baixo à direita, o do personagem cresce a partir do canto à esquerda. A conversa que abre já
 * está no lugar, sem animar o histórico.
 */
export function TelaDM({ conversaId }: { conversaId: string }) {
  const cliente = useQueryClient();
  const { medidas } = useTema();
  const mensagens = useMensagens(conversaId);
  const conversas = useConversas();
  const mundo = useMundo();
  const enviar = useEnviarMensagem(conversaId);
  const digitando = useDigitando((s) => s.porAlvo[conversaId]);
  const [ultimoEnvio, setUltimoEnvio] = useState<{ id: string; delta?: number } | null>(null);
  const rolagem = useRef<ScrollViewInstance>(null);
  const jaRolou = useRef(false);

  const conversa = conversas.data?.find((c) => c.id === conversaId);
  const personagem = conversa?.personagem;
  const nome = personagem?.nome ?? 'Personagem';
  const jogador = mundo.data?.jogador;

  // O GET das mensagens zera as não lidas no servidor: a lista de conversas precisa saber.
  const carregou = mensagens.isSuccess;
  useEffect(() => {
    if (carregou) void cliente.invalidateQueries({ queryKey: chaves.conversas });
  }, [carregou, cliente]);

  // Mensagem nova com a tela aberta já está lida: relê a conversa para zerar no servidor.
  useTempoReal((evento) => {
    if (evento.tipo !== 'mensagem' || evento.mensagem.conversaId !== conversaId) return;
    if (evento.mensagem.minha) return;
    void mensagens.refetch().then(() => cliente.invalidateQueries({ queryKey: chaves.conversas }));
  });

  const itens = useMemo(
    () => montarItens(mensagens.data ?? [], mundo.data?.dia),
    [mensagens.data, mundo.data?.dia],
  );
  const animacoes = useAnimacoes();
  const idsDosItens = useMemo(() => itens.map((i) => i.chave), [itens]);
  const entradas = useRegistroDeEntradas(idsDosItens, { novos: 'fim', cascataInicial: 0 });
  const ultimaMinha = useMemo(
    () => [...(mensagens.data ?? [])].reverse().find((m) => m.minha)?.id,
    [mensagens.data],
  );

  const rolarParaFim = () => {
    rolagem.current?.scrollToEnd({ animated: jaRolou.current });
    jaRolou.current = true;
  };

  const aoEnviar = (texto: string) =>
    enviar.mutateAsync(texto).then(
      ({ mensagem, consequencia }) => {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        const delta = consequencia.deltas.find(
          (d) => personagem && d.alvo === `relacao:${personagem.id}`,
        )?.valor;
        setUltimoEnvio({ id: mensagem.id, delta });
      },
      (erro: unknown) => {
        tratarErroDeAcao(erro);
        throw erro;
      },
    );

  const cabecalho = <CabecalhoDM conversa={conversa} />;

  if (!mensagens.data) {
    return (
      <Tela cabecalho={cabecalho} rolavel={false}>
        {mensagens.isError ? (
          <EstadoTela
            tipo="erro"
            frase="Não deu para abrir a conversa."
            acao={{ rotulo: 'Tentar de novo', onPress: () => void mensagens.refetch() }}
          />
        ) : (
          <EstadoTela tipo="carregando" frase="Abrindo a conversa…" />
        )}
      </Tela>
    );
  }

  return (
    <TecladoEvitavel>
      <Tela
        cabecalho={cabecalho}
        rolagemPropria
        gap={0}
        rodape={
          <Compositor
            iniciais={jogador?.iniciais ?? ''}
            placeholder={`Mensagem para ${primeiroNome(nome)}…`}
            custo={1}
            enviando={enviar.isPending}
            onEnviar={aoEnviar}
          />
        }
      >
        <ComEspacosDaTela>
          {(espacos) => (
            <ScrollView
              ref={rolagem}
              // A rolagem ocupa a tela toda, por baixo do cabeçalho e do compositor flutuantes, para
              // a sombra dos balões não ser cortada; os espaços da Tela evitam esconder a 1ª e a última.
              style={estilos.rolagem}
              scrollIndicatorInsets={{ top: espacos.topo, bottom: espacos.base }}
              contentContainerStyle={[
                estilos.mensagens,
                {
                  paddingHorizontal: medidas.margemLateral,
                  paddingTop: espacos.topo,
                  paddingBottom: espacos.base,
                },
              ]}
              keyboardShouldPersistTaps="handled"
              onContentSizeChange={rolarParaFim}
              onLayout={rolarParaFim}
            >
              {itens.length === 0 && (
                <Texto cor="textoSuave" style={estilos.vazio}>
                  Nenhuma mensagem ainda. Escreva a primeira para {primeiroNome(nome)}.
                </Texto>
              )}
              {itens.map((item) =>
                item.tipo === 'separador' ? (
                  <ItemAnimado
                    key={item.chave}
                    registro={entradas}
                    id={item.chave}
                    comLayout={false}
                    comSaida={false}
                    style={estilos.separador}
                  >
                    <Texto estilo="mini" cor="textoSuave">
                      {item.texto}
                    </Texto>
                  </ItemAnimado>
                ) : (
                  <Fragment key={item.chave}>
                    <ItemAnimado
                      registro={entradas}
                      id={item.chave}
                      tipoDeNovo={item.mensagem.minha ? 'balaoMeu' : 'balaoDela'}
                      comLayout={false}
                      comSaida={false}
                      style={[
                        item.trocaDeLado && estilos.trocaDeLado,
                        item.mensagem.minha ? estilos.origemDireita : estilos.origemEsquerda,
                      ]}
                    >
                      <Balao
                        texto={item.mensagem.texto}
                        minha={item.mensagem.minha}
                        autor={item.mensagem.minha ? 'Você' : nome}
                      />
                    </ItemAnimado>
                    {ultimoEnvio?.id === item.mensagem.id && ultimaMinha === item.mensagem.id && (
                      <Animated.View
                        entering={animacoes.deSubida(180)}
                        style={estilos.entrega}
                        accessible
                      >
                        <Icone icone={Check} tamanho={12} cor="destaqueTinta" traco={2} />
                        <Texto estilo="legenda" cor="destaqueTinta">
                          {textoEntrega(ultimoEnvio.delta)}
                        </Texto>
                      </Animated.View>
                    )}
                  </Fragment>
                ),
              )}
              {(digitando ?? []).map((p) => (
                <BalaoDigitando key={p.id} nome={p.nome} style={estilos.trocaDeLado} />
              ))}
            </ScrollView>
          )}
        </ComEspacosDaTela>
      </Tela>
    </TecladoEvitavel>
  );
}

/** Topo da 04: voltar, avatar, nome com selo e a relação atual (rótulo e afinidade). */
function CabecalhoDM({ conversa }: { conversa: Conversa | undefined }) {
  const personagem = conversa?.personagem;
  const relacao = conversa?.relacao;
  const rotulo = [
    personagem?.nome,
    personagem?.verificado ? 'verificado' : undefined,
    relacao ? `${relacao.rotulo}, afinidade ${relacao.afinidade}%` : undefined,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <View style={estilos.topo}>
      <BotaoSuave icone={ArrowLeft} rotulo="Voltar" onPress={() => router.back()} />
      {personagem && (
        <Avatar iniciais={personagem.iniciais} tom={personagem.tomAvatar} nome={personagem.nome} />
      )}
      <View
        style={estilos.identidade}
        accessible
        accessibilityRole="header"
        accessibilityLabel={rotulo || 'Mensagem direta'}
      >
        <View style={estilos.nome}>
          <Texto estilo="corpoForte" numberOfLines={1} style={estilos.encolher}>
            {personagem?.nome ?? 'Mensagem direta'}
          </Texto>
          {personagem?.verificado && <Verificado />}
        </View>
        {relacao && (
          <View style={estilos.relacao}>
            <View style={estilos.barra}>
              <BarraProgresso altura={5} valor={relacao.afinidade / 100} rotulo="Afinidade" />
            </View>
            <Texto estilo="legenda" cor="textoSuave" numberOfLines={1} style={estilos.encolher}>
              {relacao.rotulo} · {relacao.afinidade}%
            </Texto>
          </View>
        )}
      </View>
      {personagem && (
        <BotaoSuave
          icone={Ellipsis}
          rotulo={`Ver perfil de ${personagem.nome}`}
          onPress={() => router.push(`/personagem/${personagem.id}`)}
        />
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  topo: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44 },
  identidade: { flex: 1, gap: 4 },
  nome: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  encolher: { flexShrink: 1 },
  relacao: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barra: { width: 40 },
  rolagem: { flex: 1 },
  mensagens: { paddingTop: 18, paddingBottom: 8, gap: 6 },
  separador: { alignItems: 'center', paddingBottom: 8 },
  trocaDeLado: { paddingTop: 8 },
  origemDireita: { transformOrigin: 'right bottom' },
  origemEsquerda: { transformOrigin: 'left bottom' },
  entrega: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
    paddingTop: 2,
  },
  vazio: { textAlign: 'center', paddingVertical: 24 },
});
