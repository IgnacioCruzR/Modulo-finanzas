-- Migración v2 -> modelo central. Respaldar antes. No ejecuta pagos históricos.
-- Se detiene ante nóminas, aprobados sin ejecutar o historial inconsistente.
BEGIN;
SET LOCAL lock_timeout = '10s';
LOCK TABLE finanzas.cuenta_cobrar, finanzas.cuenta_pagar, finanzas.cuenta_financiera,
  finanzas.pago, finanzas.autorizacion_pago, finanzas.movimiento_financiero,
  finanzas.cuota, finanzas.aplicacion_pago_cuota IN ACCESS EXCLUSIVE MODE;

DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM finanzas.pago WHERE tipo_operacion='nomina' OR id_nomina IS NOT NULL OR id_empleado IS NOT NULL) THEN
    RAISE EXCEPTION 'Hay nóminas históricas: acordar su tratamiento antes de migrar; no se eliminó ningún registro';
  END IF;
  IF EXISTS (SELECT 1 FROM finanzas.pago WHERE estado='aprobado') THEN
    RAISE EXCEPTION 'Hay pagos aprobados sin ejecutar: revisar con el responsable antes de migrar';
  END IF;
  IF EXISTS (
    SELECT 1 FROM finanzas.pago p
    LEFT JOIN finanzas.autorizacion_pago a USING(id_pago)
    LEFT JOIN finanzas.movimiento_financiero m USING(id_pago)
    WHERE num_nonnulls(p.id_cxc,p.id_cxp,p.id_reembolso)<>1
      OR (p.estado='ejecutado' AND (a.decision IS DISTINCT FROM 'aprobada' OR m.id_mov_fin IS NULL
        OR m.monto<>p.monto OR m.tipo_flujo<>CASE WHEN p.id_cxc IS NOT NULL THEN 'ingreso' ELSE 'egreso' END))
      OR (p.estado='rechazado' AND (a.decision IS DISTINCT FROM 'rechazada' OR m.id_mov_fin IS NOT NULL))
      OR (p.estado='pendiente' AND (a.id_autorizacion IS NOT NULL OR m.id_mov_fin IS NOT NULL))
  ) THEN RAISE EXCEPTION 'Historial de pagos, autorizaciones o movimientos inconsistente'; END IF;
  IF EXISTS (SELECT 1 FROM finanzas.cuenta_cobrar c WHERE c.saldo_pendiente <> c.monto_total -
    COALESCE((SELECT SUM(p.monto) FROM finanzas.pago p WHERE p.id_cxc=c.id_cxc AND p.estado='ejecutado'),0))
    OR EXISTS (SELECT 1 FROM finanzas.cuenta_pagar c WHERE c.saldo_pendiente <> c.monto_total -
    COALESCE((SELECT SUM(p.monto) FROM finanzas.pago p WHERE p.id_cxp=c.id_cxp AND p.estado='ejecutado'),0))
    THEN RAISE EXCEPTION 'Los saldos históricos no coinciden con las operaciones ejecutadas'; END IF;
END $$;

CREATE TEMP TABLE saldo_antes ON COMMIT DROP AS SELECT saldo_actual FROM finanzas.v_saldo_caja;
CREATE TEMP TABLE historial_antes ON COMMIT DROP AS SELECT id_pago,monto,fecha_pago FROM finanzas.pago;

