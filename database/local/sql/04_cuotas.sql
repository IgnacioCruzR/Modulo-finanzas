-- Ampliación local: cuotas sin intereses, sin vencimientos individuales ni reprogramación.
-- Es aditiva: conserva cuentas, pagos, autorizaciones, movimientos y saldos existentes.
-- Para una base ya inicializada aplicar explícitamente con psql -v ON_ERROR_STOP=1.
BEGIN;
LOCK TABLE finanzas.cuenta_cobrar, finanzas.cuenta_pagar, finanzas.pago,
  finanzas.movimiento_financiero IN SHARE ROW EXCLUSIVE MODE;

ALTER TABLE finanzas.cuenta_cobrar ADD COLUMN IF NOT EXISTS cantidad_cuotas SMALLINT NOT NULL DEFAULT 1 CHECK (cantidad_cuotas > 0);
ALTER TABLE finanzas.cuenta_pagar ADD COLUMN IF NOT EXISTS cantidad_cuotas SMALLINT NOT NULL DEFAULT 1 CHECK (cantidad_cuotas > 0);

CREATE TABLE IF NOT EXISTS finanzas.cuota (
  id_cuota BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_cxc BIGINT REFERENCES finanzas.cuenta_cobrar(id_cxc),
  id_cxp BIGINT REFERENCES finanzas.cuenta_pagar(id_cxp),
  numero SMALLINT NOT NULL CHECK (numero > 0),
  monto NUMERIC(15,2) NOT NULL CHECK (monto > 0),
  CHECK ((id_cxc IS NOT NULL AND id_cxp IS NULL) OR (id_cxp IS NOT NULL AND id_cxc IS NULL)),
  UNIQUE (id_cxc, numero),
  UNIQUE (id_cxp, numero)
);

CREATE TABLE IF NOT EXISTS finanzas.aplicacion_pago_cuota (
  id_aplicacion BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_pago BIGINT NOT NULL REFERENCES finanzas.pago(id_pago),
  id_cuota BIGINT NOT NULL REFERENCES finanzas.cuota(id_cuota),
  monto_aplicado NUMERIC(15,2) NOT NULL CHECK (monto_aplicado > 0),
  UNIQUE (id_pago, id_cuota)
);
CREATE INDEX IF NOT EXISTS ix_aplicacion_cuota ON finanzas.aplicacion_pago_cuota(id_cuota);

CREATE OR REPLACE VIEW finanzas.v_cuotas AS
SELECT c.*, COALESCE(a.pagado,0)::NUMERIC(15,2) AS monto_pagado,
       (c.monto-COALESCE(a.pagado,0))::NUMERIC(15,2) AS saldo_pendiente,
       CASE WHEN COALESCE(a.pagado,0)=c.monto THEN 'pagada'
            WHEN COALESCE(a.pagado,0)>0 THEN 'parcial' ELSE 'pendiente' END AS estado
FROM finanzas.cuota c
LEFT JOIN (SELECT id_cuota,SUM(monto_aplicado) AS pagado FROM finanzas.aplicacion_pago_cuota GROUP BY id_cuota) a
ON a.id_cuota=c.id_cuota;

CREATE OR REPLACE FUNCTION finanzas.generar_cuotas(p_cxc BIGINT,p_cxp BIGINT,p_total NUMERIC,p_cantidad INTEGER)
RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE v_base NUMERIC(15,2);
BEGIN
  IF p_cantidad IS NULL OR p_cantidad < 1 OR p_cantidad > 32767 OR p_total*100 < p_cantidad THEN
    RAISE EXCEPTION 'La cantidad de cuotas requiere al menos un centavo por cuota' USING ERRCODE='23514';
  END IF;
  IF EXISTS(SELECT 1 FROM finanzas.cuota WHERE id_cxc=p_cxc OR id_cxp=p_cxp) THEN
    RAISE EXCEPTION 'Las cuotas ya existen y no se pueden reprogramar';
  END IF;
  v_base := TRUNC(p_total*100/p_cantidad)/100;
  INSERT INTO finanzas.cuota(id_cxc,id_cxp,numero,monto)
  SELECT p_cxc,p_cxp,n,CASE WHEN n=p_cantidad THEN p_total-v_base*(p_cantidad-1) ELSE v_base END
  FROM generate_series(1,p_cantidad) n;
