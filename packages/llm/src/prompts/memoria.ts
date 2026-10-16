// Job memoria: reescreve o que cada personagem lembra de alguém (roda junto do lote).
import { blocoItemMemoria } from './feed';
import { montarUsuario } from './formato';
import type { EntradaMemoria } from './tipos';

export const TAREFA_MEMORIA = `TAREFA
Reescreva o que cada personagem lembra de alguém, juntando os fatos atuais com os eventos novos.
- Uma entrada por item de ITENS, com o personagemId e o sobreId do item.
- fatos: até 300 caracteres, só fatos concretos, em terceira pessoa, do ponto de vista do personagem. O mais antigo e menos importante sai primeiro.

FORMATO
{"memorias":[{"personagemId":"<id de quem lembra>","sobreId":"<id de quem é lembrado>","fatos":"até 300 caracteres"}]}`;

export function promptMemoria(entrada: EntradaMemoria): string {
  return montarUsuario('memoria', [
    TAREFA_MEMORIA,
    `ITENS\n${entrada.itens.length > 0 ? entrada.itens.map(blocoItemMemoria).join('\n') : 'nada'}`,
  ]);
}