-- Dependencias de cuotas inventariadas. DROP sin CASCADE: una dependencia desconocida aborta todo.
DROP TRIGGER crear_cuotas ON finanzas.cuenta_cobrar;
DROP TRIGGER crear_cuotas ON finanzas.cuenta_pagar;
DROP TRIGGER sin_reprogramacion ON finanzas.cuenta_cobrar;
DROP TRIGGER sin_reprogramacion ON finanzas.cuenta_pagar;
DROP TRIGGER integridad_cuotas ON finanzas.cuenta_cobrar;
DROP TRIGGER integridad_cuotas ON finanzas.cuenta_pagar;
DROP TRIGGER integridad_cuotas ON finanzas.pago;
DROP TRIGGER integridad_cuotas ON finanzas.cuota;
DROP TRIGGER integridad_cuotas ON finanzas.aplicacion_pago_cuota;
DROP TRIGGER validar_fila_cuota ON finanzas.cuota;
DROP TRIGGER validar_aplicacion ON finanzas.aplicacion_pago_cuota;
DROP FUNCTION finanzas.decidir_pago(BIGINT,BIGINT,BOOLEAN,TEXT);
DROP FUNCTION finanzas.ejecutar_pago(BIGINT);
DROP FUNCTION finanzas.integridad_cuotas_diferida();
DROP FUNCTION finanzas.comprobar_cuenta_cuotas(BIGINT,BIGINT);
DROP FUNCTION finanzas.comprobar_pago_cuotas(BIGINT);
DROP FUNCTION finanzas.cuenta_crea_cuotas();
DROP FUNCTION finanzas.cuenta_sin_reprogramacion();
DROP FUNCTION finanzas.validar_fila_cuota();
DROP FUNCTION finanzas.validar_aplicacion_cuota();
DROP FUNCTION finanzas.aplicar_pago_cuotas(BIGINT);
DROP FUNCTION finanzas.generar_cuotas(BIGINT,BIGINT,NUMERIC,INTEGER);
DROP VIEW finanzas.v_cuotas;
DROP TABLE finanzas.aplicacion_pago_cuota;
DROP TABLE finanzas.cuota;
ALTER TABLE finanzas.cuenta_cobrar DROP COLUMN id_cliente, DROP COLUMN cantidad_cuotas;
ALTER TABLE finanzas.cuenta_pagar DROP COLUMN id_proveedor, DROP COLUMN cantidad_cuotas;

ALTER TABLE finanzas.pago RENAME TO operacion_financiera;
ALTER TABLE finanzas.operacion_financiera RENAME COLUMN id_pago TO id_operacion;
ALTER TABLE finanzas.operacion_financiera RENAME COLUMN fecha_pago TO fecha_ejecucion;
ALTER TABLE finanzas.autorizacion_pago RENAME TO autorizacion_financiera;
ALTER TABLE finanzas.autorizacion_financiera RENAME COLUMN id_pago TO id_operacion;
ALTER TABLE finanzas.movimiento_financiero RENAME COLUMN id_pago TO id_operacion;
ALTER TABLE finanzas.operacion_financiera
  DROP CONSTRAINT ck_pago_origen, DROP CONSTRAINT ck_pago_fecha, DROP CONSTRAINT pago_estado_check,
  DROP COLUMN tipo_operacion, DROP COLUMN id_nomina, DROP COLUMN id_empleado,
  ALTER COLUMN metodo_pago DROP NOT NULL;
UPDATE finanzas.operacion_financiera SET estado=CASE estado WHEN 'ejecutado' THEN 'ejecutada' WHEN 'rechazado' THEN 'rechazada' ELSE estado END;
ALTER TABLE finanzas.operacion_financiera
  ADD CONSTRAINT ck_operacion_origen CHECK (num_nonnulls(id_cxc,id_cxp,id_reembolso)=1),
  ADD CONSTRAINT ck_operacion_estado CHECK (estado IN ('pendiente','rechazada','ejecutada')),
  ADD CONSTRAINT ck_operacion_fecha CHECK ((estado='ejecutada')=(fecha_ejecucion IS NOT NULL)),
  ADD CONSTRAINT ck_operacion_metodo CHECK (estado<>'ejecutada' OR metodo_pago IS NOT NULL),
  ADD CONSTRAINT ck_reembolso_positivo CHECK (id_reembolso IS NULL OR id_reembolso>0);
ALTER TABLE finanzas.autorizacion_financiera ADD CONSTRAINT ck_autorizador_positivo CHECK (id_autorizador>0);
ALTER TABLE finanzas.cuenta_cobrar ADD CONSTRAINT ck_venta_positiva CHECK (id_venta>0);
ALTER TABLE finanzas.cuenta_pagar ADD CONSTRAINT ck_oc_positiva CHECK (id_oc>0);

