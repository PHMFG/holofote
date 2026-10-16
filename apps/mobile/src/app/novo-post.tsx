import type { Tom } from '@holofote/shared';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, KeyboardAvoidingView, StyleSheet, View } from 'react-native';
import { tratarErroDeAcao } from '../acoes/erros';
import { useMundo, usePrevia, usePublicar, useRelacoes } from '../api/consultas';
import { CartaoPrevia } from '../telas/post/CartaoPrevia';
import { Avatar } from '../ui/Avatar';
import { BotaoMetal } from '../ui/BotaoMetal';
import { Cabecalho } from '../ui/Cabecalho';
import { CampoTexto } from '../ui/CampoTexto';
import { Cartao } from '../ui/Cartao';
import { Chip } from '../ui/Chip';
import { RotuloSecao } from '../ui/Rotulo';
import { Tela } from '../ui/Tela';
import { Texto } from '../ui/Texto';

const LIMITE = 280;
const MAX_MARCADOS = 3;
/** Espera depois da última tecla antes de pedir a prévia ao motor. */
const ESPERA_PREVIA_MS = 500;

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

  const textoLimpo = texto.trim();
  const pedido = useMemo(() => ({ texto: textoLimpo, tom, marcados }), [textoLimpo, tom, marcados]);
  const { mutate: pedirPrevia } = previa;

  // A prévia é do motor (sem IA, custo 0): pede de novo a cada mudança, com espera curta.
  useEffect(() => {
    if (!pedido.texto) return;
    const espera = setTimeout(() => pedirPrevia(pedido), ESPERA_PREVIA_MS);
    return () => clearTimeout(espera);
  }, [pedido, pedirPrevia]);

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
      return;
    }
    setMarcados([...marcados, id]);
  };

  const enviar = () => {
    if (!textoLimpo || publicar.isPending) return;
    publicar.mutate(pedido, {
      onSuccess: ({ post, consequencia }) => {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.replace(`/post/${post.id}?acao=${consequencia.eventoId}`);
      },
      onError: tratarErroDeAcao,
    });
  };

  return (
    <KeyboardAvoidingView behavior="padding" style={estilos.flex}>
      <Tela
        cabecalho={<Cabecalho titulo="Novo post" navegacao="fechar" />}
        rodape={
          <BotaoMetal
            rotulo={`Publicar · ${custo} energia`}
            onPress={enviar}
            disabled={!textoLimpo || publicar.isPending}
          />
        }
      >
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

        <View style={estilos.secao}>
          <RotuloSecao texto="Tom" />
          <View style={estilos.chips}>
            {TONS.map((t) => (
              <Chip
                key={t.valor}
                rotulo={t.rotulo}
                selecionado={tom === t.valor}
                onPress={() => setTom(t.valor)}
              />
            ))}
          </View>
        </View>

        {elenco.length > 0 && (
          <View style={estilos.secao}>
            <RotuloSecao
              texto="Marcar"
              meta={`${marcados.length} de ${MAX_MARCADOS}`}
              corMeta="textoSuave"
            />
            <View style={estilos.chips}>
              {elenco.map(({ personagem }) => (
                <Chip
                  key={personagem.id}
                  rotulo={personagem.nome}
                  selecionado={marcados.includes(personagem.id)}
                  onPress={() => alternarMarcado(personagem.id)}
                />
              ))}
            </View>
          </View>
        )}

        <View style={estilos.secao}>
          <RotuloSecao texto="Prévia do motor" meta="regras, sem IA" corMeta="textoSuave" />
          <CartaoPrevia
            previa={textoLimpo ? previa.data : undefined}
            semTexto={!textoLimpo}
            calculando={previa.isPending}
            erro={previa.isError}
          />
        </View>
        <Texto estilo="legenda" cor="textoSuave">
          Os números reais saem do mesmo motor, com um pouco de sorte. A IA escreve as reações, e
          quem estiver online responde primeiro.
        </Texto>
      </Tela>
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
