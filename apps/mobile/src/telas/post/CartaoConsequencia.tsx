import type { Consequencia } from '@holofote/shared';
import { router } from 'expo-router';
import {
  Flame,
  Heart,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Trophy,
  Undo2,
  Zap,
} from 'lucide-react-native';
import { ActivityIndicator, StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';
import { CUSTO_DESFAZER } from '../../acoes/custos';
import { efeitosDosDeltas, formatarNumero } from '../../formatar';
import { useTema } from '../../tema/ProvedorTema';
import { Chip } from '../../ui/Chip';
import { Esfera, corSobreEsfera } from '../../ui/Esfera';
import { Icone } from '../../ui/Icone';
import { Texto } from '../../ui/Texto';
import { haQuanto } from '../../tempo';
import { useAnimacoes } from '../animacao/animacoes';
import { CartaoAnimado } from '../animacao/Animados';
import { NumeroRolante } from '../animacao/NumeroRolante';
import { rotuloSeguidores } from './formatar';

export { CUSTO_DESFAZER };

export interface CartaoConsequenciaProps {
  consequencia: Consequencia;
  /** Quando a ação aconteceu (o post publicado), para o "há 2 min". */
  desde: string;
  agora: number;
  /** Nome de cada personagem pelo id, para os deltas de relação. */
  nomePorId: ReadonlyMap<string, string>;
  /** Some quando a ação já foi desfeita ou o prazo passou. */
  podeDesfazer: boolean;
  onDesfazer: () => void;
}

/** Atraso (ms) de cada etapa da entrada: seguidores contam, depois os chips entram em cascata. */
const ATRASO_CONTAGEM = 380;
const ATRASO_CHIPS = 760;
const PASSO_DOS_CHIPS = 90;

/**
 * Cartão de consequência (Figma 17:204). Os números saem do motor na hora; o título e o texto
 * são da IA e chegam depois pelo tempo real (evento "cartao"). Até lá, o cartão diz que as
 * reações estão chegando.
 *
 * Entra em etapas: o ícone de tendência dá um pop, os seguidores contam de 0 até o valor e os
 * chips de efeitos entram em cascata. Quando o cartão da IA chega, o aviso "as reações estão
 * chegando" sai com fade, o título e o texto aparecem em seguida e o cartão acomoda a altura.
 */
export function CartaoConsequencia({
  consequencia,
  desde,
  agora,
  nomePorId,
  podeDesfazer,
  onDesfazer,
}: CartaoConsequenciaProps) {
  const { cores } = useTema();
  const animacoes = useAnimacoes();
  const { cartao, reacoesPendentes, seguidoresGanhos, curtidasSimuladas, marcoLiberado } =
    consequencia;
  const efeitos = efeitosDosDeltas(consequencia.deltas, nomePorId);
  const caiu = seguidoresGanhos < 0;

  return (
    <CartaoAnimado layout={animacoes.layout} style={estilos.cartao}>
      <Animated.View layout={animacoes.layout} style={estilos.titulo}>
        <Esfera tom="escuro" tamanho={32}>
          <Icone icone={Sparkles} tamanho={15} cor={corSobreEsfera('escuro')} traco={2} />
        </Esfera>
        <Texto estilo="corpoForte" accessibilityRole="header" style={estilos.flex}>
          Consequência
        </Texto>
        <Texto estilo="legenda" cor="textoSuave">
          {haQuanto(desde, agora)}
        </Texto>
      </Animated.View>

      <Animated.View
        layout={animacoes.layout}
        style={estilos.resultado}
        accessible
        accessibilityLabel={rotuloSeguidores(seguidoresGanhos)}
      >
        <Animated.View entering={animacoes.pop(ATRASO_CONTAGEM - 120)}>
          <Icone
            icone={caiu ? TrendingDown : TrendingUp}
            tamanho={22}
            cor="destaqueTinta"
            traco={2}
          />
        </Animated.View>
        <NumeroRolante
          texto={rotuloSeguidores(seguidoresGanhos)}
          estilo="numero"
          cor="destaqueTinta"
          desdeZero
          atraso={ATRASO_CONTAGEM}
        />
      </Animated.View>

      {cartao ? (
        <Animated.View
          key="cartao-da-ia"
          layout={animacoes.layout}
          style={estilos.textoIA}
          accessibilityLiveRegion="polite"
        >
          <Animated.View entering={animacoes.fade(120)}>
            <Texto estilo="corpoForte">{cartao.titulo}</Texto>
          </Animated.View>
          <Animated.View entering={animacoes.fade(260)}>
            <Texto cor="textoSuave">{cartao.texto}</Texto>
          </Animated.View>
        </Animated.View>
      ) : reacoesPendentes > 0 ? (
        <Animated.View
          key="reacoes-chegando"
          entering={animacoes.fade(ATRASO_CHIPS - 200)}
          exiting={animacoes.saidaSuave}
          layout={animacoes.layout}
          style={estilos.chegando}
          accessible
          accessibilityLiveRegion="polite"
          accessibilityLabel={textoChegando(reacoesPendentes)}
        >
          <ActivityIndicator color={cores.textoSuave} accessibilityLabel="Aguardando as reações" />
          <Texto cor="textoSuave" style={estilos.flex}>
            {textoChegando(reacoesPendentes)}
          </Texto>
        </Animated.View>
      ) : null}

      <Animated.View layout={animacoes.layout} style={estilos.efeitos}>
        {curtidasSimuladas > 0 && (
          <Animated.View entering={animacoes.pop(ATRASO_CHIPS)}>
            <Chip
              rotulo={`+${formatarNumero(curtidasSimuladas)} curtidas`}
              icone={Heart}
              sobreFundo
            />
          </Animated.View>
        )}
        {efeitos.map((efeito, i) => (
          <Animated.View
            key={efeito.chave}
            entering={animacoes.pop(
              ATRASO_CHIPS + (i + (curtidasSimuladas > 0 ? 1 : 0)) * PASSO_DOS_CHIPS,
            )}
          >
            <Chip
              rotulo={efeito.texto}
              icone={
                efeito.tipo === 'polemica'
                  ? Flame
                  : efeito.direcao === 'sobe'
                    ? TrendingUp
                    : TrendingDown
              }
              sobreFundo
            />
          </Animated.View>
        ))}
      </Animated.View>

      {marcoLiberado && (
        <Animated.View
          entering={animacoes.pop(ATRASO_CHIPS + (efeitos.length + 1) * PASSO_DOS_CHIPS)}
          layout={animacoes.layout}
        >
          <Chip
            rotulo={`Marco liberado: ${marcoLiberado.titulo}`}
            variante="suave"
            icone={Trophy}
            onPress={() => router.push(`/marco/${marcoLiberado.id}`)}
          />
        </Animated.View>
      )}

      {podeDesfazer && (
        <Animated.View
          entering={animacoes.pop(ATRASO_CHIPS + (efeitos.length + 2) * PASSO_DOS_CHIPS)}
          exiting={animacoes.popSaida}
          layout={animacoes.layout}
        >
          <Chip
            rotulo={`Desfazer · ${CUSTO_DESFAZER}`}
            rotuloAcessivel={`Desfazer, custa ${CUSTO_DESFAZER} de energia`}
            variante="afundado"
            icone={Undo2}
            iconeDepois={Zap}
            onPress={onDesfazer}
          />
        </Animated.View>
      )}
    </CartaoAnimado>
  );
}

function textoChegando(pendentes: number): string {
  return pendentes === 1
    ? 'As reações estão chegando: 1 personagem está escrevendo.'
    : `As reações estão chegando: ${pendentes} personagens estão escrevendo.`;
}

const estilos = StyleSheet.create({
  cartao: { gap: 12 },
  titulo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  flex: { flex: 1 },
  resultado: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  textoIA: { gap: 4 },
  chegando: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  efeitos: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
