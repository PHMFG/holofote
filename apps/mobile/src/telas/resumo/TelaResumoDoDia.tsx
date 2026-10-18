import type { Periodo, ResumoDia } from '@holofote/shared';
import { router } from 'expo-router';
import {
  ArrowDown,
  ArrowUp,
  AtSign,
  Bell,
  ChevronRight,
  Flag,
  MessageSquare,
  Minus,
  Moon,
  Newspaper,
  Sun,
  Sunrise,
  Trophy,
  User,
  X,
  type LucideIcon,
} from 'lucide-react-native';
import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { ErroDaApi } from '../../api/cliente';
import { useMundo, useResumoDia } from '../../api/consultas';
import { formatarNumero } from '../../formatar';
import { voltarOuInicio } from '../../navegacao';
import { NOME_PERIODO } from '../../tempo';
import { useTema } from '../../tema/ProvedorTema';
import { Aparecer } from '../../ui/Aparecer';
import { BotaoMetal } from '../../ui/BotaoMetal';
import { BotaoSuave } from '../../ui/BotaoSuave';
import { Cabecalho } from '../../ui/Cabecalho';
import { Cartao } from '../../ui/Cartao';
import { Esfera, corSobreEsfera } from '../../ui/Esfera';
import { EstadoTela } from '../../ui/EstadoTela';
import { Icone } from '../../ui/Icone';
import { LinhaDeLista } from '../../ui/LinhaDeLista';
import { RotuloSecao } from '../../ui/Rotulo';
import { Tela } from '../../ui/Tela';
import { Texto } from '../../ui/Texto';
import { CURVA, DURACAO, MOLA, atrasoDaCascata, useMovimento } from '../../ui/movimento';
import { Pop } from '../perfil/efeitos';
import { NumeroContando } from '../perfil/NumeroContando';

const ICONE_DO_PERIODO: Record<Periodo, LucideIcon> = { manha: Sunrise, tarde: Sun, noite: Moon };

/** Ícone da pendência pela rota de destino (a pendência só traz texto e rota). */
function iconeDaPendencia(rota: string): LucideIcon {
  if (rota.startsWith('/dm') || rota.startsWith('/mensagens')) return MessageSquare;
  if (rota.startsWith('/evento')) return Trophy;
  if (rota.startsWith('/post')) return AtSign;
  if (rota.startsWith('/personagem')) return User;
  if (rota.startsWith('/marco') || rota.startsWith('/jornada')) return Flag;
  return Bell;
}

/**
 * 20 · Resumo do dia (Figma 57:1582 claro, 58:2683 escuro), em modal: manchete escrita pela IA
 * no lote da madrugada, os números do motor e o que pede resposta. Abre sozinho na primeira
 * visita do dia (useAbrirResumoDoDia).
 */
