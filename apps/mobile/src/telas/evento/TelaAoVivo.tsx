import type { Consequencia, Conta, EventoAgendado, Post } from '@holofote/shared';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Check, Gem, Lock, Radio, Trophy } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, ActivityIndicator, StyleSheet, View } from 'react-native';
import { tratarErroDeAcao } from '../../acoes/erros';
import { ErroDaApi } from '../../api/cliente';
import { useConsequencia, useConta, useDiscurso, useEvento } from '../../api/consultas';
import { useTempoReal } from '../../api/tempoReal';
import { efeitosDosDeltas, formatarNumero } from '../../formatar';
import { voltarOuInicio } from '../../navegacao';
import { useTema } from '../../tema/ProvedorTema';
import { Avatar } from '../../ui/Avatar';
import { BarraProgresso } from '../../ui/BarraProgresso';
import { BotaoMetal } from '../../ui/BotaoMetal';
import { Cabecalho } from '../../ui/Cabecalho';
import { Camada } from '../../ui/Camada';
import { Cartao } from '../../ui/Cartao';
import { Chip } from '../../ui/Chip';
import { Esfera, corSobreEsfera } from '../../ui/Esfera';
import { EstadoTela } from '../../ui/EstadoTela';
import { Icone } from '../../ui/Icone';
import { Rotulo, RotuloSecao } from '../../ui/Rotulo';
import { Tela } from '../../ui/Tela';
import { Texto } from '../../ui/Texto';
import { Tocavel } from '../../ui/Tocavel';
import type { OpcaoDiscurso } from './formatar';
import { DISCURSO } from './icones';
import { relogio, useSegundosRestantes } from './relogio';

/** Tempo de escolha do ao vivo (docs/PLANO.md, eventos agendados). */
const PRAZO_SEGUNDOS = 30;
/** Marcos em que o VoiceOver anuncia o tempo; não anuncia a cada segundo. */
const AVISOS = [20, 10, 5];

interface Resultado {
  evento: EventoAgendado;
  consequencia: Consequencia;
  /**
   * Conta antes do discurso. A consequência não traz as gemas do prêmio; a diferença sai quando
   * a conta for relida (o useDiscurso invalida a conta).
   */
  contaAntes: Conta | undefined;
}

/**
 * 17 · Evento ao vivo (Figma 55:1554 claro, 58:2263 escuro), modal em tela cheia: 30 segundos
 * a partir de `prazoAoVivo` para escolher o discurso. O motor sorteia o vencedor e devolve os
 * números na hora; a reação do mundo, escrita pela IA, chega depois pelo tempo real.
 */
