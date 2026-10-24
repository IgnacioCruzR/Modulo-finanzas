-- ERP académico, esquema financiero independiente para desarrollo local.
-- No ejecutar directamente sobre la base compartida del profesor sin revisar permisos y acuerdos.
CREATE SCHEMA IF NOT EXISTS finanzas;

CREATE TABLE IF NOT EXISTS finanzas.cuenta_cobrar (
  id_cxc BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_venta BIGINT NOT NULL UNIQUE, -- referencia lógica a Ventas, Sprint 3
  id_cliente BIGINT NOT NULL, -- referencia lógica a maestro Cliente, Sprint 3
  monto_total NUMERIC(15,2) NOT NULL CHECK (monto_total > 0),
  saldo_pendiente NUMERIC(15,2) NOT NULL CHECK (saldo_pendiente >= 0 AND saldo_pendiente <= monto_total),
  fecha_emision DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_vencimiento DATE,
  estado VARCHAR(20) NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','parcial','pagada','anulada')),
  CONSTRAINT ck_cxc_estado_saldo CHECK (
    (estado = 'pagada' AND saldo_pendiente = 0)
    OR (estado = 'pendiente' AND saldo_pendiente = monto_total)
    OR (estado = 'parcial' AND saldo_pendiente > 0 AND saldo_pendiente < monto_total)
    OR (estado = 'anulada')
  )
);

CREATE TABLE IF NOT EXISTS finanzas.cuenta_pagar (
  id_cxp BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_oc BIGINT NOT NULL UNIQUE, -- referencia lógica a Compras, Sprint 3
  id_proveedor BIGINT NOT NULL, -- referencia lógica a maestro Proveedor, Sprint 3
  monto_total NUMERIC(15,2) NOT NULL CHECK (monto_total > 0),
  saldo_pendiente NUMERIC(15,2) NOT NULL CHECK (saldo_pendiente >= 0 AND saldo_pendiente <= monto_total),
  fecha_emision DATE NOT NULL DEFAULT CURRENT_DATE,
  fecha_vencimiento DATE,
  estado VARCHAR(20) NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','parcial','pagada','anulada')),
  CONSTRAINT ck_cxp_estado_saldo CHECK (
    (estado = 'pagada' AND saldo_pendiente = 0)
    OR (estado = 'pendiente' AND saldo_pendiente = monto_total)
    OR (estado = 'parcial' AND saldo_pendiente > 0 AND saldo_pendiente < monto_total)
    OR (estado = 'anulada')
  )
);

CREATE TABLE IF NOT EXISTS finanzas.cuenta_financiera (
  id_cuenta BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  saldo_inicial NUMERIC(15,2) NOT NULL DEFAULT 0 CHECK (saldo_inicial >= 0),
  moneda CHAR(3) NOT NULL DEFAULT 'CLP' CHECK (moneda = 'CLP'),
  activa BOOLEAN NOT NULL DEFAULT TRUE,
  fecha_apertura TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_caja_unica CHECK (id_cuenta = 1)
);

