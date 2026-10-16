import { Cartao } from './Cartao';
import { Comentario, Digitando, SeparadorComentario, VerMaisRespostas } from './Comentario';
import type { Historia } from './historias/tipos';

export const historia: Historia = {
  titulo: 'Comentario',
  figma: '53:1443',
  Exemplo: () => (
    <Cartao style={{ padding: 14, gap: 12 }}>
      <Comentario
        nome="Duda Marques"
        iniciais="DM"
        verificado
        tempo="8 min"
        texto="lua, o refrão é seu. ninguém canta igual"
        curtidas={312}
        respostas={4}
        reposts={2}
        onResponder={() => {}}
        onCurtir={() => {}}
      />
      <Comentario
        aninhado
        nome="Bento Lima"
        iniciais="BL"
        tomAvatar="medio"
        tempo="5 min"
        texto="concordo, e o clipe vai ser maior ainda"
        curtidas={41}
        onCurtir={() => {}}
      />
      <VerMaisRespostas quantidade={3} />
      <SeparadorComentario />
      <Comentario
        nome="carol_fã"
        iniciais="CF"
        tag="FÃ"
        tempo="2 min"
        texto="já salvei o pré-save"
        curtidas={18}
        respostas={0}
        reposts={0}
        onResponder={() => {}}
      />
      <Digitando nome="@fofocalizei" iniciais="FO" />
    </Cartao>
  ),
};