export function TelaResumoDoDia() {
  const resumo = useResumoDia();
  const mundo = useMundo();
  const cabecalho = (
    <Cabecalho
      navegacao="nenhuma"
      direita={<BotaoSuave icone={X} rotulo="Fechar" onPress={voltarOuInicio} />}
    />
  );

  if (!resumo.data) {
    const semResumo = resumo.error instanceof ErroDaApi && resumo.error.codigo === 'nao_encontrado';
    return (
      <Tela cabecalho={cabecalho} rolavel={false}>
        {semResumo ? (
          <EstadoTela
            tipo="vazio"
            frase="O resumo de hoje ainda não saiu. Ele chega com o lote da madrugada."
            acao={{ rotulo: 'Fechar', onPress: voltarOuInicio }}
          />
        ) : resumo.isError ? (
          <EstadoTela
            tipo="erro"
            frase="Não deu para abrir o resumo do dia."
            acao={{ rotulo: 'Tentar de novo', onPress: () => void resumo.refetch() }}
          />
        ) : (
          <EstadoTela tipo="carregando" frase="Abrindo o resumo do dia…" />
        )}
      </Tela>
    );
  }

  const r = resumo.data;
  const periodo = mundo.data?.periodo;
  const dia = periodo ? `Dia ${r.dia} · ${NOME_PERIODO[periodo]}` : `Dia ${r.dia}`;

  return (
    <Tela gap={12} rodape={<BotaoMetal rotulo="Começar o dia" onPress={voltarOuInicio} />}>
      {/* Como no Figma (57:1582), o fechar fica na linha do título, sem uma linha só para ele. */}
      <Aparecer indice={0}>
        <View style={estilos.cabecaDoDia}>
          <View style={estilos.titulo}>
            <View style={estilos.dia}>
              <Pop de={0.3} atraso={100} mola={MOLA.viva}>
                <Icone
                  icone={ICONE_DO_PERIODO[periodo ?? 'manha']}
                  tamanho={14}
                  cor="destaqueTinta"
                />
              </Pop>
              <Texto estilo="mini" cor="destaqueTinta">
                {dia}
              </Texto>
            </View>
            <Texto estilo="titulo" accessibilityRole="header">
              {r.dia === 1 ? 'Seu primeiro dia' : 'Enquanto você dormia'}
            </Texto>
          </View>
          <BotaoSuave icone={X} rotulo="Fechar" onPress={voltarOuInicio} />
        </View>
      </Aparecer>

      {/* A manchete é o centro do resumo: entra depois do cabeçalho, com mola, e leva um contorno
          de destaque que acende e apaga uma vez. */}
      <Pop de={0.92} deslocamento={14} atraso={160} mola={MOLA.suave}>
        <ContornoPassageiro>
          <Cartao style={estilos.manchete}>
            <View style={estilos.cabecaManchete}>
              <Pop de={0.3} atraso={300} mola={MOLA.viva}>
                <Esfera tom="escuro" tamanho={32}>
                  <Icone icone={Newspaper} tamanho={14} cor={corSobreEsfera('escuro')} />
                </Esfera>
              </Pop>
              <Texto estilo="corpoForte">Manchete do dia</Texto>
            </View>
            <Aparecer modo="fade" atraso={380}>
              <Texto estilo="secao">{r.manchete}</Texto>
            </Aparecer>
          </Cartao>
        </ContornoPassageiro>
      </Pop>

      {r.numeros.length > 0 && <Numeros numeros={r.numeros} />}

      {r.pendencias.length > 0 && (
        <>
          <Aparecer indice={r.numeros.length + 1}>
            <RotuloSecao
              texto="Pedem sua resposta"
              meta={String(r.pendencias.length)}
              corMeta="textoSuave"
            />
          </Aparecer>
          <Cartao lista style={estilos.pendencias}>
            {r.pendencias.map((p, i) => (
              <Aparecer
                key={`${p.destino.rota}-${i}`}
                indice={i}
                atraso={atrasoDaCascata(r.numeros.length + 1) + 80}
              >
                <LinhaDeLista
                  titulo={p.texto}
                  linhasDoTitulo={2}
                  separador={i < r.pendencias.length - 1}
                  inicio={
                    <Esfera tom="escuro" tamanho={40}>
                      <Icone
                        icone={iconeDaPendencia(p.destino.rota)}
                        tamanho={18}
                        cor={corSobreEsfera('escuro')}
                      />
                    </Esfera>
                  }
                  fim={<Icone icone={ChevronRight} tamanho={16} cor="textoSuave" />}
                  onPress={() => router.push(p.destino.rota)}
                />
              </Aparecer>
            ))}
          </Cartao>
        </>
      )}
    </Tela>
  );
}

/**
 * Linhas de cartões de números: três por linha (57:1633). Sobrando um cartão, as duas últimas
 * linhas ficam com dois cada (4 vira 2 + 2, 7 vira 3 + 2 + 2), em vez de um cartão sozinho
 * esticado na última.
 */
export function agruparNumeros<T>(numeros: readonly T[]): T[][] {
  const linhas: T[][] = [];
  const sobraUm = numeros.length % 3 === 1 && numeros.length >= 4;
  const corte = sobraUm ? numeros.length - 4 : numeros.length;
  for (let i = 0; i < corte; i += 3) linhas.push(numeros.slice(i, i + 3));
  if (sobraUm) {
    linhas.push(numeros.slice(corte, corte + 2));
    linhas.push(numeros.slice(corte + 2));
  }
  return linhas;
}

