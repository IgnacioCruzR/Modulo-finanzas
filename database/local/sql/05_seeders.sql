-- Datos de desarrollo para el modelo Finanzas v2. SOLO entorno local.
-- Requiere 01_schema.sql, 02_operaciones.sql y 04_cuotas.sql aplicados.
-- Los pagos se crean, deciden y ejecutan con finanzas.decidir_pago y finanzas.ejecutar_pago,
-- de modo que autorizaciones, movimientos, saldos, cuotas y aplicaciones quedan coherentes.
-- cuenta_financiera no recibe filas nuevas: ck_caja_unica limita la tabla a la caja id_cuenta = 1.
-- No es repetible: se detiene si ya se aplicó (ventas 7001-7012 u órdenes de compra 8001-8012).
BEGIN;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM finanzas.cuenta_financiera WHERE id_cuenta = 1 AND activa) THEN
    RAISE EXCEPTION 'Falta la caja activa id_cuenta = 1; aplica primero 01_schema.sql.';
  END IF;
  IF EXISTS (SELECT 1 FROM finanzas.cuenta_cobrar WHERE id_venta BETWEEN 7001 AND 7012)
    OR EXISTS (SELECT 1 FROM finanzas.cuenta_pagar WHERE id_oc BETWEEN 8001 AND 8012) THEN
    RAISE EXCEPTION 'El seeder ya se aplicó en esta base; no se insertaron datos.';
  END IF;
END $$;

-- Cuentas por cobrar: el trigger crear_cuotas genera sus cuotas automáticamente.
INSERT INTO finanzas.cuenta_cobrar
  (id_venta, id_cliente, monto_total, saldo_pendiente, cantidad_cuotas, fecha_emision, fecha_vencimiento, estado)
VALUES
  (7001, 201, 450000, 450000, 3, CURRENT_DATE - 40, CURRENT_DATE + 20, 'pendiente'),
  (7002, 202, 180000, 180000, 1, CURRENT_DATE - 38, CURRENT_DATE - 8,  'pendiente'),
  (7003, 203, 320000, 320000, 2, CURRENT_DATE - 35, CURRENT_DATE + 25, 'pendiente'),
  (7004, 204,  95000,  95000, 1, CURRENT_DATE - 32, CURRENT_DATE - 2,  'pendiente'),
  (7005, 205, 610000, 610000, 3, CURRENT_DATE - 30, CURRENT_DATE + 30, 'pendiente'),
  (7006, 206, 240000, 240000, 2, CURRENT_DATE - 27, CURRENT_DATE + 33, 'pendiente'),
  (7007, 207, 130000, 130000, 1, CURRENT_DATE - 24, CURRENT_DATE + 6,  'pendiente'),
  (7008, 208, 780000, 780000, 3, CURRENT_DATE - 21, CURRENT_DATE + 39, 'pendiente'),
  (7009, 209, 210000, 210000, 1, CURRENT_DATE - 18, CURRENT_DATE + 12, 'pendiente'),
  (7010, 210, 365000, 365000, 2, CURRENT_DATE - 15, CURRENT_DATE + 45, 'pendiente'),
  (7011, 211, 150000, 150000, 1, CURRENT_DATE - 10, CURRENT_DATE + 20, 'pendiente'),
  (7012, 212,  99000,  99000, 1, CURRENT_DATE - 9,  CURRENT_DATE + 21, 'anulada');

-- Cuentas por pagar.
INSERT INTO finanzas.cuenta_pagar
  (id_oc, id_proveedor, monto_total, saldo_pendiente, cantidad_cuotas, fecha_emision, fecha_vencimiento, estado)
VALUES
  (8001, 301,  500000,  500000, 2, CURRENT_DATE - 42, CURRENT_DATE + 18, 'pendiente'),
  (8002, 302,  350000,  350000, 1, CURRENT_DATE - 39, CURRENT_DATE - 9,  'pendiente'),
  (8003, 303,  260000,  260000, 1, CURRENT_DATE - 36, CURRENT_DATE - 6,  'pendiente'),
  (8004, 304,  480000,  480000, 3, CURRENT_DATE - 33, CURRENT_DATE + 27, 'pendiente'),
  (8005, 305,  175000,  175000, 1, CURRENT_DATE - 29, CURRENT_DATE + 1,  'pendiente'),
  (8006, 306,  840000,  840000, 2, CURRENT_DATE - 26, CURRENT_DATE + 34, 'pendiente'),
  (8007, 307,  290000,  290000, 2, CURRENT_DATE - 23, CURRENT_DATE + 37, 'pendiente'),
  (8008, 308,   90000,   90000, 1, CURRENT_DATE - 20, CURRENT_DATE + 10, 'pendiente'),
  (8009, 309, 1200000, 1200000, 3, CURRENT_DATE - 17, CURRENT_DATE + 43, 'pendiente'),
  (8010, 310,  410000,  410000, 2, CURRENT_DATE - 14, CURRENT_DATE + 46, 'pendiente'),
  (8011, 311,  155000,  155000, 1, CURRENT_DATE - 11, CURRENT_DATE + 19, 'pendiente'),
  (8012, 312,  230000,  230000, 1, CURRENT_DATE - 8,  CURRENT_DATE + 22, 'anulada');

