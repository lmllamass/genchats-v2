-- migrations/009_citas_calendar_event_id.sql
-- Añade calendar_event_id a citas: guarda el ID del evento real creado en Google Calendar
-- (vía backend/lib/googleCalendar.js) cuando el proyecto tiene configurado un calendar_id
-- para la herramienta concertar_cita. NULL si la cita no llegó a crear evento en el calendario
-- (calendario no compartido, sin fecha_hora_iso, error de la API, etc.).

ALTER TABLE citas
  ADD COLUMN IF NOT EXISTS calendar_event_id TEXT;
