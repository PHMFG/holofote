-- Migração manual: o pgvector precisa existir antes da coluna memoria.embedding (vector(1024)).
-- A imagem pgvector/pgvector:pg17 já traz a extensão instalada; aqui ela só é ativada no banco.
CREATE EXTENSION IF NOT EXISTS vector;
