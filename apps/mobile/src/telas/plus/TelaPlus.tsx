import * as Haptics from 'expo-haptics';
import { Check, Sparkles, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import { tratarErroDeAcao } from '../../acoes/erros';
import { useConta, usePlus } from '../../api/consultas';
import { voltarOuInicio } from '../../navegacao';
import { useTema } from '../../tema/ProvedorTema';
import { Aparecer } from '../../ui/Aparecer';
import { BotaoMetal } from '../../ui/BotaoMetal';
import { BotaoSuave } from '../../ui/BotaoSuave';
import { Cabecalho } from '../../ui/Cabecalho';
import { Cartao } from '../../ui/Cartao';
import { Chip } from '../../ui/Chip';
import { Esfera, corSobreEsfera } from '../../ui/Esfera';
import { EstadoTela } from '../../ui/EstadoTela';
import { Icone } from '../../ui/Icone';
import { Rotulo } from '../../ui/Rotulo';
import { Tela } from '../../ui/Tela';
import { Texto } from '../../ui/Texto';
import { MOLA, atrasoDaCascata } from '../../ui/movimento';
import {
  BrilhoRespirando,
  Confete,
  Halo,
  ItemFluido,
  Pop,
  Reluzir,
  Troca,
} from '../perfil/efeitos';

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
  const { medidas } = useTema();
  // Ativar dispara uma celebração curta junto com a vibração de sucesso.
  const [celebrando, setCelebrando] = useState(false);
  const fimDaFesta = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(fimDaFesta.current), []);

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
        if (ligar) {
          setCelebrando(true);
          clearTimeout(fimDaFesta.current);
          fimDaFesta.current = setTimeout(() => setCelebrando(false), 2200);
        }
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
        <Troca chave={ativo ? 'ativo' : 'gratuito'} style={estilos.trocaRodape}>
          {ativo ? (
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
              <Reluzir
                raio={medidas.botaoMetalAltura / 2}
                ativo={!plus.isPending}
                style={estilos.largo}
              >
                <BotaoMetal
                  rotulo="Ativar Plus de teste"
                  disabled={plus.isPending}
                  accessibilityHint={AVISO_TESTE}
                  onPress={() => {
                    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                    mudar(true);
                  }}
                />
              </Reluzir>
              <Texto estilo="legenda" cor="textoSuave" style={estilos.centro}>
                {AVISO_TESTE}
              </Texto>
            </View>
          )}
        </Troca>
      }
    >
      <Abertura ativo={ativo} celebrando={celebrando} />

      <Aparecer indice={3}>
        <Cartao lista style={estilos.beneficios}>
          {BENEFICIOS.map((beneficio, i) => (
            <Beneficio key={beneficio} texto={beneficio} indice={i} />
          ))}
        </Cartao>
      </Aparecer>

      {ativo && (
        <ItemFluido indice={0}>
          <Cartao style={estilos.ativo} accessible>
            <Texto estilo="corpoForte">Plano ativo</Texto>
            <Texto estilo="legenda" cor="textoSuave">
              Sua energia vai até {conta.data.energia.max} e recarrega a cada{' '}
              {conta.data.energia.regras.recargaMin} min. Nada foi cobrado.
            </Texto>
          </Cartao>
        </ItemFluido>
      )}
    </Tela>
  );
}

/**
 * Esfera com brilho no destaque, selo, título e frase (29:489). O brilho respira e uma onda se
 * abre por trás da esfera; ao ativar, o título troca, a esfera salta e as partículas explodem.
 */
function Abertura({ ativo, celebrando }: { ativo: boolean; celebrando: boolean }) {
  return (
    <View style={estilos.abertura}>
      <View style={estilos.cenaDaEsfera}>
        <Halo escala={1.6} duracao={2600} />
        <Halo ativo={celebrando} unico escala={2.6} duracao={1000} cor="destaqueSuave" />
        <Pop de={0.4} atraso={80} mola={MOLA.viva}>
          <BrilhoRespirando raio={46}>
            <Pop key={celebrando ? 'festa' : 'calma'} de={celebrando ? 0.7 : 1} mola={MOLA.viva}>
              <Esfera tom="escuro" tamanho={92}>
                <Icone icone={Sparkles} tamanho={40} cor={corSobreEsfera('escuro')} traco={2} />
              </Esfera>
            </Pop>
          </BrilhoRespirando>
        </Pop>
        <Confete disparar={celebrando} raio={130} />
      </View>
      <Aparecer indice={1} modo="fade">
        <Troca chave={ativo ? 'selo-ativo' : 'selo-novo'}>
          <Rotulo
            texto={ativo ? 'Plano ativo' : 'Novo: personagens proativos'}
            variante="destaque"
          />
        </Troca>
      </Aparecer>
      <Aparecer indice={2}>
        <Troca chave={ativo ? 'titulo-ativo' : 'titulo-novo'}>
          <Texto estilo="display" accessibilityRole="header">
            {ativo ? 'Você é Plus' : 'Holofote Plus'}
          </Texto>
        </Troca>
      </Aparecer>
      <Aparecer indice={3}>
        <Texto cor="textoSuave" style={estilos.centro}>
          Seu mundo continua vivo quando você sai.
        </Texto>
      </Aparecer>
    </View>
  );
}

/** Benefício com o check que salta, em cascata depois da abertura. */
function Beneficio({ texto, indice }: { texto: string; indice: number }) {
  const { cores } = useTema();
  const atraso = atrasoDaCascata(indice) + 450;
  return (
    <Aparecer indice={indice} atraso={450}>
      <View style={estilos.beneficio} accessible accessibilityLabel={texto}>
        <Pop de={0.2} atraso={atraso + 120} mola={MOLA.viva}>
          <View style={[estilos.marca, { backgroundColor: cores.destaqueSuave }]}>
            <Icone icone={Check} tamanho={14} cor="destaqueTinta" traco={2} />
          </View>
        </Pop>
        <Texto style={estilos.flex}>{texto}</Texto>
      </View>
    </Aparecer>
  );
}

const estilos = StyleSheet.create({
  flex: { flex: 1 },
  centro: { textAlign: 'center' },
  largo: { alignSelf: 'stretch' },
  rodape: { gap: 10, alignItems: 'center' },
  trocaRodape: { alignSelf: 'stretch' },
  cenaDaEsfera: { width: 92, height: 92, alignItems: 'center', justifyContent: 'center' },
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
