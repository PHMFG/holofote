import { NOMES_DESTAQUE, destaques, type NomeDestaque } from '@holofote/tokens';
import { Check, Monitor, Moon, Sun } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { useMundo, useSalvarAparencia } from '../../api/consultas';
import { useAparencia, type PreferenciaTema } from '../../estado/aparencia';
import { useTema } from '../../tema/ProvedorTema';
import { Avatar } from '../../ui/Avatar';
import { BarraProgresso } from '../../ui/BarraProgresso';
import { BotaoMetal } from '../../ui/BotaoMetal';
import { Cabecalho } from '../../ui/Cabecalho';
import { Camada } from '../../ui/Camada';
import { Cartao } from '../../ui/Cartao';
import { Chip } from '../../ui/Chip';
import { Icone } from '../../ui/Icone';
import { Interruptor } from '../../ui/Interruptor';
import { LinhaDeLista } from '../../ui/LinhaDeLista';
import { RotuloSecao } from '../../ui/Rotulo';
import { Segmentado } from '../../ui/Segmentado';
import { Tela } from '../../ui/Tela';
import { Texto } from '../../ui/Texto';
import { useAjustes, useReduzirMovimentoDoSistema } from './ajustes';

export const NOME_DESTAQUE: Record<NomeDestaque, string> = {
  laranja: 'Laranja',
  cobalto: 'Cobalto',
  violeta: 'Violeta',
  rosa: 'Rosa',
  menta: 'Menta',
  lima: 'Lima',
};

const NOME_TEMA: Record<PreferenciaTema, string> = {
  claro: 'claro',
  escuro: 'escuro',
  sistema: 'do sistema',
};

/**
 * 10 · Aparência (Figma 28:429 claro, 31:1172 escuro): tema e cor de destaque mudam na hora
 * (estado local em MMKV) e são salvos na conta; a prévia mostra onde o destaque aparece.
 */
export function TelaAparencia() {
  const { tema, destaque, definirTema, definirDestaque } = useAparencia();
  const salvar = useSalvarAparencia();
  const [naoSalvou, setNaoSalvou] = useState(false);

  // A mudança vale na hora; a conta guarda para o próximo aparelho. Sem rede, fica só aqui.
  const salvarNaConta = () => {
    const atual = useAparencia.getState();
    salvar.mutate(
      { tema: atual.tema, destaque: atual.destaque },
      { onSuccess: () => setNaoSalvou(false), onError: () => setNaoSalvou(true) },
    );
  };

  return (
    <Tela cabecalho={<Cabecalho titulo="Aparência" />} gap={14}>
      <Grupo titulo="Prévia">
        <Previa destaque={destaque} tema={tema} />
      </Grupo>

      <Grupo titulo="Tema">
        <Segmentado<PreferenciaTema>
          rotulo="Tema"
          valor={tema}
          onMudar={(novo) => {
            definirTema(novo);
            salvarNaConta();
          }}
          opcoes={[
            { valor: 'claro', rotulo: 'Claro', icone: Sun },
            { valor: 'escuro', rotulo: 'Escuro', icone: Moon },
            { valor: 'sistema', rotulo: 'Sistema', icone: Monitor },
          ]}
        />
      </Grupo>

      <Grupo titulo="Cor de destaque">
        <Cartao style={estilos.cores}>
          <View
            style={estilos.amostras}
            accessibilityRole="radiogroup"
            accessibilityLabel="Cor de destaque"
          >
            {NOMES_DESTAQUE.map((nome) => (
              <Amostra
                key={nome}
                nome={nome}
                escolhida={nome === destaque}
                onPress={() => {
                  definirDestaque(nome);
                  salvarNaConta();
                }}
              />
            ))}
          </View>
          <Texto estilo="legenda" cor="textoSuave">
            Vale para barras, links, novidades e o brilho do botão principal. A interface continua
            em cinza.
          </Texto>
          {naoSalvou && (
            <Texto estilo="legenda" cor="destaqueTinta" accessibilityRole="alert">
              Salvo só neste aparelho por enquanto. A conta atualiza na próxima mudança.
            </Texto>
          )}
        </Cartao>
      </Grupo>

      <Grupo titulo="Ajustes">
        <Ajustes />
      </Grupo>
    </Tela>
  );
}

function Grupo({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <View style={estilos.grupo}>
      <RotuloSecao texto={titulo} />
      {children}
    </View>
  );
}

