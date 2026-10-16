import { router, useFocusEffect } from 'expo-router';
import { CheckCheck } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useAlertas, useMarcarAlertasLidos, useMundo } from '../../api/consultas';
import { tempoRelativo, useAgora } from '../../tempo';
import { Cartao } from '../../ui/Cartao';
import { EstadoTela } from '../../ui/EstadoTela';
import { Icone } from '../../ui/Icone';
import { RotuloSecao } from '../../ui/Rotulo';
import { Segmentado } from '../../ui/Segmentado';
import { Tela } from '../../ui/Tela';
import { Texto } from '../../ui/Texto';
import { Tocavel } from '../../ui/Tocavel';
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
 * faz o mesmo na hora.
 */
export function TelaAlertas() {
  const alertas = useAlertas();
  const mundo = useMundo();
  const marcarLidos = useMarcarAlertasLidos();
  const agora = useAgora(60_000);
  const [filtro, setFiltro] = useState<FiltroAlerta>('tudo');

  const temNaoLidos = (alertas.data ?? []).some((a) => !a.lido);
  const grupos = useMemo(
    () => agruparAlertas(alertas.data ?? [], filtro, mundo.data?.dia, agora),
    [alertas.data, filtro, mundo.data?.dia, agora],
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
      <Segmentado
        opcoes={FILTROS_ALERTA}
        valor={filtro}
        onMudar={setFiltro}
        rotulo="Filtrar alertas"
      />
      {grupos.length === 0 && (
        <Cartao>
          <Texto cor="textoSuave" style={estilos.vazio}>
            {VAZIO[filtro]}
          </Texto>
        </Cartao>
      )}
      {grupos.map((grupo) => (
        <View key={grupo.chave} style={estilos.grupo}>
          <RotuloSecao texto={grupo.titulo} />
          <Cartao lista style={estilos.lista}>
            {grupo.alertas.map((alerta, i) => (
              <LinhaAlerta
                key={alerta.id}
                alerta={alerta}
                tempo={tempoRelativo(alerta.criadoEm, agora, mundo.data?.dia)}
                separador={i < grupo.alertas.length - 1}
                onPress={() => router.push(alerta.destino.rota)}
              />
            ))}
          </Cartao>
        </View>
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
