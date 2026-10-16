ALTER TABLE "mensagem" ADD COLUMN "entregue_em" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "personagem" ADD COLUMN "marco_id" uuid;--> statement-breakpoint
ALTER TABLE "post" ADD COLUMN "entregue_em" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "personagem" ADD CONSTRAINT "personagem_marco_id_marco_id_fk" FOREIGN KEY ("marco_id") REFERENCES "public"."marco"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "acao_ia_pendente_idx" ON "acao" USING btree ("criado_em") WHERE "acao"."ia_pendente" > 0;--> statement-breakpoint
ALTER TABLE "personagem" ADD CONSTRAINT "personagem_por_marco" UNIQUE("marco_id");