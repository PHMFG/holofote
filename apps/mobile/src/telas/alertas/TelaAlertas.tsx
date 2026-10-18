import { router, useFocusEffect } from 'expo-router';
import { CheckCheck } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';
import { useAlertas, useMarcarAlertasLidos, useMundo } from '../../api/consultas';
import { tempoRelativo, useAgora } from '../../tempo';
import { Aparecer } from '../../ui/Aparecer';
import { EstadoTela } from '../../ui/EstadoTela';
import { Icone } from '../../ui/Icone';
import { RotuloSecao } from '../../ui/Rotulo';
import { Segmentado } from '../../ui/Segmentado';
import { Tela } from '../../ui/Tela';
import { Texto } from '../../ui/Texto';
import { Tocavel } from '../../ui/Tocavel';
import { useAnimacoes } from '../animacao/animacoes';
import { CartaoAnimado } from '../animacao/Animados';
import { ItemAnimado, useRegistroDeEntradas } from '../animacao/entradas';
import { FILTROS_ALERTA, agruparAlertas, type FiltroAlerta } from './filtros';
import { LinhaAlerta } from './LinhaAlerta';

const VAZIO: Record<FiltroAlerta, string> = {
  tudo: 'Nenhum alerta ainda. Poste algo e o elenco reage.',
  mencoes: 'Ninguém respondeu nem citou você ainda.',
  relacoes: 'Nada do elenco por enquanto.',
  sistema: 'Nenhum aviso do jogo por enquanto.',
};

/**
 * 07 · Alertas. Os não lidos ficam marcados enquanto o jogador está na aba e viram lidos ao sair
 * dela: marcar ao abrir apagaria os pontos antes de ele ver o que é novo. "Marcar como lidos"
 * faz o mesmo na hora, e os pontos somem com animação. As linhas entram em cascata; trocar o
 * filtro tira as que não cabem com fade e acomoda as outras com animação de layout.
 */
export function TelaAlertas() {
  const alertas = useAlertas();
  const mundo = useMundo();
  const marcarLidos = useMarcarAlertasLidos();
  const agora = useAgora(60_000);
  const animacoes = useAnimacoes();
  const [filtro, setFiltro] = useState<FiltroAlerta>('tudo');

  const temNaoLidos = (alertas.data ?? []).some((a) => !a.lido);
  const grupos = useMemo(
    () => agruparAlertas(alertas.data ?? [], filtro, mundo.data?.dia, agora),
    [alertas.data, filtro, mundo.data?.dia, agora],
  );

  const entradas = useRegistroDeEntradas(
    grupos.flatMap((g) => g.alertas.map((a) => a.id)),
    { novos: 'topo' },
  );

  // A limpeza do foco lê o estado mais recente por ref, sem reinscrever o efeito a cada mudança.
  const aoSair = useRef({ temNaoLidos, marcar: marcarLidos.mutate });
  useEffect(() => {
    aoSair.current = { temNaoLidos, marcar: marcarLidos.mutate };
  });
  useFocusEffect(
    useCallback(
      () => () => {
        if (aoSair.current.temNaoLidos) aoSair.current.marcar();
      },
      [],
    ),
  );

  const cabecalho = (
    <View style={estilos.topo}>
      <Texto estilo="titulo" accessibilityRole="header">
        Alertas
      </Texto>
      {temNaoLidos && (
        <Animated.View entering={animacoes.fade()} exiting={animacoes.saidaSuave}>
          <Tocavel
            onPress={() => marcarLidos.mutate()}
            accessibilityRole="button"
            accessibilityLabel="Marcar como lidos"
            hitSlop={10}
            style={estilos.marcar}
          >
            <Icone icone={CheckCheck} tamanho={15} cor="destaqueTinta" traco={2} />
            <Texto estilo="legenda" cor="destaqueTinta">
              Marcar como lidos
            </Texto>
          </Tocavel>
        </Animated.View>
      )}
    </View>
  );

  if (!alertas.data) {
    return (
      <Tela comAbas cabecalho={cabecalho} rolavel={false}>
        {alertas.isError ? (
          <EstadoTela
            tipo="erro"
            frase="Não deu para abrir seus alertas."
            acao={{ rotulo: 'Tentar de novo', onPress: () => void alertas.refetch() }}
          />
        ) : (
          <EstadoTela tipo="carregando" frase="Carregando alertas…" />
        )}
      </Tela>
    );
  }

  return (
    <Tela comAbas cabecalho={cabecalho} gap={12}>
      <Aparecer indice={0}>
        <Segmentado
          opcoes={FILTROS_ALERTA}
          valor={filtro}
          onMudar={setFiltro}
          rotulo="Filtrar alertas"
        />
      </Aparecer>
      {grupos.length === 0 && (
        <CartaoAnimado
          key={`vazio-${filtro}`}
          entering={animacoes.fade()}
          exiting={animacoes.saida}
          layout={animacoes.layout}
        >
          <Texto cor="textoSuave" style={estilos.vazio}>
            {VAZIO[filtro]}
          </Texto>
        </CartaoAnimado>
      )}
      {grupos.map((grupo) => (
        <Animated.View
          key={grupo.chave}
          entering={animacoes.fade()}
          exiting={animacoes.saida}
          layout={animacoes.layout}
          style={estilos.grupo}
        >
          <RotuloSecao texto={grupo.titulo} />
          <CartaoAnimado lista layout={animacoes.layout} style={estilos.lista}>
            {grupo.alertas.map((alerta, i) => (
              <ItemAnimado key={alerta.id} registro={entradas} id={alerta.id} fadePadrao>
                <LinhaAlerta
                  alerta={alerta}
                  tempo={tempoRelativo(alerta.criadoEm, agora, mundo.data?.dia)}
                  separador={i < grupo.alertas.length - 1}
                  onPress={() => router.push(alerta.destino.rota)}
                />
              </ItemAnimado>
            ))}
          </CartaoAnimado>
        </Animated.View>
      ))}
    </Tela>
  );
}

const estilos = StyleSheet.create({
  topo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 44,
  },
  marcar: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  grupo: { gap: 12 },
  lista: { paddingHorizontal: 14, paddingVertical: 4 },
  vazio: { textAlign: 'center' },
});
