import type { LucideIcon } from 'lucide-react-native';
import { StyleSheet, View, type ViewProps } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTema } from '../tema/ProvedorTema';
import { Camada } from './Camada';
import { Icone } from './Icone';
import { Texto } from './Texto';
import { Tocavel } from './Tocavel';

/**
 * Painel de baixo para cima (19 · Sem energia): cantos de cima com raio 32, alça e Elevação.
 * A apresentação (modal transparente do Expo Router) e o escurecer atrás ficam com a tela que a usa.
 */
export function Folha({ children, style, ...props }: ViewProps) {
  const { cores } = useTema();
  const insets = useSafeAreaInsets();
  return (
    <Camada
      {...props}
      cor="superficie"
      sombra="elevacao"
      raio={32}
      // 34 no Figma, que é a altura do indicador de início no 16e.
      style={[estilos.folha, { paddingBottom: Math.max(34, insets.bottom) }, style]}
    >
      <View style={[estilos.alca, { backgroundColor: cores.textoFraco }]} accessible={false} />
      {children}
    </Camada>
  );
}

export interface OpcaoFolhaProps {
  icone: LucideIcon;
  titulo: string;
  subtitulo?: string;
  /** À direita, ex.: "10 gemas". */
  valor?: string;
  /** Opção recomendada (ex.: Holofote Plus): fundo destaque-suave sem borda. */
  destaque?: boolean;
  onPress?: () => void;
}

/** Opção de uma folha: linha em cartão contornado de raio 20. */
export function OpcaoFolha({
  icone,
  titulo,
  subtitulo,
  valor,
  destaque,
  onPress,
}: OpcaoFolhaProps) {
  const { cores } = useTema();
  const corTexto = destaque ? 'destaqueTinta' : 'texto';
  return (
    <Tocavel
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[titulo, subtitulo, valor].filter(Boolean).join(', ')}
      style={({ pressed }) => [
        estilos.opcao,
        {
          backgroundColor: destaque ? cores.destaqueSuave : cores.fundo,
          // Borda transparente no destaque para as opções terem a mesma altura.
          borderColor: destaque ? 'transparent' : cores.linha,
          opacity: pressed ? 0.8 : 1,
        },
      ]}
    >
      <Icone icone={icone} tamanho={20} cor={corTexto} />
      <View style={estilos.textos}>
        <Texto estilo="corpoForte" cor={corTexto}>
          {titulo}
        </Texto>
        {subtitulo && (
          <Texto estilo="legenda" cor={destaque ? 'destaqueTinta' : 'textoSuave'}>
            {subtitulo}
          </Texto>
        )}
      </View>
      {valor && !destaque && (
        <Texto estilo="legenda" cor="textoSuave">
          {valor}
        </Texto>
      )}
    </Tocavel>
  );
}

const estilos = StyleSheet.create({
  folha: {
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    paddingTop: 10,
    paddingHorizontal: 20,
    alignItems: 'center',
    gap: 14,
  },
  alca: { width: 40, height: 5, borderRadius: 3 },
  opcao: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 20,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  textos: { flex: 1, gap: 1 },
});
