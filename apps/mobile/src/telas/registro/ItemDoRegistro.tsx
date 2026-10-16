import type { ItemRegistro, TipoAcao } from '@holofote/shared';
import { Undo2, Zap } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { useTema } from '../../tema/ProvedorTema';
import { Camada } from '../../ui/Camada';
import { Chip } from '../../ui/Chip';
import { Rotulo } from '../../ui/Rotulo';
import { Texto } from '../../ui/Texto';
import { CUSTO_DESFAZER } from '../../acoes/custos';
import { horaMinuto } from '../../tempo';
import { formatarDeltas, type DeltaFormatado } from './formatar';

/** Tipo da ação como aparece no cabeçalho do cartão (Figma 27:433, em Mini maiúsculo). */
export const NOME_DO_TIPO: Record<TipoAcao, string> = {
  post: 'Post',
  resposta: 'Comentário',
  dm: 'Mensagem direta',
  historia: 'Comentário em história',
  campanha: 'Campanha',
  discurso: 'Discurso',
  desfazer: 'Desfazer',
};

export interface ItemDoRegistroProps {
  item: ItemRegistro;
  nomePorId: ReadonlyMap<string, string>;
  /** Ponto cheio de destaque no item mais recente da linha do tempo. */
  maisRecente: boolean;
  /** Último item do grupo: sem a linha abaixo do ponto. */
  ultimo: boolean;
  desfazendo: boolean;
  onDesfazer: (item: ItemRegistro) => void;
}

/** Uma atividade da linha do tempo de 09 · Registro (Figma 27:427). */
export function ItemDoRegistro({
  item,
  nomePorId,
  maisRecente,
  ultimo,
  desfazendo,
  onDesfazer,
}: ItemDoRegistroProps) {
  const { cores } = useTema();
  const hora = horaMinuto(item.criadoEm);
  const deltas = formatarDeltas(item.deltas, nomePorId);
  const rotulo = [
    `${NOME_DO_TIPO[item.tipo]}, ${hora}`,
    item.resumo,
    deltas.map((d) => d.rotulo).join(', '),
    item.desfeito ? 'desfeito' : '',
  ]
    .filter(Boolean)
    .join('. ');

  return (
    <View style={estilos.linha}>
      <View style={estilos.trilho}>
        <View
          style={[
            estilos.ponto,
            maisRecente
              ? { backgroundColor: cores.destaque }
              : { borderWidth: 2, borderColor: cores.textoFraco, backgroundColor: cores.fundo },
          ]}
        />
        {!ultimo && <View style={[estilos.fio, { backgroundColor: cores.linha }]} />}
      </View>
      <View style={[estilos.espaco, !ultimo && estilos.espacoAbaixo]}>
        <Camada cor="superficie" sombra="elevacao" raio={22} style={estilos.cartao}>
          <View accessible accessibilityLabel={rotulo} style={estilos.conteudo}>
            <View style={estilos.topo}>
              <Texto estilo="mini" cor="textoSuave" style={estilos.tipo} numberOfLines={1}>
                {NOME_DO_TIPO[item.tipo]}
              </Texto>
              <Texto estilo="legenda" cor="textoSuave">
                {hora}
              </Texto>
            </View>
            <Texto
              cor={item.desfeito ? 'textoSuave' : 'texto'}
              style={item.desfeito && estilos.riscado}
            >
              {item.resumo}
            </Texto>
            {deltas.length > 0 && (
              <View style={estilos.deltas}>
                {deltas.map((d) => (
                  <ChipDelta key={d.chave} delta={d} riscado={item.desfeito} />
                ))}
              </View>
            )}
          </View>
          {item.desfeito ? (
            <View style={estilos.rodape}>
              <Rotulo texto="Desfeito" />
            </View>
          ) : (
            item.desfazivel && (
              <View style={estilos.rodape}>
                <Chip
                  rotulo={desfazendo ? 'Desfazendo…' : `Desfazer · ${CUSTO_DESFAZER}`}
                  rotuloAcessivel={
                    desfazendo ? undefined : `Desfazer, custa ${CUSTO_DESFAZER} de energia`
                  }
                  variante="afundado"
                  icone={Undo2}
                  iconeDepois={desfazendo ? undefined : Zap}
                  onPress={desfazendo ? undefined : () => onDesfazer(item)}
                />
              </View>
            )
          )}
        </Camada>
      </View>
    </View>
  );
}

/** Efeito do motor: positivo em destaque suave, negativo neutro. */
function ChipDelta({ delta, riscado }: { delta: DeltaFormatado; riscado: boolean }) {
  const { cores } = useTema();
  return (
    <View
      style={[
        estilos.chipDelta,
        { backgroundColor: delta.positivo ? cores.destaqueSuave : cores.superficie2 },
      ]}
    >
      <Texto
        estilo="legenda"
        cor={delta.positivo ? 'destaqueTinta' : 'textoSuave'}
        style={riscado && estilos.riscado}
      >
        {delta.texto}
      </Texto>
    </View>
  );
}

const estilos = StyleSheet.create({
  linha: { flexDirection: 'row', gap: 12 },
  trilho: { width: 16, alignItems: 'center', paddingTop: 22 },
  ponto: { width: 12, height: 12, borderRadius: 6 },
  fio: { width: 2, flex: 1 },
  espaco: { flex: 1 },
  espacoAbaixo: { paddingBottom: 12 },
  cartao: { paddingHorizontal: 16, paddingVertical: 14, gap: 8 },
  conteudo: { gap: 8 },
  topo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tipo: { flex: 1 },
  riscado: { textDecorationLine: 'line-through' },
  deltas: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  chipDelta: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  rodape: { flexDirection: 'row', alignItems: 'center', paddingTop: 2 },
});
