import type { Jornada, Marco } from '@holofote/shared';
import { router } from 'expo-router';
import { Book, Calendar, ChevronRight, Gift, Newspaper, Zap } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { CUSTO_DESFAZER } from '../../acoes/custos';
import { useConta, useEnergia, useJornada, useMundo } from '../../api/consultas';
import { BarraProgresso } from '../../ui/BarraProgresso';
import { BotaoMetal } from '../../ui/BotaoMetal';
import { BotaoSuave } from '../../ui/BotaoSuave';
import { Cartao } from '../../ui/Cartao';
import { Chip } from '../../ui/Chip';
import { Esfera, corSobreEsfera } from '../../ui/Esfera';
import { EstadoTela } from '../../ui/EstadoTela';
import { Icone } from '../../ui/Icone';
import { Tela } from '../../ui/Tela';
import { Texto } from '../../ui/Texto';
import { Tocavel } from '../../ui/Tocavel';
import {
  detalheDoEvento,
  itensDaRecompensa,
  marcoAtual,
  marcoParaResgatar,
  ordenarMarcos,
  progressoDoMarco,
  proporcao,
  textoRequisito,
  tituloDoEvento,
} from './jornada';
import { TrilhaMarcos } from './TrilhaMarcos';

const abrirMarco = (marco: Marco) => router.push(`/marco/${marco.id}`);

/** 06 · Jornada (Figma 20:273 claro, 30:1221 escuro). */
export function TelaJornada() {
  const jornada = useJornada();

  if (!jornada.data) {
    return (
      <Tela comAbas rolavel={false}>
        <EstadoTela
          tipo={jornada.isError ? 'erro' : 'carregando'}
          frase={jornada.isError ? 'Não deu para carregar a jornada.' : 'Carregando a jornada…'}
          acao={
            jornada.isError
              ? { rotulo: 'Tentar de novo', onPress: () => void jornada.refetch() }
              : undefined
          }
        />
      </Tela>
    );
  }
  return <Conteudo jornada={jornada.data} />;
}

function Conteudo({ jornada }: { jornada: Jornada }) {
  const mundo = useMundo();
  const marcos = ordenarMarcos(jornada.marcos);
  const atual = marcoAtual(marcos);
  const pendente = marcoParaResgatar(marcos);
  const total = marcos.length;
  const progressoAto = Math.round(jornada.progressoAto * 100);

  return (
    <Tela
      comAbas
      gap={12}
      cabecalho={
        <View style={estilos.topo}>
          <View style={estilos.nivel}>
            <Texto estilo="titulo" accessibilityRole="header">
              Ato {jornada.ato}
            </Texto>
            {total > 0 && (
              <>
                <View style={estilos.barraTopo}>
                  <BarraProgresso
                    valor={progressoDoMarco(atual)}
                    rotulo={atual ? `Progresso do marco ${atual.ordem}` : 'Marcos do ato'}
                  />
                </View>
                <Texto estilo="legenda" cor="textoSuave" numberOfLines={1} style={estilos.encolhe}>
                  {atual ? `Marco ${atual.ordem} de ${total}` : `${total} de ${total} marcos`}
                </Texto>
              </>
            )}
          </View>
          <BotaoSuave
            icone={Book}
            rotulo="Registro de atividades"
            variante="elevado"
            onPress={() => router.push('/registro')}
          />
        </View>
      }
    >
      {pendente && (
        <Cartao style={estilos.cartao}>
          <Texto estilo="mini" cor="destaqueTinta">
            Marco liberado
          </Texto>
          <Texto estilo="secao">{pendente.titulo}</Texto>
          <Texto estilo="legenda" cor="textoSuave">
            Suas recompensas estão esperando por você.
          </Texto>
          <View style={estilos.acao}>
            <BotaoMetal rotulo="Resgatar" onPress={() => abrirMarco(pendente)} />
          </View>
        </Cartao>
      )}

      <Cartao style={estilos.cartao}>
        <Texto estilo="mini" cor="textoSuave">
          Objetivo principal
        </Texto>
        <Texto estilo="titulo">{jornada.objetivo || 'Seu objetivo está sendo escrito.'}</Texto>
        <View style={estilos.progressoAto}>
          <View style={estilos.encolhe}>
            <BarraProgresso valor={jornada.progressoAto} rotulo="Objetivo do ato" />
          </View>
          <Texto estilo="corpoForte">{progressoAto}%</Texto>
        </View>
      </Cartao>

      <View style={estilos.secao}>
        <Texto estilo="secao" accessibilityRole="header" style={estilos.tituloSecao}>
          Marcos
        </Texto>
        {total > 0 ? (
          <TrilhaMarcos marcos={marcos} onAbrir={abrirMarco} />
        ) : (
          <Texto cor="textoSuave" style={estilos.tituloSecao}>
            Os marcos deste ato ainda estão sendo escritos.
          </Texto>
        )}
      </View>

      {atual ? (
        <CartaoMarco marco={atual} />
      ) : (
        total > 0 && (
          <Cartao style={estilos.cartao}>
            <Texto estilo="mini" cor="destaqueTinta">
              Ato concluído
            </Texto>
            <Texto cor="textoSuave">Todos os marcos deste ato foram liberados.</Texto>
          </Cartao>
        )
      )}

      <View style={[estilos.linhaEntre, estilos.tituloSecao]}>
        <Texto estilo="secao" accessibilityRole="header">
          Agenda
        </Texto>
        <Chip
          rotulo="Resumo do dia"
          icone={Newspaper}
          sobreFundo
          onPress={() => router.push('/resumo-do-dia')}
        />
      </View>
      {jornada.proximoEvento ? (
        <CartaoEvento evento={jornada.proximoEvento} diaDoMundo={mundo.data?.dia} />
      ) : (
        <Texto cor="textoSuave" style={estilos.tituloSecao}>
          Nenhum evento agendado por enquanto.
        </Texto>
      )}

      <CartaoEnergia />
    </Tela>
  );
}

