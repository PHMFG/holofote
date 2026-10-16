// Mundo de exemplo "Pop Brasil" (o do Figma) para os evals e os testes.
// É dado de teste: no jogo, bíblia e fichas nascem do job criar_mundo.
import type { JogadorPrompt, PersonagemPrompt, ReatorPrompt } from '../src/prompts/tipos';

export const MUNDO_ID = '7f1c2a90-0000-4000-8000-000000000001';

export const BIBLIA_POP_BRASIL = `Universo: Pop Brasil. A cena do pop nacional, com lançamentos à meia-noite, shows lotados, prêmios de música e uma rede social em que artista, fã e fofoqueiro se esbarram o dia todo.
Tom: dramático e divertido. Indireta, apoio de fã e treta que vira manchete, sem passar do ponto.
Elenco:
Lua Prado (@luaprado): a jogadora, cantora em ascensão que quer dominar o pop nacional.
Vic Ferraz (@vicferraz): rival da Lua, estrela consolidada que alfineta com elegância.
Duda Marques (@dudamarques): produtora e parceira de trabalho da Lua, direta e exigente.
Bento Lima (@bentolima): melhor amigo da Lua, humorista de internet que defende e às vezes fala demais.
Fofocalizei (@fofocalizei): perfil de fofoca que vive de prints e manchetes.`;

export const LUA: JogadorPrompt = {
  id: '7f1c2a90-0000-4000-8000-0000000000a0',
  nome: 'Lua Prado',
  handle: '@luaprado',
  descricao: 'cantora em ascensão, do interior de Minas para o pop nacional',
  fama: 42,
  carisma: 64,
  polemica: 28,
  seguidores: 7100,
};

type PersonagemPop = PersonagemPrompt & Pick<ReatorPrompt, 'relacao' | 'memorias'>;

export const VIC: PersonagemPop = {
  id: '7f1c2a90-0000-4000-8000-0000000000b1',
  nome: 'Vic Ferraz',
  handle: '@vicferraz',
  papel: 'elenco',
  ficha:
    'Estrela do pop há dez anos, competitiva e vaidosa. Escreve em minúsculas, frases curtas e indiretas elegantes, nunca cita nome. Quer continuar sendo a número um e vê a Lua como ameaça.',
  relacao: { afinidade: 38, rotulo: 'Rivais com respeito', tipoVinculo: 'rival' },
  memorias: ['a Lua cantou no festival em que ela era atração principal'],
};

export const DUDA: PersonagemPop = {
  id: '7f1c2a90-0000-4000-8000-0000000000b2',
  nome: 'Duda Marques',
  handle: '@dudamarques',
  papel: 'elenco',
  ficha:
    'Produtora e compositora, prática e exigente. Escreve direto, fala de estúdio e de prazo. Quer emplacar com a Lua o hit do ano, mas cobra compromisso e odeia atraso.',
  relacao: { afinidade: 72, rotulo: 'Parceria', tipoVinculo: 'parceria' },
  memorias: ['a Lua faltou a uma sessão de estúdio na semana passada'],
};

export const BENTO: PersonagemPop = {
  id: '7f1c2a90-0000-4000-8000-0000000000b3',
  nome: 'Bento Lima',
  handle: '@bentolima',
  papel: 'elenco',
  ficha:
    'Melhor amigo da Lua desde a escola, humorista de internet. Escreve com piada, kkkk e apelido para todo mundo. Quer proteger a Lua da fofoca, mas às vezes fala demais.',
  relacao: { afinidade: 88, rotulo: 'Aliança', tipoVinculo: 'amizade' },
  memorias: [],
};

export const FOFOCALIZEI: PersonagemPop = {
  id: '7f1c2a90-0000-4000-8000-0000000000b4',
  nome: 'Fofocalizei',
  handle: '@fofocalizei',
  papel: 'elenco',
  ficha:
    'Perfil anônimo de fofoca do pop. Escreve em tom de manchete, com URGENTE e reticências, sempre com print. Quer audiência e não perdoa deslize de ninguém.',
  relacao: { afinidade: 20, rotulo: 'Rival', tipoVinculo: 'fofoca' },
  memorias: ['a Lua apagou um post depois de dez minutos'],
};

export const MARI: PersonagemPop = {
  id: '7f1c2a90-0000-4000-8000-0000000000c1',
  nome: 'Mari Souza',
  handle: '@marisouza.fa',
  papel: 'figurante',
  ficha: 'Fã número um da Lua, administra o fã-clube. Escreve com carinho e muita exclamação.',
  relacao: { afinidade: 70, rotulo: 'Parceria' },
  memorias: [],
};

export const OTAVIO: PersonagemPop = {
  id: '7f1c2a90-0000-4000-8000-0000000000c2',
  nome: 'Otávio Reis',
  handle: '@otavioreis',
  papel: 'figurante',
  ficha:
    'Jornalista de música, sério e um pouco ranzinza. Escreve análise curta e desconfia de hype.',
  relacao: { afinidade: 50, rotulo: 'Conhecidos' },
  memorias: [],
};

export const ELENCO = [VIC, DUDA, BENTO, FOFOCALIZEI] as const;
export const PERSONAGENS = [VIC, DUDA, BENTO, FOFOCALIZEI, MARI, OTAVIO] as const;

/** Reator a partir de um personagem do mundo, com o motivo da escolha do motor. */
export function reator(p: PersonagemPop, motivo: string): ReatorPrompt {
  return { ...p, motivo };
}

export const RESUMO_ESTADO =
  'Ato 1, dia 3. Lua lançou o single "Maré Alta" ontem e está em 7,1 mil seguidores. Vic Ferraz anunciou show no mesmo fim de semana. O Prêmio Pop Brasil é em dois dias.';