END $$;

CREATE OR REPLACE FUNCTION finanzas.validar_fila_cuota() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_total NUMERIC; v_cantidad INTEGER; v_base NUMERIC;
BEGIN
  IF TG_OP='UPDATE' THEN RAISE EXCEPTION 'No se pueden modificar ni reprogramar las cuotas'; END IF;
  IF NEW.id_cxc IS NOT NULL THEN
    SELECT monto_total,cantidad_cuotas INTO v_total,v_cantidad FROM finanzas.cuenta_cobrar WHERE id_cxc=NEW.id_cxc;
  ELSE
    SELECT monto_total,cantidad_cuotas INTO v_total,v_cantidad FROM finanzas.cuenta_pagar WHERE id_cxp=NEW.id_cxp;
  END IF;
  v_base:=TRUNC(v_total*100/v_cantidad)/100;
  IF NEW.numero > v_cantidad OR NEW.monto IS DISTINCT FROM
    (CASE WHEN NEW.numero=v_cantidad THEN v_total-v_base*(v_cantidad-1) ELSE v_base END) THEN
    RAISE EXCEPTION 'La cuota no corresponde al total y cantidad registrados' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS validar_fila_cuota ON finanzas.cuota;
CREATE TRIGGER validar_fila_cuota BEFORE INSERT OR UPDATE ON finanzas.cuota
FOR EACH ROW EXECUTE FUNCTION finanzas.validar_fila_cuota();

CREATE OR REPLACE FUNCTION finanzas.cuenta_crea_cuotas() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_TABLE_NAME='cuenta_cobrar' THEN
    PERFORM finanzas.generar_cuotas(NEW.id_cxc,NULL,NEW.monto_total,NEW.cantidad_cuotas);
  ELSE
    PERFORM finanzas.generar_cuotas(NULL,NEW.id_cxp,NEW.monto_total,NEW.cantidad_cuotas);
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS crear_cuotas ON finanzas.cuenta_cobrar;
CREATE TRIGGER crear_cuotas AFTER INSERT ON finanzas.cuenta_cobrar FOR EACH ROW EXECUTE FUNCTION finanzas.cuenta_crea_cuotas();
DROP TRIGGER IF EXISTS crear_cuotas ON finanzas.cuenta_pagar;
CREATE TRIGGER crear_cuotas AFTER INSERT ON finanzas.cuenta_pagar FOR EACH ROW EXECUTE FUNCTION finanzas.cuenta_crea_cuotas();

CREATE OR REPLACE FUNCTION finanzas.cuenta_sin_reprogramacion() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.cantidad_cuotas IS DISTINCT FROM OLD.cantidad_cuotas OR NEW.monto_total IS DISTINCT FROM OLD.monto_total THEN
    RAISE EXCEPTION 'No se puede cambiar el total ni reprogramar las cuotas de una cuenta registrada';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS sin_reprogramacion ON finanzas.cuenta_cobrar;
CREATE TRIGGER sin_reprogramacion BEFORE UPDATE ON finanzas.cuenta_cobrar FOR EACH ROW EXECUTE FUNCTION finanzas.cuenta_sin_reprogramacion();
DROP TRIGGER IF EXISTS sin_reprogramacion ON finanzas.cuenta_pagar;
CREATE TRIGGER sin_reprogramacion BEFORE UPDATE ON finanzas.cuenta_pagar FOR EACH ROW EXECUTE FUNCTION finanzas.cuenta_sin_reprogramacion();

