import type { RespostaPrevia } from '@holofote/shared';
import {
  Flame,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Users,
  type LucideIcon,
} from 'lucide-react-native';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useTema } from '../../tema/ProvedorTema';
import { Esfera, corSobreEsfera } from '../../ui/Esfera';
import { Icone } from '../../ui/Icone';
import { Texto, type CorDeTexto } from '../../ui/Texto';
import { primeiroNome } from '../../formatar';
import { useAnimacoes } from '../animacao/animacoes';
import { CartaoAnimado } from '../animacao/Animados';
import { TrocaSuave } from '../animacao/TrocaSuave';
import { faixaComSinal, faixaQuantidade } from './formatar';

export interface CartaoPreviaProps {
  previa: RespostaPrevia | undefined;
  /** Sem texto ainda: o motor não tem o que estimar. */
  semTexto: boolean;
  calculando: boolean;
  erro: boolean;
}

/**
 * Prévia do motor de regras (Figma 53:1359): faixas de alcance, seguidores, polêmica e
 * afinidade de cada marcado. Sai de POST /posts/previa, sem IA e sem gastar energia.
 * Título e números trocam com transição a cada nova estimativa, as linhas entram e saem com
 * o resto do cartão acomodando a altura.
 */
export function CartaoPrevia({ previa, semTexto, calculando, erro }: CartaoPreviaProps) {
  const { cores } = useTema();
  const animacoes = useAnimacoes();
  let titulo: string;
  let subtitulo: string;
  if (semTexto) {
    titulo = 'Escreva para ver a prévia';
    subtitulo = 'O motor estima alcance e reações pelas regras do jogo.';
  } else if (previa) {
    titulo = `Alcance provável: ${faixaQuantidade(previa.alcance)} pessoas`;
    subtitulo = 'Estimativa por regras, 0 tokens';
  } else if (erro) {
    titulo = 'Prévia indisponível agora';
    subtitulo = 'Dá para publicar mesmo assim.';
  } else {
    titulo = 'Calculando a prévia…';
    subtitulo = 'Estimativa por regras, 0 tokens';
  }

  return (
    <CartaoAnimado
      layout={animacoes.layout}
      style={estilos.cartao}
      accessibilityLiveRegion="polite"
    >
      <View style={estilos.titulo} accessible accessibilityLabel={`${titulo}. ${subtitulo}`}>
        <Esfera tom="escuro" tamanho={32}>
          <Icone icone={Sparkles} tamanho={14} cor={corSobreEsfera('escuro')} traco={2} />
        </Esfera>
        <TrocaSuave chave={`${titulo}|${subtitulo}`} style={estilos.flex}>
          <Texto estilo="corpoForte">{titulo}</Texto>
          <Texto estilo="legenda" cor="textoSuave">
            {subtitulo}
          </Texto>
        </TrocaSuave>
        {calculando && !semTexto && (
          <Animated.View entering={animacoes.fade()} exiting={animacoes.saida}>
            <ActivityIndicator color={cores.textoSuave} accessibilityLabel="Calculando a prévia" />
          </Animated.View>
        )}
      </View>
      {previa && !semTexto && (
        <Animated.View
          entering={animacoes.entrada()}
          exiting={animacoes.saidaSuave}
          layout={animacoes.layout}
          style={estilos.efeitos}
        >
          <Linha
            icone={Users}
            rotulo="Seguidores"
            valor={faixaComSinal(previa.seguidores)}
            corValor="destaqueTinta"
          />
          <Linha icone={Flame} rotulo="Polêmica" valor={faixaComSinal(previa.polemica)} />
          {previa.relacoes.map(({ personagem, afinidade }) => (
            <Linha
              key={personagem.id}
              icone={afinidade[0] + afinidade[1] < 0 ? TrendingDown : TrendingUp}
              rotulo={`${primeiroNome(personagem.nome)} · relação`}
              valor={faixaComSinal(afinidade, '%')}
              dinamica
            />
          ))}
        </Animated.View>
      )}
    </CartaoAnimado>
  );
}

function Linha(p: {
  icone: LucideIcon;
  rotulo: string;
  valor: string;
  corValor?: CorDeTexto;
  /** Linha que depende de quem está marcado: entra e sai com a marcação. */
  dinamica?: boolean;
}) {
  const animacoes = useAnimacoes();
  return (
    <Animated.View
      entering={p.dinamica ? animacoes.deSubida() : undefined}
      exiting={p.dinamica ? animacoes.saidaSuave : undefined}
      layout={animacoes.layout}
      style={estilos.linha}
      accessible
      accessibilityLabel={`${p.rotulo}: ${p.valor}`}
    >
      <Icone icone={p.icone} tamanho={16} cor="texto" />
      <Texto estilo="legenda" numberOfLines={1} style={estilos.flex}>
        {p.rotulo}
      </Texto>
      <TrocaSuave chave={p.valor}>
        <Texto estilo="legenda" cor={p.corValor ?? 'texto'}>
          {p.valor}
        </Texto>
      </TrocaSuave>
    </Animated.View>
  );
}

const estilos = StyleSheet.create({
  cartao: { gap: 12 },
  titulo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  flex: { flex: 1 },
  efeitos: { gap: 10, paddingTop: 2 },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
