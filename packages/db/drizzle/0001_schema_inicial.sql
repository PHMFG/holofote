CREATE TYPE "public"."destaque" AS ENUM('laranja', 'cobalto', 'violeta', 'rosa', 'menta', 'lima');--> statement-breakpoint
CREATE TYPE "public"."estado_evento" AS ENUM('anunciado', 'campanha', 'ao_vivo', 'encerrado');--> statement-breakpoint
CREATE TYPE "public"."estado_mundo" AS ENUM('criando', 'pronto', 'erro');--> statement-breakpoint
CREATE TYPE "public"."motivo_energia" AS ENUM('inicial', 'acao', 'recarga', 'anuncio', 'gemas', 'marco', 'desfazer', 'debug', 'estorno');--> statement-breakpoint
CREATE TYPE "public"."motivo_gemas" AS ENUM('inicial', 'marco', 'evento', 'compra', 'energia');--> statement-breakpoint
CREATE TYPE "public"."opcao_discurso" AS ENUM('seguro', 'ousado', 'especial');--> statement-breakpoint
CREATE TYPE "public"."origem_post" AS ENUM('jogador', 'diretor', 'lote', 'discurso');--> statement-breakpoint
CREATE TYPE "public"."papel" AS ENUM('jogador', 'elenco', 'figurante');--> statement-breakpoint
CREATE TYPE "public"."periodo" AS ENUM('manha', 'tarde', 'noite');--> statement-breakpoint
CREATE TYPE "public"."plano" AS ENUM('free', 'plus');--> statement-breakpoint
CREATE TYPE "public"."preferencia_tema" AS ENUM('sistema', 'claro', 'escuro');--> statement-breakpoint
CREATE TYPE "public"."tipo_acao" AS ENUM('post', 'resposta', 'dm', 'historia', 'campanha', 'discurso', 'desfazer');--> statement-breakpoint
CREATE TYPE "public"."tipo_alerta" AS ENUM('resposta', 'mencao', 'dm', 'marco', 'evento', 'seguidores', 'resumo');--> statement-breakpoint
CREATE TYPE "public"."tipo_evento" AS ENUM('premio', 'show', 'crise');--> statement-breakpoint
CREATE TYPE "public"."tipo_post" AS ENUM('post', 'historia');--> statement-breakpoint
CREATE TYPE "public"."tipo_vinculo" AS ENUM('rival', 'amizade', 'parceria', 'mentor', 'interesse', 'fofoca');--> statement-breakpoint
CREATE TYPE "public"."tom_avatar" AS ENUM('escuro', 'claro', 'medio');--> statement-breakpoint
CREATE TYPE "public"."tom" AS ENUM('fofo', 'sincero', 'misterioso', 'provocativo');--> statement-breakpoint
CREATE TABLE "acao" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mundo_id" uuid NOT NULL,
	"tipo" "tipo_acao" NOT NULL,
	"entrada" jsonb NOT NULL,
	"consequencia" jsonb,
	"cartao" jsonb,
	"ia_pendente" integer DEFAULT 0 NOT NULL,
	"desfeita_em" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "acao_ia_pendente_positivo" CHECK ("acao"."ia_pendente" >= 0)
);
--> statement-breakpoint
CREATE TABLE "alerta" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mundo_id" uuid NOT NULL,
	"tipo" "tipo_alerta" NOT NULL,
	"texto" text NOT NULL,
	"personagem_id" uuid,
	"destino" text NOT NULL,
	"entregar_em" timestamp with time zone DEFAULT now() NOT NULL,
	"lido_em" timestamp with time zone,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chamada_llm" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mundo_id" uuid,
	"acao_id" uuid,
	"job" text NOT NULL,
	"modelo" text NOT NULL,
	"tokens_cache" integer DEFAULT 0 NOT NULL,
	"tokens_entrada" integer DEFAULT 0 NOT NULL,
	"tokens_saida" integer DEFAULT 0 NOT NULL,
	"custo_usd" numeric(12, 6) DEFAULT 0 NOT NULL,
	"latencia_ms" integer NOT NULL,
	"ok" boolean NOT NULL,
	"erro" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "conversa" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mundo_id" uuid NOT NULL,
	"personagem_id" uuid NOT NULL,
	"resumo" text DEFAULT '' NOT NULL,
	"nao_lidas" integer DEFAULT 0 NOT NULL,
	"puxou_conversa" boolean DEFAULT false NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	"atualizada_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "conversa_por_personagem" UNIQUE("mundo_id","personagem_id"),
	CONSTRAINT "conversa_nao_lidas_positivo" CHECK ("conversa"."nao_lidas" >= 0)
);
--> statement-breakpoint
CREATE TABLE "curtida" (
	"post_id" uuid NOT NULL,
	"personagem_id" uuid NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "curtida_post_id_personagem_id_pk" PRIMARY KEY("post_id","personagem_id")
);
--> statement-breakpoint
CREATE TABLE "delta" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"acao_id" uuid NOT NULL,
	"alvo" text NOT NULL,
	"valor" integer NOT NULL,
	CONSTRAINT "delta_alvo_formato" CHECK ("delta"."alvo" ~ '^(fama|carisma|polemica|seguidores|relacao:[0-9a-f-]{36})$')
);
--> statement-breakpoint
CREATE TABLE "evento_agendado" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mundo_id" uuid NOT NULL,
	"tipo" "tipo_evento" NOT NULL,
	"titulo" text NOT NULL,
	"categoria" text NOT NULL,
	"dia_mundo" integer NOT NULL,
	"periodo" "periodo" NOT NULL,
	"indicados" jsonb NOT NULL,
	"campanha" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"estado" "estado_evento" DEFAULT 'anunciado' NOT NULL,
	"vencedor_id" uuid,
	"prazo_ao_vivo" timestamp with time zone,
	"discurso_escolhido" "opcao_discurso",
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "historia_vista" (
	"post_id" uuid NOT NULL,
	"personagem_id" uuid NOT NULL,
	CONSTRAINT "historia_vista_post_id_personagem_id_pk" PRIMARY KEY("post_id","personagem_id")
);
--> statement-breakpoint
CREATE TABLE "lancamento_energia" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usuario_id" uuid NOT NULL,
	"valor" integer NOT NULL,
	"motivo" "motivo_energia" NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lancamento_energia_valor_nao_nulo" CHECK ("lancamento_energia"."valor" <> 0)
);
--> statement-breakpoint
CREATE TABLE "lancamento_gemas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usuario_id" uuid NOT NULL,
	"valor" integer NOT NULL,
	"motivo" "motivo_gemas" NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lancamento_gemas_valor_nao_nulo" CHECK ("lancamento_gemas"."valor" <> 0)
);
--> statement-breakpoint
CREATE TABLE "marco" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mundo_id" uuid NOT NULL,
	"ato" integer NOT NULL,
	"ordem" integer NOT NULL,
	"titulo" text NOT NULL,
	"descricao" text NOT NULL,
	"requisitos" jsonb NOT NULL,
	"recompensa" jsonb NOT NULL,
	"liberado_em" timestamp with time zone,
	"resgatado_em" timestamp with time zone,
	CONSTRAINT "marco_por_ordem" UNIQUE("mundo_id","ato","ordem"),
	CONSTRAINT "marco_ordem_positiva" CHECK ("marco"."ato" >= 1 and "marco"."ordem" >= 1)
);
--> statement-breakpoint
CREATE TABLE "memoria" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"personagem_id" uuid NOT NULL,
	"sobre_id" uuid NOT NULL,
	"fatos" text NOT NULL,
	"embedding" vector(1024),
	"dia" integer NOT NULL,
	"atualizado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "memoria_por_par" UNIQUE("personagem_id","sobre_id")
);
--> statement-breakpoint
CREATE TABLE "mensagem" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversa_id" uuid NOT NULL,
	"autor_id" uuid NOT NULL,
	"texto" text NOT NULL,
	"entregar_em" timestamp with time zone DEFAULT now() NOT NULL,
	"acao_id" uuid,
	"oculto" boolean DEFAULT false NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mundo" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"usuario_id" uuid NOT NULL,
	"universo" text NOT NULL,
	"tom_caos" integer NOT NULL,
	"ato" integer DEFAULT 1 NOT NULL,
	"objetivo_ato" text,
	"biblia" text,
	"resumo_estado" text,
	"estado" "estado_mundo" DEFAULT 'criando' NOT NULL,
	"erro" text,
	"deslocamento_min" integer DEFAULT 0 NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mundo_tom_caos_faixa" CHECK ("mundo"."tom_caos" between 0 and 100),
	CONSTRAINT "mundo_ato_positivo" CHECK ("mundo"."ato" >= 1)
);
--> statement-breakpoint
CREATE TABLE "personagem" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mundo_id" uuid NOT NULL,
	"papel" "papel" NOT NULL,
	"nome" text NOT NULL,
	"handle" text NOT NULL,
	"iniciais" text NOT NULL,
	"tom_avatar" "tom_avatar" DEFAULT 'escuro' NOT NULL,
	"verificado" boolean DEFAULT false NOT NULL,
	"ficha" text NOT NULL,
	"tipo_vinculo" "tipo_vinculo",
	"perfil_fofoca" boolean DEFAULT false NOT NULL,
	"fama" integer DEFAULT 0 NOT NULL,
	"carisma" integer DEFAULT 0 NOT NULL,
	"polemica" integer DEFAULT 0 NOT NULL,
	"seguidores" integer DEFAULT 0 NOT NULL,
	"silenciado" boolean DEFAULT false NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "personagem_handle_por_mundo" UNIQUE("mundo_id","handle"),
	CONSTRAINT "personagem_handle_formato" CHECK ("personagem"."handle" ~ '^[a-z0-9_.]{2,24}$'),
	CONSTRAINT "personagem_iniciais_tamanho" CHECK (char_length("personagem"."iniciais") between 1 and 2),
	CONSTRAINT "personagem_jogador_sem_vinculo" CHECK ("personagem"."papel" <> 'jogador' or "personagem"."tipo_vinculo" is null),
	CONSTRAINT "personagem_fama_faixa" CHECK ("personagem"."fama" between 0 and 100),
	CONSTRAINT "personagem_carisma_faixa" CHECK ("personagem"."carisma" between 0 and 100),
	CONSTRAINT "personagem_polemica_faixa" CHECK ("personagem"."polemica" between 0 and 100),
	CONSTRAINT "personagem_seguidores_positivo" CHECK ("personagem"."seguidores" >= 0)
);
--> statement-breakpoint
CREATE TABLE "post" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mundo_id" uuid NOT NULL,
	"autor_id" uuid NOT NULL,
	"responde_a" uuid,
	"tipo" "tipo_post" DEFAULT 'post' NOT NULL,
	"texto" text NOT NULL,
	"tom" "tom",
	"enquete" jsonb,
	"origem" "origem_post" NOT NULL,
	"acao_id" uuid,
	"marcados" uuid[] DEFAULT '{}'::uuid[] NOT NULL,
	"entregar_em" timestamp with time zone DEFAULT now() NOT NULL,
	"expira_em" timestamp with time zone,
	"oculto" boolean DEFAULT false NOT NULL,
	"curtidas" integer DEFAULT 0 NOT NULL,
	"reposts" integer DEFAULT 0 NOT NULL,
	"respostas" integer DEFAULT 0 NOT NULL,
	"visualizacoes" integer DEFAULT 0 NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "relacao" (
	"de_id" uuid NOT NULL,
	"para_id" uuid NOT NULL,
	"afinidade" integer NOT NULL,
	"rotulo" text NOT NULL,
	CONSTRAINT "relacao_de_id_para_id_pk" PRIMARY KEY("de_id","para_id"),
	CONSTRAINT "relacao_afinidade_faixa" CHECK ("relacao"."afinidade" between 0 and 100),
	CONSTRAINT "relacao_sem_laco" CHECK ("relacao"."de_id" <> "relacao"."para_id")
);
--> statement-breakpoint
CREATE TABLE "resumo_dia" (
	"mundo_id" uuid NOT NULL,
	"dia" integer NOT NULL,
	"manchete" text NOT NULL,
	"numeros" jsonb NOT NULL,
	"pendencias" jsonb NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "resumo_dia_mundo_id_dia_pk" PRIMARY KEY("mundo_id","dia")
);
--> statement-breakpoint
CREATE TABLE "usuario" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"aparelho_id" uuid NOT NULL,
	"plano" "plano" DEFAULT 'free' NOT NULL,
	"tema" "preferencia_tema" DEFAULT 'sistema' NOT NULL,
	"destaque" "destaque" DEFAULT 'laranja' NOT NULL,
	"fuso" text DEFAULT 'America/Sao_Paulo' NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usuario_aparelho_id_unico" UNIQUE("aparelho_id")
);
--> statement-breakpoint
CREATE TABLE "voto" (
	"post_id" uuid NOT NULL,
	"personagem_id" uuid NOT NULL,
	"opcao" text NOT NULL,
	CONSTRAINT "voto_post_id_personagem_id_pk" PRIMARY KEY("post_id","personagem_id")
);
--> statement-breakpoint
ALTER TABLE "acao" ADD CONSTRAINT "acao_mundo_id_mundo_id_fk" FOREIGN KEY ("mundo_id") REFERENCES "public"."mundo"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerta" ADD CONSTRAINT "alerta_mundo_id_mundo_id_fk" FOREIGN KEY ("mundo_id") REFERENCES "public"."mundo"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "alerta" ADD CONSTRAINT "alerta_personagem_id_personagem_id_fk" FOREIGN KEY ("personagem_id") REFERENCES "public"."personagem"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chamada_llm" ADD CONSTRAINT "chamada_llm_mundo_id_mundo_id_fk" FOREIGN KEY ("mundo_id") REFERENCES "public"."mundo"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chamada_llm" ADD CONSTRAINT "chamada_llm_acao_id_acao_id_fk" FOREIGN KEY ("acao_id") REFERENCES "public"."acao"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversa" ADD CONSTRAINT "conversa_mundo_id_mundo_id_fk" FOREIGN KEY ("mundo_id") REFERENCES "public"."mundo"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "conversa" ADD CONSTRAINT "conversa_personagem_id_personagem_id_fk" FOREIGN KEY ("personagem_id") REFERENCES "public"."personagem"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "curtida" ADD CONSTRAINT "curtida_post_id_post_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."post"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "curtida" ADD CONSTRAINT "curtida_personagem_id_personagem_id_fk" FOREIGN KEY ("personagem_id") REFERENCES "public"."personagem"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delta" ADD CONSTRAINT "delta_acao_id_acao_id_fk" FOREIGN KEY ("acao_id") REFERENCES "public"."acao"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evento_agendado" ADD CONSTRAINT "evento_agendado_mundo_id_mundo_id_fk" FOREIGN KEY ("mundo_id") REFERENCES "public"."mundo"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "evento_agendado" ADD CONSTRAINT "evento_agendado_vencedor_id_personagem_id_fk" FOREIGN KEY ("vencedor_id") REFERENCES "public"."personagem"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "historia_vista" ADD CONSTRAINT "historia_vista_post_id_post_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."post"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "historia_vista" ADD CONSTRAINT "historia_vista_personagem_id_personagem_id_fk" FOREIGN KEY ("personagem_id") REFERENCES "public"."personagem"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lancamento_energia" ADD CONSTRAINT "lancamento_energia_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lancamento_gemas" ADD CONSTRAINT "lancamento_gemas_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marco" ADD CONSTRAINT "marco_mundo_id_mundo_id_fk" FOREIGN KEY ("mundo_id") REFERENCES "public"."mundo"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memoria" ADD CONSTRAINT "memoria_personagem_id_personagem_id_fk" FOREIGN KEY ("personagem_id") REFERENCES "public"."personagem"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "memoria" ADD CONSTRAINT "memoria_sobre_id_personagem_id_fk" FOREIGN KEY ("sobre_id") REFERENCES "public"."personagem"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mensagem" ADD CONSTRAINT "mensagem_conversa_id_conversa_id_fk" FOREIGN KEY ("conversa_id") REFERENCES "public"."conversa"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mensagem" ADD CONSTRAINT "mensagem_autor_id_personagem_id_fk" FOREIGN KEY ("autor_id") REFERENCES "public"."personagem"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mensagem" ADD CONSTRAINT "mensagem_acao_id_acao_id_fk" FOREIGN KEY ("acao_id") REFERENCES "public"."acao"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mundo" ADD CONSTRAINT "mundo_usuario_id_usuario_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuario"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "personagem" ADD CONSTRAINT "personagem_mundo_id_mundo_id_fk" FOREIGN KEY ("mundo_id") REFERENCES "public"."mundo"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post" ADD CONSTRAINT "post_mundo_id_mundo_id_fk" FOREIGN KEY ("mundo_id") REFERENCES "public"."mundo"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post" ADD CONSTRAINT "post_autor_id_personagem_id_fk" FOREIGN KEY ("autor_id") REFERENCES "public"."personagem"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post" ADD CONSTRAINT "post_responde_a_post_id_fk" FOREIGN KEY ("responde_a") REFERENCES "public"."post"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "post" ADD CONSTRAINT "post_acao_id_acao_id_fk" FOREIGN KEY ("acao_id") REFERENCES "public"."acao"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relacao" ADD CONSTRAINT "relacao_de_id_personagem_id_fk" FOREIGN KEY ("de_id") REFERENCES "public"."personagem"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "relacao" ADD CONSTRAINT "relacao_para_id_personagem_id_fk" FOREIGN KEY ("para_id") REFERENCES "public"."personagem"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "resumo_dia" ADD CONSTRAINT "resumo_dia_mundo_id_mundo_id_fk" FOREIGN KEY ("mundo_id") REFERENCES "public"."mundo"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voto" ADD CONSTRAINT "voto_post_id_post_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."post"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "voto" ADD CONSTRAINT "voto_personagem_id_personagem_id_fk" FOREIGN KEY ("personagem_id") REFERENCES "public"."personagem"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "acao_mundo_criado_idx" ON "acao" USING btree ("mundo_id","criado_em" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "alerta_mundo_entregar_idx" ON "alerta" USING btree ("mundo_id","entregar_em" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "alerta_personagem_idx" ON "alerta" USING btree ("personagem_id") WHERE "alerta"."personagem_id" is not null;--> statement-breakpoint
CREATE INDEX "chamada_llm_criado_idx" ON "chamada_llm" USING btree ("criado_em");--> statement-breakpoint
CREATE INDEX "chamada_llm_mundo_idx" ON "chamada_llm" USING btree ("mundo_id") WHERE "chamada_llm"."mundo_id" is not null;--> statement-breakpoint
CREATE INDEX "chamada_llm_acao_idx" ON "chamada_llm" USING btree ("acao_id") WHERE "chamada_llm"."acao_id" is not null;--> statement-breakpoint
CREATE INDEX "conversa_personagem_idx" ON "conversa" USING btree ("personagem_id");--> statement-breakpoint
CREATE INDEX "curtida_personagem_idx" ON "curtida" USING btree ("personagem_id");--> statement-breakpoint
CREATE INDEX "delta_acao_idx" ON "delta" USING btree ("acao_id");--> statement-breakpoint
CREATE INDEX "evento_agendado_mundo_dia_idx" ON "evento_agendado" USING btree ("mundo_id","dia_mundo");--> statement-breakpoint
CREATE INDEX "evento_agendado_vencedor_idx" ON "evento_agendado" USING btree ("vencedor_id") WHERE "evento_agendado"."vencedor_id" is not null;--> statement-breakpoint
CREATE INDEX "historia_vista_personagem_idx" ON "historia_vista" USING btree ("personagem_id");--> statement-breakpoint
CREATE INDEX "lancamento_energia_usuario_criado_idx" ON "lancamento_energia" USING btree ("usuario_id","criado_em");--> statement-breakpoint
CREATE INDEX "lancamento_gemas_usuario_criado_idx" ON "lancamento_gemas" USING btree ("usuario_id","criado_em");--> statement-breakpoint
CREATE INDEX "memoria_sobre_idx" ON "memoria" USING btree ("sobre_id");--> statement-breakpoint
CREATE INDEX "memoria_embedding_hnsw" ON "memoria" USING hnsw ("embedding" vector_cosine_ops);--> statement-breakpoint
CREATE INDEX "mensagem_conversa_entregar_idx" ON "mensagem" USING btree ("conversa_id","entregar_em");--> statement-breakpoint
CREATE INDEX "mensagem_autor_idx" ON "mensagem" USING btree ("autor_id");--> statement-breakpoint
CREATE INDEX "mensagem_acao_idx" ON "mensagem" USING btree ("acao_id") WHERE "mensagem"."acao_id" is not null;--> statement-breakpoint
CREATE UNIQUE INDEX "mundo_ativo_por_usuario" ON "mundo" USING btree ("usuario_id") WHERE "mundo"."ativo";--> statement-breakpoint
CREATE INDEX "mundo_usuario_idx" ON "mundo" USING btree ("usuario_id");--> statement-breakpoint
CREATE UNIQUE INDEX "personagem_um_jogador_por_mundo" ON "personagem" USING btree ("mundo_id") WHERE "personagem"."papel" = 'jogador';--> statement-breakpoint
CREATE INDEX "post_mundo_entregar_idx" ON "post" USING btree ("mundo_id","entregar_em" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "post_responde_a_idx" ON "post" USING btree ("responde_a");--> statement-breakpoint
CREATE INDEX "post_autor_idx" ON "post" USING btree ("autor_id");--> statement-breakpoint
CREATE INDEX "post_acao_idx" ON "post" USING btree ("acao_id") WHERE "post"."acao_id" is not null;--> statement-breakpoint
CREATE INDEX "relacao_para_idx" ON "relacao" USING btree ("para_id");--> statement-breakpoint
CREATE INDEX "voto_personagem_idx" ON "voto" USING btree ("personagem_id");