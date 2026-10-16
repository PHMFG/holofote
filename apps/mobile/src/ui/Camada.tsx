import type { Gradiente, NomeCor, NomeGradiente, NomeSombra } from '@holofote/tokens';
import { LinearGradient } from 'expo-linear-gradient';
import { useId } from 'react';
import { StyleSheet, View, type ColorValue, type ViewProps } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { useTema } from '../tema/ProvedorTema';

export interface CamadaProps extends ViewProps {
  /** Preenchimento sólido por token. */
  cor?: NomeCor;
  /** Preenchimento por gradiente do Figma (Cromo/... ou Cromo Escuro/..., conforme o modo). */
  gradiente?: NomeGradiente;
  /** Estilo de efeito do Figma; as sombras internas vão numa camada por cima do conteúdo. */
  sombra?: NomeSombra;
  raio?: number;
  borda?: { cor: NomeCor; largura: number };
}

/**
 * Bloco base do sistema Cromo: fundo (cor ou gradiente), sombras externas e internas e borda.
 * Pilha igual à do inset no CSS: sombra externa, preenchimento, sombra interna e, por cima, o
 * conteúdo (a sombra interna não escurece os filhos).
 */
export function Camada({
  cor,
  gradiente,
  sombra,
  raio = 0,
  borda,
  style,
  children,
  ...props
}: CamadaProps) {
  const tema = useTema();
  const camadas = sombra ? tema.sombras[sombra] : [];
  const externas = camadas.filter((s) => !s.inset);
  const internas = camadas.filter((s) => s.inset);
  const raioInterno = Math.max(0, raio - (borda?.largura ?? 0));

  return (
    <View
      {...props}
      style={[
        {
          borderRadius: raio,
          backgroundColor: cor ? tema.cores[cor] : undefined,
          boxShadow: externas.length > 0 ? externas : undefined,
        },
        borda && { borderWidth: borda.largura, borderColor: tema.cores[borda.cor] },
        style,
      ]}
    >
      {gradiente && <Preenchimento gradiente={tema.gradientes[gradiente]} raio={raioInterno} />}
      {internas.length > 0 && (
        <View
          pointerEvents="none"
          accessible={false}
          style={[StyleSheet.absoluteFill, { borderRadius: raioInterno, boxShadow: internas }]}
        />
      )}
      {children}
    </View>
  );
}

function Preenchimento({ gradiente, raio }: { gradiente: Gradiente; raio: number }) {
  const id = `g${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const forma = [StyleSheet.absoluteFill, { borderRadius: raio, overflow: 'hidden' as const }];

  if (gradiente.tipo === 'linear') {
    return (
      <LinearGradient
        pointerEvents="none"
        colors={gradiente.cores as unknown as readonly [ColorValue, ColorValue, ...ColorValue[]]}
        locations={gradiente.posicoes as unknown as readonly [number, number, ...number[]]}
        start={gradiente.inicio}
        end={gradiente.fim}
        style={forma}
      />
    );
  }

  const pct = (n: number) => `${n * 100}%`;
  return (
    <View pointerEvents="none" style={forma}>
      <Svg width="100%" height="100%">
        <Defs>
          <RadialGradient
            id={id}
            cx={pct(gradiente.centro.x)}
            cy={pct(gradiente.centro.y)}
            fx={pct(gradiente.centro.x)}
            fy={pct(gradiente.centro.y)}
            rx={pct(gradiente.raioX)}
            ry={pct(gradiente.raioY)}
          >
            {gradiente.cores.map((corParada, i) => (
              <Stop key={i} offset={gradiente.posicoes[i]} stopColor={corParada} />
            ))}
          </RadialGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}
