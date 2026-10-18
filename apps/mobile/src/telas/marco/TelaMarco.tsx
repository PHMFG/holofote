import type { Marco } from '@holofote/shared';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import {
  Check,
  Gem,
  Target,
  Ticket,
  Trophy,
  UserCheck,
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { tratarErroDeAcao } from '../../acoes/erros';
import { useTema } from '../../tema/ProvedorTema';
import { ErroDaApi } from '../../api/cliente';
import { useJornada, useResgatarMarco } from '../../api/consultas';
import { Aparecer } from '../../ui/Aparecer';
import { BotaoMetal } from '../../ui/BotaoMetal';
import { BotaoSuave } from '../../ui/BotaoSuave';
import { Cabecalho } from '../../ui/Cabecalho';
import { Camada } from '../../ui/Camada';
import { Cartao } from '../../ui/Cartao';
import { Chip } from '../../ui/Chip';
import { Esfera, corSobreEsfera } from '../../ui/Esfera';
import { EstadoTela } from '../../ui/EstadoTela';
import { Icone } from '../../ui/Icone';
import { LinhaDeLista } from '../../ui/LinhaDeLista';
import { MOLA, useMovimento } from '../../ui/movimento';
import { Tela } from '../../ui/Tela';
import { Texto } from '../../ui/Texto';
import { ordenarMarcos } from '../jornada/jornada';
import { Confete, Halo, Pop, Reluzir, Troca, usePulso } from '../perfil/efeitos';
import { NumeroContando } from '../perfil/NumeroContando';

/** Pausa com a celebração na tela depois de resgatar, antes de fechar. */
const PAUSA_DA_CELEBRACAO_MS = 1400;
const PAUSA_REDUZIDA_MS = 600;

const fechar = () => router.back();

const cabecalho = (
  <Cabecalho
    navegacao="nenhuma"
    direita={<BotaoSuave icone={X} rotulo="Fechar" onPress={fechar} />}
  />
);

interface LinhaRecompensa {
  icone: LucideIcon;
  rotulo: string;
  valor: string;
  /** Gemas em destaque-tinta, como no Figma (56:1491). */
  destaque?: boolean;
}

function linhasDaRecompensa(recompensa: Marco['recompensa']): LinhaRecompensa[] {
  const linhas: LinhaRecompensa[] = [];
  if (recompensa.gemas > 0)
    linhas.push({ icone: Gem, rotulo: 'Gemas', valor: `+${recompensa.gemas}`, destaque: true });
  // O nome de quem chega sai da ficha gerada pela IA no lote, depois do resgate.
  if (recompensa.personagemNovo)
    linhas.push({ icone: UserCheck, rotulo: 'Novo no elenco', valor: '1 personagem' });
  if (recompensa.acaoNova)
    linhas.push({ icone: Ticket, rotulo: 'Ação liberada', valor: recompensa.acaoNova });
  if (recompensa.energiaCheia)
    linhas.push({ icone: Zap, rotulo: 'Energia', valor: 'recarga completa' });
  return linhas;
}

/** 18 · Marco liberado (Figma 56:1445 claro, 58:2353 escuro). */
export function TelaMarco({ id }: { id: string }) {
  const jornada = useJornada();
  const resgatar = useResgatarMarco();
  const { reduzido } = useMovimento();
  const [celebrando, setCelebrando] = useState(false);
  const fecharEm = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(fecharEm.current), []);

  if (!jornada.data) {
    return (
      <Tela cabecalho={cabecalho} rolavel={false}>
        <EstadoTela
          tipo={jornada.isError ? 'erro' : 'carregando'}
          frase={jornada.isError ? 'Não deu para abrir o marco.' : 'Abrindo o marco…'}
          acao={
            jornada.isError
              ? { rotulo: 'Tentar de novo', onPress: () => void jornada.refetch() }
              : undefined
          }
        />
      </Tela>
    );
  }

  const marcos = ordenarMarcos(jornada.data.marcos);
  const marco = marcos.find((m) => m.id === id);
  if (!marco || marco.estado !== 'concluido') {
    return (
      <Tela cabecalho={cabecalho} rolavel={false}>
        <EstadoTela
          tipo="vazio"
          frase={marco ? 'Este marco ainda não foi liberado.' : 'Esse marco não existe neste ato.'}
          acao={{ rotulo: 'Fechar', onPress: fechar }}
        />
      </Tela>
    );
  }

  const proximo = marcos.find((m) => m.ordem === marco.ordem + 1);
  const linhas = linhasDaRecompensa(marco.recompensa);

  const aoResgatar = () =>
    resgatar.mutate(marco.id, {
      onSuccess: () => {
        // A vibração e a celebração começam juntas; a tela fecha depois que o jogador viu o check.
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        setCelebrando(true);
        clearTimeout(fecharEm.current);
        fecharEm.current = setTimeout(
          fechar,
          reduzido ? PAUSA_REDUZIDA_MS : PAUSA_DA_CELEBRACAO_MS,
        );
      },
      onError: (erro) => {
        // "Já resgatado" é sucesso: a jornada relida troca o botão por "Recompensas resgatadas".
        if (erro instanceof ErroDaApi && erro.codigo === 'marco_resgatado') return;
        tratarErroDeAcao(erro);
      },
    });

  const rodape =
    marco.resgatado || celebrando ? (
      <View style={estilos.rodape}>
        <View style={estilos.resgatadas} accessible accessibilityLiveRegion="polite">
          <Pop de={0.2} mola={MOLA.viva}>
            <Icone icone={Check} tamanho={15} cor="textoSuave" traco={2} />
          </Pop>
          <Texto estilo="legenda" cor="textoSuave">
            Recompensas resgatadas
          </Texto>
        </View>
        <BotaoMetal rotulo="Fechar" onPress={fechar} />
      </View>
    ) : (
      <BotaoDeResgate pendente={resgatar.isPending} onPress={aoResgatar} />
    );

  return (
    <Tela cabecalho={cabecalho} rodape={rodape} gap={14}>
      <View style={estilos.palco}>
        <Cena celebrando={celebrando} />
        <Aparecer indice={2} atraso={250}>
          <Texto estilo="mini" cor="destaqueTinta">
            Marco {marco.ordem} de {marcos.length} · liberado
          </Texto>
        </Aparecer>
        <Aparecer indice={3} atraso={250}>
          <Texto estilo="display" accessibilityRole="header" style={estilos.centro}>
            {marco.titulo}
          </Texto>
        </Aparecer>
        {marco.descricao ? (
          <Aparecer indice={4} atraso={250}>
            <Texto cor="textoSuave" style={[estilos.centro, estilos.descricao]}>
              {marco.descricao}
            </Texto>
          </Aparecer>
        ) : null}
      </View>

      {linhas.length > 0 && (
        <Cartao lista>
          {linhas.map((linha, i) => (
            <Aparecer key={linha.rotulo} indice={i} atraso={650}>
              <LinhaDeLista
                titulo={linha.rotulo}
                tituloDiscreto
                inicio={
                  <Pop de={0.3} atraso={700 + i * 40}>
                    <Esfera tom="claro" tamanho={32}>
                      <Icone icone={linha.icone} tamanho={14} cor="texto" traco={2} />
                    </Esfera>
                  </Pop>
                }
                fim={
                  <NumeroContando
                    estilo="corpoForte"
                    cor={linha.destaque ? 'destaqueTinta' : 'texto'}
                    texto={linha.valor}
                    atraso={800 + i * 40}
                  />
                }
                rotuloAcessivel={`${linha.rotulo}: ${linha.valor}`}
                separador={i < linhas.length - 1}
              />
            </Aparecer>
          ))}
        </Cartao>
      )}

      {proximo && (
        <Aparecer indice={linhas.length} atraso={700} style={estilos.proximo}>
          <Chip rotulo={`Próximo: ${proximo.titulo}`} icone={Target} sobreFundo />
        </Aparecer>
      )}
    </Tela>
  );
}

