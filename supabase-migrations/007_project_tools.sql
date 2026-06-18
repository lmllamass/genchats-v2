-- migrations/007_project_tools.sql
-- Tabla multitenant de herramientas/acciones por proyecto (Actions Engine)

CREATE TABLE IF NOT EXISTS project_tools (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  UUID NOT NULL REFERENCES proyectos(id) ON DELETE CASCADE,
  tool_name   VARCHAR(100) NOT NULL,
  enabled     BOOLEAN NOT NULL DEFAULT FALSE,
  config      JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(project_id, tool_name)
);

-- Index for fast lookups in agentCore
CREATE INDEX IF NOT EXISTS idx_project_tools_project_enabled
  ON project_tools(project_id, enabled);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_project_tools_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE OR REPLACE TRIGGER trg_project_tools_updated_at
  BEFORE UPDATE ON project_tools
  FOR EACH ROW EXECUTE FUNCTION update_project_tools_updated_at();
