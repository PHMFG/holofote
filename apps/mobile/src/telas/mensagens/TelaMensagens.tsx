import { MAX_ESCALA_FONTE } from '@holofote/tokens';
import type { Conversa, PersonagemResumo } from '@holofote/shared';
import { router } from 'expo-router';
import { Pen, Search, X } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { tratarErroDeAcao } from '../../acoes/erros';
import { useAbrirConversa, useConversas, useMundo, useRelacoes } from '../../api/consultas';
import { normalizar } from '../../formatar';
import { horaCurta, useAgora } from '../../tempo';
import { useTema } from '../../tema/ProvedorTema';
import { BotaoSuave } from '../../ui/BotaoSuave';
import { Camada } from '../../ui/Camada';
import { Cartao } from '../../ui/Cartao';
import { EstadoTela } from '../../ui/EstadoTela';
import { Icone } from '../../ui/Icone';
import { RotuloSecao } from '../../ui/Rotulo';
import { Tela } from '../../ui/Tela';
import { Texto } from '../../ui/Texto';
import { LinhaConversa } from './LinhaConversa';
import { NovaConversa } from './NovaConversa';

const instante = (c: Conversa) => (c.ultima ? new Date(c.ultima.criadoEm).getTime() : 0);

const combina = (termo: string, p: PersonagemResumo) =>
  normalizar(p.nome).includes(termo) || normalizar(p.handle).includes(termo);

/** 14 · Mensagens: conversas pela última mensagem e um jeito de puxar conversa com o elenco. */
export function TelaMensagens() {
  const conversas = useConversas();
  const relacoes = useRelacoes();
  const mundo = useMundo();
  const agora = useAgora(60_000);
  const abrir = useAbrirConversa();
  const [busca, setBusca] = useState('');
  const [escolhendo, setEscolhendo] = useState(false);

  const ordenadas = useMemo(
    // Quem está silenciado fica fora da lista, mas a conversa continua abrindo pelo perfil.
    () =>
      (conversas.data ?? []).filter((c) => !c.silenciada).sort((a, b) => instante(b) - instante(a)),
    [conversas.data],
  );
  const termo = normalizar(busca.trim());
  const filtradas = termo ? ordenadas.filter((c) => combina(termo, c.personagem)) : ordenadas;
  const elenco = (relacoes.data?.nos ?? [])
    .filter((n) => n.personagem.papel === 'elenco' && (!termo || combina(termo, n.personagem)))
    .sort((a, b) => b.relacao.afinidade - a.relacao.afinidade);
  const semConversas = conversas.data !== undefined && ordenadas.length === 0;
  const mostrarElenco = escolhendo || termo.length > 0 || semConversas;

  const comecar = (personagem: PersonagemResumo) => {
    const existente = conversas.data?.find((c) => c.personagem.id === personagem.id);
    const ir = (conversaId: string) => {
      setEscolhendo(false);
      setBusca('');
      router.push(`/dm/${conversaId}`);
    };
    if (existente) return ir(existente.id);
    if (abrir.isPending) return;
    abrir.mutate(personagem.id, { onSuccess: (c) => ir(c.id), onError: tratarErroDeAcao });
  };

  const cabecalho = (
    <View style={estilos.topo}>
      <Texto estilo="titulo" accessibilityRole="header" style={estilos.titulo}>
        Mensagens
      </Texto>
      <BotaoSuave
        icone={escolhendo ? X : Pen}
        rotulo={escolhendo ? 'Fechar nova conversa' : 'Nova conversa'}
        onPress={() => setEscolhendo((atual) => !atual)}
      />
    </View>
  );

  if (!conversas.data) {
    return (
      <Tela comAbas cabecalho={cabecalho} rolavel={false}>
        {conversas.isError ? (
          <EstadoTela
            tipo="erro"
            frase="Não deu para abrir suas conversas."
            acao={{ rotulo: 'Tentar de novo', onPress: () => void conversas.refetch() }}
          />
        ) : (
          <EstadoTela tipo="carregando" frase="Carregando conversas…" />
        )}
      </Tela>
    );
  }

  return (
    <Tela comAbas cabecalho={cabecalho} gap={12}>
      <CampoBusca valor={busca} onMudar={setBusca} />
      {mostrarElenco && (
        <NovaConversa
          elenco={elenco}
          onEscolher={comecar}
          carregando={relacoes.isPending}
          erro={relacoes.isError && !relacoes.data}
          onTentarDeNovo={() => void relacoes.refetch()}
          comBusca={termo.length > 0}
        />
      )}
      {semConversas ? (
        <Cartao style={estilos.vazio}>
          <Texto cor="textoSuave" style={estilos.centro}>
            Nenhuma conversa ainda. Escolha alguém do elenco para começar.
          </Texto>
        </Cartao>
      ) : (
        <>
          <RotuloSecao texto="Conversas" />
          <Cartao lista style={estilos.lista}>
            {filtradas.length === 0 && (
              <Texto cor="textoSuave" style={[estilos.centro, estilos.semResultado]}>
                Nenhuma conversa com esse nome.
              </Texto>
            )}
            {filtradas.map((conversa, i) => (
              <LinhaConversa
                key={conversa.id}
                conversa={conversa}
                hora={
                  conversa.ultima
                    ? horaCurta(conversa.ultima.criadoEm, agora, mundo.data?.dia)
                    : undefined
                }
                separador={i < filtradas.length - 1}
                onPress={() => router.push(`/dm/${conversa.id}`)}
              />
            ))}
          </Cartao>
        </>
      )}
    </Tela>
  );
}

/** Campo "Buscar no elenco" (Figma 54:1355): pílula afundada com lupa. */
function CampoBusca({ valor, onMudar }: { valor: string; onMudar: (texto: string) => void }) {
  const { cores, tipografia } = useTema();
  return (
    <Camada cor="superficie2" sombra="afundado" raio={999} style={estilos.busca}>
      <Icone icone={Search} tamanho={16} />
      <TextInput
        value={valor}
        onChangeText={onMudar}
        placeholder="Buscar no elenco"
        accessibilityLabel="Buscar no elenco"
        returnKeyType="search"
        clearButtonMode="while-editing"
        autoCorrect={false}
        maxFontSizeMultiplier={MAX_ESCALA_FONTE}
        placeholderTextColor={cores.textoSuave}
        selectionColor={cores.destaque}
        style={[tipografia.corpo, estilos.campo, { color: cores.texto }]}
      />
    </Camada>
  );
}

const estilos = StyleSheet.create({
  topo: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 44 },
  titulo: { flex: 1 },
  busca: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  campo: { flex: 1, padding: 0 },
  lista: { paddingHorizontal: 14, paddingVertical: 2 },
  vazio: { alignItems: 'center' },
  centro: { textAlign: 'center' },
  semResultado: { paddingVertical: 16 },
});