/**
 * Palco da celebração: a esfera entra com mola "viva" dentro do halo, que respira com ondas se
 * abrindo por trás. Ao resgatar, o troféu vira um check, uma onda grande sai do centro e as
 * partículas explodem junto com a vibração de sucesso.
 */
function Cena({ celebrando }: { celebrando: boolean }) {
  const respiro = usePulso(true, { ate: 1.04, duracao: 1600 });
  return (
    <View style={estilos.cena}>
      <Halo escala={1.8} duracao={2600} atraso={500} />
      <Halo escala={1.8} duracao={2600} atraso={1800} />
      {celebrando && <Halo escala={2.6} duracao={900} unico cor="destaqueSuave" />}
      <Pop de={0.5} atraso={80} mola={MOLA.suave}>
        <Animated.View style={respiro}>
          <Camada cor="destaqueSuave" sombra="brilhoDestaque" raio={75} style={estilos.halo}>
            <Pop de={0.2} atraso={220} mola={MOLA.viva}>
              <Esfera tom="escuro" tamanho={104}>
                <Troca chave={celebrando ? 'check' : 'trofeu'}>
                  <Icone
                    icone={celebrando ? Check : Trophy}
                    tamanho={47}
                    cor={corSobreEsfera('escuro')}
                  />
                </Troca>
              </Esfera>
            </Pop>
          </Camada>
        </Animated.View>
      </Pop>
      <Confete disparar={celebrando} raio={130} />
    </View>
  );
}

/** Resgatar com uma faixa de luz passando de tempos em tempos, chamando para o toque. */
function BotaoDeResgate({ pendente, onPress }: { pendente: boolean; onPress: () => void }) {
  const { medidas } = useTema();
  return (
    <Reluzir raio={medidas.botaoMetalAltura / 2} ativo={!pendente}>
      <BotaoMetal
        rotulo={pendente ? 'Resgatando…' : 'Resgatar recompensas'}
        disabled={pendente}
        onPress={onPress}
      />
    </Reluzir>
  );
}

const estilos = StyleSheet.create({
  cena: { width: 150, height: 150, alignItems: 'center', justifyContent: 'center' },
  palco: { alignItems: 'center', gap: 14, paddingHorizontal: 8, paddingTop: 8 },
  halo: { width: 150, height: 150, alignItems: 'center', justifyContent: 'center' },
  centro: { textAlign: 'center' },
  descricao: { maxWidth: 300 },
  proximo: { alignItems: 'center' },
  rodape: { gap: 14 },
  resgatadas: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
});
