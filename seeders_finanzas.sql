
BEGIN;

INSERT INTO finanzas.cuenta_financiera (id_cuenta, nombre, saldo_inicial, moneda, activa)
OVERRIDING SYSTEM VALUE
VALUES (1, 'Caja general ERP', 10000000, 'CLP', TRUE)
ON CONFLICT (id_cuenta) DO NOTHING;

INSERT INTO finanzas.cuenta_cobrar
  (id_cxc, id_venta, id_cliente, monto_total, saldo_pendiente, cantidad_cuotas,
   fecha_emision, fecha_vencimiento, estado)
OVERRIDING SYSTEM VALUE
VALUES
  (1, 5001, 101, 200000, 100000, 1, CURRENT_DATE - 30, CURRENT_DATE + 15, 'parcial'),
  (2, 5002, 102, 240000, 120000, 1, CURRENT_DATE - 28, CURRENT_DATE + 17, 'parcial'),
  (3, 5003, 103, 180000,  90000, 1, CURRENT_DATE - 26, CURRENT_DATE + 19, 'parcial'),
  (4, 5004, 104, 320000, 160000, 1, CURRENT_DATE - 24, CURRENT_DATE + 21, 'parcial'),
  (5, 5005, 105, 150000,  75000, 1, CURRENT_DATE - 22, CURRENT_DATE + 23, 'parcial'),
  (6, 5006, 106, 275000, 125000, 1, CURRENT_DATE - 20, CURRENT_DATE + 25, 'parcial'),
  (7, 5007, 107, 210000, 110000, 1, CURRENT_DATE - 18, CURRENT_DATE + 27, 'parcial'),
  (8, 5008, 108, 190000,  95000, 1, CURRENT_DATE - 16, CURRENT_DATE + 29, 'parcial'),
  (9, 5009, 109, 350000, 175000, 1, CURRENT_DATE - 14, CURRENT_DATE + 31, 'parcial'),
  (10,5010, 110, 225000, 115000, 1, CURRENT_DATE - 12, CURRENT_DATE + 33, 'parcial');


INSERT INTO finanzas.pago
  (id_pago, id_cxc, tipo_operacion, monto, metodo_pago, estado,
   fecha_solicitud, fecha_pago, descripcion)
OVERRIDING SYSTEM VALUE
VALUES
  (1,  1, 'cobro', 100000, 'tarjeta',       'ejecutado', CURRENT_TIMESTAMP - INTERVAL '9 days', CURRENT_TIMESTAMP - INTERVAL '9 days', 'Matías Soto, RUT 12.345.678-5; Webpay'),
  (2,  2, 'cobro', 120000, 'transferencia', 'ejecutado', CURRENT_TIMESTAMP - INTERVAL '8 days', CURRENT_TIMESTAMP - INTERVAL '8 days', 'Camila Rojas, RUT 17.654.321-3; Transferencia BancoEstado'),
  (3,  3, 'cobro',  90000, 'tarjeta',       'ejecutado', CURRENT_TIMESTAMP - INTERVAL '7 days', CURRENT_TIMESTAMP - INTERVAL '7 days', 'Diego Muñoz, RUT 9.876.543-3; Tarjeta MACH'),
  (4,  4, 'cobro', 160000, 'transferencia', 'ejecutado', CURRENT_TIMESTAMP - INTERVAL '6 days', CURRENT_TIMESTAMP - INTERVAL '6 days', 'Valentina Pérez, RUT 15.432.109-8; Transferencia BancoEstado'),
  (5,  5, 'cobro',  75000, 'tarjeta',       'ejecutado', CURRENT_TIMESTAMP - INTERVAL '5 days', CURRENT_TIMESTAMP - INTERVAL '5 days', 'Benjamín González, RUT 20.345.678-6; Webpay'),
  (6,  6, 'cobro', 150000, 'transferencia', 'ejecutado', CURRENT_TIMESTAMP - INTERVAL '4 days', CURRENT_TIMESTAMP - INTERVAL '4 days', 'Antonia Fernández, RUT 11.222.333-9; Transferencia BancoEstado'),
  (7,  7, 'cobro', 100000, 'tarjeta',       'ejecutado', CURRENT_TIMESTAMP - INTERVAL '3 days', CURRENT_TIMESTAMP - INTERVAL '3 days', 'Joaquín Silva, RUT 19.876.543-0; Tarjeta MACH'),
  (8,  8, 'cobro',  95000, 'transferencia', 'ejecutado', CURRENT_TIMESTAMP - INTERVAL '2 days', CURRENT_TIMESTAMP - INTERVAL '2 days', 'Florencia Torres, RUT 14.567.890-0; Transferencia BancoEstado'),
  (9,  9, 'cobro', 175000, 'tarjeta',       'ejecutado', CURRENT_TIMESTAMP - INTERVAL '1 day', CURRENT_TIMESTAMP - INTERVAL '1 day', 'Vicente Ramírez, RUT 16.789.012-1; Webpay'),
  (10,10, 'cobro', 110000, 'transferencia', 'ejecutado', CURRENT_TIMESTAMP - INTERVAL '12 hours', CURRENT_TIMESTAMP - INTERVAL '12 hours', 'Javiera Contreras, RUT 10.234.567-3; Transferencia BancoEstado');

