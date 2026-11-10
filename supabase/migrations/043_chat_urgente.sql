-- Add urgente flag to chat_messaggi
ALTER TABLE chat_messaggi ADD COLUMN IF NOT EXISTS urgente boolean NOT NULL DEFAULT false;
