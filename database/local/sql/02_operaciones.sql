-- Operaciones atómicas para demostración local. No ejecutar sobre base remota sin coordinación.
-- El backend DEBE autenticar al autorizador; aquí se recibe su ID como parámetro.
CREATE OR REPLACE FUNCTION finanzas.decidir_pago(
  p_id_pago BIGINT, p_id_autorizador BIGINT, p_aprobar BOOLEAN, p_observacion TEXT DEFAULT NULL
) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE v_estado VARCHAR(20);
BEGIN
  SELECT estado INTO v_estado FROM finanzas.pago WHERE id_pago=p_id_pago FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pago % inexistente',p_id_pago; END IF;
  IF v_estado <> 'pendiente' THEN RAISE EXCEPTION 'Solo se decide un pago pendiente; estado: %',v_estado; END IF;
  IF p_id_autorizador IS NULL THEN RAISE EXCEPTION 'Falta autorizador'; END IF;
  IF NOT p_aprobar AND NULLIF(BTRIM(COALESCE(p_observacion,'')),'') IS NULL THEN
    RAISE EXCEPTION 'El rechazo requiere motivo';
  END IF;
  INSERT INTO finanzas.autorizacion_pago(id_pago,id_autorizador,decision,observacion)
  VALUES(p_id_pago,p_id_autorizador,CASE WHEN p_aprobar THEN 'aprobada' ELSE 'rechazada' END,p_observacion);
  UPDATE finanzas.pago SET estado=CASE WHEN p_aprobar THEN 'aprobado' ELSE 'rechazado' END WHERE id_pago=p_id_pago;
END $$;

CREATE OR REPLACE FUNCTION finanzas.ejecutar_pago(p_id_pago BIGINT) RETURNS BIGINT
LANGUAGE plpgsql AS $$
DECLARE
  v finanzas.pago%ROWTYPE;
  v_saldo NUMERIC(15,2);
  v_pendiente NUMERIC(15,2);
  v_cuenta BIGINT := 1;
  v_flujo VARCHAR(10);
  v_mov BIGINT;
BEGIN
  -- Serializa ejecuciones que modifican la caja; también evita pagos concurrentes sobre el mismo saldo.
  PERFORM pg_advisory_xact_lock(71007, 1);
  SELECT * INTO v FROM finanzas.pago WHERE id_pago=p_id_pago FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Pago % inexistente',p_id_pago; END IF;
  IF v.estado <> 'aprobado' THEN RAISE EXCEPTION 'El pago debe estar aprobado; estado actual %',v.estado; END IF;
  IF NOT EXISTS (SELECT 1 FROM finanzas.autorizacion_pago WHERE id_pago=p_id_pago AND decision='aprobada') THEN
    RAISE EXCEPTION 'Falta autorización aprobada';
  END IF;
  v_flujo := CASE WHEN v.tipo_operacion='cobro' THEN 'ingreso' ELSE 'egreso' END;
  IF v.tipo_operacion='cobro' THEN
    SELECT saldo_pendiente INTO v_pendiente FROM finanzas.cuenta_cobrar WHERE id_cxc=v.id_cxc FOR UPDATE;
    IF NOT FOUND OR v_pendiente < v.monto THEN RAISE EXCEPTION 'Cuenta por cobrar inexistente o saldo insuficiente'; END IF;
  ELSIF v.tipo_operacion='proveedor' THEN
    SELECT saldo_pendiente INTO v_pendiente FROM finanzas.cuenta_pagar WHERE id_cxp=v.id_cxp FOR UPDATE;
    IF NOT FOUND OR v_pendiente < v.monto THEN RAISE EXCEPTION 'Cuenta por pagar inexistente o saldo insuficiente'; END IF;
  END IF;
  IF v_flujo='egreso' THEN
    SELECT saldo_actual INTO v_saldo FROM finanzas.v_saldo_caja WHERE id_cuenta=v_cuenta;
    IF v_saldo IS NULL OR v_saldo < v.monto THEN RAISE EXCEPTION 'Caja insuficiente'; END IF;
  END IF;
  UPDATE finanzas.pago SET estado='ejecutado',fecha_pago=NOW() WHERE id_pago=p_id_pago;
  INSERT INTO finanzas.movimiento_financiero(id_pago,id_cuenta,tipo_flujo,monto,descripcion)
  VALUES(p_id_pago,v_cuenta,v_flujo,v.monto,v.descripcion) RETURNING id_mov_fin INTO v_mov;
  IF v.tipo_operacion='cobro' THEN
    UPDATE finanzas.cuenta_cobrar
       SET saldo_pendiente=saldo_pendiente-v.monto,
           estado=CASE WHEN saldo_pendiente-v.monto=0 THEN 'pagada' ELSE 'parcial' END
     WHERE id_cxc=v.id_cxc;
  ELSIF v.tipo_operacion='proveedor' THEN
    UPDATE finanzas.cuenta_pagar
       SET saldo_pendiente=saldo_pendiente-v.monto,
           estado=CASE WHEN saldo_pendiente-v.monto=0 THEN 'pagada' ELSE 'parcial' END
     WHERE id_cxp=v.id_cxp;
  END IF;
  RETURN v_mov;
END $$;

-- Las funciones proporcionan el camino seguro si la aplicación no modifica directamente tablas.
-- Para producción sería necesario restringir permisos DML de la cuenta usada por la API.