-- El pago ejecutado solo puede aplicarse a cuotas de su propia cuenta, sin exceder saldos.
CREATE OR REPLACE FUNCTION finanzas.validar_aplicacion_cuota() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE p finanzas.pago%ROWTYPE; c finanzas.cuota%ROWTYPE; v_aplicado NUMERIC;
BEGIN
  IF TG_OP='UPDATE' THEN RAISE EXCEPTION 'Las aplicaciones de pagos no se pueden modificar'; END IF;
  PERFORM pg_advisory_xact_lock(71007,1);
  SELECT * INTO p FROM finanzas.pago WHERE id_pago=NEW.id_pago FOR UPDATE;
  SELECT * INTO c FROM finanzas.cuota WHERE id_cuota=NEW.id_cuota FOR UPDATE;
  IF p.id_pago IS NULL OR c.id_cuota IS NULL OR p.estado<>'ejecutado'
    OR p.tipo_operacion NOT IN ('cobro','proveedor')
    OR p.id_cxc IS DISTINCT FROM c.id_cxc OR p.id_cxp IS DISTINCT FROM c.id_cxp THEN
    RAISE EXCEPTION 'La aplicación requiere un pago ejecutado y una cuota de la misma cuenta' USING ERRCODE='23514';
  END IF;
  SELECT COALESCE(SUM(monto_aplicado),0) INTO v_aplicado FROM finanzas.aplicacion_pago_cuota WHERE id_cuota=c.id_cuota;
  IF v_aplicado+NEW.monto_aplicado > c.monto THEN RAISE EXCEPTION 'El abono supera el saldo de la cuota' USING ERRCODE='23514'; END IF;
  SELECT COALESCE(SUM(monto_aplicado),0) INTO v_aplicado FROM finanzas.aplicacion_pago_cuota WHERE id_pago=p.id_pago;
  IF v_aplicado+NEW.monto_aplicado > p.monto THEN RAISE EXCEPTION 'La aplicación supera el importe del pago' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS validar_aplicacion ON finanzas.aplicacion_pago_cuota;
CREATE TRIGGER validar_aplicacion BEFORE INSERT OR UPDATE ON finanzas.aplicacion_pago_cuota
FOR EACH ROW EXECUTE FUNCTION finanzas.validar_aplicacion_cuota();

CREATE OR REPLACE FUNCTION finanzas.aplicar_pago_cuotas(p_id_pago BIGINT) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE p finanzas.pago%ROWTYPE; c RECORD; v_restante NUMERIC(15,2); v_abono NUMERIC(15,2);
BEGIN
  PERFORM pg_advisory_xact_lock(71007,1);
  SELECT * INTO p FROM finanzas.pago WHERE id_pago=p_id_pago FOR UPDATE;
  IF NOT FOUND OR p.estado<>'ejecutado' THEN RAISE EXCEPTION 'Solo se aplican pagos ejecutados'; END IF;
  IF p.tipo_operacion NOT IN ('cobro','proveedor') THEN RETURN; END IF;
  IF EXISTS(SELECT 1 FROM finanzas.aplicacion_pago_cuota WHERE id_pago=p_id_pago) THEN RAISE EXCEPTION 'El pago ya fue aplicado a cuotas'; END IF;
  v_restante:=p.monto;
  FOR c IN SELECT q.*,q.monto-COALESCE((SELECT SUM(a.monto_aplicado) FROM finanzas.aplicacion_pago_cuota a WHERE a.id_cuota=q.id_cuota),0) AS saldo
    FROM finanzas.cuota q WHERE q.id_cxc=p.id_cxc OR q.id_cxp=p.id_cxp ORDER BY q.numero FOR UPDATE OF q
  LOOP
    v_abono:=LEAST(v_restante,c.saldo);
    IF v_abono>0 THEN
      INSERT INTO finanzas.aplicacion_pago_cuota(id_pago,id_cuota,monto_aplicado) VALUES(p_id_pago,c.id_cuota,v_abono);
      v_restante:=v_restante-v_abono;
    END IF;
    EXIT WHEN v_restante=0;
  END LOOP;
  IF v_restante<>0 THEN RAISE EXCEPTION 'No hay saldo suficiente en las cuotas para aplicar el pago'; END IF;
