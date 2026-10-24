# Backend – Módulo de Finanzas

## Modelo activo: Finanzas v2

La API activa usa el modelo Finanzas v2, conexión TypeORM y Administrador 1
como usuario mock local. Desde la raíz: `docker compose up -d --wait`.
Contrato, configuración y endpoints en [Finanzas/v2/README.md](Finanzas/v2/README.md).
El frontend original está en http://localhost:8080 y funciona en modo demostración;
no consume todavía los endpoints de esta API.

## API Sprint 2

Todas las rutas tienen el prefijo `/api/finanzas`.

- `GET /cuentas-cobrar`: lista las cuentas por cobrar.
- `GET /cuentas-cobrar/:id`: consulta la cuenta con sus cuotas.
- `POST /pagos`: crea una solicitud pendiente.
- `POST /pagos/:id/decision`: aprueba o rechaza el pago.
- `POST /pagos/:id/ejecutar`: ejecuta el pago aprobado, crea el movimiento
  financiero y aplica el pago a la deuda y sus cuotas.

La ruta de decisión usa el segmento `/decision` (no `/aprobar`) y el listado
usa `/cuentas-cobrar` (no `/cuentas-por-cobrar`).

**Nota técnica:** `finanzas.cuenta_financiera` permite una sola caja, con
`id_cuenta = 1`.

## Documentación del modelo anterior (referencia)

El contenido siguiente se conserva para el trabajo previo del equipo. Sus
entidades y rutas no se registran en la API v2 y su Compose no se usa con la base
actual. No ejecutar sus scripts de creación sobre la base v2.


## 1. Requisitos

| Herramienta | Para qué | Versión sugerida |
|---|---|---|
| [Docker Desktop](https://www.docker.com/products/docker-desktop/) | Opción A (API + PostgreSQL en contenedores) | Última estable |
| [Node.js](https://nodejs.org/) | Opción B (ejecutar sin Docker) | 20 LTS o superior |
| Git | Clonar el repositorio | — |
| [DBeaver](https://dbeaver.io/) o pgAdmin | Opcional, para ver las tablas | — |

## 2. Estructura del backend del proyecto

```
back/
├── Finanzas/
│    ├── dto/
│    │    └── finanzas.dto.ts        # Validación de los datos de entrada
│    ├── sql/
│    │    └── schema_datos.sql      # Crea esquema, tablas y datos iniciales
│    ├── finanzas.entities.ts   # Entidades (Cliente, MetodoPago, Factura, Pago)
│    ├── finanzas.controller.ts # Rutas HTTP
│    ├── finanzas.service.ts    # Lógica de negocio y acceso a datos
│    └── finanzas.module.ts
├── main.ts                    # Arranque: CORS y validación global
├── app.module.ts              # Módulo raíz y conexión TypeORM a PostgreSQL
├── Dockerfile                     # Imagen de la API
├── docker-compose.yml             # API + PostgreSQL
└── README.md
```

## 3. Variables de entorno

La configuración se lee desde un archivo `.env` en la raíz del proyecto. **Este archivo contiene credenciales: nunca se sube a Git** (verifica que `.env` esté en el `.gitignore`).



## 4.Conexión a la base de datos

Sirve para desarrollar con recarga automática o para conectarse a la **base de datos de AWS** del curso.

1. Instala dependencias:
   ```bash
   npm install
   ```
2. Completa tu `.env` con los datos de conexión (host, usuario, contraseña, esquema asignado). Para AWS usa `DB_SSL=true`.
3. Asegúrate de que el esquema y las tablas existan.
4. Inicia la API:
   ```bash
   npm run start:dev      # desarrollo, con recarga automática
   # o bien:
   npm run build && npm run start:prod
   ```

```bash
docker compose up -d db
```

```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=#####
DB_USER=#####
DB_PASSWORD=#####
DB_SCHEMA=finanzas
DB_SSL=true
```
> **Nota de seguridad:** no subas `.env` al repositorio ni compartas credenciales por chats públicos. Cada integrante debe crear su propio `.env` local a partir de `.env.example`.

## Registro de egresos del modelo anterior

La API expone `GET /payments/obligations`, `GET /payments/summary`, `GET /payments`,
`GET /payments/:id` y `POST /payments`. El POST requiere el encabezado
`Idempotency-Key` (UUID) y registra el movimiento, el pago y el saldo dentro de una
transacción PostgreSQL. Estas rutas usan tablas nuevas y separadas de las facturas
de clientes existentes.

Antes de activar `VITE_PAYMENTS_MODE=api` en el frontend, revisa y aplica
manualmente `database/migrations/20261023_outgoing_payments.sql` en el esquema
`finanzas`, y carga obligaciones reales desde Compras o Recursos Humanos. La
migración no se ejecuta al iniciar la API y no incorpora datos ficticios.

Este backend todavía no tiene autenticación ni control de roles; proteger las rutas
para administradores antes de habilitarlas en un entorno compartido.