/** Próximo marco com os requisitos e a recompensa (Figma 20:328). */
function CartaoMarco({ marco }: { marco: Marco }) {
  const recompensa = itensDaRecompensa(marco.recompensa);
  return (
    <Cartao style={estilos.cartao}>
      <View style={estilos.cabecalhoMarco}>
        <Texto estilo="mini" cor="destaqueTinta">
          Próximo marco
        </Texto>
        <Texto estilo="secao">{marco.titulo}</Texto>
        {marco.descricao ? (
          <Texto estilo="legenda" cor="textoSuave">
            {marco.descricao}
          </Texto>
        ) : null}
      </View>
      {marco.requisitos.map((r) => (
        <View key={r.chave} style={estilos.requisito}>
          <View
            style={estilos.linhaEntre}
            accessible
            accessibilityLabel={`${r.rotulo}, ${textoRequisito(r)}`}
          >
            <Texto style={estilos.encolhe}>{r.rotulo}</Texto>
            <Texto estilo="legenda" cor="textoSuave">
              {textoRequisito(r)}
            </Texto>
          </View>
          <BarraProgresso valor={proporcao(r)} altura={6} rotulo={r.rotulo} />
        </View>
      ))}
      {recompensa.length > 0 && (
        <View
          style={estilos.recompensa}
          accessible
          accessibilityLabel={`Recompensa: ${recompensa.join(', ')}`}
        >
          <Icone icone={Gift} tamanho={14} cor="textoSuave" traco={2} />
          <Texto estilo="legenda" cor="textoSuave" style={estilos.encolhe}>
            Recompensa: {recompensa.join(' · ')}
          </Texto>
        </View>
      )}
    </Cartao>
  );
}

function CartaoEvento({
  evento,
  diaDoMundo,
}: {
  evento: NonNullable<Jornada['proximoEvento']>;
  diaDoMundo: number | undefined;
}) {
  const titulo = tituloDoEvento(evento, diaDoMundo);
  const detalhe = detalheDoEvento(evento);
  return (
    <Tocavel
      onPress={() => router.push(`/evento/${evento.id}`)}
      accessibilityRole="button"
      accessibilityLabel={`${titulo}. ${detalhe}`}
    >
      <Cartao style={estilos.linhaCartao}>
        <Esfera tom="escuro" tamanho={44}>
          <Icone icone={Calendar} tamanho={18} cor={corSobreEsfera('escuro')} traco={2} />
        </Esfera>
        <View style={estilos.textos}>
          <Texto estilo="corpoForte" numberOfLines={1}>
            {titulo}
          </Texto>
          <Texto estilo="legenda" cor="textoSuave" numberOfLines={1}>
            {detalhe}
          </Texto>
        </View>
        <Icone icone={ChevronRight} tamanho={16} cor="textoSuave" />
      </Cartao>
    </Tocavel>
  );
}

/** Resumo da energia (Figma 20:354); abre a folha 19 com as formas de recarregar. */
function CartaoEnergia() {
  const energia = useEnergia();
  const conta = useConta();
  const estado = energia.data ?? conta.data?.energia;
  if (!estado) return null;
  const titulo = `Energia ${estado.atual} de ${estado.max}`;
  const detalhe = `Postar e responder custam 1; desfazer custa ${CUSTO_DESFAZER}. Recarrega 1 a cada ${estado.regras.recargaMin} min.`;
  return (
    <Tocavel
      onPress={() => router.push('/sem-energia')}
      accessibilityRole="button"
      accessibilityLabel={`${titulo}. ${detalhe}`}
    >
      <Cartao style={estilos.linhaCartao}>
        <Esfera tom="escuro" tamanho={40}>
          <Icone icone={Zap} tamanho={18} cor={corSobreEsfera('escuro')} traco={2} />
        </Esfera>
        <View style={estilos.textos}>
          <Texto estilo="corpoForte">{titulo}</Texto>
          <Texto estilo="legenda" cor="textoSuave">
            {detalhe}
          </Texto>
        </View>
        <Icone icone={ChevronRight} tamanho={16} cor="textoSuave" />
      </Cartao>
    </Tocavel>
  );
}

const estilos = StyleSheet.create({
  topo: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  nivel: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  barraTopo: { width: 96 },
  encolhe: { flex: 1 },
  cartao: { gap: 8 },
  acao: { paddingTop: 4 },
  progressoAto: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: 4 },
  secao: { gap: 10, paddingTop: 4 },
  tituloSecao: { paddingHorizontal: 4 },
  cabecalhoMarco: { gap: 3 },
  requisito: { gap: 6 },
  linhaEntre: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  recompensa: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 4 },
  linhaCartao: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  textos: { flex: 1, gap: 1 },
});
