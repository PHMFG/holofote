import type { Personagem } from '@holofote/shared';
import { router } from 'expo-router';
import { ArrowDown, ArrowUp, BadgeCheck, Sparkles, Volume2, VolumeX } from 'lucide-react-native';
import { Alert, StyleSheet, View } from 'react-native';
import { tratarErroDeAcao } from '../../acoes/erros';
import { ErroDaApi } from '../../api/cliente';
import { useAbrirConversa, usePersonagem, useRegistro, useSilenciar } from '../../api/consultas';
import { formatarNumero, primeiroNome } from '../../formatar';
import { Avatar } from '../../ui/Avatar';
import { BarraProgresso } from '../../ui/BarraProgresso';
import { BotaoMetal } from '../../ui/BotaoMetal';
import { Cabecalho } from '../../ui/Cabecalho';
import { Cartao } from '../../ui/Cartao';
import { Chip } from '../../ui/Chip';
import { EstadoTela } from '../../ui/EstadoTela';
import { Icone } from '../../ui/Icone';
import { Rotulo } from '../../ui/Rotulo';
import { Tela } from '../../ui/Tela';
import { Texto } from '../../ui/Texto';
import { Capa } from '../perfil/Capa';
import { variacaoDeHoje } from '../perfil/variacao';
import { comArroba } from '../registro/formatar';
import { useAgora } from '../../tempo';
import { separarDia } from './memorias';

/** 08 · Perfil de personagem (Figma 26:354 claro, 31:911 escuro). */
export function TelaPersonagem({ id }: { id: string }) {
  const personagem = usePersonagem(id);

  if (!personagem.data) {
    const naoExiste =
      personagem.error instanceof ErroDaApi && personagem.error.codigo === 'nao_encontrado';
    return (
      <Tela cabecalho={<Cabecalho />} rolavel={false}>
        <EstadoTela
          tipo={personagem.isError ? (naoExiste ? 'vazio' : 'erro') : 'carregando'}
          frase={
            naoExiste
              ? 'Esse personagem não está no seu mundo.'
              : personagem.isError
                ? 'Não deu para abrir o perfil.'
                : 'Abrindo o perfil…'
          }
          acao={
            personagem.isError && !naoExiste
              ? { rotulo: 'Tentar de novo', onPress: () => void personagem.refetch() }
              : undefined
          }
        />
      </Tela>
    );
  }
  return <Perfil personagem={personagem.data} />;
}

