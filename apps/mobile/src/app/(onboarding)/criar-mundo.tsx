import type { PedidoCriarMundo } from '@holofote/shared';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, KeyboardAvoidingView, StyleSheet } from 'react-native';
import { ErroDaApi } from '../../api/cliente';
import { useCriarMundo, useMundo } from '../../api/consultas';
import { useTempoReal } from '../../api/tempoReal';
import { FORM_INICIAL, montarPedido, type FormMundo } from '../../telas/onboarding/formulario';
import { PassoConsentimento } from '../../telas/onboarding/PassoConsentimento';
import { PassoGeracao } from '../../telas/onboarding/PassoGeracao';
import { PassoMundo } from '../../telas/onboarding/PassoMundo';
import { BotaoMetal } from '../../ui/BotaoMetal';
import { EstadoTela } from '../../ui/EstadoTela';
import { Tela } from '../../ui/Tela';

type Passo = 'consentimento' | 'mundo' | 'gerando';

/** Sem o tempo real (socket caindo), a tela pergunta pelo mundo nesse intervalo. */
const INTERVALO_CONSULTA_MS = 3000;

/**
 * 01 · Criar mundo (Figma 14:3 e 30:482), em três passos: consentimento de IA, persona/universo/
 * tom e a geração pela IA. Todo texto do mundo (bíblia, elenco, marcos, evento e feed) é gerado
 * pela IA a partir dessas escolhas; os números saem do motor do servidor.
 */
export default function CriarMundo() {
  const mundo = useMundo();
  const criar = useCriarMundo();
  const [passo, setPasso] = useState<Passo>('consentimento');
  const [aceito, setAceito] = useState(false);
  const [form, setForm] = useState<FormMundo>(FORM_INICIAL);
  const [ultimoPedido, setUltimoPedido] = useState<PedidoCriarMundo | null>(null);

  const estado = mundo.data?.estado;
  const { refetch } = mundo;
  const semMundo = mundo.error instanceof ErroDaApi && mundo.error.codigo === 'nao_encontrado';

  // O evento "mundo" já atualiza o cache (api/tempoReal); aqui só prende a tela no passo 3,
  // para mostrar o elenco quando a geração termina.
  useTempoReal((evento) => {
    if (evento.tipo === 'mundo') setPasso('gerando');
  });

  // Plano B do tempo real: enquanto a IA gera, consulta o mundo a cada 3 s.
  useEffect(() => {
    if (estado !== 'criando') return;
    const id = setInterval(() => {
      setPasso('gerando');
      void refetch();
    }, INTERVALO_CONSULTA_MS);
    return () => clearInterval(id);
  }, [estado, refetch]);

  // Quem já tem mundo pronto ao abrir vai direto para o feed.
  useEffect(() => {
    if (estado === 'pronto' && passo !== 'gerando') router.replace('/');
  }, [estado, passo]);

  const enviar = (pedido: PedidoCriarMundo) => {
    setUltimoPedido(pedido);
    criar.mutate(pedido, {
      onSuccess: () => setPasso('gerando'),
      onError: (erro) => {
        if (
          erro instanceof ErroDaApi &&
          (erro.codigo === 'mundo_existente' || erro.codigo === 'mundo_criando')
        ) {
          setPasso('gerando');
          void refetch();
          return;
        }
        Alert.alert(
          'Não deu para criar o mundo',
          erro instanceof ErroDaApi ? erro.message : 'Confira a internet e tente de novo.',
        );
      },
    });
  };

  if (!mundo.data && !semMundo) {
    return (
      <Tela rolavel={false}>
        {mundo.isError ? (
          <EstadoTela
            tipo="erro"
            frase="Não deu para falar com o servidor."
            acao={{ rotulo: 'Tentar de novo', onPress: () => void refetch() }}
          />
        ) : (
          <EstadoTela tipo="carregando" frase="Abrindo…" />
        )}
      </Tela>
    );
  }

  // Geração em andamento ou com erro aparece mesmo ao reabrir o app; no erro, "Mudar" volta ao
  // formulário (passo "mundo").
  const gerando =
    passo === 'gerando' || estado === 'criando' || (estado === 'erro' && passo !== 'mundo');

  if (estado === 'pronto' && !gerando) {
    return (
      <Tela rolavel={false}>
        <EstadoTela tipo="carregando" frase="Abrindo seu mundo…" />
      </Tela>
    );
  }

  const pedido = montarPedido(form);
  let conteudo;
  let rodape;
  if (gerando) {
    conteudo = <PassoGeracao mundo={mundo.data} onEditar={() => setPasso('mundo')} />;
    if (estado === 'pronto') {
      rodape = <BotaoMetal rotulo="Entrar em cena" onPress={() => router.replace('/')} />;
    } else if (estado === 'erro') {
      rodape = (
        <BotaoMetal
          rotulo="Tentar de novo"
          disabled={criar.isPending}
          onPress={() => (ultimoPedido ? enviar(ultimoPedido) : setPasso('mundo'))}
        />
      );
    }
  } else if (passo === 'mundo') {
    conteudo = (
      <PassoMundo form={form} onMudar={(parcial) => setForm((f) => ({ ...f, ...parcial }))} />
    );
    rodape = (
      <BotaoMetal
        rotulo="Criar mundo"
        disabled={!pedido || criar.isPending}
        onPress={() => pedido && enviar(pedido)}
      />
    );
  } else {
    conteudo = <PassoConsentimento aceito={aceito} onAceitar={setAceito} />;
    rodape = <BotaoMetal rotulo="Continuar" disabled={!aceito} onPress={() => setPasso('mundo')} />;
  }

  return (
    <KeyboardAvoidingView behavior="padding" style={estilos.flex}>
      <Tela rodape={rodape}>{conteudo}</Tela>
    </KeyboardAvoidingView>
  );
}

const estilos = StyleSheet.create({ flex: { flex: 1 } });
