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
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { CUSTO_DESFAZER } from '../../acoes/custos';
import { efeitosDosDeltas, formatarNumero } from '../../formatar';
import { useTema } from '../../tema/ProvedorTema';
import { Cartao } from '../../ui/Cartao';
import { Chip } from '../../ui/Chip';
import { Esfera, corSobreEsfera } from '../../ui/Esfera';
import { Icone } from '../../ui/Icone';
import { Texto } from '../../ui/Texto';
import { haQuanto } from '../../tempo';
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

/**
 * Cartão de consequência (Figma 17:204). Os números saem do motor na hora; o título e o texto
 * são da IA e chegam depois pelo tempo real (evento "cartao"). Até lá, o cartão diz que as
 * reações estão chegando.
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
  const { cartao, reacoesPendentes, seguidoresGanhos, curtidasSimuladas, marcoLiberado } =
    consequencia;
  const efeitos = efeitosDosDeltas(consequencia.deltas, nomePorId);
  const caiu = seguidoresGanhos < 0;

  return (
    <Cartao style={estilos.cartao}>
      <View style={estilos.titulo}>
        <Esfera tom="escuro" tamanho={32}>
          <Icone icone={Sparkles} tamanho={15} cor={corSobreEsfera('escuro')} traco={2} />
        </Esfera>
        <Texto estilo="corpoForte" accessibilityRole="header" style={estilos.flex}>
          Consequência
        </Texto>
        <Texto estilo="legenda" cor="textoSuave">
          {haQuanto(desde, agora)}
        </Texto>
      </View>

      <View
        style={estilos.resultado}
        accessible
        accessibilityLabel={rotuloSeguidores(seguidoresGanhos)}
      >
        <Icone
          icone={caiu ? TrendingDown : TrendingUp}
          tamanho={22}
          cor="destaqueTinta"
          traco={2}
        />
        <Texto estilo="numero" cor="destaqueTinta">
          {rotuloSeguidores(seguidoresGanhos)}
        </Texto>
      </View>

      {cartao ? (
        <View style={estilos.textoIA} accessibilityLiveRegion="polite">
          <Texto estilo="corpoForte">{cartao.titulo}</Texto>
          <Texto cor="textoSuave">{cartao.texto}</Texto>
        </View>
      ) : reacoesPendentes > 0 ? (
        <View
          style={estilos.chegando}
          accessible
          accessibilityLiveRegion="polite"
          accessibilityLabel={textoChegando(reacoesPendentes)}
        >
          <ActivityIndicator color={cores.textoSuave} accessibilityLabel="Aguardando as reações" />
          <Texto cor="textoSuave" style={estilos.flex}>
            {textoChegando(reacoesPendentes)}
          </Texto>
        </View>
      ) : null}

      <View style={estilos.efeitos}>
        {curtidasSimuladas > 0 && (
          <Chip
            rotulo={`+${formatarNumero(curtidasSimuladas)} curtidas`}
            icone={Heart}
            sobreFundo
          />
        )}
        {efeitos.map((efeito) => (
          <Chip
            key={efeito.chave}
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
        ))}
      </View>

      {marcoLiberado && (
        <Chip
          rotulo={`Marco liberado: ${marcoLiberado.titulo}`}
          variante="suave"
          icone={Trophy}
          onPress={() => router.push(`/marco/${marcoLiberado.id}`)}
        />
      )}

      {podeDesfazer && (
        <Chip
          rotulo={`Desfazer · ${CUSTO_DESFAZER}`}
          rotuloAcessivel={`Desfazer, custa ${CUSTO_DESFAZER} de energia`}
          variante="afundado"
          icone={Undo2}
          iconeDepois={Zap}
          onPress={onDesfazer}
        />
      )}
    </Cartao>
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
