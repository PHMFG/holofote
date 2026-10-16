import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Bug, Clock, Crown, Gem, Tv, Zap } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { tratarErroDeAcao } from '../../acoes/erros';
import { useConta, useEnergia, useRecarga } from '../../api/consultas';
import { Esfera, corSobreEsfera } from '../../ui/Esfera';
import { Folha, OpcaoFolha, type OpcaoFolhaProps } from '../../ui/Folha';
import { Icone } from '../../ui/Icone';
import { Texto } from '../../ui/Texto';
import { Tocavel } from '../../ui/Tocavel';
import { useAgora } from '../../tempo';
import { CUSTO_DESFAZER } from '../../acoes/custos';
import { msAteRecarga, textoMinutos } from './tempo';

/** Duração do anúncio simulado (o MVP não tem rede de anúncios: docs/DECISOES.md). */
export const DURACAO_ANUNCIO_MS = 2000;

type Via = 'gemas' | 'anuncio' | 'debug';

const fechar = () => router.back();

/** 19 · Sem energia (Figma 56:1534 claro, 58:2440 escuro), apresentada como folha de baixo (modal transparente). */
export function TelaSemEnergia() {
  const energia = useEnergia();
  const conta = useConta();
  const recarga = useRecarga();
  const agora = useAgora(1000);
  const [assistindo, setAssistindo] = useState(false);
  const anuncio = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(anuncio.current), []);

  const estado = energia.data ?? conta.data?.energia;
  // Os números da recarga vêm do motor (`regras`), não de constantes do app.
  const regras = estado?.regras;
  const plano = estado?.plano ?? conta.data?.plano ?? 'free';
  const gemas = conta.data?.gemas;
  const contaPronta = !!conta.data;
  const anunciosRestantes = conta.data?.anunciosRestantesHoje;
  const ms = estado ? msAteRecarga(estado.proximaEm, agora) : null;
  const cheia = !!estado && estado.atual >= estado.max;
  const ocupado = recarga.isPending || assistindo;

  const recarregar = (via: Via) =>
    recarga.mutate(via, {
      onSuccess: () => {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.back();
      },
      onError: tratarErroDeAcao,
    });

  const verAnuncio = () => {
    // Toque duplo ou outra recarga em andamento: um anúncio só.
    if (ocupado || anuncio.current !== undefined) return;
    setAssistindo(true);
    anuncio.current = setTimeout(() => {
      anuncio.current = undefined;
      recarregar('anuncio');
      setAssistindo(false);
    }, DURACAO_ANUNCIO_MS);
  };

  // Relógio do aparelho adiantado em relação ao servidor: sem tempo positivo, não promete minutos
  // ("1 min" congelado); a energia é relida sozinha (useEnergia) e a contagem volta ao normal.
  const proxima = ms !== null && ms > 0 ? textoMinutos(ms) : null;
  const naoEspera = proxima ?? 'instantes';
  let descricao: string;
  if (!estado) descricao = 'Carregando sua energia…';
  else if (cheia)
    descricao = `Sua barra está cheia. Postar, responder e mandar mensagem custam 1; campanha custa 1 ou 2 e desfazer custa ${CUSTO_DESFAZER}.`;
  else if (estado.atual === 0)
    descricao = `A próxima carga chega em ${naoEspera}. Enquanto isso, o mundo segue e as reações ao que você já fez continuam chegando.`;
  else descricao = `A próxima carga chega em ${naoEspera}.`;

  const semAnuncios = anunciosRestantes === 0;
  const gemasInsuficientes = !regras || gemas === undefined || gemas < regras.gemasParaEncher;
  const comAnuncio = plano !== 'plus' && (regras?.anunciosPorDia ?? 1) > 0;
  const subtituloAnuncio =
    !regras || anunciosRestantes === undefined
      ? 'Carregando…'
      : semAnuncios
        ? `+${regras.anuncioEnergia} de energia · volta amanhã`
        : `+${regras.anuncioEnergia} de energia · ${anunciosRestantes === 1 ? 'resta 1' : `restam ${anunciosRestantes}`} hoje`;

  return (
    <Folha>
      <Esfera tom="escuro" tamanho={60}>
        <Icone icone={Zap} tamanho={27} cor={corSobreEsfera('escuro')} traco={3.6} />
      </Esfera>
      {estado && estado.atual === 0 ? (
        <Texto estilo="titulo" accessibilityRole="header" style={estilos.centro}>
          Sua energia acabou
        </Texto>
      ) : (
        <View
          style={estilos.titulo}
          accessible
          accessibilityRole="header"
          accessibilityLabel={estado ? `Energia, ${estado.atual} de ${estado.max}` : 'Energia'}
        >
          <Texto estilo="titulo">Energia</Texto>
          {estado && (
            <Texto estilo="numero" cor="destaqueTinta">
              {estado.atual} de {estado.max}
            </Texto>
          )}
        </View>
      )}
      <Texto cor="textoSuave" style={estilos.centro} accessibilityLiveRegion="polite">
        {descricao}
      </Texto>

      <View style={estilos.opcoes}>
        <OpcaoFolha
          icone={Clock}
          titulo="Esperar recarga"
          subtitulo={regras ? `+1 a cada ${regras.recargaMin} min · grátis` : 'Carregando…'}
          valor={cheia ? 'cheia' : (proxima ?? undefined)}
        />
        {comAnuncio && (
          <Opcao
            icone={Tv}
            titulo={assistindo ? 'Assistindo anúncio…' : 'Ver um anúncio'}
            subtitulo={subtituloAnuncio}
            valor={regras ? `+${regras.anuncioEnergia}` : undefined}
            desabilitada={!contaPronta || semAnuncios || cheia || ocupado}
            aoTocar={verAnuncio}
          />
        )}
        <Opcao
          icone={Gem}
          titulo={regras ? `Usar ${regras.gemasParaEncher} gemas` : 'Usar gemas'}
          subtitulo={gemas === undefined ? 'Enche tudo' : `Enche tudo · você tem ${gemas}`}
          valor={regras ? String(regras.gemasParaEncher) : undefined}
          desabilitada={gemasInsuficientes || cheia || ocupado}
          aoTocar={() => recarregar('gemas')}
        />
        {plano !== 'plus' && (
          // Desabilitada durante uma recarga: o anúncio que termina fecharia a tela do Plus.
          <Opcao
            icone={Crown}
            titulo="Holofote Plus"
            subtitulo="Energia em dobro e sem anúncios"
            destaque
            desabilitada={ocupado}
            aoTocar={() => router.push('/plus')}
          />
        )}
        <Opcao
          icone={Bug}
          titulo="Recarregar (debug)"
          subtitulo="Enche a barra na hora, sem custo"
          desabilitada={ocupado}
          aoTocar={() => recarregar('debug')}
        />
      </View>

      <Tocavel
        onPress={fechar}
        accessibilityRole="button"
        accessibilityLabel="Agora não"
        hitSlop={8}
      >
        <Texto estilo="corpoForte" cor="textoSuave">
          Agora não
        </Texto>
      </Tocavel>
    </Folha>
  );
}

/**
 * OpcaoFolha que pode ficar desabilitada: o VoiceOver lê "esmaecido" e o toque não faz nada.
 * A OpcaoFolha sem onPress vira texto; o invólucro dá o papel de botão e o estado. A ação chega
 * como `aoTocar` para nenhum onPress ficar pendurado na árvore quando desabilitada.
 */
function Opcao({
  desabilitada,
  aoTocar,
  ...props
}: Omit<OpcaoFolhaProps, 'onPress'> & { aoTocar: () => void; desabilitada?: boolean }) {
  if (!desabilitada) return <OpcaoFolha {...props} onPress={aoTocar} />;
  return (
    <View
      accessible
      accessibilityRole="button"
      accessibilityLabel={[props.titulo, props.subtitulo, props.valor].filter(Boolean).join(', ')}
      accessibilityState={{ disabled: true }}
      style={estilos.desabilitada}
    >
      <OpcaoFolha {...props} />
    </View>
  );
}

const estilos = StyleSheet.create({
  centro: { textAlign: 'center' },
  titulo: { alignItems: 'center', gap: 2 },
  opcoes: { alignSelf: 'stretch', gap: 8 },
  desabilitada: { alignSelf: 'stretch', opacity: 0.5 },
});