-- Auxiliar de sesión: crea un pago y lo lleva al estado pedido usando las funciones del modelo.
-- Luego distribuye las fechas en el pasado para que los listados no muestren todo en el mismo instante.
CREATE FUNCTION pg_temp.seed_pago(
  p_tipo TEXT, p_venta BIGINT, p_oc BIGINT, p_nomina BIGINT, p_empleado BIGINT, p_reembolso BIGINT,
  p_monto NUMERIC, p_metodo TEXT, p_descripcion TEXT, p_dias_atras INTEGER, p_estado TEXT, p_observacion TEXT
) RETURNS BIGINT LANGUAGE plpgsql AS $$
DECLARE
  v_id BIGINT;
  v_solicitud TIMESTAMPTZ := NOW() - make_interval(days => p_dias_atras);
BEGIN
  INSERT INTO finanzas.pago (id_cxc, id_cxp, id_nomina, id_empleado, id_reembolso, tipo_operacion, monto, metodo_pago, descripcion)
  VALUES (
    (SELECT id_cxc FROM finanzas.cuenta_cobrar WHERE id_venta = p_venta),
    (SELECT id_cxp FROM finanzas.cuenta_pagar WHERE id_oc = p_oc),
    p_nomina, p_empleado, p_reembolso, p_tipo, p_monto, p_metodo, p_descripcion
  ) RETURNING id_pago INTO v_id;

  IF p_estado IN ('aprobado', 'ejecutado') THEN
    PERFORM finanzas.decidir_pago(v_id, 1, TRUE, p_observacion);
  ELSIF p_estado = 'rechazado' THEN
    PERFORM finanzas.decidir_pago(v_id, 1, FALSE, p_observacion);
  END IF;
  IF p_estado = 'ejecutado' THEN
    PERFORM finanzas.ejecutar_pago(v_id);
  END IF;

  UPDATE finanzas.pago
     SET fecha_solicitud = v_solicitud,
         fecha_pago = CASE WHEN estado = 'ejecutado' THEN v_solicitud + INTERVAL '1 day' END
   WHERE id_pago = v_id;
  UPDATE finanzas.autorizacion_pago SET fecha_autorizacion = v_solicitud + INTERVAL '4 hours' WHERE id_pago = v_id;
  UPDATE finanzas.movimiento_financiero SET fecha_movimiento = v_solicitud + INTERVAL '1 day' WHERE id_pago = v_id;
  RETURN v_id;
END $$;

