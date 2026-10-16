import type { ItemRegistro, TipoAcao } from '@holofote/shared';
import * as Haptics from 'expo-haptics';
import { useMemo, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { tratarErroDeAcao } from '../../acoes/erros';
import { useDesfazer, useMundo, useRegistro, useRelacoes } from '../../api/consultas';
import { Cabecalho } from '../../ui/Cabecalho';
import { EstadoTela } from '../../ui/EstadoTela';
import { RotuloSecao } from '../../ui/Rotulo';
import { Segmentado, type OpcaoSegmentado } from '../../ui/Segmentado';
import { Tela } from '../../ui/Tela';
import { CUSTO_DESFAZER } from '../../acoes/custos';
import { agruparPorDia } from './dias';
import { ItemDoRegistro } from './ItemDoRegistro';
import { useAgora } from '../../tempo';

type Filtro = 'tudo' | 'posts' | 'dms' | 'historias';

// Rótulos do Figma (27:415).
const FILTROS: readonly OpcaoSegmentado<Filtro>[] = [
  { valor: 'tudo', rotulo: 'Tudo' },
  { valor: 'posts', rotulo: 'Posts' },
  { valor: 'dms', rotulo: 'DMs' },
  { valor: 'historias', rotulo: 'Histórias' },
];

const TIPOS: Record<Exclude<Filtro, 'tudo'>, readonly TipoAcao[]> = {
  posts: ['post', 'resposta'],
  dms: ['dm'],
  historias: ['historia'],
};

const VAZIO: Record<Filtro, string> = {
  tudo: 'Nada por aqui ainda. Cada post, comentário e mensagem fica registrado aqui.',
  posts: 'Nenhum post ou comentário ainda.',
  dms: 'Nenhuma mensagem direta ainda.',
  historias: 'Nenhuma resposta a histórias ainda.',
};

/** 09 · Registro de atividades (Figma 27:392 claro, 31:1024 escuro). */
export function TelaRegistro() {
  const registro = useRegistro();
  const relacoes = useRelacoes();
  const mundo = useMundo();
  const desfazer = useDesfazer();
  const agora = useAgora();
  const [filtro, setFiltro] = useState<Filtro>('tudo');

  const nomePorId = useMemo(
    () =>
      new Map((relacoes.data?.nos ?? []).map((n) => [n.personagem.id, n.personagem.nome] as const)),
    [relacoes.data],
  );
  const itens = (registro.data ?? []).filter(
    (i) => filtro === 'tudo' || TIPOS[filtro].includes(i.tipo),
  );
  const grupos = agruparPorDia(itens, agora, mundo.data?.dia);
  const maisRecente = itens[0]?.eventoId;

  const confirmarDesfazer = (item: ItemRegistro) =>
    Alert.alert(
      'Desfazer esta ação?',
      `Custa ${CUSTO_DESFAZER} de energia. Os números voltam e as reações a ela somem.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Desfazer',
          style: 'destructive',
          onPress: () =>
            desfazer.mutate(item.eventoId, {
              onSuccess: () =>
                void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
              onError: tratarErroDeAcao,
            }),
        },
      ],
    );

  let conteudo;
  if (registro.isPending) {
    conteudo = <EstadoTela tipo="carregando" frase="Carregando o registro…" />;
  } else if (registro.isError) {
    conteudo = (
      <EstadoTela
        tipo="erro"
        frase="Não deu para carregar o registro."
        acao={{ rotulo: 'Tentar de novo', onPress: () => void registro.refetch() }}
      />
    );
  } else if (grupos.length === 0) {
    conteudo = <EstadoTela tipo="vazio" frase={VAZIO[filtro]} />;
  } else {
    conteudo = grupos.map((grupo) => (
      <View key={grupo.chave} style={estilos.grupo}>
        <RotuloSecao texto={grupo.rotulo} />
        <View>
          {grupo.itens.map((item, i) => (
            <ItemDoRegistro
              key={item.eventoId}
              item={item}
              nomePorId={nomePorId}
              maisRecente={item.eventoId === maisRecente}
              ultimo={i === grupo.itens.length - 1}
              desfazendo={desfazer.isPending && desfazer.variables === item.eventoId}
              onDesfazer={confirmarDesfazer}
            />
          ))}
        </View>
      </View>
    ));
  }

  return (
    <Tela cabecalho={<Cabecalho titulo="Registro de atividades" />} gap={12}>
      <Segmentado opcoes={FILTROS} valor={filtro} onMudar={setFiltro} rotulo="Filtrar atividades" />
      {conteudo}
    </Tela>
  );
}

const estilos = StyleSheet.create({
  grupo: { gap: 12 },
});