-- Los nombres de las FK se actualizan sin recrear relaciones ni identificadores.
ALTER TABLE finanzas.operacion_financiera RENAME CONSTRAINT pago_pkey TO operacion_financiera_pkey;
ALTER TABLE finanzas.operacion_financiera RENAME CONSTRAINT pago_id_cxc_fkey TO operacion_id_cxc_fkey;
ALTER TABLE finanzas.operacion_financiera RENAME CONSTRAINT pago_id_cxp_fkey TO operacion_id_cxp_fkey;
ALTER TABLE finanzas.autorizacion_financiera RENAME CONSTRAINT autorizacion_pago_pkey TO autorizacion_financiera_pkey;
ALTER TABLE finanzas.autorizacion_financiera RENAME CONSTRAINT autorizacion_pago_id_pago_key TO autorizacion_id_operacion_key;
ALTER TABLE finanzas.autorizacion_financiera RENAME CONSTRAINT autorizacion_pago_id_pago_fkey TO autorizacion_id_operacion_fkey;
ALTER TABLE finanzas.movimiento_financiero RENAME CONSTRAINT movimiento_financiero_id_pago_key TO movimiento_id_operacion_key;
ALTER TABLE finanzas.movimiento_financiero RENAME CONSTRAINT movimiento_financiero_id_pago_fkey TO movimiento_id_operacion_fkey;
ALTER INDEX finanzas.ix_pago_estado RENAME TO ix_operacion_estado;
ALTER INDEX finanzas.ix_pago_fecha RENAME TO ix_operacion_fecha;
ALTER INDEX finanzas.ix_pago_cxc RENAME TO ix_operacion_cxc;
ALTER INDEX finanzas.ix_pago_cxp RENAME TO ix_operacion_cxp;

-- Una sola función registra decisión y ejecución. El candado se toma ANTES de filas.
CREATE FUNCTION finanzas.decidir_operacion(p_id BIGINT,p_autorizador BIGINT,p_aprobar BOOLEAN,
  p_observacion TEXT DEFAULT NULL,p_metodo VARCHAR DEFAULT NULL) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE o finanzas.operacion_financiera%ROWTYPE; c RECORD; v_saldo NUMERIC; v_activa BOOLEAN; v_metodo VARCHAR;
BEGIN
  PERFORM pg_advisory_xact_lock(71007,1);
  SELECT * INTO o FROM finanzas.operacion_financiera WHERE id_operacion=p_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Operación inexistente'; END IF;
  IF o.estado<>'pendiente' THEN RAISE EXCEPTION 'Solo se decide una operación pendiente'; END IF;
  IF p_autorizador IS NULL OR p_autorizador<=0 OR p_aprobar IS NULL THEN RAISE EXCEPTION 'Decisión o autorizador inválido'; END IF;
  IF NOT p_aprobar THEN
    IF NULLIF(BTRIM(p_observacion),'') IS NULL THEN RAISE EXCEPTION 'El rechazo requiere motivo'; END IF;
    IF p_metodo IS NOT NULL THEN RAISE EXCEPTION 'Un rechazo no recibe método de pago'; END IF;
    INSERT INTO finanzas.autorizacion_financiera(id_operacion,id_autorizador,decision,observacion)
      VALUES(p_id,p_autorizador,'rechazada',BTRIM(p_observacion));
    UPDATE finanzas.operacion_financiera SET estado='rechazada' WHERE id_operacion=p_id;
    RETURN;
  END IF;
  v_metodo:=COALESCE(p_metodo,o.metodo_pago);
  IF v_metodo IS NULL OR v_metodo NOT IN ('efectivo','transferencia','tarjeta','simulado') THEN RAISE EXCEPTION 'La ejecución requiere un método válido'; END IF;
  SELECT activa INTO v_activa FROM finanzas.cuenta_financiera WHERE id_cuenta=1 FOR UPDATE;
  IF NOT FOUND OR NOT v_activa THEN RAISE EXCEPTION 'Caja inexistente o inactiva'; END IF;
  IF o.id_cxc IS NOT NULL THEN
    SELECT saldo_pendiente,estado INTO c FROM finanzas.cuenta_cobrar WHERE id_cxc=o.id_cxc FOR UPDATE;
  ELSIF o.id_cxp IS NOT NULL THEN
    SELECT saldo_pendiente,estado INTO c FROM finanzas.cuenta_pagar WHERE id_cxp=o.id_cxp FOR UPDATE;
  END IF;
  IF o.id_cxc IS NOT NULL OR o.id_cxp IS NOT NULL THEN
    IF c.estado IS NULL OR c.estado IN ('anulada','pagada') OR c.saldo_pendiente<o.monto THEN RAISE EXCEPTION 'Obligación no ejecutable o saldo pendiente insuficiente'; END IF;
  END IF;
  IF o.id_cxc IS NULL THEN
    SELECT saldo_actual INTO v_saldo FROM finanzas.v_saldo_caja WHERE id_cuenta=1;
    IF v_saldo<o.monto THEN RAISE EXCEPTION 'Caja insuficiente'; END IF;
  END IF;
  INSERT INTO finanzas.autorizacion_financiera(id_operacion,id_autorizador,decision,observacion)
    VALUES(p_id,p_autorizador,'aprobada',NULLIF(BTRIM(p_observacion),''));
  UPDATE finanzas.operacion_financiera SET estado='ejecutada',fecha_ejecucion=NOW(),metodo_pago=v_metodo WHERE id_operacion=p_id;
  INSERT INTO finanzas.movimiento_financiero(id_operacion,id_cuenta,tipo_flujo,monto,descripcion)
    VALUES(p_id,1,CASE WHEN o.id_cxc IS NOT NULL THEN 'ingreso' ELSE 'egreso' END,o.monto,o.descripcion);
  IF o.id_cxc IS NOT NULL THEN
    UPDATE finanzas.cuenta_cobrar SET saldo_pendiente=saldo_pendiente-o.monto,
      estado=CASE WHEN saldo_pendiente-o.monto=0 THEN 'pagada' ELSE 'parcial' END WHERE id_cxc=o.id_cxc;
  ELSIF o.id_cxp IS NOT NULL THEN
    UPDATE finanzas.cuenta_pagar SET saldo_pendiente=saldo_pendiente-o.monto,
      estado=CASE WHEN saldo_pendiente-o.monto=0 THEN 'pagada' ELSE 'parcial' END WHERE id_cxp=o.id_cxp;
  END IF;