export function TelaAoVivo({ id }: { id: string }) {
  const evento = useEvento(id);
  const conta = useConta();
  const discurso = useDiscurso(id);
  const [escolha, setEscolha] = useState<OpcaoDiscurso | null>(null);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [plateia, setPlateia] = useState<Post[]>([]);

  const e = evento.data;
  const aoVivo = e?.estado === 'ao_vivo' && !resultado;
  const restante = useSegundosRestantes(aoVivo ? (e?.prazoAoVivo ?? null) : null, PRAZO_SEGUNDOS);
  const acabou = restante === 0;
  // Esgotado o tempo, só o seguro continua valendo; uma escolha ousada pendente é desfeita.
  const escolhaValida = acabou && escolha !== 'seguro' ? null : escolha;

  useAvisosDoCronometro(aoVivo ? restante : null);

  // Depois do discurso, o que chega ao feed é a plateia reagindo.
  useTempoReal((ev) => {
    if (!resultado || ev.tipo !== 'post') return;
    setPlateia((atual) =>
      atual.some((p) => p.id === ev.post.id) ? atual : [ev.post, ...atual].slice(0, 5),
    );
  });

  const cabecalho = (
    <Cabecalho
      navegacao="fechar"
      titulo={e?.titulo ?? 'Ao vivo'}
      direita={
        e?.estado === 'ao_vivo' || resultado ? (
          <Chip rotulo="AO VIVO" variante="destaque" icone={Radio} />
        ) : undefined
      }
    />
  );

  if (!e) {
    return (
      <Tela cabecalho={cabecalho} rolavel={false}>
        {evento.isError ? (
          <EstadoTela
            tipo="erro"
            frase={
              evento.error instanceof ErroDaApi && evento.error.codigo === 'nao_encontrado'
                ? 'Este evento não existe mais.'
                : 'Não deu para entrar ao vivo.'
            }
            acao={{ rotulo: 'Tentar de novo', onPress: () => void evento.refetch() }}
          />
        ) : (
          <EstadoTela tipo="carregando" frase="Entrando ao vivo…" />
        )}
      </Tela>
    );
  }

  if (!resultado && (e.estado === 'anunciado' || e.estado === 'campanha')) {
    return (
      <Tela cabecalho={cabecalho} rolavel={false}>
        <EstadoTela
          tipo="vazio"
          frase="O evento ainda não começou. A campanha continua aberta."
          acao={{ rotulo: 'Voltar', onPress: voltarOuInicio }}
        />
      </Tela>
    );
  }

  const subir = () => {
    if (!escolhaValida) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const contaAntes = conta.data;
    discurso.mutate(escolhaValida, {
      onSuccess: (r) => {
        const venceu = r.evento.vencedor?.papel === 'jogador';
        void Haptics.notificationAsync(
          venceu
            ? Haptics.NotificationFeedbackType.Success
            : Haptics.NotificationFeedbackType.Warning,
        );
        setResultado({ ...r, contaAntes });
        AccessibilityInfo.announceForAccessibility(
          venceu ? 'Você venceu.' : `${r.evento.vencedor?.nome ?? 'Outra pessoa'} venceu.`,
        );
      },
      onError: tratarErroDeAcao,
    });
  };

  const exibido = resultado?.evento ?? e;
  const verFeed = () => router.dismissTo('/');

  return (
    <Tela
      cabecalho={cabecalho}
      gap={14}
      rodape={
        resultado || e.estado === 'encerrado' ? (
          <BotaoMetal rotulo="Ver o feed" onPress={verFeed} />
        ) : (
          <BotaoMetal
            rotulo="Subir ao palco"
            disabled={!escolhaValida || discurso.isPending}
            onPress={subir}
          />
        )
      }
    >
      <Palco evento={exibido} consequencia={resultado?.consequencia} />

      {resultado ? (
        <ResultadoDoDiscurso
          resultado={resultado}
          contaAgora={conta.data !== resultado.contaAntes ? conta.data : undefined}
          plateia={plateia}
        />
      ) : e.estado === 'encerrado' ? (
        <Texto cor="textoSuave" style={estilos.centro}>
          Este evento já acabou.
        </Texto>
      ) : (
        <>
          <Cronometro restante={restante} />
          {acabou && (
            <Texto estilo="legenda" cor="destaqueTinta" accessibilityRole="alert">
              O tempo acabou, mas o discurso seguro continua disponível.
            </Texto>
          )}
          {e.discurso.map((opcao) => {
            const visual = DISCURSO[opcao.id];
            const esgotado = acabou && opcao.id !== 'seguro';
            const liberada = opcao.liberada && !esgotado;
            const motivo = esgotado ? 'O tempo acabou.' : opcao.motivo;
            return (
              <OpcaoDeDiscurso
                key={opcao.id}
                titulo={opcao.titulo}
                detalhe={liberada ? visual.descricao : (motivo ?? 'Ainda bloqueado.')}
                icone={visual}
                liberada={liberada}
                selecionada={escolhaValida === opcao.id}
                realce={acabou && opcao.id === 'seguro'}
                onPress={
                  liberada && !discurso.isPending
                    ? () => {
                        void Haptics.selectionAsync();
                        setEscolha(opcao.id);
                      }
                    : undefined
                }
              />
            );
          })}
        </>
      )}
    </Tela>
  );
}

/** Anuncia o tempo restante nos marcos de 20, 10 e 5 segundos e quando acaba. */
function useAvisosDoCronometro(restante: number | null) {
  const anunciados = useRef(new Set<number>());
  useEffect(() => {
    if (restante === null || anunciados.current.has(restante)) return;
    if (restante === 0) {
      anunciados.current.add(0);
      AccessibilityInfo.announceForAccessibility(
        'O tempo acabou. O discurso seguro continua disponível.',
      );
      return;
    }
    if (AVISOS.includes(restante)) {
      anunciados.current.add(restante);
      AccessibilityInfo.announceForAccessibility(`Faltam ${restante} segundos para escolher.`);
    }
  }, [restante]);
}

