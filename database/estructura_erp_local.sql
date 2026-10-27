--
-- PostgreSQL database dump
--

\restrict XHhmyW4lcreRq3FymPmWIEJvXKqCkr5asffuIoMFvjvU0hxDOdMbxdDrM4UBCnc

-- Dumped from database version 17.11 (Debian 17.11-1.pgdg13+2)
-- Dumped by pg_dump version 17.11 (Debian 17.11-1.pgdg13+2)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: finanzas; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA finanzas;


--
-- Name: aplicar_pago_cuotas(bigint); Type: FUNCTION; Schema: finanzas; Owner: -
--

CREATE FUNCTION finanzas.aplicar_pago_cuotas(p_id_pago bigint) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE p finanzas.pago%ROWTYPE; c RECORD; v_restante NUMERIC(15,2); v_abono NUMERIC(15,2);
BEGIN
  PERFORM pg_advisory_xact_lock(71007,1);Maquetar formulario transaccional de registro de pago en React con validaciones en cliente.
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


--
-- Name: comprobar_cuenta_cuotas(bigint, bigint); Type: FUNCTION; Schema: finanzas; Owner: -
--

CREATE FUNCTION finanzas.comprobar_cuenta_cuotas(p_cxc bigint, p_cxp bigint) RETURNS void
    LANGUAGE plpgsql
    AS $$
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


--
-- Name: comprobar_pago_cuotas(bigint); Type: FUNCTION; Schema: finanzas; Owner: -
--

CREATE FUNCTION finanzas.comprobar_pago_cuotas(p_id_pago bigint) RETURNS void
    LANGUAGE plpgsql
    AS $$
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


--
-- Name: cuenta_crea_cuotas(); Type: FUNCTION; Schema: finanzas; Owner: -
--

CREATE FUNCTION finanzas.cuenta_crea_cuotas() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF TG_TABLE_NAME='cuenta_cobrar' THEN
    PERFORM finanzas.generar_cuotas(NEW.id_cxc,NULL,NEW.monto_total,NEW.cantidad_cuotas);
  ELSE
    PERFORM finanzas.generar_cuotas(NULL,NEW.id_cxp,NEW.monto_total,NEW.cantidad_cuotas);
  END IF;
  RETURN NEW;
END $$;


--
-- Name: cuenta_sin_reprogramacion(); Type: FUNCTION; Schema: finanzas; Owner: -
--

CREATE FUNCTION finanzas.cuenta_sin_reprogramacion() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  IF NEW.cantidad_cuotas IS DISTINCT FROM OLD.cantidad_cuotas OR NEW.monto_total IS DISTINCT FROM OLD.monto_total THEN
    RAISE EXCEPTION 'No se puede cambiar el total ni reprogramar las cuotas de una cuenta registrada';
  END IF;
  RETURN NEW;
END $$;


--
-- Name: decidir_pago(bigint, bigint, boolean, text); Type: FUNCTION; Schema: finanzas; Owner: -
--

