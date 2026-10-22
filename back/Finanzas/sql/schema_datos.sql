-- =====================================================
-- ERP Legos - Módulo Finanzas - Sprint 2 (MVP)
-- Cambia "finanzas" por el nombre del esquema que asigne el profesor.
-- Si el usuario no tiene permiso para crear esquemas, comenta la línea CREATE SCHEMA.
-- =====================================================
CREATE SCHEMA IF NOT EXISTS finanzas;
SET search_path TO finanzas;

DROP TABLE IF EXISTS pago, factura, metodo_pago, cliente CASCADE;

-- Cliente simulado (en Sprint 3 vendrá del dato maestro de Ventas/Clientes)
CREATE TABLE cliente (
  id      INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre  VARCHAR(100) NOT NULL,
  email   VARCHAR(120) NOT NULL UNIQUE
);

CREATE TABLE metodo_pago (
  id      INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  nombre  VARCHAR(50) NOT NULL UNIQUE
);

CREATE TABLE factura (
  id                 INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  numero             VARCHAR(20) NOT NULL UNIQUE,
  cliente_id         INTEGER NOT NULL REFERENCES cliente(id),
  fecha_emision      DATE NOT NULL,
  fecha_vencimiento  DATE NOT NULL,
  monto_total        NUMERIC(12,2) NOT NULL CHECK (monto_total > 0),
  estado             VARCHAR(10) NOT NULL DEFAULT 'PENDIENTE'
                     CHECK (estado IN ('PENDIENTE','PARCIAL','PAGADA')),
  CHECK (fecha_vencimiento >= fecha_emision)
);

CREATE TABLE pago (
  id              INTEGER GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  factura_id      INTEGER NOT NULL REFERENCES factura(id),
  metodo_pago_id  INTEGER NOT NULL REFERENCES metodo_pago(id),
  fecha_pago      DATE NOT NULL,
  monto           NUMERIC(12,2) NOT NULL CHECK (monto > 0)
);

CREATE INDEX idx_factura_cliente ON factura(cliente_id);
CREATE INDEX idx_pago_factura ON pago(factura_id);

-- ---------- Datos iniciales (simulados) ----------
INSERT INTO cliente (nombre, email) VALUES
 ('Ana Soto','ana.soto@mail.com'),
 ('Bruno Pérez','bruno.perez@mail.com'),
 ('Carla Rojas','carla.rojas@mail.com'),
 ('Diego Muñoz','diego.munoz@mail.com'),
 ('Elena Vargas','elena.vargas@mail.com'),
 ('Felipe Castro','felipe.castro@mail.com'),
 ('Gabriela Núñez','gabriela.nunez@mail.com'),
 ('Hugo Fuentes','hugo.fuentes@mail.com'),
 ('Isidora Reyes','isidora.reyes@mail.com'),
 ('Javier Tapia','javier.tapia@mail.com');

INSERT INTO metodo_pago (nombre) VALUES
 ('Efectivo'),('Débito'),('Crédito'),('Transferencia'),('WebPay'),
 ('Mercado Pago'),('PayPal'),('Cheque'),('Gift card'),('Depósito');

INSERT INTO factura (numero, cliente_id, fecha_emision, fecha_vencimiento, monto_total) VALUES
 ('F-0001', 1, DATE '2026-09-22', DATE '2026-09-22' + 30,  45000),
 ('F-0002', 2, DATE '2026-09-25', DATE '2026-09-25' + 30, 120000),
 ('F-0003', 3, DATE '2026-09-28', DATE '2026-09-28' + 30,  89990),
 ('F-0004', 4, DATE '2026-10-01', DATE '2026-10-01' + 30,  15990),
 ('F-0005', 5, DATE '2026-10-03', DATE '2026-10-03' + 30, 250000),
 ('F-0006', 6, DATE '2026-10-05', DATE '2026-10-05' + 30,  64990),
 ('F-0007', 7, DATE '2026-10-08', DATE '2026-10-08' + 30,  32500),
 ('F-0008', 8, DATE '2026-10-10', DATE '2026-10-10' + 30, 179990),
 ('F-0009', 9, DATE '2026-10-12', DATE '2026-10-12' + 30,  22990),
 ('F-0010',10, DATE '2026-10-14', DATE '2026-10-14' + 30,  99990),
 ('F-0011', 1, DATE '2026-10-16', DATE '2026-10-16' + 30,  54990),
 ('F-0012', 2, DATE '2026-10-19', DATE '2026-10-19' + 30, 310000);

INSERT INTO pago (factura_id, metodo_pago_id, fecha_pago, monto) VALUES
 (1, 1, '2026-09-23',  45000),
 (2, 4, '2026-09-30',  60000),
 (3, 3, '2026-09-29',  89990),
 (5, 4, '2026-10-04', 250000),
 (6, 6, '2026-10-09',  30000),
 (8, 5, '2026-10-11', 179990),
 (9, 2, '2026-10-13',  22990),
 (10,7, '2026-10-18',  50000),
 (11,4, '2026-10-17',  54990),
 (12,4, '2026-10-20', 100000);

-- Dejar el estado de cada factura coherente con sus pagos
UPDATE factura f
SET estado = CASE WHEN s.total >= f.monto_total THEN 'PAGADA' ELSE 'PARCIAL' END
FROM (SELECT factura_id, SUM(monto) AS total FROM pago GROUP BY factura_id) s
WHERE s.factura_id = f.id;