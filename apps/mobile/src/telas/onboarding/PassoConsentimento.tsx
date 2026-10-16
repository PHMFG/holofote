import { ShieldCheck } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { Cartao } from '../../ui/Cartao';
import { Esfera, corSobreEsfera } from '../../ui/Esfera';
import { Icone } from '../../ui/Icone';
import { Interruptor } from '../../ui/Interruptor';
import { LinhaDeLista } from '../../ui/LinhaDeLista';
import { Texto } from '../../ui/Texto';
import { RotuloGrupo, TopoDoPasso } from './TopoDoPasso';

const PONTOS = [
  'Seus posts, comentários e mensagens são enviados a modelos de IA de terceiros, pelo OpenCode, para o elenco reagir ao que você escreve.',
  'A IA escreve o texto dos personagens. Os números do jogo (seguidores, fama, relações) saem do motor de regras.',
  'Não escreva dados pessoais reais, como seu nome completo, endereço ou telefone.',
] as const;

export interface PassoConsentimentoProps {
  aceito: boolean;
  onAceitar: (aceito: boolean) => void;
}

/**
 * Passo 1: consentimento para o uso de IA de terceiros, exigido pela regra 5.1.2(i) da App Store
 * (docs/PLANO.md, segurança). Sem o aceite o jogo não começa.
 */
export function PassoConsentimento({ aceito, onAceitar }: PassoConsentimentoProps) {
  return (
    <>
      <TopoDoPasso
        passo={1}
        titulo="Antes de começar"
        texto="Aqui só você é humano. Todo o resto do elenco é escrito por IA."
      />
      <View style={estilos.grupo}>
        <RotuloGrupo texto="Como seus textos são usados" />
        <Cartao style={estilos.cartao}>
          <View style={estilos.cabeca}>
            <Esfera tom="escuro" tamanho={40}>
              <Icone icone={ShieldCheck} tamanho={18} cor={corSobreEsfera('escuro')} traco={2} />
            </Esfera>
            <Texto estilo="corpoForte" style={estilos.flex}>
              IA de terceiros, com o seu aceite
            </Texto>
          </View>
          {PONTOS.map((ponto) => (
            <View key={ponto} style={estilos.ponto}>
              <Texto cor="textoSuave" accessible={false}>
                ·
              </Texto>
              <Texto cor="textoSuave" style={estilos.flex}>
                {ponto}
              </Texto>
            </View>
          ))}
        </Cartao>
      </View>
      <Cartao lista>
        <LinhaDeLista
          titulo="Aceito o uso de IA"
          subtitulo="Obrigatório para jogar"
          separador={false}
          fim={
            <Interruptor
              valor={aceito}
              onMudar={onAceitar}
              rotulo="Aceito o uso de IA de terceiros"
            />
          }
        />
      </Cartao>
      {/* PROVISÓRIO: vira link para a política em português (LGPD) antes do TestFlight. */}
      <Texto estilo="legenda" cor="textoSuave">
        Detalhes na Política de privacidade do Holofote (link em breve).
      </Texto>
    </>
  );
}

const estilos = StyleSheet.create({
  grupo: { gap: 10 },
  cartao: { gap: 10 },
  cabeca: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingBottom: 2 },
  ponto: { flexDirection: 'row', gap: 8 },
  flex: { flex: 1 },
});