INSERT INTO finanzas.movimiento_financiero
  (id_mov_fin, id_pago, id_cuenta, tipo_flujo, monto, fecha_movimiento, descripcion)
OVERRIDING SYSTEM VALUE
VALUES
  (1,  1, 1, 'ingreso', 100000, CURRENT_TIMESTAMP - INTERVAL '9 days', 'Abono Webpay - Matías Soto'),
  (2,  2, 1, 'ingreso', 120000, CURRENT_TIMESTAMP - INTERVAL '8 days', 'Transferencia BancoEstado - Camila Rojas'),
  (3,  3, 1, 'ingreso',  90000, CURRENT_TIMESTAMP - INTERVAL '7 days', 'Tarjeta MACH - Diego Muñoz'),
  (4,  4, 1, 'ingreso', 160000, CURRENT_TIMESTAMP - INTERVAL '6 days', 'Transferencia BancoEstado - Valentina Pérez'),
  (5,  5, 1, 'ingreso',  75000, CURRENT_TIMESTAMP - INTERVAL '5 days', 'Webpay - Benjamín González'),
  (6,  6, 1, 'ingreso', 150000, CURRENT_TIMESTAMP - INTERVAL '4 days', 'Transferencia BancoEstado - Antonia Fernández'),
  (7,  7, 1, 'ingreso', 100000, CURRENT_TIMESTAMP - INTERVAL '3 days', 'Tarjeta MACH - Joaquín Silva'),
  (8,  8, 1, 'ingreso',  95000, CURRENT_TIMESTAMP - INTERVAL '2 days', 'Transferencia BancoEstado - Florencia Torres'),
  (9,  9, 1, 'ingreso', 175000, CURRENT_TIMESTAMP - INTERVAL '1 day', 'Webpay - Vicente Ramírez'),
  (10,10, 1, 'ingreso', 110000, CURRENT_TIMESTAMP - INTERVAL '12 hours', 'Transferencia BancoEstado - Javiera Contreras');

INSERT INTO finanzas.aplicacion_pago_cuota
  (id_aplicacion, id_pago, id_cuota, monto_aplicado)
OVERRIDING SYSTEM VALUE
VALUES
  (1,  1,  1, 100000),
  (2,  2,  2, 120000),
  (3,  3,  3,  90000),
  (4,  4,  4, 160000),
  (5,  5,  5,  75000),
  (6,  6,  6, 150000),
  (7,  7,  7, 100000),
  (8,  8,  8,  95000),
  (9,  9,  9, 175000),
  (10,10, 10, 110000);


SELECT setval(pg_get_serial_sequence('finanzas.cuenta_financiera', 'id_cuenta'), (SELECT MAX(id_cuenta) FROM finanzas.cuenta_financiera), TRUE);
SELECT setval(pg_get_serial_sequence('finanzas.cuenta_cobrar', 'id_cxc'), (SELECT MAX(id_cxc) FROM finanzas.cuenta_cobrar), TRUE);
SELECT setval(pg_get_serial_sequence('finanzas.pago', 'id_pago'), (SELECT MAX(id_pago) FROM finanzas.pago), TRUE);
SELECT setval(pg_get_serial_sequence('finanzas.movimiento_financiero', 'id_mov_fin'), (SELECT MAX(id_mov_fin) FROM finanzas.movimiento_financiero), TRUE);
SELECT setval(pg_get_serial_sequence('finanzas.cuota', 'id_cuota'), (SELECT MAX(id_cuota) FROM finanzas.cuota), TRUE);
SELECT setval(pg_get_serial_sequence('finanzas.aplicacion_pago_cuota', 'id_aplicacion'), (SELECT MAX(id_aplicacion) FROM finanzas.aplicacion_pago_cuota), TRUE);

COMMIT;
