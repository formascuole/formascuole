-- Migration 026: Add data_termine to finanziamenti table
-- Allows blocking session insertion beyond the funding period end date.

ALTER TABLE finanziamenti ADD COLUMN IF NOT EXISTS data_termine date;
