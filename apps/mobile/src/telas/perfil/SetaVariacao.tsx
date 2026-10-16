import { ArrowDown, ArrowUp, Minus } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { Icone } from '../../ui/Icone';
import { Texto } from '../../ui/Texto';

/** "subiu 3 hoje", "caiu 1,2 hoje", "sem variação hoje". */
export function rotuloVariacao(valor: number): string {
  if (valor === 0) return 'sem variação hoje';
  const absoluto = Math.abs(valor).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  return `${valor > 0 ? 'subiu' : 'caiu'} ${absoluto} hoje`;
}

/** Seta e valor da variação de hoje (Figma 19:281 e 19:329): o sinal fica na seta. */
export function SetaVariacao({ valor, icone = 12 }: { valor: number; icone?: number }) {
  const Seta = valor > 0 ? ArrowUp : valor < 0 ? ArrowDown : Minus;
  return (
    <View style={estilos.linha} accessible accessibilityLabel={rotuloVariacao(valor)}>
      <Icone icone={Seta} tamanho={icone} cor="textoSuave" traco={2} />
      <Texto estilo="legenda" cor="textoSuave">
        {Math.abs(valor).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}
      </Texto>
    </View>
  );
}

const estilos = StyleSheet.create({
  linha: { flexDirection: 'row', alignItems: 'center', gap: 3 },
});
