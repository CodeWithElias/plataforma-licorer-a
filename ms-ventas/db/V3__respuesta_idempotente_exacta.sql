-- Idempotencia (CU03): la respuesta repetida debe ser idéntica byte a byte a la primera.
-- JSONB reordena las claves y cambia los espacios, así que se guarda el texto tal cual.
ALTER TABLE idempotency_keys ALTER COLUMN respuesta TYPE TEXT USING respuesta::text;
