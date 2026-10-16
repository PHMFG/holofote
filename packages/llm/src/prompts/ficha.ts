// Job ficha: um personagem novo entra no mundo (recompensa de marco, por exemplo).
import { arroba, limpar, montarUsuario, pessoa, secao } from './formato';
import type { EntradaFicha } from './tipos';

export const TAREFA_FICHA = `TAREFA
Crie um personagem novo que entra no mundo agora, original, fictício e coerente com a bíblia.
- nome até 40 caracteres e handle no formato @nome (minúsculas, números, _ ou .), diferentes dos EXISTENTES.
- ficha até 600 caracteres (mire em 350): personalidade, jeito de escrever nas redes e o que quer.
- tipoVinculo com o jogador: rival, amizade, parceria, mentor, interesse ou fofoca (use o VÍNCULO DESEJADO quando houver).
- verificado: se tem selo. tomAvatar: claro ou medio.

FORMATO
{"nome":"...","handle":"@...","ficha":"até 600 caracteres","tipoVinculo":"rival","tomAvatar":"medio","verificado":false}`;

export function promptFicha(entrada: EntradaFicha): string {
  return montarUsuario('ficha', [
    TAREFA_FICHA,
    secao('MOTIVO DA ENTRADA', [limpar(entrada.motivo, 200)]),
    entrada.vinculoDesejado ? secao('VÍNCULO DESEJADO', [entrada.vinculoDesejado]) : null,
    secao('JOGADOR', [pessoa(entrada.jogador)]),
    secao(
      'EXISTENTES',
      entrada.existentes.map((p) => `- ${limpar(p.nome, 40)} (${arroba(p.handle)})`),
    ),
  ]);
}