CREATE FUNCTION finanzas.decidir_pago(p_id_pago bigint, p_id_autorizador bigint, p_aprobar boolean, p_observacion text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql
    AS $$
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


--
-- Name: ejecutar_pago(bigint); Type: FUNCTION; Schema: finanzas; Owner: -
--

CREATE FUNCTION finanzas.ejecutar_pago(p_id_pago bigint) RETURNS bigint
    LANGUAGE plpgsql
    AS $$
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


--
-- Name: generar_cuotas(bigint, bigint, numeric, integer); Type: FUNCTION; Schema: finanzas; Owner: -
--

CREATE FUNCTION finanzas.generar_cuotas(p_cxc bigint, p_cxp bigint, p_total numeric, p_cantidad integer) RETURNS void
    LANGUAGE plpgsql
    AS $$
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


--
-- Name: integridad_cuotas_diferida(); Type: FUNCTION; Schema: finanzas; Owner: -
--

CREATE FUNCTION finanzas.integridad_cuotas_diferida() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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


--
-- Name: validar_aplicacion_cuota(); Type: FUNCTION; Schema: finanzas; Owner: -
--

CREATE FUNCTION finanzas.validar_aplicacion_cuota() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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


--
-- Name: validar_fila_cuota(); Type: FUNCTION; Schema: finanzas; Owner: -
--

CREATE FUNCTION finanzas.validar_fila_cuota() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
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


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: aplicacion_pago_cuota; Type: TABLE; Schema: finanzas; Owner: -
--

CREATE TABLE finanzas.aplicacion_pago_cuota (
    id_aplicacion bigint NOT NULL,
    id_pago bigint NOT NULL,
    id_cuota bigint NOT NULL,
    monto_aplicado numeric(15,2) NOT NULL,
    CONSTRAINT aplicacion_pago_cuota_monto_aplicado_check CHECK ((monto_aplicado > (0)::numeric))
);


--
-- Name: aplicacion_pago_cuota_id_aplicacion_seq; Type: SEQUENCE; Schema: finanzas; Owner: -
--

ALTER TABLE finanzas.aplicacion_pago_cuota ALTER COLUMN id_aplicacion ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME finanzas.aplicacion_pago_cuota_id_aplicacion_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: autorizacion_pago; Type: TABLE; Schema: finanzas; Owner: -
--

CREATE TABLE finanzas.autorizacion_pago (
    id_autorizacion bigint NOT NULL,
    id_pago bigint NOT NULL,
    id_autorizador bigint NOT NULL,
    decision character varying(20) NOT NULL,
    observacion text,
    fecha_autorizacion timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT autorizacion_pago_decision_check CHECK (((decision)::text = ANY ((ARRAY['aprobada'::character varying, 'rechazada'::character varying])::text[]))),
    CONSTRAINT ck_motivo_rechazo CHECK ((((decision)::text <> 'rechazada'::text) OR (NULLIF(btrim(observacion), ''::text) IS NOT NULL)))
);


--
-- Name: autorizacion_pago_id_autorizacion_seq; Type: SEQUENCE; Schema: finanzas; Owner: -
--

ALTER TABLE finanzas.autorizacion_pago ALTER COLUMN id_autorizacion ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME finanzas.autorizacion_pago_id_autorizacion_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: cuenta_cobrar; Type: TABLE; Schema: finanzas; Owner: -
--

CREATE TABLE finanzas.cuenta_cobrar (
    id_cxc bigint NOT NULL,
    id_venta bigint NOT NULL,
    id_cliente bigint NOT NULL,
    monto_total numeric(15,2) NOT NULL,
    saldo_pendiente numeric(15,2) NOT NULL,
    fecha_emision date DEFAULT CURRENT_DATE NOT NULL,
    fecha_vencimiento date,
    estado character varying(20) DEFAULT 'pendiente'::character varying NOT NULL,
    cantidad_cuotas smallint DEFAULT 1 NOT NULL,
    CONSTRAINT ck_cxc_estado_saldo CHECK (((((estado)::text = 'pagada'::text) AND (saldo_pendiente = (0)::numeric)) OR (((estado)::text = 'pendiente'::text) AND (saldo_pendiente = monto_total)) OR (((estado)::text = 'parcial'::text) AND (saldo_pendiente > (0)::numeric) AND (saldo_pendiente < monto_total)) OR ((estado)::text = 'anulada'::text))),
    CONSTRAINT cuenta_cobrar_cantidad_cuotas_check CHECK ((cantidad_cuotas > 0)),
    CONSTRAINT cuenta_cobrar_check CHECK (((saldo_pendiente >= (0)::numeric) AND (saldo_pendiente <= monto_total))),
    CONSTRAINT cuenta_cobrar_estado_check CHECK (((estado)::text = ANY ((ARRAY['pendiente'::character varying, 'parcial'::character varying, 'pagada'::character varying, 'anulada'::character varying])::text[]))),
    CONSTRAINT cuenta_cobrar_monto_total_check CHECK ((monto_total > (0)::numeric))
);


--
-- Name: cuenta_cobrar_id_cxc_seq; Type: SEQUENCE; Schema: finanzas; Owner: -
--

ALTER TABLE finanzas.cuenta_cobrar ALTER COLUMN id_cxc ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME finanzas.cuenta_cobrar_id_cxc_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: cuenta_financiera; Type: TABLE; Schema: finanzas; Owner: -
--

CREATE TABLE finanzas.cuenta_financiera (
    id_cuenta bigint NOT NULL,
    nombre character varying(100) NOT NULL,
    saldo_inicial numeric(15,2) DEFAULT 0 NOT NULL,
    moneda character(3) DEFAULT 'CLP'::bpchar NOT NULL,
    activa boolean DEFAULT true NOT NULL,
    fecha_apertura timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ck_caja_unica CHECK ((id_cuenta = 1)),
    CONSTRAINT cuenta_financiera_moneda_check CHECK ((moneda = 'CLP'::bpchar)),
    CONSTRAINT cuenta_financiera_saldo_inicial_check CHECK ((saldo_inicial >= (0)::numeric))
);


--
-- Name: cuenta_financiera_id_cuenta_seq; Type: SEQUENCE; Schema: finanzas; Owner: -
--

ALTER TABLE finanzas.cuenta_financiera ALTER COLUMN id_cuenta ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME finanzas.cuenta_financiera_id_cuenta_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: cuenta_pagar; Type: TABLE; Schema: finanzas; Owner: -
--

CREATE TABLE finanzas.cuenta_pagar (
    id_cxp bigint NOT NULL,
    id_oc bigint NOT NULL,
    id_proveedor bigint NOT NULL,
    monto_total numeric(15,2) NOT NULL,
    saldo_pendiente numeric(15,2) NOT NULL,
    fecha_emision date DEFAULT CURRENT_DATE NOT NULL,
    fecha_vencimiento date,
    estado character varying(20) DEFAULT 'pendiente'::character varying NOT NULL,
    cantidad_cuotas smallint DEFAULT 1 NOT NULL,
    CONSTRAINT ck_cxp_estado_saldo CHECK (((((estado)::text = 'pagada'::text) AND (saldo_pendiente = (0)::numeric)) OR (((estado)::text = 'pendiente'::text) AND (saldo_pendiente = monto_total)) OR (((estado)::text = 'parcial'::text) AND (saldo_pendiente > (0)::numeric) AND (saldo_pendiente < monto_total)) OR ((estado)::text = 'anulada'::text))),
    CONSTRAINT cuenta_pagar_cantidad_cuotas_check CHECK ((cantidad_cuotas > 0)),
    CONSTRAINT cuenta_pagar_check CHECK (((saldo_pendiente >= (0)::numeric) AND (saldo_pendiente <= monto_total))),
    CONSTRAINT cuenta_pagar_estado_check CHECK (((estado)::text = ANY ((ARRAY['pendiente'::character varying, 'parcial'::character varying, 'pagada'::character varying, 'anulada'::character varying])::text[]))),
    CONSTRAINT cuenta_pagar_monto_total_check CHECK ((monto_total > (0)::numeric))
);


--
-- Name: cuenta_pagar_id_cxp_seq; Type: SEQUENCE; Schema: finanzas; Owner: -
--

ALTER TABLE finanzas.cuenta_pagar ALTER COLUMN id_cxp ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME finanzas.cuenta_pagar_id_cxp_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: cuota; Type: TABLE; Schema: finanzas; Owner: -
--

CREATE TABLE finanzas.cuota (
    id_cuota bigint NOT NULL,
    id_cxc bigint,
    id_cxp bigint,
    numero smallint NOT NULL,
    monto numeric(15,2) NOT NULL,
    CONSTRAINT cuota_check CHECK ((((id_cxc IS NOT NULL) AND (id_cxp IS NULL)) OR ((id_cxp IS NOT NULL) AND (id_cxc IS NULL)))),
    CONSTRAINT cuota_monto_check CHECK ((monto > (0)::numeric)),
    CONSTRAINT cuota_numero_check CHECK ((numero > 0))
);


--
-- Name: cuota_id_cuota_seq; Type: SEQUENCE; Schema: finanzas; Owner: -
--

ALTER TABLE finanzas.cuota ALTER COLUMN id_cuota ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME finanzas.cuota_id_cuota_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: movimiento_financiero; Type: TABLE; Schema: finanzas; Owner: -
--

CREATE TABLE finanzas.movimiento_financiero (
    id_mov_fin bigint NOT NULL,
    id_pago bigint NOT NULL,
    id_cuenta bigint DEFAULT 1 NOT NULL,
    tipo_flujo character varying(10) NOT NULL,
    monto numeric(15,2) NOT NULL,
    fecha_movimiento timestamp with time zone DEFAULT now() NOT NULL,
    descripcion text,
    CONSTRAINT movimiento_financiero_monto_check CHECK ((monto > (0)::numeric)),
    CONSTRAINT movimiento_financiero_tipo_flujo_check CHECK (((tipo_flujo)::text = ANY ((ARRAY['ingreso'::character varying, 'egreso'::character varying])::text[])))
);


--
-- Name: movimiento_financiero_id_mov_fin_seq; Type: SEQUENCE; Schema: finanzas; Owner: -
--

ALTER TABLE finanzas.movimiento_financiero ALTER COLUMN id_mov_fin ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME finanzas.movimiento_financiero_id_mov_fin_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: pago; Type: TABLE; Schema: finanzas; Owner: -
--

CREATE TABLE finanzas.pago (
    id_pago bigint NOT NULL,
    id_cxc bigint,
    id_cxp bigint,
    id_empleado bigint,
    id_nomina bigint,
    id_reembolso bigint,
    tipo_operacion character varying(20) NOT NULL,
    monto numeric(15,2) NOT NULL,
    metodo_pago character varying(30) NOT NULL,
    estado character varying(20) DEFAULT 'pendiente'::character varying NOT NULL,
    fecha_solicitud timestamp with time zone DEFAULT now() NOT NULL,
    fecha_pago timestamp with time zone,
    descripcion text,
    CONSTRAINT ck_pago_fecha CHECK (((((estado)::text = 'ejecutado'::text) AND (fecha_pago IS NOT NULL)) OR (((estado)::text <> 'ejecutado'::text) AND (fecha_pago IS NULL)))),
    CONSTRAINT ck_pago_origen CHECK (((((tipo_operacion)::text = 'cobro'::text) AND (id_cxc IS NOT NULL) AND (id_cxp IS NULL) AND (id_nomina IS NULL) AND (id_empleado IS NULL) AND (id_reembolso IS NULL)) OR (((tipo_operacion)::text = 'proveedor'::text) AND (id_cxp IS NOT NULL) AND (id_cxc IS NULL) AND (id_nomina IS NULL) AND (id_empleado IS NULL) AND (id_reembolso IS NULL)) OR (((tipo_operacion)::text = 'nomina'::text) AND (id_nomina IS NOT NULL) AND (id_empleado IS NOT NULL) AND (id_cxc IS NULL) AND (id_cxp IS NULL) AND (id_reembolso IS NULL)) OR (((tipo_operacion)::text = 'reembolso'::text) AND (id_reembolso IS NOT NULL) AND (id_cxc IS NULL) AND (id_cxp IS NULL) AND (id_nomina IS NULL) AND (id_empleado IS NULL)))),
    CONSTRAINT pago_estado_check CHECK (((estado)::text = ANY ((ARRAY['pendiente'::character varying, 'aprobado'::character varying, 'rechazado'::character varying, 'ejecutado'::character varying])::text[]))),
    CONSTRAINT pago_metodo_pago_check CHECK (((metodo_pago)::text = ANY ((ARRAY['efectivo'::character varying, 'transferencia'::character varying, 'tarjeta'::character varying, 'simulado'::character varying])::text[]))),
    CONSTRAINT pago_monto_check CHECK ((monto > (0)::numeric)),
    CONSTRAINT pago_tipo_operacion_check CHECK (((tipo_operacion)::text = ANY ((ARRAY['cobro'::character varying, 'proveedor'::character varying, 'nomina'::character varying, 'reembolso'::character varying])::text[])))
);


--
-- Name: pago_id_pago_seq; Type: SEQUENCE; Schema: finanzas; Owner: -
--

ALTER TABLE finanzas.pago ALTER COLUMN id_pago ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME finanzas.pago_id_pago_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: v_cuotas; Type: VIEW; Schema: finanzas; Owner: -
--

CREATE VIEW finanzas.v_cuotas AS
 SELECT c.id_cuota,
    c.id_cxc,
    c.id_cxp,
    c.numero,
    c.monto,
    (COALESCE(a.pagado, (0)::numeric))::numeric(15,2) AS monto_pagado,
    ((c.monto - COALESCE(a.pagado, (0)::numeric)))::numeric(15,2) AS saldo_pendiente,
        CASE
            WHEN (COALESCE(a.pagado, (0)::numeric) = c.monto) THEN 'pagada'::text
            WHEN (COALESCE(a.pagado, (0)::numeric) > (0)::numeric) THEN 'parcial'::text
            ELSE 'pendiente'::text
        END AS estado
   FROM (finanzas.cuota c
     LEFT JOIN ( SELECT aplicacion_pago_cuota.id_cuota,
            sum(aplicacion_pago_cuota.monto_aplicado) AS pagado
           FROM finanzas.aplicacion_pago_cuota
          GROUP BY aplicacion_pago_cuota.id_cuota) a ON ((a.id_cuota = c.id_cuota)));


--
-- Name: v_saldo_caja; Type: VIEW; Schema: finanzas; Owner: -
--

CREATE VIEW finanzas.v_saldo_caja AS
 SELECT c.id_cuenta,
    c.nombre,
    c.moneda,
    c.saldo_inicial,
    (c.saldo_inicial + COALESCE(sum(
        CASE
            WHEN ((m.tipo_flujo)::text = 'ingreso'::text) THEN m.monto
            ELSE (- m.monto)
        END), (0)::numeric)) AS saldo_actual
   FROM (finanzas.cuenta_financiera c
     LEFT JOIN finanzas.movimiento_financiero m ON ((m.id_cuenta = c.id_cuenta)))
  GROUP BY c.id_cuenta, c.nombre, c.moneda, c.saldo_inicial;


--
-- Name: aplicacion_pago_cuota aplicacion_pago_cuota_id_pago_id_cuota_key; Type: CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.aplicacion_pago_cuota
    ADD CONSTRAINT aplicacion_pago_cuota_id_pago_id_cuota_key UNIQUE (id_pago, id_cuota);


--
-- Name: aplicacion_pago_cuota aplicacion_pago_cuota_pkey; Type: CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.aplicacion_pago_cuota
    ADD CONSTRAINT aplicacion_pago_cuota_pkey PRIMARY KEY (id_aplicacion);


--
-- Name: autorizacion_pago autorizacion_pago_id_pago_key; Type: CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.autorizacion_pago
    ADD CONSTRAINT autorizacion_pago_id_pago_key UNIQUE (id_pago);


--
-- Name: autorizacion_pago autorizacion_pago_pkey; Type: CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.autorizacion_pago
    ADD CONSTRAINT autorizacion_pago_pkey PRIMARY KEY (id_autorizacion);


--
-- Name: cuenta_cobrar cuenta_cobrar_id_venta_key; Type: CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.cuenta_cobrar
    ADD CONSTRAINT cuenta_cobrar_id_venta_key UNIQUE (id_venta);


--
-- Name: cuenta_cobrar cuenta_cobrar_pkey; Type: CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.cuenta_cobrar
    ADD CONSTRAINT cuenta_cobrar_pkey PRIMARY KEY (id_cxc);


--
-- Name: cuenta_financiera cuenta_financiera_pkey; Type: CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.cuenta_financiera
    ADD CONSTRAINT cuenta_financiera_pkey PRIMARY KEY (id_cuenta);


--
-- Name: cuenta_pagar cuenta_pagar_id_oc_key; Type: CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.cuenta_pagar
    ADD CONSTRAINT cuenta_pagar_id_oc_key UNIQUE (id_oc);


--
-- Name: cuenta_pagar cuenta_pagar_pkey; Type: CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.cuenta_pagar
    ADD CONSTRAINT cuenta_pagar_pkey PRIMARY KEY (id_cxp);


--
-- Name: cuota cuota_id_cxc_numero_key; Type: CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.cuota
    ADD CONSTRAINT cuota_id_cxc_numero_key UNIQUE (id_cxc, numero);


--
-- Name: cuota cuota_id_cxp_numero_key; Type: CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.cuota
    ADD CONSTRAINT cuota_id_cxp_numero_key UNIQUE (id_cxp, numero);


--
-- Name: cuota cuota_pkey; Type: CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.cuota
    ADD CONSTRAINT cuota_pkey PRIMARY KEY (id_cuota);


--
-- Name: movimiento_financiero movimiento_financiero_id_pago_key; Type: CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.movimiento_financiero
    ADD CONSTRAINT movimiento_financiero_id_pago_key UNIQUE (id_pago);


--
-- Name: movimiento_financiero movimiento_financiero_pkey; Type: CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.movimiento_financiero
    ADD CONSTRAINT movimiento_financiero_pkey PRIMARY KEY (id_mov_fin);


--
-- Name: pago pago_pkey; Type: CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.pago
    ADD CONSTRAINT pago_pkey PRIMARY KEY (id_pago);


--
-- Name: ix_aplicacion_cuota; Type: INDEX; Schema: finanzas; Owner: -
--

CREATE INDEX ix_aplicacion_cuota ON finanzas.aplicacion_pago_cuota USING btree (id_cuota);


--
-- Name: ix_movimiento_cuenta_fecha; Type: INDEX; Schema: finanzas; Owner: -
--

CREATE INDEX ix_movimiento_cuenta_fecha ON finanzas.movimiento_financiero USING btree (id_cuenta, fecha_movimiento);


--
-- Name: ix_pago_cxc; Type: INDEX; Schema: finanzas; Owner: -
--

CREATE INDEX ix_pago_cxc ON finanzas.pago USING btree (id_cxc);


--
-- Name: ix_pago_cxp; Type: INDEX; Schema: finanzas; Owner: -
--

CREATE INDEX ix_pago_cxp ON finanzas.pago USING btree (id_cxp);


--
-- Name: ix_pago_estado; Type: INDEX; Schema: finanzas; Owner: -
--

CREATE INDEX ix_pago_estado ON finanzas.pago USING btree (estado);


--
-- Name: ix_pago_fecha; Type: INDEX; Schema: finanzas; Owner: -
--

CREATE INDEX ix_pago_fecha ON finanzas.pago USING btree (fecha_solicitud);


--
-- Name: cuenta_cobrar crear_cuotas; Type: TRIGGER; Schema: finanzas; Owner: -
--

CREATE TRIGGER crear_cuotas AFTER INSERT ON finanzas.cuenta_cobrar FOR EACH ROW EXECUTE FUNCTION finanzas.cuenta_crea_cuotas();


--
-- Name: cuenta_pagar crear_cuotas; Type: TRIGGER; Schema: finanzas; Owner: -
--

CREATE TRIGGER crear_cuotas AFTER INSERT ON finanzas.cuenta_pagar FOR EACH ROW EXECUTE FUNCTION finanzas.cuenta_crea_cuotas();


--
-- Name: aplicacion_pago_cuota integridad_cuotas; Type: TRIGGER; Schema: finanzas; Owner: -
--

CREATE CONSTRAINT TRIGGER integridad_cuotas AFTER INSERT OR DELETE ON finanzas.aplicacion_pago_cuota DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION finanzas.integridad_cuotas_diferida();


--
-- Name: cuenta_cobrar integridad_cuotas; Type: TRIGGER; Schema: finanzas; Owner: -
--

CREATE CONSTRAINT TRIGGER integridad_cuotas AFTER INSERT OR UPDATE ON finanzas.cuenta_cobrar DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION finanzas.integridad_cuotas_diferida();


--
-- Name: cuenta_pagar integridad_cuotas; Type: TRIGGER; Schema: finanzas; Owner: -
--

CREATE CONSTRAINT TRIGGER integridad_cuotas AFTER INSERT OR UPDATE ON finanzas.cuenta_pagar DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION finanzas.integridad_cuotas_diferida();


--
-- Name: cuota integridad_cuotas; Type: TRIGGER; Schema: finanzas; Owner: -
--

CREATE CONSTRAINT TRIGGER integridad_cuotas AFTER DELETE ON finanzas.cuota DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION finanzas.integridad_cuotas_diferida();


--
-- Name: pago integridad_cuotas; Type: TRIGGER; Schema: finanzas; Owner: -
--

CREATE CONSTRAINT TRIGGER integridad_cuotas AFTER INSERT OR UPDATE ON finanzas.pago DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION finanzas.integridad_cuotas_diferida();


--
-- Name: cuenta_cobrar sin_reprogramacion; Type: TRIGGER; Schema: finanzas; Owner: -
--

CREATE TRIGGER sin_reprogramacion BEFORE UPDATE ON finanzas.cuenta_cobrar FOR EACH ROW EXECUTE FUNCTION finanzas.cuenta_sin_reprogramacion();


--
-- Name: cuenta_pagar sin_reprogramacion; Type: TRIGGER; Schema: finanzas; Owner: -
--

CREATE TRIGGER sin_reprogramacion BEFORE UPDATE ON finanzas.cuenta_pagar FOR EACH ROW EXECUTE FUNCTION finanzas.cuenta_sin_reprogramacion();


--
-- Name: aplicacion_pago_cuota validar_aplicacion; Type: TRIGGER; Schema: finanzas; Owner: -
--

CREATE TRIGGER validar_aplicacion BEFORE INSERT OR UPDATE ON finanzas.aplicacion_pago_cuota FOR EACH ROW EXECUTE FUNCTION finanzas.validar_aplicacion_cuota();


--
-- Name: cuota validar_fila_cuota; Type: TRIGGER; Schema: finanzas; Owner: -
--

CREATE TRIGGER validar_fila_cuota BEFORE INSERT OR UPDATE ON finanzas.cuota FOR EACH ROW EXECUTE FUNCTION finanzas.validar_fila_cuota();


--
-- Name: aplicacion_pago_cuota aplicacion_pago_cuota_id_cuota_fkey; Type: FK CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.aplicacion_pago_cuota
    ADD CONSTRAINT aplicacion_pago_cuota_id_cuota_fkey FOREIGN KEY (id_cuota) REFERENCES finanzas.cuota(id_cuota);


--
-- Name: aplicacion_pago_cuota aplicacion_pago_cuota_id_pago_fkey; Type: FK CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.aplicacion_pago_cuota
    ADD CONSTRAINT aplicacion_pago_cuota_id_pago_fkey FOREIGN KEY (id_pago) REFERENCES finanzas.pago(id_pago);


--
-- Name: autorizacion_pago autorizacion_pago_id_pago_fkey; Type: FK CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.autorizacion_pago
    ADD CONSTRAINT autorizacion_pago_id_pago_fkey FOREIGN KEY (id_pago) REFERENCES finanzas.pago(id_pago);


--
-- Name: cuota cuota_id_cxc_fkey; Type: FK CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.cuota
    ADD CONSTRAINT cuota_id_cxc_fkey FOREIGN KEY (id_cxc) REFERENCES finanzas.cuenta_cobrar(id_cxc);


--
-- Name: cuota cuota_id_cxp_fkey; Type: FK CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.cuota
    ADD CONSTRAINT cuota_id_cxp_fkey FOREIGN KEY (id_cxp) REFERENCES finanzas.cuenta_pagar(id_cxp);


--
-- Name: movimiento_financiero movimiento_financiero_id_cuenta_fkey; Type: FK CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.movimiento_financiero
    ADD CONSTRAINT movimiento_financiero_id_cuenta_fkey FOREIGN KEY (id_cuenta) REFERENCES finanzas.cuenta_financiera(id_cuenta);


--
-- Name: movimiento_financiero movimiento_financiero_id_pago_fkey; Type: FK CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.movimiento_financiero
    ADD CONSTRAINT movimiento_financiero_id_pago_fkey FOREIGN KEY (id_pago) REFERENCES finanzas.pago(id_pago);


--
-- Name: pago pago_id_cxc_fkey; Type: FK CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.pago
    ADD CONSTRAINT pago_id_cxc_fkey FOREIGN KEY (id_cxc) REFERENCES finanzas.cuenta_cobrar(id_cxc);


--
-- Name: pago pago_id_cxp_fkey; Type: FK CONSTRAINT; Schema: finanzas; Owner: -
--

ALTER TABLE ONLY finanzas.pago
    ADD CONSTRAINT pago_id_cxp_fkey FOREIGN KEY (id_cxp) REFERENCES finanzas.cuenta_pagar(id_cxp);


--
-- PostgreSQL database dump complete
--

\unrestrict XHhmyW4lcreRq3FymPmWIEJvXKqCkr5asffuIoMFvjvU0hxDOdMbxdDrM4UBCnc

