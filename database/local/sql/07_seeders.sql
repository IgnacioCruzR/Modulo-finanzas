-- Fixtures financieros locales. Requiere 06_modelo_central.sql. No son maestros del profesor.
-- Repetible: no duplica orígenes ya cargados ni reinicia caja o saldos.
BEGIN;
INSERT INTO finanzas.cuenta_financiera(id_cuenta,nombre,saldo_inicial,moneda)
OVERRIDING SYSTEM VALUE VALUES(1,'Caja general ERP',10000000,'CLP')
ON CONFLICT(id_cuenta) DO NOTHING;
DO $$
DECLARE i INTEGER; cxc BIGINT; cxp BIGINT; op BIGINT; total NUMERIC;
BEGIN
  FOR i IN 1..12 LOOP
    total := 100000+i*1000;
    INSERT INTO finanzas.cuenta_cobrar(id_venta,monto_total,saldo_pendiente)
      VALUES(7000+i,total,total) ON CONFLICT(id_venta) DO NOTHING RETURNING id_cxc INTO cxc;
    IF cxc IS NOT NULL THEN
      INSERT INTO finanzas.operacion_financiera(id_cxc,monto,metodo_pago,descripcion)
        VALUES(cxc,1000,'simulado','Abono de prueba a venta '||(7000+i)) RETURNING id_operacion INTO op;
      IF i<=10 THEN PERFORM finanzas.decidir_operacion(op,1,i<=8,CASE WHEN i>8 THEN 'Solicitud de prueba rechazada' ELSE NULL END); END IF;
    END IF;
    INSERT INTO finanzas.cuenta_pagar(id_oc,monto_total,saldo_pendiente)
      VALUES(8000+i,total,total) ON CONFLICT(id_oc) DO NOTHING RETURNING id_cxp INTO cxp;
    IF cxp IS NOT NULL THEN
      INSERT INTO finanzas.operacion_financiera(id_cxp,monto,metodo_pago,descripcion)
        VALUES(cxp,500,'simulado','Abono de prueba a orden '||(8000+i)) RETURNING id_operacion INTO op;
      IF i<=10 THEN PERFORM finanzas.decidir_operacion(op,1,i<=8,CASE WHEN i>8 THEN 'Solicitud de prueba rechazada' ELSE NULL END); END IF;
    END IF;
  END LOOP;
END $$;
COMMIT;
