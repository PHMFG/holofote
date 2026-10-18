import type { Alerta } from '@holofote/shared';
import {
  AtSign,
  Calendar,
  MessageCircle,
  MessageSquare,
  Newspaper,
  TrendingUp,
  Trophy,
  type LucideIcon,
} from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useTema } from '../../tema/ProvedorTema';
import { Avatar } from '../../ui/Avatar';
import { Esfera, corSobreEsfera } from '../../ui/Esfera';
import { Icone } from '../../ui/Icone';
import { Texto } from '../../ui/Texto';
import { useAnimacoes } from '../animacao/animacoes';

type TipoAlerta = Alerta['tipo'];

const ICONES: Record<TipoAlerta, LucideIcon> = {
  resposta: MessageCircle,
  mencao: AtSign,
  dm: MessageSquare,
  marco: Trophy,
  evento: Calendar,
  seguidores: TrendingUp,
  resumo: Newspaper,
};

/** Segunda linha: de onde veio o alerta (o texto em si vem do servidor). */
export const ROTULO_TIPO: Record<TipoAlerta, string> = {
  resposta: 'Resposta ao seu post',
  mencao: 'Menção',
  dm: 'Mensagem direta',
  marco: 'Marco da jornada',
  evento: 'Evento',
  seguidores: 'Seguidores',
  resumo: 'Resumo do dia',
};

export interface LinhaAlertaProps {
  alerta: Alerta;
  /** Já formatada: "agora", "12 min", "1 h", "Dia 5". */
  tempo: string;
  separador?: boolean;
  onPress: () => void;
}

/**
 * Linha de 07 · Alertas (Figma 25:349). Como a LinhaDeLista alinhada ao topo, mas com o título
 * em várias linhas e o nome do personagem em negrito dentro dele, e a hora com o ponto de não
 * lido embaixo, na coluna da direita.
 */
export function LinhaAlerta({ alerta, tempo, separador = true, onPress }: LinhaAlertaProps) {
  const { cores } = useTema();
  const animacoes = useAnimacoes();
  const { personagem } = alerta;
  // O texto vem pronto do servidor; quando começa pelo nome do personagem, o nome vai em negrito.
  const nome = personagem && alerta.texto.startsWith(personagem.nome) ? personagem.nome : null;
  const subtitulo = ROTULO_TIPO[alerta.tipo];
  const rotulo = [alerta.texto, subtitulo, tempo, alerta.lido ? undefined : 'não lido']
    .filter(Boolean)
    .join(', ');

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={rotulo}
      style={({ pressed }) => [
        estilos.linha,
        separador && { borderBottomWidth: 1, borderBottomColor: cores.linha },
        { opacity: pressed ? 0.7 : 1 },
      ]}
    >
      {personagem ? (
        <Avatar iniciais={personagem.iniciais} tom={personagem.tomAvatar} nome={personagem.nome} />
      ) : (
        <Esfera tom="escuro" tamanho={40}>
          <Icone icone={ICONES[alerta.tipo]} tamanho={18} cor={corSobreEsfera('escuro')} />
        </Esfera>
      )}
      <View style={estilos.texto}>
        <Texto>
          {nome ? (
            <>
              <Texto estilo="corpoForte">{nome}</Texto>
              {alerta.texto.slice(nome.length)}
            </>
          ) : (
            alerta.texto
          )}
        </Texto>
        <Texto estilo="legenda" cor="textoSuave">
          {subtitulo}
        </Texto>
      </View>
      <View style={estilos.meta}>
        <Texto estilo="legenda" cor="textoSuave">
          {tempo}
        </Texto>
        {/* Lido o alerta, o ponto de não lido encolhe e some com fade. */}
        {!alerta.lido && (
          <Animated.View
            exiting={animacoes.popSaida}
            style={[estilos.ponto, { backgroundColor: cores.destaque }]}
          />
        )}
      </View>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  linha: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 12 },
  texto: { flex: 1, gap: 2 },
  meta: { alignItems: 'flex-end', gap: 8, paddingTop: 2 },
  ponto: { width: 9, height: 9, borderRadius: 4.5 },
});