END $$;

-- Compatibilidad: cuentas anteriores pasan a una cuota, y se asignan los pagos
-- ya ejecutados en orden histórico, sin ejecutar pagos ni volver a mover caja.
DO $$ DECLARE c RECORD; p RECORD;
BEGIN
  FOR c IN SELECT * FROM finanzas.cuenta_cobrar a WHERE NOT EXISTS(SELECT 1 FROM finanzas.cuota q WHERE q.id_cxc=a.id_cxc) LOOP
    PERFORM finanzas.generar_cuotas(c.id_cxc,NULL,c.monto_total,c.cantidad_cuotas);
  END LOOP;
  FOR c IN SELECT * FROM finanzas.cuenta_pagar a WHERE NOT EXISTS(SELECT 1 FROM finanzas.cuota q WHERE q.id_cxp=a.id_cxp) LOOP
    PERFORM finanzas.generar_cuotas(NULL,c.id_cxp,c.monto_total,c.cantidad_cuotas);
  END LOOP;
  FOR p IN SELECT * FROM finanzas.pago a WHERE estado='ejecutado' AND tipo_operacion IN ('cobro','proveedor')
    AND NOT EXISTS(SELECT 1 FROM finanzas.aplicacion_pago_cuota x WHERE x.id_pago=a.id_pago) ORDER BY fecha_pago,id_pago LOOP
    PERFORM finanzas.aplicar_pago_cuotas(p.id_pago);
  END LOOP;
END $$;

CREATE OR REPLACE FUNCTION finanzas.comprobar_cuenta_cuotas(p_cxc BIGINT,p_cxp BIGINT) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE v_total NUMERIC; v_saldo NUMERIC; v_cantidad INTEGER; v_numero INTEGER; v_suma NUMERIC; v_pagado NUMERIC;
BEGIN
  IF p_cxc IS NOT NULL THEN
    SELECT monto_total,saldo_pendiente,cantidad_cuotas INTO v_total,v_saldo,v_cantidad FROM finanzas.cuenta_cobrar WHERE id_cxc=p_cxc;
  ELSE
    SELECT monto_total,saldo_pendiente,cantidad_cuotas INTO v_total,v_saldo,v_cantidad FROM finanzas.cuenta_pagar WHERE id_cxp=p_cxp;
  END IF;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT COUNT(*),COALESCE(SUM(monto),0),COALESCE(SUM(monto_pagado),0) INTO v_numero,v_suma,v_pagado
  FROM finanzas.v_cuotas WHERE id_cxc=p_cxc OR id_cxp=p_cxp;
  IF v_numero<>v_cantidad OR v_suma<>v_total OR v_total-v_pagado<>v_saldo THEN
    RAISE EXCEPTION 'Las cuotas, aplicaciones y saldo de la cuenta no coinciden' USING ERRCODE='23514';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION finanzas.comprobar_pago_cuotas(p_id_pago BIGINT) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE p finanzas.pago%ROWTYPE; v_suma NUMERIC;
BEGIN
  SELECT * INTO p FROM finanzas.pago WHERE id_pago=p_id_pago;
  IF NOT FOUND THEN RETURN; END IF;
  SELECT COALESCE(SUM(monto_aplicado),0) INTO v_suma FROM finanzas.aplicacion_pago_cuota WHERE id_pago=p_id_pago;
  IF (p.estado='ejecutado' AND p.tipo_operacion IN ('cobro','proveedor') AND v_suma<>p.monto)
    OR ((p.estado<>'ejecutado' OR p.tipo_operacion NOT IN ('cobro','proveedor')) AND v_suma<>0) THEN
    RAISE EXCEPTION 'El pago ejecutado debe quedar aplicado exactamente una vez por su monto' USING ERRCODE='23514';
  END IF;
