-- Migration: add calendario_token to corsi
-- Used for one-click calendar acceptance link sent to schools
ALTER TABLE corsi ADD COLUMN IF NOT EXISTS calendario_token text;