-- Se ejecutan en orden cronológico para que las cuotas se apliquen en el mismo orden.
--                       tipo         venta  oc    nómina empl  reemb  monto    método           descripción                                    días  estado       observación
SELECT pg_temp.seed_pago('cobro',     7001, NULL, NULL, NULL, NULL, 150000, 'transferencia', 'Primera cuota venta 7001',                     30, 'ejecutado', 'Transferencia verificada');
SELECT pg_temp.seed_pago('proveedor', NULL, 8001, NULL, NULL, NULL, 200000, 'transferencia', 'Abono OC 8001 - insumos plásticos',            29, 'ejecutado', 'Factura recibida');
SELECT pg_temp.seed_pago('cobro',     7002, NULL, NULL, NULL, NULL, 180000, 'tarjeta',       'Pago total venta 7002',                        28, 'ejecutado', 'Voucher conciliado');
SELECT pg_temp.seed_pago('nomina',    NULL, NULL,  501, 1001, NULL, 650000, 'transferencia', 'Remuneración octubre - bodega',                27, 'ejecutado', 'Liquidación aprobada por RR. HH.');
SELECT pg_temp.seed_pago('proveedor', NULL, 8002, NULL, NULL, NULL, 350000, 'transferencia', 'Pago total OC 8002 - embalaje',                26, 'ejecutado', 'Recepción conforme');
SELECT pg_temp.seed_pago('cobro',     7003, NULL, NULL, NULL, NULL, 100000, 'efectivo',      'Abono parcial venta 7003',                     25, 'ejecutado', 'Recibido en caja');
SELECT pg_temp.seed_pago('reembolso', NULL, NULL, NULL, NULL,  601,  35000, 'efectivo',      'Reembolso por producto defectuoso',            24, 'ejecutado', 'Postventa validó la devolución');
SELECT pg_temp.seed_pago('cobro',     7005, NULL, NULL, NULL, NULL, 610000, 'transferencia', 'Pago total venta 7005',                        23, 'ejecutado', 'Transferencia verificada');
SELECT pg_temp.seed_pago('proveedor', NULL, 8004, NULL, NULL, NULL, 150000, 'efectivo',      'Abono OC 8004 - transporte',                   22, 'ejecutado', 'Guía de despacho conforme');
SELECT pg_temp.seed_pago('cobro',     7006, NULL, NULL, NULL, NULL, 120000, 'tarjeta',       'Primera cuota venta 7006',                     21, 'ejecutado', 'Voucher conciliado');
SELECT pg_temp.seed_pago('proveedor', NULL, 8006, NULL, NULL, NULL, 420000, 'transferencia', 'Primera cuota OC 8006 - moldes',               20, 'ejecutado', 'Factura recibida');
SELECT pg_temp.seed_pago('cobro',     7008, NULL, NULL, NULL, NULL, 300000, 'transferencia', 'Abono venta 7008',                             19, 'ejecutado', 'Transferencia verificada');
SELECT pg_temp.seed_pago('proveedor', NULL, 8008, NULL, NULL, NULL,  90000, 'transferencia', 'Pago total OC 8008 - etiquetas',               18, 'ejecutado', 'Recepción conforme');
SELECT pg_temp.seed_pago('cobro',     7010, NULL, NULL, NULL, NULL, 365000, 'transferencia', 'Pago total venta 7010',                        17, 'ejecutado', 'Transferencia verificada');
SELECT pg_temp.seed_pago('proveedor', NULL, 8005, NULL, NULL, NULL,  80000, 'transferencia', 'Abono OC 8005 - repuestos',                    15, 'rechazado', 'Factura sin orden de recepción');
SELECT pg_temp.seed_pago('cobro',     7009, NULL, NULL, NULL, NULL, 210000, 'tarjeta',       'Pago venta 7009',                              13, 'rechazado', 'El monto no coincide con la boleta');
SELECT pg_temp.seed_pago('reembolso', NULL, NULL, NULL, NULL,  602,  48000, 'transferencia', 'Reembolso de gastos de envío',                 11, 'rechazado', 'Gasto fuera de la política de reembolsos');
SELECT pg_temp.seed_pago('cobro',     7004, NULL, NULL, NULL, NULL,  95000, 'tarjeta',       'Pago total venta 7004',                         9, 'aprobado',  'Pendiente de conciliación bancaria');
SELECT pg_temp.seed_pago('proveedor', NULL, 8003, NULL, NULL, NULL, 120000, 'transferencia', 'Abono OC 8003 - cajas',                         7, 'aprobado',  'Programado para el próximo pago');
SELECT pg_temp.seed_pago('nomina',    NULL, NULL,  501, 1002, NULL, 590000, 'transferencia', 'Remuneración octubre - ventas',                 6, 'aprobado',  'Liquidación aprobada por RR. HH.');
SELECT pg_temp.seed_pago('cobro',     7007, NULL, NULL, NULL, NULL,  65000, 'efectivo',      'Abono venta 7007',                              4, 'pendiente', NULL);
SELECT pg_temp.seed_pago('proveedor', NULL, 8007, NULL, NULL, NULL, 140000, 'transferencia', 'Primera cuota OC 8007 - pintura',               3, 'pendiente', NULL);
SELECT pg_temp.seed_pago('nomina',    NULL, NULL,  502, 1003, NULL, 720000, 'transferencia', 'Remuneración noviembre - administración',       2, 'pendiente', NULL);
SELECT pg_temp.seed_pago('reembolso', NULL, NULL, NULL, NULL,  603,  22500, 'simulado',      'Reembolso por cambio de producto',              1, 'pendiente', NULL);

DROP FUNCTION pg_temp.seed_pago(TEXT, BIGINT, BIGINT, BIGINT, BIGINT, BIGINT, NUMERIC, TEXT, TEXT, INTEGER, TEXT, TEXT);

COMMIT;

-- Resumen de registros por tabla después de aplicar el seeder.
SELECT 'cuenta_financiera' AS tabla, COUNT(*) AS registros FROM finanzas.cuenta_financiera
UNION ALL SELECT 'cuenta_cobrar', COUNT(*) FROM finanzas.cuenta_cobrar
UNION ALL SELECT 'cuenta_pagar', COUNT(*) FROM finanzas.cuenta_pagar
UNION ALL SELECT 'cuota', COUNT(*) FROM finanzas.cuota
UNION ALL SELECT 'pago', COUNT(*) FROM finanzas.pago
UNION ALL SELECT 'autorizacion_pago', COUNT(*) FROM finanzas.autorizacion_pago
UNION ALL SELECT 'movimiento_financiero', COUNT(*) FROM finanzas.movimiento_financiero
UNION ALL SELECT 'aplicacion_pago_cuota', COUNT(*) FROM finanzas.aplicacion_pago_cuota;
