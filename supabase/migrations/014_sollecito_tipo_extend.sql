-- Estende l'enum sollecito_tipo con i valori usati dall'app
-- ma non presenti nell'enum iniziale (001_initial_schema.sql)
ALTER TYPE sollecito_tipo ADD VALUE IF NOT EXISTS 'reminder_sessione';
ALTER TYPE sollecito_tipo ADD VALUE IF NOT EXISTS 'reminder_accettazione';
ALTER TYPE sollecito_tipo ADD VALUE IF NOT EXISTS 'reminder_questionario';
ALTER TYPE sollecito_tipo ADD VALUE IF NOT EXISTS 'reminder_candidatura';
ALTER TYPE sollecito_tipo ADD VALUE IF NOT EXISTS 'notifica_calendario_completo';
ALTER TYPE sollecito_tipo ADD VALUE IF NOT EXISTS 'notifica_corso_concluso';
