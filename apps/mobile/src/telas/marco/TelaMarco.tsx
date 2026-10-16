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
import { StyleSheet, View } from 'react-native';
import { tratarErroDeAcao } from '../../acoes/erros';
import { ErroDaApi } from '../../api/cliente';
import { useJornada, useResgatarMarco } from '../../api/consultas';
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
import { Tela } from '../../ui/Tela';
import { Texto } from '../../ui/Texto';
import { ordenarMarcos } from '../jornada/jornada';

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
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        router.back();
      },
      onError: (erro) => {
        // "Já resgatado" é sucesso: a jornada relida troca o botão por "Recompensas resgatadas".
        if (erro instanceof ErroDaApi && erro.codigo === 'marco_resgatado') return;
        tratarErroDeAcao(erro);
      },
    });

  const rodape = marco.resgatado ? (
    <View style={estilos.rodape}>
      <View style={estilos.resgatadas} accessible accessibilityLiveRegion="polite">
        <Icone icone={Check} tamanho={15} cor="textoSuave" traco={2} />
        <Texto estilo="legenda" cor="textoSuave">
          Recompensas resgatadas
        </Texto>
      </View>
      <BotaoMetal rotulo="Fechar" onPress={fechar} />
    </View>
  ) : (
    <BotaoMetal
      rotulo={resgatar.isPending ? 'Resgatando…' : 'Resgatar recompensas'}
      disabled={resgatar.isPending}
      onPress={aoResgatar}
    />
  );

  return (
    <Tela cabecalho={cabecalho} rodape={rodape} gap={14}>
      <View style={estilos.palco}>
        <Camada cor="destaqueSuave" sombra="brilhoDestaque" raio={75} style={estilos.halo}>
          <Esfera tom="escuro" tamanho={104}>
            <Icone icone={Trophy} tamanho={47} cor={corSobreEsfera('escuro')} />
          </Esfera>
        </Camada>
        <Texto estilo="mini" cor="destaqueTinta">
          Marco {marco.ordem} de {marcos.length} · liberado
        </Texto>
        <Texto estilo="display" accessibilityRole="header" style={estilos.centro}>
          {marco.titulo}
        </Texto>
        {marco.descricao ? (
          <Texto cor="textoSuave" style={[estilos.centro, estilos.descricao]}>
            {marco.descricao}
          </Texto>
        ) : null}
      </View>

      {linhas.length > 0 && (
        <Cartao lista>
          {linhas.map((linha, i) => (
            <LinhaDeLista
              key={linha.rotulo}
              titulo={linha.rotulo}
              tituloDiscreto
              inicio={
                <Esfera tom="claro" tamanho={32}>
                  <Icone icone={linha.icone} tamanho={14} cor="texto" traco={2} />
                </Esfera>
              }
              fim={
                <Texto estilo="corpoForte" cor={linha.destaque ? 'destaqueTinta' : 'texto'}>
                  {linha.valor}
                </Texto>
              }
              rotuloAcessivel={`${linha.rotulo}: ${linha.valor}`}
              separador={i < linhas.length - 1}
            />
          ))}
        </Cartao>
      )}

      {proximo && (
        <View style={estilos.proximo}>
          <Chip rotulo={`Próximo: ${proximo.titulo}`} icone={Target} sobreFundo />
        </View>
      )}
    </Tela>
  );
}

const estilos = StyleSheet.create({
  palco: { alignItems: 'center', gap: 14, paddingHorizontal: 8, paddingTop: 8 },
  halo: { width: 150, height: 150, alignItems: 'center', justifyContent: 'center' },
  centro: { textAlign: 'center' },
  descricao: { maxWidth: 300 },
  proximo: { alignItems: 'center' },
  rodape: { gap: 14 },
  resgatadas: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
});