/** Cartões de número: rótulo, valor e a variação com seta. */
function Numeros({ numeros }: { numeros: ResumoDia['numeros'] }) {
  const linhas = agruparNumeros(numeros);
  // Índice corrido dos cartões: a cascata anda da esquerda para a direita, linha a linha.
  let posicao = 0;
  return (
    <>
      {linhas.map((linha, i) => (
        <View key={i} style={estilos.numeros}>
          {linha.map((n) => (
            <Numero key={n.rotulo} {...n} indice={posicao++} />
          ))}
        </View>
      ))}
    </>
  );
}

/** Contorno de destaque que acende e apaga uma vez em volta do cartão, chamando o olhar. */
function ContornoPassageiro({ children }: { children: ReactNode }) {
  const { cores, medidas } = useTema();
  const { reduzido } = useMovimento();
  const brilho = useSharedValue(0);
  useEffect(() => {
    if (reduzido) return;
    brilho.value = withDelay(
      450,
      withSequence(
        withTiming(1, { duration: DURACAO.media, easing: CURVA.saida }),
        withTiming(0, { duration: DURACAO.lenta + 300, easing: CURVA.entradaSaida }),
      ),
    );
    return () => cancelAnimation(brilho);
  }, [reduzido, brilho]);
  const estilo = useAnimatedStyle(() => ({ opacity: brilho.value }));
  return (
    <View>
      {children}
      <Animated.View
        pointerEvents="none"
        style={[
          estilos.contorno,
          { borderColor: cores.destaque, borderRadius: medidas.cartaoRaio },
          estilo,
        ]}
      />
    </View>
  );
}

function Numero({
  rotulo,
  valor,
  variacao,
  indice,
}: ResumoDia['numeros'][number] & { indice: number }) {
  const sobe = variacao !== null && variacao > 0;
  const desce = variacao !== null && variacao < 0;
  const cor = sobe ? 'destaqueTinta' : 'textoSuave';
  const variacaoTexto =
    variacao === null
      ? null
      : `${sobe ? '+' : desce ? '−' : ''}${formatarNumero(Math.abs(variacao))}`;
  const falada =
    variacao === null
      ? ''
      : sobe
        ? `, subiu ${formatarNumero(variacao)}`
        : desce
          ? `, caiu ${formatarNumero(Math.abs(variacao))}`
          : ', sem mudança';
  const atraso = atrasoDaCascata(indice + 2);
  return (
    <Aparecer indice={indice + 2} style={estilos.cartaoNumero}>
      <Cartao style={estilos.numero} accessible accessibilityLabel={`${rotulo}: ${valor}${falada}`}>
        <Texto estilo="mini" cor="textoSuave" numberOfLines={1}>
          {rotulo}
        </Texto>
        <NumeroContando
          estilo="numero"
          texto={valor}
          numberOfLines={1}
          adjustsFontSizeToFit
          animarAte={7}
          atraso={atraso + 150}
        />
        {variacaoTexto && (
          <Pop
            de={0.3}
            deslocamento={sobe ? 6 : desce ? -6 : 0}
            atraso={atraso + 450}
            mola={MOLA.viva}
            style={estilos.alinhaInicio}
          >
            <View style={estilos.variacao}>
              <Icone
                icone={sobe ? ArrowUp : desce ? ArrowDown : Minus}
                tamanho={12}
                cor={cor}
                traco={2}
              />
              <NumeroContando
                estilo="legenda"
                cor={cor}
                texto={variacaoTexto}
                atraso={atraso + 450}
              />
            </View>
          </Pop>
        )}
      </Cartao>
    </Aparecer>
  );
}

const estilos = StyleSheet.create({
  cabecaDoDia: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  titulo: { gap: 2, flex: 1, paddingTop: 2 },
  dia: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  manchete: { gap: 10 },
  cabecaManchete: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  numeros: { flexDirection: 'row', gap: 10 },
  cartaoNumero: { flex: 1 },
  numero: { gap: 2, padding: 14 },
  alinhaInicio: { alignSelf: 'flex-start' },
  contorno: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderWidth: 2 },
  variacao: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  pendencias: { paddingHorizontal: 14, paddingVertical: 2 },
});
