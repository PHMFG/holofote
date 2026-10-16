import { SignJWT, jwtVerify } from 'jose';
import { ErroApi } from './erros';

const emissor = 'holofote';

/** Token do login anônimo por aparelho; o sujeito é o id do usuário. */
export async function emitirToken(usuarioId: string, segredo: string): Promise<string> {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(usuarioId)
    .setIssuer(emissor)
    .setIssuedAt()
    .setExpirationTime('90d')
    .sign(new TextEncoder().encode(segredo));
}

export async function verificarToken(token: string, segredo: string): Promise<string> {
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(segredo), {
      issuer: emissor,
    });
    if (!payload.sub) throw new Error('sem sujeito');
    return payload.sub;
  } catch {
    throw new ErroApi(401, 'nao_autenticado', 'Sessão inválida. Abra o app de novo.');
  }
}

export function tokenDoCabecalho(autorizacao: string | undefined): string {
  const [tipo, token] = (autorizacao ?? '').split(' ');
  if (tipo !== 'Bearer' || !token) throw new ErroApi(401, 'nao_autenticado', 'Sessão ausente.');
  return token;
}