END $$;

CREATE FUNCTION finanzas.proteger_historial() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN
  IF TG_TABLE_NAME='operacion_financiera' AND TG_OP='INSERT' THEN
    IF NEW.estado<>'pendiente' THEN RAISE EXCEPTION 'Una solicitud nueva debe quedar pendiente'; END IF;
    RETURN NEW;
  END IF;
  IF TG_TABLE_NAME='operacion_financiera' AND TG_OP='UPDATE' AND OLD.estado='pendiente'
    AND NEW.id_operacion=OLD.id_operacion AND NEW.id_cxc IS NOT DISTINCT FROM OLD.id_cxc
    AND NEW.id_cxp IS NOT DISTINCT FROM OLD.id_cxp AND NEW.id_reembolso IS NOT DISTINCT FROM OLD.id_reembolso
    AND NEW.monto=OLD.monto AND NEW.fecha_solicitud=OLD.fecha_solicitud
    AND NEW.descripcion IS NOT DISTINCT FROM OLD.descripcion THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'El historial financiero es inmutable';
END $$;
CREATE TRIGGER proteger_operacion BEFORE INSERT OR UPDATE OR DELETE ON finanzas.operacion_financiera FOR EACH ROW EXECUTE FUNCTION finanzas.proteger_historial();
CREATE TRIGGER proteger_autorizacion BEFORE UPDATE OR DELETE ON finanzas.autorizacion_financiera FOR EACH ROW EXECUTE FUNCTION finanzas.proteger_historial();
CREATE TRIGGER proteger_movimiento BEFORE UPDATE OR DELETE ON finanzas.movimiento_financiero FOR EACH ROW EXECUTE FUNCTION finanzas.proteger_historial();

CREATE FUNCTION finanzas.comprobar_operacion(p_id BIGINT) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE o finanzas.operacion_financiera%ROWTYPE; a finanzas.autorizacion_financiera%ROWTYPE; m finanzas.movimiento_financiero%ROWTYPE;
BEGIN
  SELECT * INTO o FROM finanzas.operacion_financiera WHERE id_operacion=p_id;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT * INTO a FROM finanzas.autorizacion_financiera WHERE id_operacion=p_id;
  SELECT * INTO m FROM finanzas.movimiento_financiero WHERE id_operacion=p_id;
  IF (o.estado='pendiente' AND (a.id_autorizacion IS NOT NULL OR m.id_mov_fin IS NOT NULL))
    OR (o.estado='rechazada' AND (a.decision IS DISTINCT FROM 'rechazada' OR m.id_mov_fin IS NOT NULL))
    OR (o.estado='ejecutada' AND (a.decision IS DISTINCT FROM 'aprobada' OR m.id_mov_fin IS NULL
      OR m.monto<>o.monto OR m.tipo_flujo<>CASE WHEN o.id_cxc IS NOT NULL THEN 'ingreso' ELSE 'egreso' END))
  THEN RAISE EXCEPTION 'Operación, autorización y movimiento inconsistentes' USING ERRCODE='23514'; END IF;
  IF (SELECT saldo_actual FROM finanzas.v_saldo_caja WHERE id_cuenta=1)<0 THEN
    RAISE EXCEPTION 'La caja no admite saldo negativo' USING ERRCODE='23514';
  END IF;
END $$;