/**
 * Prévia do Figma (28:452) com um botão principal pequeno: destaque-suave no chip, barra em
 * destaque-gráfico, ponto e link em destaque e o brilho do botão metálico. É só ilustração:
 * o VoiceOver lê um resumo e o toque não passa para os elementos.
 */
function Previa({ destaque, tema }: { destaque: NomeDestaque; tema: PreferenciaTema }) {
  const { cores } = useTema();
  const mundo = useMundo();
  const jogador = mundo.data?.jogador;
  return (
    <Cartao
      style={estilos.previa}
      accessible
      accessibilityLabel={`Prévia do destaque ${NOME_DESTAQUE[destaque]} no tema ${NOME_TEMA[tema]}: barra de progresso, chip, link e botão principal.`}
    >
      <View pointerEvents="none" style={estilos.previaConteudo}>
        <View style={estilos.linha}>
          <Avatar iniciais={jogador?.iniciais ?? 'EU'} tom="escuro" nome={jogador?.nome} />
          <View style={estilos.flex}>
            <Texto estilo="corpoForte" numberOfLines={1}>
              {jogador?.nome ?? 'Você'}
            </Texto>
            <Texto estilo="legenda" cor="textoSuave" numberOfLines={1}>
              Texto de exemplo
            </Texto>
          </View>
          <Chip rotulo="Chip de exemplo" variante="suave" tamanho="pequeno" />
        </View>
        <BarraProgresso valor={0.62} rotulo="Barra de exemplo" />
        <View style={estilos.linha}>
          <View style={[estilos.ponto, { backgroundColor: cores.destaque }]} />
          <Texto estilo="legenda" cor="textoSuave" style={estilos.flex}>
            Item de exemplo
          </Texto>
          <Texto estilo="legenda" cor="destaqueTinta">
            Ver detalhes
          </Texto>
        </View>
        <BotaoMetal rotulo="Botão principal" style={estilos.botao} />
      </View>
    </Cartao>
  );
}

/** Bolinha de cor no anel (28:500): a escolhida ganha o anel em texto e o check. */
function Amostra(p: { nome: NomeDestaque; escolhida: boolean; onPress: () => void }) {
  const { cores } = useTema();
  return (
    <Pressable
      onPress={p.onPress}
      accessibilityRole="radio"
      accessibilityLabel={NOME_DESTAQUE[p.nome]}
      accessibilityState={{ checked: p.escolhida }}
      hitSlop={4}
      style={estilos.amostra}
    >
      <View style={[estilos.anel, { borderColor: p.escolhida ? cores.texto : 'transparent' }]}>
        <Camada
          sombra="esferaClara"
          raio={20}
          style={[estilos.cor, { backgroundColor: destaques[p.nome].base }]}
        >
          {p.escolhida && <Icone icone={Check} tamanho={18} cor="destaqueSobre" traco={2.4} />}
        </Camada>
      </View>
      <Texto estilo="legenda" cor={p.escolhida ? 'texto' : 'textoSuave'} numberOfLines={1}>
        {NOME_DESTAQUE[p.nome]}
      </Texto>
    </Pressable>
  );
}

/**
 * Ajustes (28:536). Só "Reduzir animações" tem efeito neste aparelho. "Brilho no botão
 * principal" dependeria de uma opção no BotaoMetal e "Ícone do app na cor de destaque", de
 * ícones alternativos no build nativo; ficam de fora até existirem.
 */
function Ajustes() {
  const reduzir = useAjustes((s) => s.reduzirAnimacoes);
  const definir = useAjustes((s) => s.definirReduzirAnimacoes);
  const doSistema = useReduzirMovimentoDoSistema();
  return (
    <Cartao lista>
      <LinhaDeLista
        titulo="Reduzir animações"
        subtitulo={
          doSistema
            ? 'O iPhone já pede menos movimento.'
            : 'Menos movimento nos gestos e transições.'
        }
        separador={false}
        fim={<Interruptor valor={reduzir} onMudar={definir} rotulo="Reduzir animações" />}
      />
    </Cartao>
  );
}

const estilos = StyleSheet.create({
  flex: { flex: 1 },
  grupo: { gap: 8 },
  previa: { gap: 12 },
  previaConteudo: { gap: 12 },
  linha: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  ponto: { width: 8, height: 8, borderRadius: 4 },
  botao: { alignSelf: 'center', width: 220 },
  cores: { gap: 14 },
  amostras: { flexDirection: 'row', justifyContent: 'space-between' },
  amostra: { alignItems: 'center', gap: 6 },
  anel: { borderWidth: 2, borderRadius: 999, padding: 3 },
  cor: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
});
