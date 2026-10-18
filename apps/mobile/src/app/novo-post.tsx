import type { Tom } from '@holofote/shared';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, KeyboardAvoidingView, StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { tratarErroDeAcao } from '../acoes/erros';
import { useMundo, usePrevia, usePublicar, useRelacoes } from '../api/consultas';
import { useAnimacoes } from '../telas/animacao/animacoes';
import { Pop } from '../telas/animacao/Pop';
import { CartaoPrevia } from '../telas/post/CartaoPrevia';
import { SucessoDePublicacao } from '../telas/post/SucessoDePublicacao';
import { Avatar } from '../ui/Avatar';
import { BotaoMetal } from '../ui/BotaoMetal';
import { Cabecalho } from '../ui/Cabecalho';
import { CampoTexto } from '../ui/CampoTexto';
import { Cartao } from '../ui/Cartao';
import { Chip } from '../ui/Chip';
import { DURACAO, useMovimento } from '../ui/movimento';
import { RotuloSecao } from '../ui/Rotulo';
import { Tela, type TrechoVisivel } from '../ui/Tela';
import { Texto } from '../ui/Texto';

const LIMITE = 280;
const MAX_MARCADOS = 3;
/** Espera depois da última tecla antes de pedir a prévia ao motor. */
const ESPERA_PREVIA_MS = 500;
/** Quanto o aviso de "Publicado" fica na tela antes de abrir o post. */
const ESPERA_SUCESSO_MS = 600;

const TONS: readonly { valor: Tom; rotulo: string }[] = [
  { valor: 'fofo', rotulo: 'Fofo' },
  { valor: 'sincero', rotulo: 'Sincero' },
  { valor: 'misterioso', rotulo: 'Misterioso' },
  { valor: 'provocativo', rotulo: 'Provocativo' },
];

