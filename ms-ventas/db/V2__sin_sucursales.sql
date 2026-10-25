-- La licorería tiene una sola sucursal: la venta ya no guarda sucursal_id.
ALTER TABLE venta DROP COLUMN IF EXISTS sucursal_id;
