-- Esquema relacional (PostgreSQL) fiel às colunas do CSV.
-- Nota: a tabela `membros` guarda apenas as colunas do CSV (sem flags/derivações).

CREATE TABLE IF NOT EXISTS membros (
  membro_id BIGSERIAL PRIMARY KEY,
  "Ord." TEXT,
  "Nome Completo" TEXT NOT NULL,
  "Comunidade" TEXT,
  "Data de Baptismo" TEXT,
  "Data de Nascimento" TEXT,
  "Naturalidade" TEXT,
  "Nome do Pai" TEXT,
  "Naturalidade do Pai" TEXT,
  "Estado Civil" TEXT,
  "Profissao" TEXT,
  "Nome da Mae" TEXT,
  "Avos Paternos" TEXT,
  "Avos Maternos" TEXT,
  "Nome do Padrinho" TEXT,
  "Estado Civil.1" TEXT,
  "Profissao.1" TEXT,
  "Residencia" TEXT,
  "Nome da Madrinha" TEXT,
  "Estado Civil da Madrinha" TEXT,
  "Profisssao da Madrinha" TEXT,
  "Residencia da Madrinha" TEXT,
  "Data do Crisma" TEXT,
  "Data do Casamento" TEXT,
  "Numero do Assento" TEXT,
  "Observacoes" TEXT
);

CREATE TABLE IF NOT EXISTS familias (
  familia_id BIGSERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  residencia TEXT,
  observacoes TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Associação externa membro↔família (sem mexer no membro).
CREATE TABLE IF NOT EXISTS membro_familia_links (
  link_id BIGSERIAL PRIMARY KEY,
  membro_id BIGINT NOT NULL REFERENCES membros(membro_id) ON DELETE CASCADE,
  familia_id BIGINT NOT NULL REFERENCES familias(familia_id) ON DELETE CASCADE,
  relacao TEXT,
  UNIQUE (membro_id, familia_id)
);

-- Registo de importações (CSV/OCR/etc.) e auditoria simples.
CREATE TABLE IF NOT EXISTS importacoes (
  importacao_id BIGSERIAL PRIMARY KEY,
  tipo TEXT NOT NULL, -- ex.: 'csv', 'ocr'
  estrategia TEXT, -- ex.: 'add', 'replace'
  origem TEXT, -- nome do ficheiro, operador, etc.
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS importacao_membros (
  importacao_id BIGINT NOT NULL REFERENCES importacoes(importacao_id) ON DELETE CASCADE,
  membro_id BIGINT NOT NULL REFERENCES membros(membro_id) ON DELETE CASCADE,
  acao TEXT NOT NULL, -- 'added', 'replaced', 'skipped'
  PRIMARY KEY (importacao_id, membro_id)
);

CREATE TABLE IF NOT EXISTS atividade_log (
  atividade_id BIGSERIAL PRIMARY KEY,
  at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  tipo TEXT NOT NULL,
  mensagem TEXT NOT NULL,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb
);

