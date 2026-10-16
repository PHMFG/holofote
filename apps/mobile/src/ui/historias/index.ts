// Ordem do catálogo: primeiro o quadro "Componentes · Cromo" (12:2), depois os demais.
import { historia as avatar } from '../Avatar.historia';
import { historia as barraDeAbas } from '../BarraDeAbas.historia';
import { historia as barraProgresso } from '../BarraProgresso.historia';
import { historia as botaoMetal } from '../BotaoMetal.historia';
import { historia as botaoSuave } from '../BotaoSuave.historia';
import { historia as cartao } from '../Cartao.historia';
import { historia as chip } from '../Chip.historia';
import { historia as comentario } from '../Comentario.historia';
import { historia as custo } from '../Custo.historia';
import { historia as esfera } from '../Esfera.historia';
import { historia as folha } from '../Folha.historia';
import { historia as interruptor } from '../Interruptor.historia';
import { historia as linhaDeLista } from '../LinhaDeLista.historia';
import { historia as post } from '../Post.historia';
import { historia as rotulo } from '../Rotulo.historia';
import { historia as segmentado } from '../Segmentado.historia';
import type { Historia } from './tipos';

export const HISTORIAS: Historia[] = [
  avatar,
  barraDeAbas,
  post,
  botaoMetal,
  esfera,
  botaoSuave,
  chip,
  cartao,
  segmentado,
  barraProgresso,
  custo,
  rotulo,
  folha,
  comentario,
  linhaDeLista,
  interruptor,
];
