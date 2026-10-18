import { Heart, MessageCircle, Repeat } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { useTema } from '../tema/ProvedorTema';
import { Aparecer } from './Aparecer';
import { Avatar } from './Avatar';
import { ContadorDeAcao } from './ContadorDeAcao';
import type { TomEsfera } from './Esfera';
import { PontosDigitando } from './PontosDigitando';
import { Rotulo } from './Rotulo';
import { Texto } from './Texto';
import { Tocavel } from './Tocavel';
import { Verificado } from './Verificado';

export interface ComentarioProps {
  nome: string;
  iniciais: string;
  tomAvatar?: TomEsfera;
  verificado?: boolean;
  /** Etiqueta neutra depois do nome, ex.: "FÃ". */
  tag?: string;
  tempo: string;
  texto: string;
  curtidas: number;
  respostas?: number;
  reposts?: number;
  curtido?: boolean;
  /** Resposta a outra resposta: recuo de 46 e avatar 28, só com curtir. */
  aninhado?: boolean;
  onCurtir?: () => void;
  onResponder?: () => void;
}

/** Resposta numa conversa (13 · Respostas). O cartão em volta é da tela. */
export function Comentario(p: ComentarioProps) {
  const aninhado = !!p.aninhado;
  return (
    <View style={[estilos.linha, aninhado && estilos.aninhado]}>
      <Avatar
        iniciais={p.iniciais}
        tom={p.tomAvatar ?? 'claro'}
        tamanho={aninhado ? 28 : 36}
        nome={p.nome}
      />
      <View style={estilos.coluna}>
        <View
          style={estilos.cabecalho}
          accessible
          accessibilityLabel={`${p.nome}${p.verificado ? ', verificado' : ''}${p.tag ? `, ${p.tag}` : ''}, ${p.tempo}: ${p.texto}`}
        >
          <Texto estilo="corpoForte" numberOfLines={1} style={estilos.nome}>
            {p.nome}
          </Texto>
          {p.verificado && <Verificado />}
          {p.tag && <Rotulo texto={p.tag} />}
          <Texto estilo="legenda" cor="textoSuave">
            {p.tempo}
          </Texto>
        </View>
        <Texto accessible={false}>{p.texto}</Texto>
        <View style={estilos.acoes}>
          {!aninhado && p.respostas !== undefined && (
            <ContadorDeAcao
              icone={MessageCircle}
              tamanhoIcone={14}
              traco={2}
              espaco={5}
              valor={p.respostas}
              rotulo="respostas"
            />
          )}
          {!aninhado && p.reposts !== undefined && (
            <ContadorDeAcao
              icone={Repeat}
              tamanhoIcone={14}
              traco={2}
              espaco={5}
              valor={p.reposts}
              rotulo="reposts"
            />
          )}
          <ContadorDeAcao
            tamanhoIcone={14}
            traco={2}
            espaco={5}
            icone={Heart}
            valor={p.curtidas}
            rotulo="curtidas"
            ativo={p.curtido}
            onPress={p.onCurtir}
          />
          {!aninhado && p.onResponder && (
            <Tocavel
              onPress={p.onResponder}
              accessibilityRole="button"
              accessibilityLabel={`Responder a ${p.nome}`}
              hitSlop={8}
            >
              <Texto estilo="legenda" cor="destaqueTinta">
                Responder
              </Texto>
            </Tocavel>
          )}
        </View>
      </View>
    </View>
  );
}

/** Linha "Ver mais N respostas" depois de um aninhado. */
export function VerMaisRespostas({
  quantidade,
  onPress,
}: {
  quantidade: number;
  onPress?: () => void;
}) {
  return (
    <Tocavel onPress={onPress} accessibilityRole="button" style={estilos.verMais}>
      <Texto estilo="legenda" cor="destaqueTinta">
        Ver mais {quantidade} {quantidade === 1 ? 'resposta' : 'respostas'}
      </Texto>
    </Tocavel>
  );
}

/** "Fulano está digitando": as respostas chegam aos poucos (entregarEm). */
export function Digitando({ nome, iniciais }: { nome: string; iniciais: string }) {
  const { cores } = useTema();
  return (
    <Aparecer modo="fade">
      <View style={estilos.digitando} accessible accessibilityLabel={`${nome} está digitando`}>
        <Avatar iniciais={iniciais} tamanho={28} />
        <View style={[estilos.bolha, { backgroundColor: cores.superficie2 }]}>
          <PontosDigitando />
        </View>
        <Texto estilo="legenda" cor="textoSuave">
          {nome} está digitando
        </Texto>
      </View>
    </Aparecer>
  );
}

/** Separador de 1 px entre comentários de primeiro nível. */
export function SeparadorComentario() {
  const { cores } = useTema();
  return <View style={{ height: 1, backgroundColor: cores.linha }} />;
}

const estilos = StyleSheet.create({
  linha: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  aninhado: { marginLeft: 46, gap: 8 },
  coluna: { flex: 1, gap: 3 },
  cabecalho: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  nome: { flexShrink: 1 },
  acoes: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingTop: 4 },
  verMais: { marginLeft: 46 },
  digitando: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  bolha: {
    width: 50,
    height: 24,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
