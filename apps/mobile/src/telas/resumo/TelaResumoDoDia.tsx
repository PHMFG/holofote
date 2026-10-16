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
import { StyleSheet, View } from 'react-native';
import { ErroDaApi } from '../../api/cliente';
import { useMundo, useResumoDia } from '../../api/consultas';
import { formatarNumero } from '../../formatar';
import { voltarOuInicio } from '../../navegacao';
import { NOME_PERIODO } from '../../tempo';
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
      <View style={estilos.cabecaDoDia}>
        <View style={estilos.titulo}>
          <View style={estilos.dia}>
            <Icone icone={ICONE_DO_PERIODO[periodo ?? 'manha']} tamanho={14} cor="destaqueTinta" />
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

      <Cartao style={estilos.manchete}>
        <View style={estilos.cabecaManchete}>
          <Esfera tom="escuro" tamanho={32}>
            <Icone icone={Newspaper} tamanho={14} cor={corSobreEsfera('escuro')} />
          </Esfera>
          <Texto estilo="corpoForte">Manchete do dia</Texto>
        </View>
        <Texto estilo="secao">{r.manchete}</Texto>
      </Cartao>

      {r.numeros.length > 0 && <Numeros numeros={r.numeros} />}

      {r.pendencias.length > 0 && (
        <>
          <RotuloSecao
            texto="Pedem sua resposta"
            meta={String(r.pendencias.length)}
            corMeta="textoSuave"
          />
          <Cartao lista style={estilos.pendencias}>
            {r.pendencias.map((p, i) => (
              <LinhaDeLista
                key={`${p.destino.rota}-${i}`}
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
  return (
    <>
      {linhas.map((linha, i) => (
        <View key={i} style={estilos.numeros}>
          {linha.map((n) => (
            <Numero key={n.rotulo} {...n} />
          ))}
        </View>
      ))}
    </>
  );
}

function Numero({ rotulo, valor, variacao }: ResumoDia['numeros'][number]) {
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
  return (
    <Cartao style={estilos.numero} accessible accessibilityLabel={`${rotulo}: ${valor}${falada}`}>
      <Texto estilo="mini" cor="textoSuave" numberOfLines={1}>
        {rotulo}
      </Texto>
      <Texto estilo="numero" numberOfLines={1} adjustsFontSizeToFit>
        {valor}
      </Texto>
      {variacaoTexto && (
        <View style={estilos.variacao}>
          <Icone
            icone={sobe ? ArrowUp : desce ? ArrowDown : Minus}
            tamanho={12}
            cor={cor}
            traco={2}
          />
          <Texto estilo="legenda" cor={cor}>
            {variacaoTexto}
          </Texto>
        </View>
      )}
    </Cartao>
  );
}

const estilos = StyleSheet.create({
  cabecaDoDia: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  titulo: { gap: 2, flex: 1, paddingTop: 2 },
  dia: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  manchete: { gap: 10 },
  cabecaManchete: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  numeros: { flexDirection: 'row', gap: 10 },
  numero: { flex: 1, gap: 2, padding: 14 },
  variacao: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  pendencias: { paddingHorizontal: 14, paddingVertical: 2 },
});