/** Barra chapada de 4 e "decida em 0:24" (55:1596 e 55:1600). */
function Cronometro({ restante }: { restante: number | null }) {
  const valor = restante === null ? 1 : restante / PRAZO_SEGUNDOS;
  const meta =
    restante === null
      ? undefined
      : restante > 0
        ? `decida em ${relogio(restante)}`
        : 'tempo esgotado';
  return (
    <>
      <RotuloSecao texto="Escolha seu discurso" meta={meta} />
      <BarraProgresso
        valor={valor}
        altura={4}
        variante="chapada"
        rotulo={
          restante === null
            ? 'Tempo para escolher'
            : restante > 0
              ? `Tempo para escolher, ${restante} segundos`
              : 'Tempo esgotado'
        }
      />
    </>
  );
}

/** Topo do palco (55:1588): categoria antes do discurso; o vencedor depois. */
function Palco({
  evento,
  consequencia,
}: {
  evento: EventoAgendado;
  consequencia: Consequencia | undefined;
}) {
  const vencedor = evento.estado === 'encerrado' ? evento.vencedor : null;
  const seguidores = consequencia?.seguidoresGanhos ?? 0;
  const detalhe = vencedor
    ? `${evento.categoria}${seguidores > 0 ? ` · +${formatarNumero(seguidores)} seguidores` : ''}`
    : 'O vencedor sai depois do seu discurso';
  return (
    <Cartao>
      <View
        style={estilos.palco}
        accessible
        accessibilityLabel={
          vencedor
            ? `O prêmio vai para ${vencedor.nome}. ${detalhe}`
            : `Categoria ${evento.categoria}. ${detalhe}`
        }
      >
        {vencedor ? (
          <Avatar iniciais={vencedor.iniciais} tom={vencedor.tomAvatar} tamanho={56} />
        ) : (
          <Esfera tom="escuro" tamanho={56}>
            <Icone icone={Trophy} tamanho={25} cor={corSobreEsfera('escuro')} traco={2} />
          </Esfera>
        )}
        <View style={estilos.textosPalco}>
          <Texto estilo="mini" cor="textoSuave">
            {vencedor ? 'E o prêmio vai para' : 'Categoria'}
          </Texto>
          <Texto estilo="titulo">{vencedor ? vencedor.nome : evento.categoria}</Texto>
          <Texto estilo="legenda" cor="destaqueTinta">
            {detalhe}
          </Texto>
        </View>
      </View>
    </Cartao>
  );
}

function OpcaoDeDiscurso(p: {
  titulo: string;
  detalhe: string;
  icone: (typeof DISCURSO)[OpcaoDiscurso];
  liberada: boolean;
  selecionada: boolean;
  realce: boolean;
  onPress?: () => void;
}) {
  const { cores, medidas } = useTema();
  const destaque = p.selecionada || p.realce;
  return (
    <Tocavel
      onPress={p.onPress}
      accessibilityRole="radio"
      accessibilityLabel={`Discurso ${p.titulo}, ${p.liberada ? p.detalhe : `bloqueado: ${p.detalhe}`}`}
      accessibilityState={{ checked: p.selecionada, disabled: !p.liberada }}
    >
      <Camada
        cor="superficie"
        sombra="elevacao"
        raio={medidas.cartaoRaio}
        borda={{ cor: destaque ? 'destaque' : 'superficie', largura: 2 }}
        style={estilos.opcao}
      >
        <Esfera tom={p.liberada ? p.icone.tom : 'claro'} tamanho={36}>
          <Icone
            icone={p.liberada ? p.icone.icone : Lock}
            tamanho={16}
            cor={p.liberada ? corSobreEsfera(p.icone.tom) : 'textoSuave'}
          />
        </Esfera>
        <View style={estilos.textosOpcao}>
          <View style={estilos.tituloOpcao}>
            <Texto estilo="corpoForte" cor={p.liberada ? 'texto' : 'textoSuave'}>
              {p.titulo}
            </Texto>
            {p.realce && <Rotulo texto="Disponível" variante="destaque" />}
          </View>
          <Texto estilo="legenda" cor={p.selecionada ? 'destaqueTinta' : 'textoSuave'}>
            {p.detalhe}
          </Texto>
        </View>
        {p.liberada ? (
          p.selecionada ? (
            <View style={[estilos.marca, { backgroundColor: cores.destaque }]}>
              <Icone icone={Check} tamanho={14} cor="destaqueSobre" traco={2} />
            </View>
          ) : (
            <View style={[estilos.marca, { borderWidth: 2, borderColor: cores.linha }]} />
          )
        ) : (
          <Icone icone={Lock} tamanho={16} cor="textoSuave" />
        )}
      </Camada>
    </Tocavel>
  );
}

