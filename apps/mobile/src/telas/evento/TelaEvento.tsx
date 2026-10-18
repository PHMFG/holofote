import type { EventoAgendado } from '@holofote/shared';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import { Check, Lock } from 'lucide-react-native';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import { tratarErroDeAcao } from '../../acoes/erros';
import { ErroDaApi } from '../../api/cliente';
import { useCampanha, useEnergia, useEvento, useMundo } from '../../api/consultas';
import { useTema } from '../../tema/ProvedorTema';
import { Aparecer } from '../../ui/Aparecer';
import { Avatar } from '../../ui/Avatar';
import { BotaoMetal } from '../../ui/BotaoMetal';
import { Cabecalho } from '../../ui/Cabecalho';
import { Cartao } from '../../ui/Cartao';
import { Custo } from '../../ui/Custo';
import { Esfera, corSobreEsfera } from '../../ui/Esfera';
import { EstadoTela } from '../../ui/EstadoTela';
import { Icone } from '../../ui/Icone';
import { LinhaDeLista } from '../../ui/LinhaDeLista';
import { RotuloSecao } from '../../ui/Rotulo';
import { Tela } from '../../ui/Tela';
import { Texto } from '../../ui/Texto';
import { MOLA, atrasoDaCascata } from '../../ui/movimento';
import { Pop, Reluzir, Troca } from '../perfil/efeitos';
import { NumeroContando } from '../perfil/NumeroContando';
import { BarraChance } from './BarraChance';
import { contagem, porcentagem, quandoTexto } from './formatar';
import { DISCURSO, ICONE_DO_EVENTO, iconeDaCampanha } from './icones';

type Evento = EventoAgendado;

const campanhaAberta = (evento: Evento) =>
  evento.estado === 'anunciado' || evento.estado === 'campanha';

/**
 * 16 · Evento (Figma 55:1385 claro, 58:2106 escuro): o cartão do evento, os indicados com a
 * chance do motor, as ações de campanha e a prévia do discurso. Ao vivo, leva à tela 17;
 * encerrado, mostra o vencedor.
 */
export function TelaEvento({ id }: { id: string }) {
  const evento = useEvento(id);
  const mundo = useMundo();

  const e = evento.data;
  const cabecalho = <Cabecalho titulo={e?.titulo ?? 'Evento'} />;

  if (!e) {
    const sumiu = evento.error instanceof ErroDaApi && evento.error.codigo === 'nao_encontrado';
    return (
      <Tela cabecalho={cabecalho} rolavel={false}>
        {evento.isError ? (
          <EstadoTela
            tipo="erro"
            frase={sumiu ? 'Este evento não existe mais.' : 'Não deu para abrir o evento.'}
            acao={
              sumiu
                ? { rotulo: 'Voltar', onPress: () => router.back() }
                : { rotulo: 'Tentar de novo', onPress: () => void evento.refetch() }
            }
          />
        ) : (
          <EstadoTela tipo="carregando" frase="Abrindo o evento…" />
        )}
      </Tela>
    );
  }

  return (
    <Tela
      cabecalho={cabecalho}
      gap={10}
      rodape={
        e.estado === 'ao_vivo' ? (
          <EntrarAoVivo
            onPress={() => {
              void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
              router.push(`/evento/${e.id}/ao-vivo`);
            }}
          />
        ) : undefined
      }
    >
      <Aparecer indice={0}>
        <CartaoDoEvento evento={e} diaDoMundo={mundo.data?.dia} />
      </Aparecer>
      {e.estado === 'encerrado' && (
        <Aparecer indice={1}>
          <CartaoResultado evento={e} />
        </Aparecer>
      )}
      <Indicados evento={e} />
      {e.estado !== 'encerrado' && <Campanha evento={e} />}
      {e.estado !== 'encerrado' && <PreviaDiscurso evento={e} />}
    </Tela>
  );
}

/** "Entrar ao vivo" com uma faixa de luz de tempos em tempos: o evento está acontecendo agora. */
function EntrarAoVivo({ onPress }: { onPress: () => void }) {
  const { medidas } = useTema();
  return (
    <Reluzir raio={medidas.botaoMetalAltura / 2}>
      <BotaoMetal rotulo="Entrar ao vivo" onPress={onPress} />
    </Reluzir>
  );
}

