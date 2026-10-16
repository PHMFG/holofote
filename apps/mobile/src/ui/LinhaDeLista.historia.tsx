import { ChevronRight } from 'lucide-react-native';
import { useState } from 'react';
import { Avatar } from './Avatar';
import { Cartao } from './Cartao';
import { Custo } from './Custo';
import type { Historia } from './historias/tipos';
import { Icone } from './Icone';
import { Interruptor } from './Interruptor';
import { LinhaDeLista } from './LinhaDeLista';
import { Texto } from './Texto';

function Exemplo() {
  const [ligado, setLigado] = useState(true);
  return (
    <Cartao lista>
      <LinhaDeLista
        inicio={<Avatar iniciais="DM" tamanho={44} nome="Duda Marques" />}
        titulo="Duda Marques"
        subtitulo="viu o teaser? me conta tudo"
        detalhe="Parceria criativa · 72%"
        naoLida
        rotuloFim="agora"
        fim={
          <Texto estilo="legenda" cor="destaqueTinta">
            agora
          </Texto>
        }
        onPress={() => {}}
      />
      <LinhaDeLista
        inicio={<Avatar iniciais="VF" nome="Vic Ferraz" />}
        titulo="Vic Ferraz"
        subtitulo="rival · estrela do pop"
        fim={
          <Interruptor valor={ligado} onMudar={setLigado} rotulo="Incluir Vic Ferraz no elenco" />
        }
      />
      <LinhaDeLista
        titulo="Ensaiar o discurso"
        subtitulo="libera a opção ousada"
        rotuloFim="custa 2 de energia"
        fim={<Custo energia={2} />}
        onPress={() => {}}
      />
      <LinhaDeLista
        titulo="Responder Vic"
        subtitulo="ela marcou você no story"
        separador={false}
        fim={<Icone icone={ChevronRight} tamanho={16} />}
        onPress={() => {}}
      />
    </Cartao>
  );
}

export const historia: Historia = { titulo: 'LinhaDeLista', figma: '25:388', Exemplo };
