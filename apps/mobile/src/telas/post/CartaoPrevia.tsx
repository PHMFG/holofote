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
import { useTema } from '../../tema/ProvedorTema';
import { Cartao } from '../../ui/Cartao';
import { Esfera, corSobreEsfera } from '../../ui/Esfera';
import { Icone } from '../../ui/Icone';
import { Texto, type CorDeTexto } from '../../ui/Texto';
import { primeiroNome } from '../../formatar';
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
 */
export function CartaoPrevia({ previa, semTexto, calculando, erro }: CartaoPreviaProps) {
  const { cores } = useTema();
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
    <Cartao style={estilos.cartao} accessibilityLiveRegion="polite">
      <View style={estilos.titulo} accessible accessibilityLabel={`${titulo}. ${subtitulo}`}>
        <Esfera tom="escuro" tamanho={32}>
          <Icone icone={Sparkles} tamanho={14} cor={corSobreEsfera('escuro')} traco={2} />
        </Esfera>
        <View style={estilos.flex}>
          <Texto estilo="corpoForte">{titulo}</Texto>
          <Texto estilo="legenda" cor="textoSuave">
            {subtitulo}
          </Texto>
        </View>
        {calculando && !semTexto && (
          <ActivityIndicator color={cores.textoSuave} accessibilityLabel="Calculando a prévia" />
        )}
      </View>
      {previa && !semTexto && (
        <View style={estilos.efeitos}>
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
            />
          ))}
        </View>
      )}
    </Cartao>
  );
}

function Linha(p: { icone: LucideIcon; rotulo: string; valor: string; corValor?: CorDeTexto }) {
  return (
    <View style={estilos.linha} accessible accessibilityLabel={`${p.rotulo}: ${p.valor}`}>
      <Icone icone={p.icone} tamanho={16} cor="texto" />
      <Texto estilo="legenda" numberOfLines={1} style={estilos.flex}>
        {p.rotulo}
      </Texto>
      <Texto estilo="legenda" cor={p.corValor ?? 'texto'}>
        {p.valor}
      </Texto>
    </View>
  );
}

const estilos = StyleSheet.create({
  cartao: { gap: 12 },
  titulo: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  flex: { flex: 1 },
  efeitos: { gap: 10, paddingTop: 2 },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 8 },
});
