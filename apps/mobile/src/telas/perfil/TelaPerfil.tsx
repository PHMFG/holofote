import type { Atributo } from '@holofote/shared';
import * as Haptics from 'expo-haptics';
import { router } from 'expo-router';
import {
  Book,
  ChevronRight,
  Crown,
  Flame,
  Globe,
  Heart,
  LayoutGrid,
  RotateCcw,
  Sparkles,
  Zap,
  type LucideIcon,
} from 'lucide-react-native';
import { Alert, StyleSheet, View } from 'react-native';
import { tratarErroDeAcao } from '../../acoes/erros';
import { useConta, useMundo, useRecarga, useRegistro, useRelacoes } from '../../api/consultas';
import { formatarNumero } from '../../formatar';
import { Avatar } from '../../ui/Avatar';
import { BarraProgresso } from '../../ui/BarraProgresso';
import { BotaoSuave } from '../../ui/BotaoSuave';
import { Cartao } from '../../ui/Cartao';
import { Esfera } from '../../ui/Esfera';
import { EstadoTela } from '../../ui/EstadoTela';
import { Icone } from '../../ui/Icone';
import { IndicadoresConta } from '../../ui/IndicadoresConta';
import { LinhaDeLista } from '../../ui/LinhaDeLista';
import { Tela } from '../../ui/Tela';
import { Texto } from '../../ui/Texto';
import { Tocavel } from '../../ui/Tocavel';
import { comArroba } from '../registro/formatar';
import { useAgora } from '../../tempo';
import { Capa } from './Capa';
import { useRecomecarMundo } from './recomecar';
import { SetaVariacao, rotuloVariacao } from './SetaVariacao';
import { relacoesPrincipais, variacaoDeHoje } from './variacao';

// icon/estrela do Figma (19:278) é desenho próprio, uma estrela de 4 pontas preenchida;
// Sparkles do lucide é o mais próximo.
const ATRIBUTOS: { chave: Atributo; nome: string; icone: LucideIcon; tamanho: number }[] = [
  { chave: 'fama', nome: 'Fama', icone: Sparkles, tamanho: 15 },
  { chave: 'carisma', nome: 'Carisma', icone: Heart, tamanho: 16 },
  { chave: 'polemica', nome: 'Polêmica', icone: Flame, tamanho: 16 },
];

