import type { Enquete } from '@holofote/shared';
import { Check } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { useTema } from '../../tema/ProvedorTema';
import { Camada } from '../../ui/Camada';
import { Icone } from '../../ui/Icone';
import { Texto } from '../../ui/Texto';
import { BarraChance } from '../evento/BarraChance';
import { parcelasDaEnquete } from './formatar';

export interface EnqueteHistoriaProps {
  enquete: Enquete;
  onVotar: (opcaoId: string) => void;
  votando: boolean;
}

/**
 * Enquete da história (Figma 54:1505). Antes do voto, as opções são botões; depois, cada uma
 * mostra a porcentagem e o seu voto ganha o check e a barra em destaque. Votar não gasta energia.
 */
export function EnqueteHistoria({ enquete, onVotar, votando }: EnqueteHistoriaProps) {
  const { medidas } = useTema();
  const votou = enquete.meuVoto !== null;
  const parcelas = parcelasDaEnquete(enquete);

  return (
    <Camada cor="superficie" sombra="elevacao" raio={medidas.cartaoRaio} style={estilos.cartao}>
      <Texto estilo="mini" cor="textoSuave" accessibilityRole="header">
        Enquete · {enquete.pergunta}
      </Texto>
      {votou
        ? parcelas.map((opcao) => {
            const minha = opcao.id === enquete.meuVoto;
            return (
              <View
                key={opcao.id}
                style={estilos.resultado}
                accessible
                accessibilityLabel={`${opcao.texto}, ${opcao.porcentagem}%${minha ? ', seu voto' : ''}`}
              >
                <View style={estilos.linha}>
                  {minha && <Icone icone={Check} tamanho={14} cor="destaqueTinta" traco={2} />}
                  <Texto
                    estilo="corpoForte"
                    cor={minha ? 'texto' : 'textoSuave'}
                    numberOfLines={1}
                    style={estilos.flex}
                  >
                    {opcao.texto}
                  </Texto>
                  <Texto estilo="corpoForte" cor={minha ? 'destaqueTinta' : 'textoSuave'}>
                    {opcao.porcentagem}%
                  </Texto>
                </View>
                <BarraChance
                  valor={opcao.parcela}
                  rotulo={`Votos em ${opcao.texto}`}
                  altura={8}
                  destaque={minha}
                />
              </View>
            );
          })
        : enquete.opcoes.map((opcao) => (
            <OpcaoParaVotar
              key={opcao.id}
              texto={opcao.texto}
              desabilitada={votando}
              onPress={() => onVotar(opcao.id)}
            />
          ))}
      <Texto estilo="legenda" cor="textoSuave">
        {votou ? 'Você votou · 0 energia' : 'Votar é grátis · 0 energia'}
      </Texto>
    </Camada>
  );
}

function OpcaoParaVotar(p: { texto: string; desabilitada: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={p.onPress}
      disabled={p.desabilitada}
      accessibilityRole="button"
      accessibilityLabel={`Votar em ${p.texto}, grátis`}
      accessibilityState={{ disabled: p.desabilitada }}
      style={({ pressed }) => ({ opacity: pressed || p.desabilitada ? 0.7 : 1 })}
    >
      <Camada cor="fundo" borda={{ cor: 'linha', largura: 1 }} raio={999} style={estilos.opcao}>
        <Texto estilo="corpoForte" numberOfLines={2}>
          {p.texto}
        </Texto>
      </Camada>
    </Pressable>
  );
}

const estilos = StyleSheet.create({
  cartao: { width: '100%', maxWidth: 300, padding: 18, gap: 12 },
  resultado: { gap: 6 },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  flex: { flex: 1 },
  opcao: { paddingHorizontal: 16, paddingVertical: 10 },
});
