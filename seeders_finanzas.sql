-- Escenario de Tomas Guerra recuperado de bdf3acd y adaptado al modelo central.
-- Conserva las ventas 5001-5010, montos totales, abonos, metodos y fechas relativas.
-- Solo desarrollo local. Requiere 06_modelo_central.sql. No se carga automaticamente.
-- Sin IDs forzados, nombres/RUT de terceros, cuotas ni cambios a operaciones existentes.
BEGIN;
SET LOCAL lock_timeout = '10s';
SELECT pg_advisory_xact_lock(71007,1);

DO $$ BEGIN
  IF current_database()<>'erp_local' THEN
    RAISE EXCEPTION 'Este escenario solo se admite en la base local erp_local';
  END IF;
END $$;

INSERT INTO finanzas.cuenta_financiera(id_cuenta,nombre,saldo_inicial,moneda,activa)
OVERRIDING SYSTEM VALUE VALUES(1,'Caja general ERP',10000000,'CLP',TRUE)
ON CONFLICT(id_cuenta) DO NOTHING;

DO $$
DECLARE d RECORD; v_cxc BIGINT; v_operacion BIGINT; v_total NUMERIC; v_coincidencias INTEGER;
BEGIN
  FOR d IN SELECT * FROM (VALUES
    (5001,200000,100000,'tarjeta',       30,15,INTERVAL '9 days'),
    (5002,240000,120000,'transferencia', 28,17,INTERVAL '8 days'),
    (5003,180000, 90000,'tarjeta',       26,19,INTERVAL '7 days'),
    (5004,320000,160000,'transferencia', 24,21,INTERVAL '6 days'),
    (5005,150000, 75000,'tarjeta',       22,23,INTERVAL '5 days'),
    (5006,275000,150000,'transferencia', 20,25,INTERVAL '4 days'),
    (5007,210000,100000,'tarjeta',       18,27,INTERVAL '3 days'),
    (5008,190000, 95000,'transferencia', 16,29,INTERVAL '2 days'),
    (5009,350000,175000,'tarjeta',       14,31,INTERVAL '1 day'),
    (5010,225000,110000,'transferencia', 12,33,INTERVAL '12 hours')
  ) AS datos(venta,total,abono,metodo,dias_emision,dias_vencimiento,antiguedad)
  LOOP
    INSERT INTO finanzas.cuenta_cobrar(id_venta,monto_total,saldo_pendiente,fecha_emision,fecha_vencimiento)
      VALUES(d.venta,d.total,d.total,CURRENT_DATE-d.dias_emision,CURRENT_DATE+d.dias_vencimiento)
      ON CONFLICT(id_venta) DO NOTHING RETURNING id_cxc INTO v_cxc;
    IF v_cxc IS NOT NULL THEN
      INSERT INTO finanzas.operacion_financiera(id_cxc,monto,metodo_pago,fecha_solicitud,descripcion)
        VALUES(v_cxc,d.abono,d.metodo,NOW()-d.antiguedad,'Abono de prueba a venta '||d.venta)
        RETURNING id_operacion INTO v_operacion;
      -- Crea autorizacion, movimiento y saldo mediante el flujo real. No se falsifican
      -- estados finales ni se desactivan triggers. La ejecucion queda fechada ahora.
      PERFORM finanzas.decidir_operacion(v_operacion,1,TRUE);
    ELSE
      SELECT id_cxc,monto_total INTO v_cxc,v_total FROM finanzas.cuenta_cobrar WHERE id_venta=d.venta;
      SELECT COUNT(*) INTO v_coincidencias FROM finanzas.operacion_financiera o
        JOIN finanzas.autorizacion_financiera a USING(id_operacion)
        JOIN finanzas.movimiento_financiero m USING(id_operacion)
        WHERE o.id_cxc=v_cxc AND o.estado='ejecutada' AND o.monto=d.abono
          AND o.metodo_pago=d.metodo AND o.descripcion='Abono de prueba a venta '||d.venta
          AND a.decision='aprobada' AND m.tipo_flujo='ingreso' AND m.monto=d.abono;
      IF v_total<>d.total OR v_coincidencias<>1 THEN
        RAISE EXCEPTION 'La venta % ya existe y no coincide con este escenario; se revierte toda la carga',d.venta;
      END IF;
      -- Repeticion compatible: no reinicia el saldo ni crea otro abono, incluso si
      -- posteriormente se registraron pagos adicionales sobre esta cuenta.
    END IF;
  END LOOP;
END $$;
COMMIT;

-- Vista de consulta de las diez operaciones recuperadas; no depende de IDs internos.
SELECT c.id_venta,c.id_cxc,c.monto_total,c.saldo_pendiente,c.estado AS estado_cuenta,
       o.id_operacion,o.monto AS abono,o.metodo_pago,o.estado AS estado_operacion
FROM finanzas.cuenta_cobrar c
JOIN finanzas.operacion_financiera o USING(id_cxc)
WHERE c.id_venta BETWEEN 5001 AND 5010
  AND o.descripcion='Abono de prueba a venta '||c.id_venta
ORDER BY c.id_venta;
