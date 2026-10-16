ALTER TABLE "alerta" ADD COLUMN "acao_id" uuid;--> statement-breakpoint
ALTER TABLE "alerta" ADD CONSTRAINT "alerta_acao_id_acao_id_fk" FOREIGN KEY ("acao_id") REFERENCES "public"."acao"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "alerta_acao_idx" ON "alerta" USING btree ("acao_id") WHERE "alerta"."acao_id" is not null;