# Módulo de Finanzas

## Base local activa

Frontend, API y base local se inician desde la raíz con `docker compose up -d --wait`.
Abrir **http://localhost:8080** para utilizar la interfaz de demostración original.
La API de NestJS ofrece consultas de cuentas por cobrar y el flujo transaccional de
pagos en tres pasos: crear la solicitud, aprobarla y ejecutarla.
Utiliza PostgreSQL 17 en `localhost:15433`, base `erp_local`, esquema `finanzas`.
Consultar [la guía local](database/local/USO_LOCAL.md) para credenciales,
persistencia y pruebas. La [API activa](back/Finanzas/v2/README.md) utiliza las
seis tablas originales más el soporte de cuotas y Administrador 1 como usuario local de prueba en
`http://localhost:3000/api/finanzas`. El Compose de `back/` corresponde al modelo
anterior y se conserva como referencia.

## API Sprint 2

Las rutas usan el prefijo `/api/finanzas`.

- `GET /cuentas-cobrar`: lista las cuentas por cobrar.
- `GET /cuentas-cobrar/:id`: consulta una cuenta y sus cuotas.
- `POST /pagos`: crea una solicitud pendiente.
- `POST /pagos/:id/decision`: aprueba o rechaza la solicitud.
- `POST /pagos/:id/ejecutar`: ejecuta el pago aprobado, registra el movimiento
  financiero y actualiza el saldo y las aplicaciones a cuotas.

La ruta de decisión recibe `{"decision":"aprobada"}` o
`{"decision":"rechazada","observacion":"Motivo"}`. La ruta de ejecución recibe
un cuerpo vacío `{}`. El backend usa `/decision` y `/cuentas-cobrar`; no expone
las rutas `/aprobar` ni `/cuentas-por-cobrar`.

**Nota técnica:** `finanzas.cuenta_financiera` tiene una restricción de caja única:
`id_cuenta = 1`.

Proyecto del módulo financiero del ERP.

## Estructura del repositorio

```text
Modulo-finanzas/
├── front/       # Aplicación web en React, TypeScript y Vite
├── back/        # API y lógica de negocio del servidor
├── database/    # Migraciones y scripts de PostgreSQL
└── README.md    # Guía general del proyecto
```

## Frontend

Para trabajar en la aplicación web:

```bash
cd front
npm install
npm run dev
```

Consulta [front/README.md](front/README.md) para conocer su estructura y comandos.

## Backend y base de datos

La API NestJS con TypeORM usa el modelo base y la ampliación de cuotas de `database/local/sql/`.
La identidad mock local es Administrador 1. La base remota del
profesor no está conectada. Los archivos de modelos anteriores se conservan
como referencia, pero no deben ejecutarse sobre la base v2.

La conexión y las credenciales de PostgreSQL deben manejarse desde el backend,
nunca desde el frontend.
