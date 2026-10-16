import { StyleSheet, View } from 'react-native';
import { useTema } from '../tema/ProvedorTema';
import { Camada } from './Camada';
import { Texto } from './Texto';

export interface BarraProgressoProps {
  /** De 0 a 1. */
  valor: number;
  /** Lido pelo VoiceOver, ex.: "Objetivo do ato". */
  rotulo: string;
  /** 8 (padrão), 6 nos requisitos, 5 mini, 4 cronômetro, 3 histórias. */
  altura?: 8 | 6 | 5 | 4 | 3;
  /**
   * padrão: trilho afundado com preenchimento destaque-grafico.
   * chapada: trilho sem sombra com preenchimento destaque (12 · Compor post, 17 · Ao vivo).
   */
  variante?: 'padrao' | 'chapada';
}

export function BarraProgresso({
  valor,
  rotulo,
  altura = 8,
  variante = 'padrao',
}: BarraProgressoProps) {
  const { cores } = useTema();
  const proporcao = Math.min(1, Math.max(0, valor));
  const raio = altura / 2;
  return (
    <Camada
      cor="superficie2"
      sombra={variante === 'padrao' ? 'afundado' : undefined}
      raio={raio}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={rotulo}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(proporcao * 100) }}
      style={{ height: altura, overflow: 'hidden' }}
    >
      <View
        style={{
          width: `${proporcao * 100}%`,
          height: altura,
          borderRadius: raio,
          backgroundColor: variante === 'padrao' ? cores.destaqueGrafico : cores.destaque,
        }}
      />
    </Camada>
  );
}

export interface BarraPassosProps {
  total: number;
  /** Passos concluídos, contando o atual. */
  atual: number;
}

/** Passos do onboarding (01 · Criar mundo): segmentos de 26 feitos e 14 pendentes. */
export function BarraPassos({ total, atual }: BarraPassosProps) {
  const { cores } = useTema();
  const texto = `Passo ${atual} de ${total}`;
  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={texto}
      accessibilityValue={{ min: 0, max: total, now: atual }}
      style={estilos.passos}
    >
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={[
            estilos.segmento,
            i < atual
              ? { width: 26, backgroundColor: cores.destaqueGrafico }
              : { width: 14, backgroundColor: cores.linha },
          ]}
        />
      ))}
      <Texto estilo="mini" cor="textoSuave">
        {texto}
      </Texto>
    </View>
  );
}

const estilos = StyleSheet.create({
  passos: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  segmento: { height: 5, borderRadius: 3 },
});
