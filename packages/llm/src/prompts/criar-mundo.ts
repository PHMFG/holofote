// Job criar_mundo: o mundo inteiro nasce aqui, a partir do universo escolhido (sugestão ou texto livre).
import { aspas, arroba, limpar, montarUsuario, secao } from './formato';
import type { EntradaCriarMundo } from './tipos';

export const TAREFA_CRIAR_MUNDO = `TAREFA
Crie um mundo novo do Holofote a partir do UNIVERSO pedido pelo jogador. Tudo original e fictício, coerente com o NÍVEL DE CAOS.
- nomeMundo: até 60 caracteres.
- biblia: até 3000 caracteres (mire em 1500), em três blocos de linhas curtas: "Universo:" (como este mundo e a sua rede funcionam), "Tom:" (o clima das conversas, de acordo com o caos) e "Elenco:" com uma linha por personagem do elenco no formato "Nome (@handle): vínculo com o jogador e jeito em poucas palavras".
- objetivoAto: o objetivo do primeiro ato para o jogador, até 120 caracteres.
- elenco: exatamente 5 personagens principais, com pelo menos 1 rival e 1 aliado (amizade, parceria ou mentor). ficha até 600 caracteres (mire em 350): personalidade, jeito de escrever nas redes e o que quer. tipoVinculo com o jogador: rival, amizade, parceria, mentor, interesse ou fofoca. verificado: se tem selo. tomAvatar: claro ou medio.
- figurantes: exatamente 4 perfis menores (fã, crítico, jornalista, colega...), ficha até 200 caracteres e tipo até 30.
- marcos: exatamente 5 marcos do primeiro ato, do mais fácil ao mais difícil (titulo até 60, descricao até 200). Sem números de requisito: o motor define.
- evento: o primeiro evento agendado, tipo premio, show ou crise, com titulo e categoria até 60 caracteres.
- handles no formato @nome (minúsculas, números, _ ou .), todos diferentes entre si e do jogador.
- Se o universo pedir pessoa real, marca como protagonista ou conteúdo acima de 12 anos, devolva só {"moderacao":{"ok":false,"motivo":"motivo curto"}}.

FORMATO
{"nomeMundo":"...","biblia":"Universo: ...\\nTom: ...\\nElenco:\\nNome (@handle): ...","objetivoAto":"...","elenco":[{"nome":"...","handle":"@...","ficha":"...","tipoVinculo":"rival","verificado":true,"tomAvatar":"claro"}],"figurantes":[{"nome":"...","handle":"@...","ficha":"...","tipo":"fã"}],"marcos":[{"titulo":"...","descricao":"..."}],"evento":{"tipo":"premio","titulo":"...","categoria":"..."},"moderacao":{"ok":true}}`;

export function promptCriarMundo(entrada: EntradaCriarMundo): string {
  const caos = Math.round(Math.min(Math.max(entrada.tomCaos, 0), 100));
  return montarUsuario('criar_mundo', [
    TAREFA_CRIAR_MUNDO,
    secao('UNIVERSO', [aspas(entrada.universo, 120)]),
    secao('NÍVEL DE CAOS', [`${caos} de 100 (0 é calmo, 100 é caótico)`]),
    secao('JOGADOR', [
      `${limpar(entrada.persona.nome, 40)} (${arroba(entrada.persona.handle)})`,
      `bio: ${aspas(entrada.persona.descricao, 200)}`,
    ]),
  ]);
}
