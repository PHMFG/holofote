import type { PersonagemResumo } from '@holofote/shared';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Svg, { Line } from 'react-native-svg';
import { useTema } from '../../tema/ProvedorTema';
import { Avatar } from '../../ui/Avatar';
import { Camada } from '../../ui/Camada';
import { Texto } from '../../ui/Texto';
import { primeiroNome } from '../../formatar';
import {
  LIMITE_PROXIMO,
  alturaDoMapa,
  dimensoesDosNos,
  estiloDoLaco,
  posicionarNos,
  type NoDoMapa,
} from './layout';

const JOGADOR = 60;
const CAIXA_JOGADOR = 96;
/**
 * Caixa de cada nó, bem mais larga que o rótulo: o rótulo se ajusta ao texto (sem reticências) e o
 * layout já reservou o lugar dele. A caixa é só transparente; o toque fica no avatar e no rótulo.
 */
const CAIXA_DO_NO = 160;

export interface GrafoProps {
  jogador: PersonagemResumo;
  nos: readonly NoDoMapa[];
  selecionadoId: string | null;
  onSelecionar: (personagemId: string) => void;
  /** Frase no lugar dos nós quando o filtro não tem ninguém. */
  vazio: string;
}

/** Grafo de 21 · Mapa de relações (Figma 57:1729): o jogador no centro, o elenco em volta. */
export function Grafo({ jogador, nos, selecionadoId, onSelecionar, vazio }: GrafoProps) {
  const { cores, medidas } = useTema();
  const janela = useWindowDimensions();
  // Antes do primeiro onLayout, a largura da tela menos as margens.
  const [largura, setLargura] = useState(janela.width - medidas.margemLateral * 2);
  const altura = alturaDoMapa(nos.length);
  // O primeiro nome inteiro sempre que couber. Mapa denso (10 ou mais): avatar menor e rótulo só
  // com o nome; o percentual vai ao selecionar. No folgado, o percentual sai se não couber.
  const { avatar } = dimensoesDosNos(nos.length);
  const {
    centro,
    nos: pontos,
    comPercentual,
  } = useMemo(
    () =>
      posicionarNos(
        nos.map((n) => n.relacao.afinidade),
        largura,
        altura,
        nos.map((n) => primeiroNome(n.personagem.nome)),
      ),
    [nos, largura, altura],
  );

  return (
    <Camada
      cor="superficie"
      sombra="elevacao"
      raio={medidas.cartaoRaio}
      style={{ height: altura }}
      onLayout={(e) => setLargura(e.nativeEvent.layout.width)}
    >
      <View pointerEvents="none" style={StyleSheet.absoluteFill} accessible={false}>
        <Svg width={largura} height={altura}>
          {nos.map((no, i) => {
            const ponto = pontos[i]!;
            const laco = estiloDoLaco(no.relacao.afinidade);
            return (
              <Line
                key={no.personagem.id}
                x1={centro.x}
                y1={centro.y}
                x2={ponto.x}
                y2={ponto.y}
                stroke={cores[laco.cor]}
                strokeWidth={laco.largura}
                strokeDasharray={laco.tracejado ? '4 4' : undefined}
                strokeLinecap="round"
              />
            );
          })}
        </Svg>
      </View>

      <View
        pointerEvents="none"
        style={[
          estilos.no,
          { width: CAIXA_JOGADOR, left: centro.x - CAIXA_JOGADOR / 2, top: centro.y - JOGADOR / 2 },
        ]}
        accessible
        accessibilityLabel={`Você, ${jogador.nome}`}
      >
        <Avatar iniciais={jogador.iniciais} tom="escuro" tamanho={JOGADOR} />
        <Camada cor="superficie" raio={999} style={estilos.halo}>
          <Camada cor="superficie" raio={999} style={estilos.rotulo}>
            <Texto estilo="legenda">Você</Texto>
          </Camada>
        </Camada>
      </View>

      {nos.map((no, i) => {
        const ponto = pontos[i]!;
        const { personagem, relacao } = no;
        const selecionado = personagem.id === selecionadoId;
        return (
          <View
            key={personagem.id}
            pointerEvents="box-none"
            style={[
              estilos.no,
              {
                width: CAIXA_DO_NO,
                left: ponto.x - CAIXA_DO_NO / 2,
                top: ponto.y - avatar / 2,
              },
            ]}
          >
            <Pressable
              onPress={() => onSelecionar(personagem.id)}
              accessibilityRole="button"
              accessibilityLabel={`${personagem.nome}, ${relacao.rotulo}, ${relacao.afinidade}%`}
              accessibilityState={{ selected: selecionado }}
              hitSlop={4}
              style={({ pressed }) => [estilos.toque, { opacity: pressed ? 0.75 : 1 }]}
            >
              <Avatar iniciais={personagem.iniciais} tom={personagem.tomAvatar} tamanho={avatar} />
              {/* O halo na cor do cartão cobre a linha que passa perto do rótulo. */}
              <Camada cor="superficie" raio={999} style={estilos.halo}>
                <Camada
                  cor="superficie"
                  raio={999}
                  // Borda sempre presente (da cor do fundo quando não selecionado) para não mudar o tamanho.
                  borda={{ cor: selecionado ? 'destaque' : 'superficie', largura: 1 }}
                  style={estilos.rotulo}
                >
                  <Texto estilo="legenda" numberOfLines={1}>
                    {primeiroNome(personagem.nome)}
                  </Texto>
                  {comPercentual && (
                    <Texto
                      estilo="legenda"
                      cor={relacao.afinidade >= LIMITE_PROXIMO ? 'destaqueTinta' : 'textoSuave'}
                    >
                      {relacao.afinidade}%
                    </Texto>
                  )}
                </Camada>
              </Camada>
            </Pressable>
          </View>
        );
      })}

      {nos.length === 0 && (
        <View pointerEvents="none" style={[estilos.vazio, { top: centro.y + JOGADOR / 2 + 40 }]}>
          <Texto cor="textoSuave" style={estilos.textoVazio}>
            {vazio}
          </Texto>
        </View>
      )}
    </Camada>
  );
}

const estilos = StyleSheet.create({
  no: { position: 'absolute', alignItems: 'center' },
  toque: { alignItems: 'center' },
  halo: { marginTop: 2, padding: 2 },
  rotulo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  vazio: { position: 'absolute', left: 16, right: 16 },
  textoVazio: { textAlign: 'center' },
});
