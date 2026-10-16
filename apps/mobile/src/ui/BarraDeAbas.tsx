import type { LucideIcon } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTema } from '../tema/ProvedorTema';
import { Camada } from './Camada';
import { Esfera, corSobreEsfera } from './Esfera';
import { Icone } from './Icone';

export interface Aba<Chave extends string> {
  chave: Chave;
  rotulo: string;
  icone: LucideIcon;
  /** Ponto de novidade (ex.: alertas não lidos), na cor de destaque. */
  novidade?: boolean;
}

export interface BarraDeAbasProps<Chave extends string> {
  abas: readonly Aba<Chave>[];
  ativa: Chave;
  onSelecionar: (chave: Chave) => void;
}

const TAMANHO_ABA = 52;

/** Navegação flutuante em pílula (Figma 12:26). A aba ativa vira uma esfera preta. */
export function BarraDeAbas<Chave extends string>({
  abas,
  ativa,
  onSelecionar,
}: BarraDeAbasProps<Chave>) {
  return (
    <Camada
      cor="superficie"
      sombra="elevacao"
      raio={32}
      borda={{ cor: 'linha', largura: 1 }}
      // No iOS só "tabbar" vira trait; com ele o VoiceOver lê "aba, 1 de 5" nos botões.
      accessibilityRole="tabbar"
      style={estilos.pilula}
    >
      {abas.map((aba) => {
        const selecionada = aba.chave === ativa;
        return (
          <Pressable
            key={aba.chave}
            onPress={() => onSelecionar(aba.chave)}
            accessibilityRole="button"
            accessibilityLabel={aba.novidade ? `${aba.rotulo}, com novidades` : aba.rotulo}
            accessibilityState={{ selected: selecionada }}
            style={estilos.aba}
          >
            {selecionada ? (
              <Esfera tom="escuro" tamanho={TAMANHO_ABA}>
                <Icone icone={aba.icone} cor={corSobreEsfera('escuro')} />
              </Esfera>
            ) : (
              <Icone icone={aba.icone} />
            )}
            {aba.novidade && <PontoNovidade />}
          </Pressable>
        );
      })}
    </Camada>
  );
}

/** Ponto de 11 px com aro na cor da superfície (camada "novidade" do Figma). */
function PontoNovidade() {
  const { cores } = useTema();
  return (
    <View
      pointerEvents="none"
      style={[estilos.ponto, { backgroundColor: cores.destaque, borderColor: cores.superficie }]}
    />
  );
}

const estilos = StyleSheet.create({
  pilula: {
    height: 64,
    padding: 6,
    marginHorizontal: 30,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  aba: { width: TAMANHO_ABA, height: TAMANHO_ABA, alignItems: 'center', justifyContent: 'center' },
  ponto: {
    position: 'absolute',
    left: 30,
    top: 12,
    width: 11,
    height: 11,
    borderRadius: 5.5,
    borderWidth: 2,
  },
});
