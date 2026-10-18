import type { EventoResumo } from '@holofote/shared';
import { router } from 'expo-router';
import { ArrowUpRight, Calendar } from 'lucide-react-native';
import { StyleSheet } from 'react-native';
import type { z } from 'zod';
import { useTema } from '../../tema/ProvedorTema';
import { Aparecer } from '../../ui/Aparecer';
import { Camada } from '../../ui/Camada';
import { Esfera, corSobreEsfera } from '../../ui/Esfera';
import { Icone } from '../../ui/Icone';
import { Texto } from '../../ui/Texto';
import { Tocavel } from '../../ui/Tocavel';
import { TrocaSuave } from '../animacao/TrocaSuave';
import { NOME_PERIODO } from '../../tempo';

type Evento = z.infer<typeof EventoResumo>;

const ESTADO: Record<Evento['estado'], string> = {
  anunciado: 'anunciado',
  campanha: 'campanha aberta',
  ao_vivo: 'ao vivo agora',
  encerrado: 'encerrado',
};

/** "Prêmio Holofote em 2 dias", contado pelo dia do mundo. */
export function tituloDoEvento(evento: Evento, diaDoMundo: number): string {
  if (evento.estado === 'ao_vivo') return `${evento.titulo} ao vivo`;
  const faltam = evento.quando.dia - diaDoMundo;
  if (faltam <= 0) return `${evento.titulo} hoje`;
  if (faltam === 1) return `${evento.titulo} amanhã`;
  return `${evento.titulo} em ${faltam} dias`;
}

/**
 * Banner do próximo evento agendado (Figma 16:92): cartão com borda de destaque. Entra com fade
 * e leve subida; o título troca com transição quando o dia do mundo vira.
 */
export function BannerEvento({ evento, diaDoMundo }: { evento: Evento; diaDoMundo: number }) {
  const { medidas } = useTema();
  const titulo = tituloDoEvento(evento, diaDoMundo);
  const detalhe = `Dia ${evento.quando.dia}, ${NOME_PERIODO[evento.quando.periodo]} · ${ESTADO[evento.estado]}`;
  return (
    <Aparecer indice={1}>
      <Tocavel
        onPress={() => router.push(`/evento/${evento.id}`)}
        accessibilityRole="button"
        accessibilityLabel={`${titulo}. ${detalhe}`}
      >
        <Camada
          cor="superficie"
          sombra="elevacao"
          raio={medidas.cartaoRaio}
          borda={{ cor: 'destaque', largura: 1.5 }}
          style={estilos.cartao}
        >
          <Esfera tom="escuro" tamanho={44}>
            <Icone icone={Calendar} tamanho={18} cor={corSobreEsfera('escuro')} traco={2} />
          </Esfera>
          <TrocaSuave chave={`${titulo}|${detalhe}`} style={estilos.textos}>
            <Texto estilo="corpoForte" numberOfLines={1}>
              {titulo}
            </Texto>
            <Texto estilo="legenda" cor="textoSuave" numberOfLines={1}>
              {detalhe}
            </Texto>
          </TrocaSuave>
          {/* Seta do botão suave do Figma, decorativa: o cartão inteiro é o toque. */}
          <Camada cor="superficie2" raio={medidas.botaoSuave / 2} style={estilos.seta}>
            <Icone icone={ArrowUpRight} tamanho={18} cor="texto" />
          </Camada>
        </Camada>
      </Tocavel>
    </Aparecer>
  );
}

const estilos = StyleSheet.create({
  cartao: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 12 },
  textos: { flex: 1, gap: 1 },
  seta: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
});
