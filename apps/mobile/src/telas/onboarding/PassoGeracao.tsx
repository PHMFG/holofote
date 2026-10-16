import type { Mundo } from '@holofote/shared';
import { Users } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useRelacoes } from '../../api/consultas';
import { useTema } from '../../tema/ProvedorTema';
import { Avatar } from '../../ui/Avatar';
import { Cartao } from '../../ui/Cartao';
import { Chip } from '../../ui/Chip';
import { Icone } from '../../ui/Icone';
import { LinhaDeLista } from '../../ui/LinhaDeLista';
import { Texto } from '../../ui/Texto';
import { useAgora } from '../../tempo';
import { RotuloGrupo, TopoDoPasso } from './TopoDoPasso';

/** O que a IA gera na criação (docs/PLANO.md); lista fixa, sem fingir progresso por item. */
const GERADOS = [
  'a bíblia do universo',
  'o elenco, cada um com sua personalidade',
  'os marcos do primeiro ato',
  'o primeiro evento',
  'o feed do dia 1',
] as const;

export interface PassoGeracaoProps {
  mundo: Mundo | undefined;
  /** Volta ao formulário (só no erro). */
  onEditar: () => void;
}

/** Passo 3: geração do mundo pela IA, elenco pronto ou erro com nova tentativa. */
export function PassoGeracao({ mundo, onEditar }: PassoGeracaoProps) {
  if (mundo?.estado === 'pronto') return <MundoPronto mundo={mundo} />;
  if (mundo?.estado === 'erro') {
    return (
      <>
        <TopoDoPasso
          passo={3}
          titulo="O mundo não saiu"
          texto="A IA não conseguiu terminar desta vez. Nada foi gasto: dá para tentar de novo agora ou mudar o universo."
        />
        <Chip rotulo="Mudar persona ou universo" variante="elevado" onPress={onEditar} />
      </>
    );
  }
  return <Gerando universo={mundo?.universo} />;
}

function Gerando({ universo }: { universo: string | undefined }) {
  const { cores } = useTema();
  const [inicio] = useState(() => Date.now());
  const agora = useAgora(1000);
  const segundos = Math.max(0, Math.round((agora - inicio) / 1000));
  return (
    <>
      <TopoDoPasso
        passo={3}
        titulo="Gerando seu mundo"
        texto={`A IA está escrevendo ${universo ? `"${universo}"` : 'o seu universo'}. Costuma levar alguns segundos.`}
      />
      <Cartao style={estilos.cartaoGerando}>
        <View
          style={estilos.linha}
          accessible
          accessibilityLiveRegion="polite"
          accessibilityLabel="Gerando o mundo"
        >
          <ActivityIndicator color={cores.textoSuave} accessibilityLabel="Gerando o mundo" />
          <Texto estilo="corpoForte" style={estilos.flex}>
            Gerando
          </Texto>
          <Texto estilo="legenda" cor="textoSuave">
            {segundos} s
          </Texto>
        </View>
        <Texto cor="textoSuave">A IA escreve agora {GERADOS.join(', ')}.</Texto>
        <Texto estilo="legenda" cor="textoSuave">
          Os números do jogo vêm do motor de regras, não da IA.
        </Texto>
      </Cartao>
    </>
  );
}

function MundoPronto({ mundo }: { mundo: Mundo }) {
  return (
    <>
      <TopoDoPasso
        passo={3}
        titulo="Seu mundo está pronto"
        texto={`${mundo.universo} · ${mundo.tomCaos}% caótico. Conheça quem divide o palco com você.`}
      />
      <View style={estilos.grupo}>
        <RotuloGrupo texto="Elenco gerado pela IA" />
        <ElencoGerado />
      </View>
    </>
  );
}

/** Elenco do mundo novo (Figma 14:82): nome, arroba e o rótulo da relação com o jogador. */
function ElencoGerado() {
  const relacoes = useRelacoes();
  const { cores } = useTema();

  if (relacoes.isPending) {
    return (
      <Cartao>
        <ActivityIndicator color={cores.textoSuave} accessibilityLabel="Carregando o elenco" />
      </Cartao>
    );
  }
  if (relacoes.isError) {
    return (
      <Cartao style={estilos.erroElenco}>
        <Texto cor="textoSuave">Não deu para carregar o elenco agora.</Texto>
        <Chip rotulo="Tentar de novo" variante="elevado" onPress={() => void relacoes.refetch()} />
      </Cartao>
    );
  }

  const nos = relacoes.data.nos;
  const elenco = nos.filter((no) => no.personagem.papel === 'elenco');
  const figurantes = nos.length - elenco.length;
  if (nos.length === 0) {
    return (
      <Cartao>
        <Texto cor="textoSuave">O elenco aparece no feed assim que você entrar.</Texto>
      </Cartao>
    );
  }
  return (
    <Cartao lista>
      {elenco.map(({ personagem, relacao }, i) => (
        <LinhaDeLista
          key={personagem.id}
          inicio={
            <Avatar
              iniciais={personagem.iniciais}
              tom={personagem.tomAvatar}
              nome={personagem.nome}
            />
          }
          titulo={personagem.nome}
          subtitulo={`${personagem.handle} · ${relacao.rotulo.toLowerCase()}`}
          separador={i < elenco.length - 1 || figurantes > 0}
        />
      ))}
      {figurantes > 0 && (
        <View style={estilos.figurantes} accessible>
          <Icone icone={Users} tamanho={16} />
          <Texto estilo="legenda" cor="textoSuave">
            + {figurantes} {figurantes === 1 ? 'figurante' : 'figurantes'}
          </Texto>
        </View>
      )}
    </Cartao>
  );
}

const estilos = StyleSheet.create({
  grupo: { gap: 10 },
  cartaoGerando: { gap: 10 },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  flex: { flex: 1 },
  erroElenco: { gap: 12, alignItems: 'flex-start' },
  figurantes: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 12,
    paddingBottom: 10,
  },
});