function CartaoDoEvento({ evento, diaDoMundo }: { evento: Evento; diaDoMundo?: number }) {
  const quando = `${contagem(evento, diaDoMundo)} · ${quandoTexto(evento.quando)}`;
  return (
    <Cartao>
      <View
        style={estilos.linhaEvento}
        accessible
        accessibilityLabel={`Categoria ${evento.categoria}. ${quando}`}
      >
        <Pop de={0.5} atraso={120} mola={MOLA.viva}>
          <Esfera tom="escuro" tamanho={56}>
            <Icone
              icone={ICONE_DO_EVENTO[evento.tipo]}
              tamanho={25}
              cor={corSobreEsfera('escuro')}
              traco={2}
            />
          </Esfera>
        </Pop>
        <View style={estilos.textosEvento}>
          <Texto estilo="mini" cor="textoSuave">
            Categoria
          </Texto>
          <Texto estilo="titulo">{evento.categoria}</Texto>
          <Texto estilo="legenda" cor="destaqueTinta">
            {quando}
          </Texto>
        </View>
      </View>
    </Cartao>
  );
}

function CartaoResultado({ evento }: { evento: Evento }) {
  const vencedor = evento.vencedor;
  const venceu = vencedor?.papel === 'jogador';
  return (
    <Cartao>
      <View
        style={estilos.linhaEvento}
        accessible
        accessibilityLabel={
          vencedor
            ? `Vencedor: ${vencedor.nome}. ${venceu ? 'Você venceu.' : 'Não foi dessa vez.'}`
            : 'O resultado ainda não saiu.'
        }
      >
        <Pop de={0.3} atraso={200} mola={MOLA.viva}>
          {vencedor ? (
            <Avatar iniciais={vencedor.iniciais} tom={vencedor.tomAvatar} tamanho={56} />
          ) : (
            <Esfera tom="claro" tamanho={56} />
          )}
        </Pop>
        <View style={estilos.textosEvento}>
          <Texto estilo="mini" cor="textoSuave">
            {vencedor ? 'O prêmio foi para' : 'Resultado'}
          </Texto>
          <Texto estilo="titulo">{vencedor?.nome ?? 'A caminho'}</Texto>
          {vencedor && (
            <Texto estilo="legenda" cor={venceu ? 'destaqueTinta' : 'textoSuave'}>
              {venceu ? 'Você venceu' : 'Não foi dessa vez'}
            </Texto>
          )}
        </View>
      </View>
    </Cartao>
  );
}

function Indicados({ evento }: { evento: Evento }) {
  const { cores } = useTema();
  return (
    <>
      <Aparecer indice={2}>
        <RotuloSecao
          texto="Indicados"
          meta={evento.estado === 'encerrado' ? 'chance final' : 'chance estimada'}
          corMeta="textoSuave"
        />
      </Aparecer>
      <Aparecer indice={3}>
        <Cartao lista style={estilos.listaEstreita}>
          {evento.indicados.map(({ personagem, chance }, i) => {
            const jogador = personagem.papel === 'jogador';
            const nome = jogador ? `${personagem.nome} · você` : personagem.nome;
            const rotulo = `${nome}, ${porcentagem(chance)} de chance`;
            return (
              <View
                key={personagem.id}
                style={[
                  estilos.indicado,
                  i < evento.indicados.length - 1 && {
                    borderBottomWidth: 1,
                    borderBottomColor: cores.linha,
                  },
                ]}
                accessible
                accessibilityLabel={rotulo}
              >
                <Avatar
                  iniciais={personagem.iniciais}
                  tom={personagem.tomAvatar}
                  tamanho={36}
                  nome={personagem.nome}
                />
                <View style={estilos.textosIndicado}>
                  <View style={estilos.linhaIndicado}>
                    <Texto estilo="corpoForte" numberOfLines={1} style={estilos.flex}>
                      {nome}
                    </Texto>
                    <NumeroContando
                      estilo="corpoForte"
                      cor={jogador ? 'destaqueTinta' : 'textoSuave'}
                      texto={porcentagem(chance)}
                      atraso={atrasoDaCascata(i + 3) + 300}
                    />
                  </View>
                  <BarraChance
                    valor={chance}
                    rotulo={`Chance de ${personagem.nome}`}
                    altura={6}
                    destaque={jogador}
                    atraso={atrasoDaCascata(i + 3) + 350}
                  />
                </View>
              </View>
            );
          })}
        </Cartao>
      </Aparecer>
    </>
  );
}

