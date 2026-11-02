-- Migration 042: estende l'enum corso_tipo con i valori MF e PF+Lab
-- MF (Modulo Formativo) era già usato nell'app ma mancava nell'enum
-- PF+Lab permette a un corso di essere sia Percorso Formativo che Laboratorio

ALTER TYPE corso_tipo ADD VALUE IF NOT EXISTS 'MF';
ALTER TYPE corso_tipo ADD VALUE IF NOT EXISTS 'PF+Lab';
