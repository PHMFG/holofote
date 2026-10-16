import { Plus } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { Avatar } from '../../ui/Avatar';
import { CampoTexto } from '../../ui/CampoTexto';
import { Cartao } from '../../ui/Cartao';
import { Chip } from '../../ui/Chip';
import { Texto } from '../../ui/Texto';
import { ControleDeslizante } from './ControleDeslizante';
import {
  UNIVERSOS,
  erroDoHandle,
  iniciaisDe,
  normalizarHandle,
  type FormMundo,
} from './formulario';
import { RotuloGrupo, TopoDoPasso } from './TopoDoPasso';

export interface PassoMundoProps {
  form: FormMundo;
  onMudar: (parcial: Partial<FormMundo>) => void;
}

/** Passo 2 (Figma 14:3): persona, universo e tom do mundo. */
export function PassoMundo({ form, onMudar }: PassoMundoProps) {
  const handle = normalizarHandle(form.handle);
  const linhaPersona = [handle, form.descricao.trim()].filter(Boolean).join(' · ');

  return (
    <>
      <TopoDoPasso
        passo={2}
        titulo="Monte o seu mundo"
        texto="A IA cria o elenco, as contas e as primeiras fofocas."
      />

      <View style={estilos.grupo}>
        <RotuloGrupo texto="Sua persona" />
        <Cartao
          style={estilos.persona}
          accessible
          accessibilityLabel={`Prévia da persona: ${form.nome.trim() || 'sem nome'}${linhaPersona ? `, ${linhaPersona}` : ''}`}
        >
          <Avatar iniciais={iniciaisDe(form.nome) || '?'} tom="escuro" tamanho={48} />
          <View style={estilos.flex}>
            <Texto
              estilo="corpoForte"
              cor={form.nome.trim() ? 'texto' : 'textoSuave'}
              numberOfLines={1}
            >
              {form.nome.trim() || 'Sua persona'}
            </Texto>
            <Texto estilo="legenda" cor="textoSuave" numberOfLines={1}>
              {linhaPersona || '@handle · quem você é nesse mundo'}
            </Texto>
          </View>
        </Cartao>
        <CampoTexto
          rotulo="Nome"
          testID="campo-nome"
          value={form.nome}
          onChangeText={(nome) => onMudar({ nome })}
          placeholder="Lua Prado"
          maxLength={40}
          autoComplete="off"
          textContentType="none"
        />
        <CampoTexto
          rotulo="Arroba"
          testID="campo-arroba"
          value={form.handle}
          onChangeText={(h) => onMudar({ handle: h })}
          placeholder="@luaprado"
          erro={erroDoHandle(form.handle)}
          maxLength={25}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="off"
        />
        <CampoTexto
          rotulo="Quem você é"
          testID="campo-quem"
          value={form.descricao}
          onChangeText={(descricao) => onMudar({ descricao })}
          placeholder="cantora em ascensão"
          limite={140}
          multiline
        />
      </View>

      <View style={estilos.grupo}>
        <RotuloGrupo texto="Universo" />
        <View style={estilos.chips}>
          {UNIVERSOS.map((universo) => (
            <Chip
              key={universo}
              rotulo={universo}
              tamanho="grande"
              selecionado={!form.livre && form.universo === universo}
              onPress={() => onMudar({ universo, livre: false })}
            />
          ))}
          {form.livre ? (
            <Chip
              rotulo="Criar do zero"
              tamanho="grande"
              selecionado
              onPress={() => onMudar({ livre: false })}
            />
          ) : (
            <Chip
              rotulo="Criar do zero"
              tamanho="grande"
              variante="tracejado"
              icone={Plus}
              onPress={() => onMudar({ livre: true })}
            />
          )}
        </View>
        {form.livre && (
          <CampoTexto
            rotulo="Descreva o universo"
            testID="campo-universo"
            value={form.universoLivre}
            onChangeText={(universoLivre) => onMudar({ universoLivre })}
            placeholder="banda de forró em turnê pelo interior"
            limite={80}
            autoFocus
          />
        )}
      </View>

      <View style={estilos.grupoTom}>
        <View style={estilos.linhaTom}>
          <RotuloGrupo texto="Tom do mundo" />
          <Texto estilo="legenda" cor="destaqueTinta">
            {form.tomCaos}% caótico
          </Texto>
        </View>
        <ControleDeslizante
          valor={form.tomCaos}
          onMudar={(tomCaos) => onMudar({ tomCaos })}
          rotulo="Tom do mundo, de acolhedor a caótico"
          textoDoValor={`${form.tomCaos}% caótico`}
        />
        <View style={estilos.linhaTom}>
          <Texto estilo="legenda" cor="textoSuave">
            Acolhedor
          </Texto>
          <Texto estilo="legenda" cor="textoSuave">
            Caótico
          </Texto>
        </View>
      </View>
    </>
  );
}

const estilos = StyleSheet.create({
  grupo: { gap: 10 },
  grupoTom: { gap: 12 },
  persona: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  flex: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  linhaTom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