function Campanha({ evento }: { evento: Evento }) {
  const campanha = useCampanha(evento.id);
  const energia = useEnergia();
  const aberta = campanhaAberta(evento);

  const fazer = (acaoId: string, titulo: string) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    campanha.mutate(acaoId, {
      onSuccess: ({ evento: atualizado }) => {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        const minha = atualizado.indicados.find((i) => i.personagem.papel === 'jogador');
        AccessibilityInfo.announceForAccessibility(
          minha
            ? `${titulo} feito. Sua chance agora é ${porcentagem(minha.chance)}.`
            : `${titulo} feito.`,
        );
      },
      onError: tratarErroDeAcao,
    });
  };

  const meta = aberta
    ? energia.data
      ? `você tem ${energia.data.atual} de energia`
      : undefined
    : 'campanha encerrada';

  return (
    <>
      <Aparecer indice={4}>
        <RotuloSecao texto="Campanha" meta={meta} corMeta="textoSuave" />
      </Aparecer>
      <Aparecer indice={5}>
        <Cartao lista style={estilos.listaCampanha}>
          {evento.acoes.map((acao, i) => {
            const tocavel = aberta && !acao.feita && !campanha.isPending;
            return (
              <LinhaDeLista
                key={acao.id}
                titulo={acao.titulo}
                subtitulo={acao.descricao}
                separador={i < evento.acoes.length - 1}
                inicio={
                  <Esfera tom="claro" tamanho={36}>
                    <Icone icone={iconeDaCampanha(acao.id)} tamanho={16} cor="texto" />
                  </Esfera>
                }
                fim={
                  <Troca chave={acao.feita ? 'feita' : 'custo'}>
                    {acao.feita ? <Feita /> : <Custo energia={acao.custo} />}
                  </Troca>
                }
                rotuloFim={`custa ${acao.custo} de energia`}
                rotuloAcessivel={
                  acao.feita ? `${acao.titulo}, ${acao.descricao}, feita` : undefined
                }
                onPress={tocavel ? () => fazer(acao.id, acao.titulo) : undefined}
              />
            );
          })}
        </Cartao>
      </Aparecer>
    </>
  );
}

/** Ação de campanha feita: o check aparece com um pop e o texto vem logo atrás. */
function Feita() {
  return (
    <View style={estilos.feita} accessible accessibilityLabel="Feita">
      <Pop de={0.2} mola={MOLA.viva}>
        <Icone icone={Check} tamanho={14} cor="destaqueTinta" traco={2} />
      </Pop>
      <Pop de={0.8} deslocamento={4} atraso={80} mola={MOLA.firme}>
        <Texto estilo="legenda" cor="destaqueTinta">
          Feita
        </Texto>
      </Pop>
    </View>
  );
}

function PreviaDiscurso({ evento }: { evento: Evento }) {
  return (
    <>
      <Aparecer indice={6}>
        <RotuloSecao
          texto="Discurso no palco"
          meta="você escolhe no ao vivo"
          corMeta="textoSuave"
        />
      </Aparecer>
      <Aparecer indice={7}>
        <Cartao lista style={estilos.listaCampanha}>
          {evento.discurso.map((opcao, i) => {
            const visual = DISCURSO[opcao.id];
            const detalhe = opcao.liberada
              ? visual.descricao
              : (opcao.motivo ?? 'Ainda bloqueado.');
            return (
              <LinhaDeLista
                key={opcao.id}
                titulo={opcao.titulo}
                subtitulo={detalhe}
                separador={i < evento.discurso.length - 1}
                rotuloAcessivel={`Discurso ${opcao.titulo}, ${
                  opcao.liberada ? `liberado, ${detalhe}` : `bloqueado: ${detalhe}`
                }`}
                inicio={
                  <Esfera tom={opcao.liberada ? visual.tom : 'claro'} tamanho={36}>
                    <Icone
                      icone={opcao.liberada ? visual.icone : Lock}
                      tamanho={16}
                      cor={opcao.liberada ? corSobreEsfera(visual.tom) : 'textoSuave'}
                    />
                  </Esfera>
                }
                fim={
                  opcao.liberada ? (
                    <Texto estilo="legenda" cor="destaqueTinta" accessible={false}>
                      Liberado
                    </Texto>
                  ) : (
                    <Icone icone={Lock} tamanho={16} cor="textoSuave" />
                  )
                }
              />
            );
          })}
        </Cartao>
      </Aparecer>
    </>
  );
}

const estilos = StyleSheet.create({
  flex: { flex: 1 },
  linhaEvento: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  textosEvento: { flex: 1, gap: 2 },
  listaEstreita: { paddingHorizontal: 14 },
  listaCampanha: { paddingHorizontal: 14, paddingVertical: 2 },
  indicado: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10 },
  textosIndicado: { flex: 1, gap: 6 },
  linhaIndicado: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  feita: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