function Perfil({ personagem: p }: { personagem: Personagem }) {
  const registro = useRegistro();
  const abrirConversa = useAbrirConversa();
  const silenciar = useSilenciar(p.id);
  const agora = useAgora(60_000);
  const ehJogador = p.papel === 'jogador';
  const hoje = variacaoDeHoje(registro.data, agora)?.get(`relacao:${p.id}`) ?? 0;
  const nome = primeiroNome(p.nome);

  const mandarMensagem = () =>
    abrirConversa.mutate(p.id, {
      onSuccess: (conversa) => router.push(`/dm/${conversa.id}`),
      onError: tratarErroDeAcao,
    });

  const alternarSilencio = () => {
    const silenciarAgora = !p.silenciado;
    const aplicar = () => silenciar.mutate(silenciarAgora, { onError: tratarErroDeAcao });
    if (!silenciarAgora) return aplicar();
    Alert.alert(
      `Silenciar ${nome}?`,
      `${nome} some do seu feed e da lista de mensagens, e o elenco para de chamar ${nome} para reagir. Você pode desfazer quando quiser.`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Silenciar', style: 'destructive', onPress: aplicar },
      ],
    );
  };

  const numeros = [
    { valor: formatarNumero(p.seguidores), rotulo: p.seguidores === 1 ? 'seguidor' : 'seguidores' },
    { valor: String(p.fama), rotulo: 'fama' },
    { valor: String(p.carisma), rotulo: 'carisma' },
    { valor: String(p.polemica), rotulo: 'polêmica' },
  ];

  return (
    <Tela gap={12}>
      <Capa
        acoes={<Cabecalho variante="elevado" />}
        avatar={<Avatar iniciais={p.iniciais} tom={p.tomAvatar} tamanho={84} nome={p.nome} />}
      />

      <View style={estilos.identidade}>
        <View
          style={estilos.nome}
          accessible
          accessibilityRole="header"
          accessibilityLabel={p.verificado ? `${p.nome}, verificado` : p.nome}
        >
          <Texto estilo="titulo">{p.nome}</Texto>
          {/* icon/verificado do Figma é um selo preenchido próprio; BadgeCheck é o mais próximo. */}
          {p.verificado && <Icone icone={BadgeCheck} tamanho={18} cor="texto" traco={2} />}
        </View>
        <Texto cor="textoSuave">{comArroba(p.handle)}</Texto>
        {p.silenciado && (
          <View
            style={estilos.silenciado}
            accessible
            accessibilityLabel={`${nome} está silenciado`}
          >
            <Icone icone={VolumeX} tamanho={14} cor="textoSuave" traco={2} />
            <Texto estilo="legenda" cor="textoSuave">
              Silenciado · fora do seu feed e das mensagens
            </Texto>
          </View>
        )}
      </View>
      {p.ficha ? <Texto>{p.ficha}</Texto> : null}
      <View style={estilos.numeros}>
        {numeros.map((n) => (
          <View key={n.rotulo} style={estilos.numero} accessible>
            <Texto estilo="corpoForte">{n.valor}</Texto>
            <Texto cor="textoSuave">{n.rotulo}</Texto>
          </View>
        ))}
      </View>

      {!ehJogador && (
        <BotaoMetal
          rotulo={abrirConversa.isPending ? 'Abrindo conversa…' : 'Mandar mensagem'}
          disabled={abrirConversa.isPending}
          onPress={mandarMensagem}
        />
      )}

      {!ehJogador && (
        <Chip
          rotulo={p.silenciado ? 'Deixar de silenciar' : 'Silenciar'}
          icone={p.silenciado ? Volume2 : VolumeX}
          onPress={silenciar.isPending ? undefined : alternarSilencio}
        />
      )}

      {p.relacao && (
        <Cartao style={estilos.cartao}>
          <View
            style={estilos.linhaEntre}
            accessible
            accessibilityLabel={`Sua relação: ${p.relacao.rotulo}, ${p.relacao.afinidade}%`}
          >
            <Texto estilo="mini" cor="textoSuave">
              Sua relação
            </Texto>
            <Texto estilo="corpoForte">{p.relacao.afinidade}%</Texto>
          </View>
          <Texto estilo="secao">{p.relacao.rotulo}</Texto>
          <BarraProgresso valor={p.relacao.afinidade / 100} rotulo={`Afinidade com ${nome}`} />
          {hoje !== 0 && (
            <View
              style={estilos.efeito}
              accessible
              accessibilityLabel={`Afinidade ${hoje > 0 ? 'subiu' : 'caiu'} ${Math.abs(hoje)}% hoje`}
            >
              <Icone
                icone={hoje > 0 ? ArrowUp : ArrowDown}
                tamanho={12}
                cor="textoSuave"
                traco={2}
              />
              <Texto estilo="legenda" cor="textoSuave">
                {Math.abs(hoje)}% hoje
              </Texto>
            </View>
          )}
        </Cartao>
      )}

      {!ehJogador && (
        <Cartao style={estilos.cartao}>
          <View style={estilos.tituloMemoria}>
            {/* icon/estrela do Figma (26:421) é desenho próprio; Sparkles é o mais próximo. */}
            <Icone icone={Sparkles} tamanho={13} cor="destaqueTinta" traco={2} />
            <Texto estilo="mini" cor="destaqueTinta" accessibilityRole="header">
              O que {nome} lembra de você
            </Texto>
          </View>
          {p.lembra.length === 0 ? (
            <Texto cor="textoSuave">Ainda não guardou nenhuma lembrança sua.</Texto>
          ) : (
            p.lembra.map((fato, i) => {
              const { dia, texto } = separarDia(fato);
              return (
                <View
                  key={`${i}-${fato}`}
                  style={estilos.fato}
                  accessible
                  accessibilityLabel={dia ? `${dia}: ${texto}` : texto}
                >
                  {dia && <Rotulo texto={dia} variante="data" />}
                  <Texto style={estilos.encolhe}>{texto}</Texto>
                </View>
              );
            })
          )}
        </Cartao>
      )}
    </Tela>
  );
}

const estilos = StyleSheet.create({
  identidade: { gap: 2 },
  nome: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  silenciado: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 4 },
  numeros: { flexDirection: 'row', flexWrap: 'wrap', columnGap: 16, rowGap: 4 },
  numero: { flexDirection: 'row', gap: 4 },
  cartao: { gap: 10 },
  linhaEntre: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  efeito: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tituloMemoria: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  fato: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  encolhe: { flex: 1 },
});