function ResultadoDoDiscurso({
  resultado,
  contaAgora,
  plateia,
}: {
  resultado: Resultado;
  contaAgora: Conta | undefined;
  plateia: Post[];
}) {
  const { cores } = useTema();
  // O cartão da IA e o fim das reações pendentes chegam pelo tempo real na mesma chave.
  const aoVivo = useConsequencia(resultado.consequencia.eventoId);
  const consequencia = aoVivo.data ?? resultado.consequencia;
  const venceu = resultado.evento.vencedor?.papel === 'jogador';

  const nomes = new Map(
    resultado.evento.indicados.map((i) => [i.personagem.id, i.personagem.nome] as const),
  );
  const efeitos = efeitosDosDeltas(consequencia.deltas, nomes, { seguidores: true });
  const deltaGemas = consequencia.deltas.find((d) => d.alvo === 'gemas')?.valor;
  const gemas =
    deltaGemas ??
    (contaAgora && resultado.contaAntes
      ? contaAgora.gemas - resultado.contaAntes.gemas
      : undefined);
  const reagindo = !consequencia.cartao && consequencia.reacoesPendentes > 0;

  return (
    <>
      <Cartao style={estilos.resultado} accessibilityLiveRegion="polite">
        <Texto estilo="secao" accessibilityRole="header">
          {venceu ? 'Você venceu' : 'Não foi dessa vez'}
        </Texto>
        {gemas !== undefined && gemas > 0 ? (
          <View style={estilos.gemas} accessible accessibilityLabel={`Ganhou ${gemas} gemas`}>
            <Icone icone={Gem} tamanho={16} cor="destaqueTinta" traco={2} />
            <Texto estilo="corpoForte" cor="destaqueTinta">
              +{gemas} gemas
            </Texto>
          </View>
        ) : (
          <Texto estilo="legenda" cor="textoSuave">
            {venceu ? 'As gemas estão a caminho da sua conta.' : 'Sem gemas desta vez.'}
          </Texto>
        )}
        {efeitos.length > 0 && (
          <View style={estilos.efeitos}>
            {efeitos.map((efeito) => (
              <Chip
                key={efeito.chave}
                rotulo={efeito.texto}
                variante={efeito.direcao === 'sobe' ? 'suave' : 'afundado'}
                tamanho="pequeno"
              />
            ))}
          </View>
        )}
      </Cartao>

      {consequencia.cartao && (
        <Cartao style={estilos.resultado}>
          <Texto estilo="corpoForte">{consequencia.cartao.titulo}</Texto>
          <Texto cor="textoSuave">{consequencia.cartao.texto}</Texto>
        </Cartao>
      )}

      <RotuloSecao texto="Plateia" meta="reações em tempo real" corMeta="textoSuave" />
      <Cartao variante="afundado" style={estilos.plateia}>
        {plateia.length === 0 ? (
          <View style={estilos.reagindo} accessibilityLiveRegion="polite">
            {reagindo && (
              <ActivityIndicator
                size="small"
                color={cores.textoSuave}
                accessibilityLabel="Aguardando as reações"
              />
            )}
            <Texto estilo="legenda" cor="textoSuave">
              {reagindo ? 'O mundo está reagindo ao seu discurso…' : 'As reações aparecem no feed.'}
            </Texto>
          </View>
        ) : (
          plateia.map((post) => (
            <Texto key={post.id} estilo="legenda" cor="textoSuave" numberOfLines={2}>
              <Texto estilo="legenda">{post.autor.nome}</Texto> {post.texto}
            </Texto>
          ))
        )}
      </Cartao>
    </>
  );
}

const estilos = StyleSheet.create({
  centro: { textAlign: 'center' },
  palco: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  textosPalco: { flex: 1, gap: 2 },
  opcao: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  textosOpcao: { flex: 1, gap: 1 },
  tituloOpcao: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  marca: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  resultado: { gap: 8 },
  gemas: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  efeitos: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  plateia: { gap: 6, paddingHorizontal: 14, paddingVertical: 12 },
  reagindo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
