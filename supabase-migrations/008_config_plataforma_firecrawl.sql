-- migrations/008_config_plataforma_firecrawl.sql
-- Añade la columna firecrawl_api_key a config_plataforma (usada por FirecrawlBlock.jsx en AdminConfiguracion)

ALTER TABLE config_plataforma
  ADD COLUMN IF NOT EXISTS firecrawl_api_key TEXT;
