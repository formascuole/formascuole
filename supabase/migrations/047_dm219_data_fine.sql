-- Migration 047: aggiunge data_fine_effettiva a dm219_params
-- Default: 2026-12-20 (chiusura attività pre-natale)
-- Usata per calcolare le ore pianificate "realisticamente raggiungibili":
-- solo le sessioni con data <= data_fine_effettiva vengono conteggiate.

ALTER TABLE dm219_params
  ADD COLUMN IF NOT EXISTS data_fine_effettiva DATE NOT NULL DEFAULT '2026-12-20';