CREATE TABLE IF NOT EXISTS finanzas.pago (
  id_pago BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_cxc BIGINT REFERENCES finanzas.cuenta_cobrar(id_cxc),
  id_cxp BIGINT REFERENCES finanzas.cuenta_pagar(id_cxp),
  id_empleado BIGINT, -- referencia lógica a RRHH
  id_nomina BIGINT, -- referencia lógica a RRHH
  id_reembolso BIGINT, -- referencia lógica a Postventa
  tipo_operacion VARCHAR(20) NOT NULL CHECK (tipo_operacion IN ('cobro','proveedor','nomina','reembolso')),
  monto NUMERIC(15,2) NOT NULL CHECK (monto > 0),
  metodo_pago VARCHAR(30) NOT NULL CHECK (metodo_pago IN ('efectivo','transferencia','tarjeta','simulado')),
  estado VARCHAR(20) NOT NULL DEFAULT 'pendiente' CHECK (estado IN ('pendiente','aprobado','rechazado','ejecutado')),
  fecha_solicitud TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  fecha_pago TIMESTAMPTZ,
  descripcion TEXT,
  CONSTRAINT ck_pago_origen CHECK (
    (tipo_operacion = 'cobro' AND id_cxc IS NOT NULL AND id_cxp IS NULL AND id_nomina IS NULL AND id_empleado IS NULL AND id_reembolso IS NULL)
    OR (tipo_operacion = 'proveedor' AND id_cxp IS NOT NULL AND id_cxc IS NULL AND id_nomina IS NULL AND id_empleado IS NULL AND id_reembolso IS NULL)
    OR (tipo_operacion = 'nomina' AND id_nomina IS NOT NULL AND id_empleado IS NOT NULL AND id_cxc IS NULL AND id_cxp IS NULL AND id_reembolso IS NULL)
    OR (tipo_operacion = 'reembolso' AND id_reembolso IS NOT NULL AND id_cxc IS NULL AND id_cxp IS NULL AND id_nomina IS NULL AND id_empleado IS NULL)
  ),
  CONSTRAINT ck_pago_fecha CHECK ((estado = 'ejecutado' AND fecha_pago IS NOT NULL) OR (estado <> 'ejecutado' AND fecha_pago IS NULL))
);

CREATE TABLE IF NOT EXISTS finanzas.autorizacion_pago (
  id_autorizacion BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_pago BIGINT NOT NULL UNIQUE REFERENCES finanzas.pago(id_pago),
  id_autorizador BIGINT NOT NULL, -- referencia lógica a usuario autenticado
  decision VARCHAR(20) NOT NULL CHECK (decision IN ('aprobada','rechazada')),
  observacion TEXT,
  fecha_autorizacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_motivo_rechazo CHECK (decision <> 'rechazada' OR NULLIF(BTRIM(observacion),'') IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS finanzas.movimiento_financiero (
  id_mov_fin BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_pago BIGINT NOT NULL UNIQUE REFERENCES finanzas.pago(id_pago),
  id_cuenta BIGINT NOT NULL DEFAULT 1 REFERENCES finanzas.cuenta_financiera(id_cuenta),
  tipo_flujo VARCHAR(10) NOT NULL CHECK (tipo_flujo IN ('ingreso','egreso')),
  monto NUMERIC(15,2) NOT NULL CHECK (monto > 0),
  fecha_movimiento TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  descripcion TEXT
);

CREATE INDEX IF NOT EXISTS ix_pago_estado ON finanzas.pago(estado);
CREATE INDEX IF NOT EXISTS ix_pago_fecha ON finanzas.pago(fecha_solicitud);
CREATE INDEX IF NOT EXISTS ix_pago_cxc ON finanzas.pago(id_cxc);
CREATE INDEX IF NOT EXISTS ix_pago_cxp ON finanzas.pago(id_cxp);
CREATE INDEX IF NOT EXISTS ix_movimiento_cuenta_fecha ON finanzas.movimiento_financiero(id_cuenta,fecha_movimiento);

INSERT INTO finanzas.cuenta_financiera (nombre,saldo_inicial,moneda)
SELECT 'Caja general ERP',10000000,'CLP'
WHERE NOT EXISTS (SELECT 1 FROM finanzas.cuenta_financiera WHERE id_cuenta = 1);

-- Esta vista refleja el saldo exclusivamente mediante movimientos registrados.
-- El backend debe garantizar que se inserten SOLO al confirmar pagos ejecutados.
CREATE OR REPLACE VIEW finanzas.v_saldo_caja AS
SELECT c.id_cuenta, c.nombre, c.moneda, c.saldo_inicial,
       c.saldo_inicial + COALESCE(SUM(CASE WHEN m.tipo_flujo='ingreso' THEN m.monto ELSE -m.monto END),0) AS saldo_actual
FROM finanzas.cuenta_financiera c
LEFT JOIN finanzas.movimiento_financiero m ON m.id_cuenta=c.id_cuenta
GROUP BY c.id_cuenta,c.nombre,c.moneda,c.saldo_inicial;
