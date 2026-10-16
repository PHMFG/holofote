import type { Redis } from 'ioredis';

export interface Assinante {
  enviar(mensagem: string): void;
}

/**
 * Repassa o canal Redis de cada mundo para os sockets abertos dele. Uma conexão de assinatura só,
 * multiplexada por canal; o canal é assinado no primeiro socket e liberado no último.
 */
export class Difusor {
  private readonly porCanal = new Map<string, Set<Assinante>>();
  /** Assinatura em andamento por canal: quem entra no meio espera a mesma. */
  private readonly pendentes = new Map<string, Promise<void>>();

  constructor(private readonly assinatura: Redis) {
    assinatura.on('message', (canal: string, mensagem: string) => {
      for (const a of this.porCanal.get(canal) ?? []) {
        // Um socket com problema não pode impedir a entrega aos outros.
        try {
          a.enviar(mensagem);
        } catch {
          // O 'close' do socket tira o assinante.
        }
      }
    });
  }

  async entrar(canal: string, assinante: Assinante): Promise<void> {
    let conjunto = this.porCanal.get(canal);
    if (!conjunto) {
      const novo = new Set<Assinante>();
      conjunto = novo;
      this.porCanal.set(canal, novo);
      this.pendentes.set(
        canal,
        this.assinatura.subscribe(canal).then(
          () => {
            this.pendentes.delete(canal);
          },
          (erro: unknown) => {
            // Sem assinatura, o conjunto não pode ficar: o próximo socket tenta assinar de novo.
            this.pendentes.delete(canal);
            if (this.porCanal.get(canal) === novo) this.porCanal.delete(canal);
            throw erro;
          },
        ),
      );
    }
    conjunto.add(assinante);
    await this.pendentes.get(canal);
  }

  async sair(canal: string, assinante: Assinante): Promise<void> {
    const conjunto = this.porCanal.get(canal);
    if (!conjunto) return;
    conjunto.delete(assinante);
    if (conjunto.size === 0) {
      this.porCanal.delete(canal);
      // No encerramento a conexão pode já ter fechado; não há o que liberar.
      await this.assinatura.unsubscribe(canal).catch(() => undefined);
    }
  }

  totalDeAssinantes(canal: string): number {
    return this.porCanal.get(canal)?.size ?? 0;
  }
}
