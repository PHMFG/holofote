import type { NomeCor } from '@holofote/tokens';
import { StyleSheet, View } from 'react-native';
import { useTema } from '../tema/ProvedorTema';
import { Texto, type CorDeTexto } from './Texto';

export type VarianteRotulo = 'neutro' | 'destaque' | 'data';

const APARENCIA: Record<VarianteRotulo, { fundo: NomeCor; texto: CorDeTexto }> = {
  neutro: { fundo: 'superficie2', texto: 'textoSuave' },
  destaque: { fundo: 'destaqueSuave', texto: 'destaqueTinta' },
  data: { fundo: 'superficie2', texto: 'textoSuave' },
};

/** Etiqueta curta: "FÃ" (neutro), "NOVO" (destaque) ou pílula de data. */
export function Rotulo({
  texto,
  variante = 'neutro',
}: {
  texto: string;
  variante?: VarianteRotulo;
}) {
  const { cores } = useTema();
  const { fundo, texto: corTexto } = APARENCIA[variante];
  const ehData = variante === 'data';
  return (
    <View style={[ehData ? estilos.data : estilos.tag, { backgroundColor: cores[fundo] }]}>
      <Texto estilo={ehData ? 'legenda' : 'mini'} cor={corTexto}>
        {texto}
      </Texto>
    </View>
  );
}

export interface RotuloSecaoProps {
  texto: string;
  /** Informação à direita, ex.: "decida em 0:24". */
  meta?: string;
  corMeta?: CorDeTexto;
}

/** Título de seção em Mini maiúsculo, com meta opcional à direita. */
export function RotuloSecao({ texto, meta, corMeta = 'destaqueTinta' }: RotuloSecaoProps) {
  return (
    <View style={estilos.secao}>
      <Texto estilo="mini" cor="textoSuave" accessibilityRole="header" style={estilos.textoSecao}>
        {texto}
      </Texto>
      {meta && (
        <Texto estilo="legenda" cor={corMeta}>
          {meta}
        </Texto>
      )}
    </View>
  );
}

const estilos = StyleSheet.create({
  tag: { alignSelf: 'flex-start', borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 },
  data: { alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  secao: { flexDirection: 'row', alignItems: 'center', paddingTop: 4, paddingHorizontal: 4 },
  textoSecao: { flex: 1 },
});
