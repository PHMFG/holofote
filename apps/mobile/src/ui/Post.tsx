import { Bookmark, Heart, MessageCircle, Repeat, type LucideIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { formatarNumero } from '../formatar';
import { useTema } from '../tema/ProvedorTema';
import { Avatar } from './Avatar';
import { Camada } from './Camada';
import type { TomEsfera } from './Esfera';
import { Icone } from './Icone';
import { Texto } from './Texto';
import { Tocavel } from './Tocavel';
import { Verificado } from './Verificado';

export interface PostProps {
  nome: string;
  handle: string;
  /** Já formatado, ex.: "2h". */
  tempo: string;
  texto: string;
  iniciais: string;
  tomAvatar?: TomEsfera;
  verificado?: boolean;
  respostas: number;
  reposts: number;
  curtidas: number;
  curtido?: boolean;
  salvo?: boolean;
  onAbrir?: () => void;
  onResponder?: () => void;
  onRepostar?: () => void;
  onCurtir?: () => void;
  onSalvar?: () => void;
}

/**
 * Post em cartão elevado (Figma 12:49). Repostar e Salvar só aparecem com o handler: sem rota na
 * API, ficam de fora em vez de virar controles que não fazem nada.
 */
export function Post(props: PostProps) {
  const { medidas } = useTema();
  const { nome, handle, tempo, texto, iniciais, tomAvatar = 'claro', verificado } = props;

  return (
    <Camada cor="superficie" sombra="elevacao" raio={medidas.cartaoRaio} style={estilos.cartao}>
      <Avatar iniciais={iniciais} tom={tomAvatar} nome={nome} />
      <View style={estilos.conteudo}>
        {/* Só cabeçalho e texto abrem o post: as métricas ficam fora para o VoiceOver alcançá-las. */}
        <Tocavel
          onPress={props.onAbrir}
          accessibilityRole="button"
          accessibilityLabel={`${nome}${verificado ? ', verificado' : ''}, ${handle}, ${tempo}: ${texto}`}
          style={estilos.corpo}
        >
          <View style={estilos.cabecalho}>
            <Texto estilo="corpoForte" numberOfLines={1} style={estilos.nome}>
              {nome}
            </Texto>
            {verificado && <Verificado />}
            <Texto estilo="legenda" cor="textoSuave" numberOfLines={1} style={estilos.handle}>
              {handle} · {tempo}
            </Texto>
          </View>
          <Texto>{texto}</Texto>
        </Tocavel>
        <View style={estilos.metricas}>
          <View style={estilos.acoes}>
            <Metrica
              icone={MessageCircle}
              valor={props.respostas}
              rotulo="respostas"
              onPress={props.onResponder}
            />
            {props.onRepostar && (
              <Metrica
                icone={Repeat}
                valor={props.reposts}
                rotulo="reposts"
                onPress={props.onRepostar}
              />
            )}
            <Metrica
              icone={Heart}
              valor={props.curtidas}
              rotulo="curtidas"
              ativo={props.curtido}
              onPress={props.onCurtir}
            />
          </View>
          {props.onSalvar && (
            <Tocavel
              onPress={props.onSalvar}
              hitSlop={12}
              accessibilityRole="button"
              accessibilityLabel={props.salvo ? 'Remover dos salvos' : 'Salvar'}
              accessibilityState={{ selected: !!props.salvo }}
            >
              <Icone
                icone={Bookmark}
                tamanho={16}
                cor={props.salvo ? 'destaqueTinta' : 'textoSuave'}
              />
            </Tocavel>
          )}
        </View>
      </View>
    </Camada>
  );
}

function Metrica(p: {
  icone: LucideIcon;
  valor: number;
  rotulo: string;
  ativo?: boolean;
  onPress?: () => void;
}) {
  // Curtida é informação viva: usa o destaque (docs/PLANO.md, regra de papéis de cor).
  const cor = p.ativo ? 'destaqueTinta' : 'textoSuave';
  return (
    <Tocavel
      onPress={p.onPress}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityLabel={`${formatarNumero(p.valor)} ${p.rotulo}`}
      accessibilityState={{ selected: !!p.ativo }}
      style={estilos.metrica}
    >
      <Icone icone={p.icone} tamanho={16} cor={cor} />
      <Texto estilo="legenda" cor={cor}>
        {formatarNumero(p.valor)}
      </Texto>
    </Tocavel>
  );
}

const estilos = StyleSheet.create({
  cartao: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 16,
    paddingBottom: 14,
    paddingHorizontal: 16,
  },
  conteudo: { flex: 1, gap: 4 },
  corpo: { gap: 4 },
  cabecalho: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  nome: { flexShrink: 1 },
  handle: { flex: 1 },
  metricas: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 8,
  },
  acoes: { flexDirection: 'row', alignItems: 'center', gap: 20 },
  metrica: { flexDirection: 'row', alignItems: 'center', gap: 6 },
});
