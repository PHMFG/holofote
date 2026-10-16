import { NOMES_DESTAQUE, destaques, type NomeDestaque } from '@holofote/tokens';
import { Redirect, router } from 'expo-router';
import { ArrowLeft, Monitor, Moon, Sun } from 'lucide-react-native';
import { Fragment } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAparencia, type PreferenciaTema } from '../../estado/aparencia';
import { useTema } from '../../tema/ProvedorTema';
import { BotaoSuave } from '../../ui/BotaoSuave';
import { Cartao } from '../../ui/Cartao';
import { HISTORIAS } from '../../ui/historias';
import { RotuloSecao } from '../../ui/Rotulo';
import { Segmentado } from '../../ui/Segmentado';
import { Texto } from '../../ui/Texto';

const NOME_DESTAQUE: Record<NomeDestaque, string> = {
  laranja: 'Laranja',
  cobalto: 'Cobalto',
  violeta: 'Violeta',
  rosa: 'Rosa',
  menta: 'Menta',
  lima: 'Lima',
};

/** Catálogo dos componentes Cromo, só em desenvolvimento (holofote://dev/catalogo). */
export default function Catalogo() {
  const insets = useSafeAreaInsets();
  const { medidas } = useTema();
  if (!__DEV__) return <Redirect href="/" />;

  return (
    <ScrollView
      contentContainerStyle={{
        paddingTop: insets.top + 8,
        paddingBottom: insets.bottom + 32,
        paddingHorizontal: medidas.margemLateral,
        gap: 16,
      }}
    >
      <View style={estilos.cabecalho}>
        <BotaoSuave icone={ArrowLeft} rotulo="Voltar" onPress={() => router.back()} />
        <Texto estilo="titulo" accessibilityRole="header">
          Componentes
        </Texto>
      </View>
      <Controles />
      {HISTORIAS.map(({ titulo, figma, Exemplo }) => (
        <Fragment key={titulo}>
          <RotuloSecao texto={titulo} meta={`Figma ${figma}`} corMeta="textoSuave" />
          <Exemplo />
        </Fragment>
      ))}
    </ScrollView>
  );
}

function Controles() {
  const { tema, destaque, definirTema, definirDestaque } = useAparencia();
  const { cores } = useTema();
  return (
    <Cartao style={{ gap: 14 }}>
      <Segmentado<PreferenciaTema>
        rotulo="Tema"
        valor={tema}
        onMudar={definirTema}
        opcoes={[
          { valor: 'claro', rotulo: 'Claro', icone: Sun },
          { valor: 'escuro', rotulo: 'Escuro', icone: Moon },
          { valor: 'sistema', rotulo: 'Sistema', icone: Monitor },
        ]}
      />
      <View
        style={estilos.cores}
        accessibilityRole="radiogroup"
        accessibilityLabel="Cor de destaque"
      >
        {NOMES_DESTAQUE.map((nome) => {
          const escolhida = nome === destaque;
          return (
            <Pressable
              key={nome}
              onPress={() => definirDestaque(nome)}
              accessibilityRole="radio"
              accessibilityLabel={NOME_DESTAQUE[nome]}
              accessibilityState={{ checked: escolhida }}
              style={[estilos.anel, { borderColor: escolhida ? cores.texto : 'transparent' }]}
            >
              <View style={[estilos.cor, { backgroundColor: destaques[nome].base }]} />
            </Pressable>
          );
        })}
      </View>
      <Texto estilo="legenda" cor="destaqueTinta">
        Link de exemplo em destaque-tinta: {NOME_DESTAQUE[destaque]}
      </Texto>
    </Cartao>
  );
}

const estilos = StyleSheet.create({
  cabecalho: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cores: { flexDirection: 'row', justifyContent: 'space-between' },
  anel: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cor: { width: 30, height: 30, borderRadius: 15 },
});