CREATE FUNCTION finanzas.proteger_obligacion() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN
  IF NEW.monto_total IS DISTINCT FROM OLD.monto_total
    OR (to_jsonb(NEW)->>TG_ARGV[0]) IS DISTINCT FROM (to_jsonb(OLD)->>TG_ARGV[0])
    OR (to_jsonb(NEW)->>TG_ARGV[1]) IS DISTINCT FROM (to_jsonb(OLD)->>TG_ARGV[1]) THEN
    RAISE EXCEPTION 'No se puede cambiar el identificador, origen o total de una obligación';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER proteger_cxc BEFORE UPDATE ON finanzas.cuenta_cobrar FOR EACH ROW EXECUTE FUNCTION finanzas.proteger_obligacion('id_venta','id_cxc');
CREATE TRIGGER proteger_cxp BEFORE UPDATE ON finanzas.cuenta_pagar FOR EACH ROW EXECUTE FUNCTION finanzas.proteger_obligacion('id_oc','id_cxp');

CREATE FUNCTION finanzas.comprobar_saldo_obligacion(p_cxc BIGINT,p_cxp BIGINT) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE v_total NUMERIC; v_saldo NUMERIC; v_ejecutado NUMERIC;
BEGIN
  IF p_cxc IS NOT NULL THEN
    SELECT monto_total,saldo_pendiente INTO v_total,v_saldo FROM finanzas.cuenta_cobrar WHERE id_cxc=p_cxc;
    SELECT COALESCE(SUM(monto),0) INTO v_ejecutado FROM finanzas.operacion_financiera WHERE id_cxc=p_cxc AND estado='ejecutada';
  ELSE
    SELECT monto_total,saldo_pendiente INTO v_total,v_saldo FROM finanzas.cuenta_pagar WHERE id_cxp=p_cxp;
    SELECT COALESCE(SUM(monto),0) INTO v_ejecutado FROM finanzas.operacion_financiera WHERE id_cxp=p_cxp AND estado='ejecutada';
  END IF;
  IF v_saldo IS DISTINCT FROM v_total-v_ejecutado THEN RAISE EXCEPTION 'El saldo debe corresponder a operaciones ejecutadas' USING ERRCODE='23514'; END IF;
END $$;

CREATE FUNCTION finanzas.integridad_financiera() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE o finanzas.operacion_financiera%ROWTYPE;
BEGIN
  IF TG_TABLE_NAME='cuenta_cobrar' THEN PERFORM finanzas.comprobar_saldo_obligacion(NEW.id_cxc,NULL);
  ELSIF TG_TABLE_NAME='cuenta_pagar' THEN PERFORM finanzas.comprobar_saldo_obligacion(NULL,NEW.id_cxp);
  ELSE
    PERFORM finanzas.comprobar_operacion(NEW.id_operacion);
    SELECT * INTO o FROM finanzas.operacion_financiera WHERE id_operacion=NEW.id_operacion;
    IF o.id_cxc IS NOT NULL OR o.id_cxp IS NOT NULL THEN PERFORM finanzas.comprobar_saldo_obligacion(o.id_cxc,o.id_cxp); END IF;
  END IF;
  RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER integridad_operacion AFTER INSERT OR UPDATE ON finanzas.operacion_financiera DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION finanzas.integridad_financiera();
CREATE CONSTRAINT TRIGGER integridad_autorizacion AFTER INSERT ON finanzas.autorizacion_financiera DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION finanzas.integridad_financiera();
CREATE CONSTRAINT TRIGGER integridad_movimiento AFTER INSERT ON finanzas.movimiento_financiero DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION finanzas.integridad_financiera();
CREATE CONSTRAINT TRIGGER integridad_cxc AFTER INSERT OR UPDATE ON finanzas.cuenta_cobrar DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION finanzas.integridad_financiera();
CREATE CONSTRAINT TRIGGER integridad_cxp AFTER INSERT OR UPDATE ON finanzas.cuenta_pagar DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION finanzas.integridad_financiera();

DO $$ BEGIN
  IF (SELECT saldo_actual FROM finanzas.v_saldo_caja) IS DISTINCT FROM (SELECT saldo_actual FROM saldo_antes)
    OR EXISTS (SELECT id_pago,monto,fecha_pago FROM historial_antes EXCEPT SELECT id_operacion,monto,fecha_ejecucion FROM finanzas.operacion_financiera)
  THEN RAISE EXCEPTION 'La migración alteró el saldo o el historial'; END IF;
END $$;
COMMIT;