/** 05 · Perfil do jogador (Figma 19:233 claro, 30:1064 escuro). */
export function TelaPerfil() {
  const mundo = useMundo();
  const relacoes = useRelacoes();
  const conta = useConta();
  const registro = useRegistro();
  const recarga = useRecarga();
  const recomecar = useRecomecarMundo();
  const agora = useAgora(60_000);
  const variacao = variacaoDeHoje(registro.data, agora);

  if (!mundo.data) {
    return (
      <Tela comAbas rolavel={false}>
        <EstadoTela
          tipo={mundo.isError ? 'erro' : 'carregando'}
          frase={mundo.isError ? 'Não deu para abrir seu perfil.' : 'Abrindo seu perfil…'}
          acao={
            mundo.isError
              ? { rotulo: 'Tentar de novo', onPress: () => void mundo.refetch() }
              : undefined
          }
        />
      </Tela>
    );
  }

  const { jogador } = mundo.data;
  const principais = relacoesPrincipais(relacoes.data?.nos ?? []);

  const recarregarDebug = () => {
    if (recarga.isPending) return;
    recarga.mutate('debug', {
      onSuccess: () => void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
      onError: tratarErroDeAcao,
    });
  };

  const confirmarRecomecar = () =>
    Alert.alert(
      'Recomeçar o mundo?',
      'Este mundo, o elenco e as memórias deles serão apagados. Energia e gemas continuam na conta.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Recomeçar',
          style: 'destructive',
          onPress: () => recomecar.mutate(undefined, { onError: tratarErroDeAcao }),
        },
      ],
    );

  return (
    <Tela comAbas gap={12}>
      <Capa
        acoes={
          <View style={estilos.acoesCapa}>
            <IndicadoresConta />
            <View style={estilos.espaco} />
            <BotaoSuave
              icone={Globe}
              rotulo="Aparência"
              variante="elevado"
              onPress={() => router.push('/aparencia')}
            />
            <BotaoSuave
              icone={Book}
              rotulo="Registro de atividades"
              variante="elevado"
              onPress={() => router.push('/registro')}
            />
          </View>
        }
        avatar={
          <Avatar iniciais={jogador.iniciais} tom="escuro" tamanho={84} nome={jogador.nome} />
        }
      />

      <View style={estilos.identidade}>
        <Texto estilo="titulo" accessibilityRole="header">
          {jogador.nome}
        </Texto>
        <Texto cor="textoSuave">
          {comArroba(jogador.handle)} · {mundo.data.universo}
        </Texto>
      </View>
      {jogador.ficha ? <Texto>{jogador.ficha}</Texto> : null}
      <View style={estilos.numeros} accessible>
        <Texto estilo="corpoForte">{formatarNumero(jogador.seguidores)}</Texto>
        <Texto cor="textoSuave">{jogador.seguidores === 1 ? 'seguidor' : 'seguidores'}</Texto>
      </View>

      <Cartao style={estilos.presenca}>
        <View style={estilos.linhaEntre}>
          <Texto estilo="secao" accessibilityRole="header">
            Presença
          </Texto>
          {variacao && (
            <Texto estilo="legenda" cor="textoSuave">
              variação de hoje
            </Texto>
          )}
        </View>
        {ATRIBUTOS.map(({ chave, nome, icone, tamanho }) => {
          const valor = jogador[chave];
          const hoje = variacao?.get(chave) ?? 0;
          return (
            <View key={chave} style={estilos.atributo}>
              <View
                style={estilos.linhaEntre}
                accessible
                accessibilityLabel={[`${nome} ${valor}%`, variacao && rotuloVariacao(hoje)]
                  .filter(Boolean)
                  .join(', ')}
              >
                <View style={estilos.nomeAtributo}>
                  <Icone icone={icone} tamanho={tamanho} cor="texto" />
                  <Texto>{nome}</Texto>
                </View>
                <View style={estilos.valorAtributo}>
                  {variacao && <SetaVariacao valor={hoje} />}
                  <Texto estilo="corpoForte">{valor}%</Texto>
                </View>
              </View>
              <BarraProgresso valor={valor / 100} rotulo={nome} />
            </View>
          );
        })}
      </Cartao>

      <View style={[estilos.linhaEntre, estilos.tituloSecao]}>
        <Texto estilo="secao" accessibilityRole="header">
          Relações
        </Texto>
        <Tocavel
          onPress={() => router.push('/relacoes')}
          accessibilityRole="link"
          accessibilityLabel="Ver mapa de relações"
          hitSlop={8}
          style={estilos.verMapa}
        >
          <Texto estilo="legenda" cor="destaqueTinta">
            Ver mapa
          </Texto>
        </Tocavel>
      </View>
      {relacoes.isError && !relacoes.data ? (
        <EstadoTela
          tipo="erro"
          frase="Não deu para carregar suas relações."
          acao={{ rotulo: 'Tentar de novo', onPress: () => void relacoes.refetch() }}
        />
      ) : (
        <Cartao lista>
          {principais.length === 0 ? (
            <Texto cor="textoSuave" style={estilos.semRelacoes}>
              {relacoes.isPending
                ? 'Carregando relações…'
                : 'Ninguém do elenco cruzou seu caminho ainda.'}
            </Texto>
          ) : (
            principais.map(({ personagem, relacao }, i) => {
              const hoje = variacao?.get(`relacao:${personagem.id}`) ?? 0;
              return (
                <LinhaDeLista
                  key={personagem.id}
                  titulo={personagem.nome}
                  subtitulo={relacao.rotulo}
                  inicio={
                    <Avatar
                      iniciais={personagem.iniciais}
                      tom={personagem.tomAvatar}
                      nome={personagem.nome}
                    />
                  }
                  fim={
                    <View style={estilos.fimRelacao}>
                      <Texto estilo="corpoForte">{relacao.afinidade}%</Texto>
                      {variacao && <SetaVariacao valor={hoje} icone={11} />}
                    </View>
                  }
                  rotuloFim={[`afinidade ${relacao.afinidade}%`, variacao && rotuloVariacao(hoje)]
                    .filter(Boolean)
                    .join(', ')}
                  separador={i < principais.length - 1}
                  onPress={() => router.push(`/personagem/${personagem.id}`)}
                />
              );
            })
          )}
        </Cartao>
      )}

      <View style={estilos.tituloSecao}>
        <Texto estilo="secao" accessibilityRole="header">
          Conta
        </Texto>
      </View>
      <Cartao lista>
        <LinhaConta
          icone={Crown}
          titulo="Holofote Plus"
          subtitulo={
            conta.data?.plano === 'plus'
              ? 'Ativo: energia em dobro e sem anúncios'
              : 'Energia em dobro e sem anúncios'
          }
          navega
          onPress={() => router.push('/plus')}
        />
        <LinhaConta
          icone={Zap}
          titulo="Recarregar energia (debug)"
          subtitulo={recarga.isPending ? 'Recarregando…' : 'Enche a barra na hora, sem custo'}
          onPress={recarregarDebug}
        />
        {__DEV__ && (
          <LinhaConta
            icone={LayoutGrid}
            titulo="Catálogo de componentes"
            subtitulo="Só em desenvolvimento"
            navega
            onPress={() => router.push('/dev/catalogo')}
          />
        )}
        <LinhaConta
          icone={RotateCcw}
          titulo="Recomeçar mundo"
          subtitulo={
            recomecar.isPending ? 'Apagando o mundo…' : 'Apaga este mundo; energia e gemas ficam'
          }
          ultima
          onPress={recomecar.isPending ? undefined : confirmarRecomecar}
        />
      </Cartao>
    </Tela>
  );
}

function LinhaConta({
  icone,
  titulo,
  subtitulo,
  navega,
  ultima,
  onPress,
}: {
  icone: LucideIcon;
  titulo: string;
  subtitulo: string;
  navega?: boolean;
  ultima?: boolean;
  onPress?: () => void;
}) {
  return (
    <LinhaDeLista
      titulo={titulo}
      subtitulo={subtitulo}
      inicio={
        <Esfera tom="claro" tamanho={32}>
          <Icone icone={icone} tamanho={14} cor="texto" traco={2} />
        </Esfera>
      }
      fim={navega ? <Icone icone={ChevronRight} tamanho={16} cor="textoSuave" /> : undefined}
      separador={!ultima}
      onPress={onPress}
    />
  );
}

const estilos = StyleSheet.create({
  acoesCapa: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  espaco: { flex: 1 },
  identidade: { gap: 2 },
  numeros: { flexDirection: 'row', gap: 4 },
  presenca: { gap: 14 },
  linhaEntre: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  atributo: { gap: 8 },
  nomeAtributo: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  valorAtributo: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  tituloSecao: { paddingTop: 4, paddingHorizontal: 4 },
  fimRelacao: { alignItems: 'flex-end', gap: 2 },
  semRelacoes: { paddingVertical: 12 },
  // Área de toque de 44 pt (o texto sozinho tem uns 16).
  verMapa: { minHeight: 44, justifyContent: 'center', marginVertical: -14 },
});