END $$;

CREATE OR REPLACE FUNCTION finanzas.integridad_cuotas_diferida() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE r RECORD; q finanzas.cuota%ROWTYPE;
BEGIN
  IF TG_OP='DELETE' THEN r:=OLD; ELSE r:=NEW; END IF;
  IF TG_TABLE_NAME='cuenta_cobrar' THEN PERFORM finanzas.comprobar_cuenta_cuotas(r.id_cxc,NULL);
  ELSIF TG_TABLE_NAME='cuenta_pagar' THEN PERFORM finanzas.comprobar_cuenta_cuotas(NULL,r.id_cxp);
  ELSIF TG_TABLE_NAME='cuota' THEN PERFORM finanzas.comprobar_cuenta_cuotas(r.id_cxc,r.id_cxp);
  ELSE
    PERFORM finanzas.comprobar_pago_cuotas(r.id_pago);
    IF TG_TABLE_NAME='aplicacion_pago_cuota' THEN
      SELECT * INTO q FROM finanzas.cuota WHERE id_cuota=r.id_cuota;
      IF FOUND THEN PERFORM finanzas.comprobar_cuenta_cuotas(q.id_cxc,q.id_cxp); END IF;
    END IF;
  END IF;
  RETURN NULL;
END $$;
DROP TRIGGER IF EXISTS integridad_cuotas ON finanzas.cuenta_cobrar;
CREATE CONSTRAINT TRIGGER integridad_cuotas AFTER INSERT OR UPDATE ON finanzas.cuenta_cobrar
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION finanzas.integridad_cuotas_diferida();
DROP TRIGGER IF EXISTS integridad_cuotas ON finanzas.cuenta_pagar;
CREATE CONSTRAINT TRIGGER integridad_cuotas AFTER INSERT OR UPDATE ON finanzas.cuenta_pagar
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION finanzas.integridad_cuotas_diferida();
DROP TRIGGER IF EXISTS integridad_cuotas ON finanzas.cuota;
CREATE CONSTRAINT TRIGGER integridad_cuotas AFTER DELETE ON finanzas.cuota
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION finanzas.integridad_cuotas_diferida();
DROP TRIGGER IF EXISTS integridad_cuotas ON finanzas.pago;
CREATE CONSTRAINT TRIGGER integridad_cuotas AFTER INSERT OR UPDATE ON finanzas.pago
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION finanzas.integridad_cuotas_diferida();
DROP TRIGGER IF EXISTS integridad_cuotas ON finanzas.aplicacion_pago_cuota;
CREATE CONSTRAINT TRIGGER integridad_cuotas AFTER INSERT OR DELETE ON finanzas.aplicacion_pago_cuota
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION finanzas.integridad_cuotas_diferida();

-- Comprobar también el historial migrado, antes de aceptar la migración.
DO $$ DECLARE c RECORD; p RECORD;
BEGIN
  FOR c IN SELECT id_cxc FROM finanzas.cuenta_cobrar LOOP PERFORM finanzas.comprobar_cuenta_cuotas(c.id_cxc,NULL); END LOOP;
  FOR c IN SELECT id_cxp FROM finanzas.cuenta_pagar LOOP PERFORM finanzas.comprobar_cuenta_cuotas(NULL,c.id_cxp); END LOOP;
  FOR p IN SELECT id_pago FROM finanzas.pago LOOP PERFORM finanzas.comprobar_pago_cuotas(p.id_pago); END LOOP;
END $$;

-- La definición actualizada de ejecutar_pago se incorpora a continuación.

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
  PERFORM finanzas.aplicar_pago_cuotas(p_id_pago);
  RETURN v_mov;
END $$;

COMMIT;
