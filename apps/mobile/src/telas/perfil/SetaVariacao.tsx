import { ArrowDown, ArrowUp, Minus } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { Icone } from '../../ui/Icone';
import { MOLA } from '../../ui/movimento';
import { Pop } from './efeitos';
import { NumeroContando } from './NumeroContando';

/** "subiu 3 hoje", "caiu 1,2 hoje", "sem variação hoje". */
export function rotuloVariacao(valor: number): string {
  if (valor === 0) return 'sem variação hoje';
  const absoluto = Math.abs(valor).toLocaleString('pt-BR', { maximumFractionDigits: 1 });
  return `${valor > 0 ? 'subiu' : 'caiu'} ${absoluto} hoje`;
}

/**
 * Seta e valor da variação de hoje (Figma 19:281 e 19:329): o sinal fica na seta. A seta entra
 * com mola vindo da direção que aponta e o número conta até o valor; quando a variação muda
 * (uma ação nova), o conjunto entra de novo.
 */
export function SetaVariacao({
  valor,
  icone = 12,
  atraso = 0,
}: {
  valor: number;
  icone?: number;
  /** Atraso em ms da entrada (para acompanhar a cascata da lista). */
  atraso?: number;
}) {
  const Seta = valor > 0 ? ArrowUp : valor < 0 ? ArrowDown : Minus;
  return (
    <Pop
      key={valor}
      de={0.3}
      deslocamento={valor > 0 ? 6 : valor < 0 ? -6 : 0}
      atraso={atraso}
      mola={MOLA.viva}
    >
      <View style={estilos.linha} accessible accessibilityLabel={rotuloVariacao(valor)}>
        <Icone icone={Seta} tamanho={icone} cor="textoSuave" traco={2} />
        <NumeroContando
          estilo="legenda"
          cor="textoSuave"
          atraso={atraso}
          texto={Math.abs(valor).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}
        />
      </View>
    </Pop>
  );
}

const estilos = StyleSheet.create({
  linha: { flexDirection: 'row', alignItems: 'center', gap: 3 },
});