/** 12 · Compor post (Figma 53:1293 e 58:1644), apresentado como modal. */
export default function NovoPost() {
  const mundo = useMundo();
  const relacoes = useRelacoes();
  const previa = usePrevia();
  const publicar = usePublicar();
  const [texto, setTexto] = useState('');
  const [tom, setTom] = useState<Tom>('sincero');
  const [marcados, setMarcados] = useState<string[]>([]);
  // Rota do post publicado: enquanto definida, o aviso de sucesso cobre a tela.
  const [aberto, setAberto] = useState<string | null>(null);
  const animacoes = useAnimacoes();
  const { reduzido, reduceMotion } = useMovimento();
  const tremor = useSharedValue(0);
  const estiloDoTremor = useAnimatedStyle(() => ({ transform: [{ translateX: tremor.value }] }));
  // Onde estão os chips de tom: com o teclado aberto a Tela rola até eles ficarem visíveis.
  const [trechoDoTom, setTrechoDoTom] = useState<TrechoVisivel | null>(null);

  const textoLimpo = texto.trim();
  const pedido = useMemo(() => ({ texto: textoLimpo, tom, marcados }), [textoLimpo, tom, marcados]);
  const { mutate: pedirPrevia } = previa;

  // A prévia é do motor (sem IA, custo 0): pede de novo a cada mudança, com espera curta.
  useEffect(() => {
    if (!pedido.texto) return;
    const espera = setTimeout(() => pedirPrevia(pedido), ESPERA_PREVIA_MS);
    return () => clearTimeout(espera);
  }, [pedido, pedirPrevia]);

  // O feedback de sucesso aparece e só então o post abre; sair da tela antes cancela a ida.
  useEffect(() => {
    if (!aberto) return;
    const espera = setTimeout(() => router.replace(aberto), reduzido ? 0 : ESPERA_SUCESSO_MS);
    return () => clearTimeout(espera);
  }, [aberto, reduzido]);

  const elenco = (relacoes.data?.nos ?? []).filter((no) => no.personagem.papel === 'elenco');
  const jogador = mundo.data?.jogador;
  const custo = previa.data?.custo ?? 1;

  const alternarMarcado = (id: string) => {
    if (marcados.includes(id)) {
      setMarcados(marcados.filter((m) => m !== id));
      return;
    }
    if (marcados.length >= MAX_MARCADOS) {
      AccessibilityInfo.announceForAccessibility('Dá para marcar até 3 personagens.');
      // O limite também se vê: a fileira balança de leve (sem movimento reduzido).
      if (!reduzido) {
        const passo = { duration: DURACAO.instante / 2, reduceMotion };
        tremor.set(
          withSequence(
            withTiming(-6, passo),
            withTiming(6, passo),
            withTiming(-4, passo),
            withTiming(4, passo),
            withTiming(0, passo),
          ),
        );
      }
      return;
    }
    setMarcados([...marcados, id]);
  };

  const enviar = () => {
    if (!textoLimpo || publicar.isPending || aberto) return;
    publicar.mutate(pedido, {
      onSuccess: ({ post, consequencia }) => {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setAberto(`/post/${post.id}?acao=${consequencia.eventoId}`);
      },
      onError: tratarErroDeAcao,
    });
  };

  return (
    <KeyboardAvoidingView behavior="padding" style={estilos.flex}>
      <Tela
        cabecalho={<Cabecalho titulo="Novo post" navegacao="fechar" />}
        revelarAoTeclado={trechoDoTom}
        rodape={
          <BotaoMetal
            rotulo={`Publicar · ${custo} energia`}
            onPress={enviar}
            disabled={!textoLimpo || publicar.isPending || !!aberto}
          />
        }
      >
        <Animated.View entering={animacoes.entrada(0)}>
          <Cartao style={estilos.editor}>
            <View style={estilos.autor}>
              <Avatar
                iniciais={jogador?.iniciais ?? ''}
                tom="escuro"
                nome={jogador?.nome ?? 'Você'}
              />
              <View>
                <Texto estilo="corpoForte">{jogador?.nome ?? 'Você'}</Texto>
                <Texto estilo="legenda" cor="textoSuave">
                  Público · todo o elenco vê
                </Texto>
              </View>
            </View>
            <CampoTexto
              rotulo="Seu post"
              testID="campo-post"
              value={texto}
              onChangeText={setTexto}
              placeholder="O que o seu mundo precisa saber?"
              limite={LIMITE}
              multiline
              autoFocus
            />
          </Cartao>
        </Animated.View>

        <Animated.View
          entering={animacoes.entrada(1)}
          style={estilos.secao}
          onLayout={(e) =>
            setTrechoDoTom({ y: e.nativeEvent.layout.y, altura: e.nativeEvent.layout.height })
          }
        >
          <RotuloSecao texto="Tom" />
          <View style={estilos.chips}>
            {TONS.map((t) => (
              <Pop key={t.valor} gatilho={tom === t.valor} soAoLigar escala={1.08}>
                <Chip
                  rotulo={t.rotulo}
                  selecionado={tom === t.valor}
                  onPress={() => setTom(t.valor)}
                />
              </Pop>
            ))}
          </View>
        </Animated.View>

        {elenco.length > 0 && (
          <Animated.View entering={animacoes.entrada(2)} style={estilos.secao}>
            <RotuloSecao
              texto="Marcar"
              meta={`${marcados.length} de ${MAX_MARCADOS}`}
              corMeta="textoSuave"
            />
            <Animated.View style={[estilos.chips, estiloDoTremor]}>
              {elenco.map(({ personagem }) => (
                <Pop
                  key={personagem.id}
                  gatilho={marcados.includes(personagem.id)}
                  soAoLigar
                  escala={1.08}
                >
                  <Chip
                    rotulo={personagem.nome}
                    selecionado={marcados.includes(personagem.id)}
                    onPress={() => alternarMarcado(personagem.id)}
                  />
                </Pop>
              ))}
            </Animated.View>
          </Animated.View>
        )}

        <Animated.View entering={animacoes.entrada(3)} style={estilos.secao}>
          <RotuloSecao texto="Prévia do motor" meta="regras, sem IA" corMeta="textoSuave" />
          <CartaoPrevia
            previa={textoLimpo ? previa.data : undefined}
            semTexto={!textoLimpo}
            calculando={previa.isPending}
            erro={previa.isError}
          />
        </Animated.View>
        <Animated.View entering={animacoes.entrada(4)}>
          <Texto estilo="legenda" cor="textoSuave">
            Os números reais saem do mesmo motor, com um pouco de sorte. A IA escreve as reações, e
            quem estiver online responde primeiro.
          </Texto>
        </Animated.View>
      </Tela>
      {aberto && <SucessoDePublicacao />}
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({
  flex: { flex: 1 },
  editor: { gap: 12 },
  autor: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  secao: { gap: 14 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
