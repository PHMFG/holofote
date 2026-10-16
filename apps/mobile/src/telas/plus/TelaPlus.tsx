import * as Haptics from 'expo-haptics';
import { Check, Sparkles, X } from 'lucide-react-native';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import { tratarErroDeAcao } from '../../acoes/erros';
import { useConta, usePlus } from '../../api/consultas';
import { voltarOuInicio } from '../../navegacao';
import { useTema } from '../../tema/ProvedorTema';
import { BotaoMetal } from '../../ui/BotaoMetal';
import { BotaoSuave } from '../../ui/BotaoSuave';
import { Cabecalho } from '../../ui/Cabecalho';
import { Camada } from '../../ui/Camada';
import { Cartao } from '../../ui/Cartao';
import { Chip } from '../../ui/Chip';
import { Esfera, corSobreEsfera } from '../../ui/Esfera';
import { EstadoTela } from '../../ui/EstadoTela';
import { Icone } from '../../ui/Icone';
import { Rotulo } from '../../ui/Rotulo';
import { Tela } from '../../ui/Tela';
import { Texto } from '../../ui/Texto';

/** Aviso fixo do placebo (docs/DECISOES.md: Plus liga o plano na conta sem cobrança). */
export const AVISO_TESTE = 'Versão de teste: nenhuma cobrança é feita.';

// Sem números: os valores do plano (energia, recarga, conversas) vêm do motor e só aparecem
// com o Plus ligado, em `conta.energia`. Antes disso o app não promete o que não lê da API.
const BENEFICIOS = [
  'Energia em dobro',
  'Recarga mais rápida',
  'Sem anúncios',
  'Personagens puxam conversa com mais frequência',
];

/**
 * 11 · Holofote Plus (Figma 29:467 claro, 31:1322 escuro), em modal. É placebo: assinar só liga
 * o plano Plus na conta, sem cobrança, e a tela diz isso. Não há escolha de plano nem preço:
 * um seletor mensal/anual sugeriria uma cobrança que não existe. Com a conta já Plus, mostra o
 * plano ativo e a volta para o gratuito.
 */
export function TelaPlus() {
  const conta = useConta();
  const plus = usePlus();

  const cabecalho = (
    <Cabecalho
      navegacao="nenhuma"
      direita={<BotaoSuave icone={X} rotulo="Fechar" onPress={voltarOuInicio} />}
    />
  );

  if (!conta.data) {
    return (
      <Tela cabecalho={cabecalho} rolavel={false}>
        {conta.isError ? (
          <EstadoTela
            tipo="erro"
            frase="Não deu para abrir sua conta."
            acao={{ rotulo: 'Tentar de novo', onPress: () => void conta.refetch() }}
          />
        ) : (
          <EstadoTela tipo="carregando" frase="Abrindo o Holofote Plus…" />
        )}
      </Tela>
    );
  }

  const ativo = conta.data.plano === 'plus';

  const mudar = (ligar: boolean) =>
    plus.mutate(ligar, {
      onSuccess: () => {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        AccessibilityInfo.announceForAccessibility(
          ligar ? `Holofote Plus ativado. ${AVISO_TESTE}` : 'Você voltou para o plano gratuito.',
        );
      },
      onError: tratarErroDeAcao,
    });

  return (
    <Tela
      cabecalho={cabecalho}
      gap={14}
      rodape={
        ativo ? (
          <View style={estilos.rodape}>
            <Chip
              rotulo={plus.isPending ? 'Voltando…' : 'Voltar para o gratuito'}
              variante="elevado"
              tamanho="grande"
              onPress={plus.isPending ? undefined : () => mudar(false)}
            />
            <Texto estilo="legenda" cor="textoSuave" style={estilos.centro}>
              {AVISO_TESTE}
            </Texto>
          </View>
        ) : (
          <View style={estilos.rodape}>
            <BotaoMetal
              rotulo="Ativar Plus de teste"
              disabled={plus.isPending}
              accessibilityHint={AVISO_TESTE}
              onPress={() => {
                void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                mudar(true);
              }}
              style={estilos.largo}
            />
            <Texto estilo="legenda" cor="textoSuave" style={estilos.centro}>
              {AVISO_TESTE}
            </Texto>
          </View>
        )
      }
    >
      <Abertura ativo={ativo} />

      <Cartao lista style={estilos.beneficios}>
        {BENEFICIOS.map((beneficio) => (
          <Beneficio key={beneficio} texto={beneficio} />
        ))}
      </Cartao>

      {ativo && (
        <Cartao style={estilos.ativo} accessible>
          <Texto estilo="corpoForte">Plano ativo</Texto>
          <Texto estilo="legenda" cor="textoSuave">
            Sua energia vai até {conta.data.energia.max} e recarrega a cada{' '}
            {conta.data.energia.regras.recargaMin} min. Nada foi cobrado.
          </Texto>
        </Cartao>
      )}
    </Tela>
  );
}

/** Esfera com brilho no destaque, selo, título e frase (29:489). */
function Abertura({ ativo }: { ativo: boolean }) {
  return (
    <View style={estilos.abertura}>
      <Camada sombra="brilhoDestaque" raio={46}>
        <Esfera tom="escuro" tamanho={92}>
          <Icone icone={Sparkles} tamanho={40} cor={corSobreEsfera('escuro')} traco={2} />
        </Esfera>
      </Camada>
      <Rotulo texto={ativo ? 'Plano ativo' : 'Novo: personagens proativos'} variante="destaque" />
      <Texto estilo="display" accessibilityRole="header">
        {ativo ? 'Você é Plus' : 'Holofote Plus'}
      </Texto>
      <Texto cor="textoSuave" style={estilos.centro}>
        Seu mundo continua vivo quando você sai.
      </Texto>
    </View>
  );
}

function Beneficio({ texto }: { texto: string }) {
  const { cores } = useTema();
  return (
    <View style={estilos.beneficio} accessible accessibilityLabel={texto}>
      <View style={[estilos.marca, { backgroundColor: cores.destaqueSuave }]}>
        <Icone icone={Check} tamanho={14} cor="destaqueTinta" traco={2} />
      </View>
      <Texto style={estilos.flex}>{texto}</Texto>
    </View>
  );
}

const estilos = StyleSheet.create({
  flex: { flex: 1 },
  centro: { textAlign: 'center' },
  largo: { alignSelf: 'stretch' },
  rodape: { gap: 10, alignItems: 'center' },
  abertura: { alignItems: 'center', gap: 10, paddingTop: 4, paddingBottom: 6 },
  beneficios: { paddingVertical: 6 },
  beneficio: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9 },
  marca: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ativo: { gap: 4 },
});
