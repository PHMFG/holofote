import { mundoDto as mundoDtoDb } from '@holofote/db';
import type { Mundo } from '@holofote/shared';
import { diaEPeriodo, type SessaoComMundo } from './sessao';
import type { Executor } from './tipos';

export { personagemDto } from '@holofote/db';

export async function mundoDto(db: Executor, sessao: SessaoComMundo): Promise<Mundo> {
  return mundoDtoDb(db, sessao.mundo, sessao.jogador.id, diaEPeriodo(sessao));
}
