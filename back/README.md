# Backend – Módulo de Finanzas


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


### Variables solo para Docker Compose

Definen el PostgreSQL **local** que levanta `docker-compose.yml`. Si no las defines, se usan los valores por defecto indicados.

| Variable | Valor por defecto |
|---|---|
| `POSTGRES_DB` | `erp_legos` |
| `POSTGRES_USER` | `erp` |
| `POSTGRES_PASSWORD` | `erp_pass` |

> Con Docker Compose, la API **ignora** `DB_HOST`, `DB_USER`, etc. del `.env`: el compose las define por su cuenta para que apunten al contenedor `db`. Las `DB_*` del `.env` se usan al ejecutar sin Docker

## 4. Opción A: ejecutar con Docker (recomendada)

Levanta PostgreSQL local con los datos ya cargados y la API, sin instalar nada más.

```bash
docker compose up --build
```

La primera vez, PostgreSQL ejecuta automáticamente `sql/schema_datos.sql`, que crea el esquema, las tablas y más de 10 registros por tabla. La API queda disponible en **http://localhost:3000**.

Prueba rápida: abre http://localhost:3000/facturas en el navegador; debe mostrar una lista de facturas en JSON.

Comandos útiles:

```bash
docker compose up -d --build   # levantar en segundo plano
docker compose logs -f api     # ver los logs de la API
docker compose down            # apagar (conserva los datos)
docker compose down -v         # apagar y BORRAR los datos (para recargar el SQL desde cero)
```

> El script SQL solo se ejecuta cuando el volumen de datos está vacío. Si modificas el script, necesitas `docker compose down -v` y volver a levantar para que se aplique.

## 5. Opción B: ejecutar sin Docker contra una BD existente

Sirve para desarrollar con recarga automática o para conectarse a la **base de datos de AWS** del curso.

1. Instala dependencias:
   ```bash
   npm install
   ```
2. Completa tu `.env` con los datos de conexión (host, usuario, contraseña, esquema asignado). Para AWS usa `DB_SSL=true`.
3. Asegúrate de que el esquema y las tablas existan (ver [sección 6](#6-cargar-el-esquema-y-los-datos-iniciales)).
4. Inicia la API:
   ```bash
   npm run start:dev      # desarrollo, con recarga automática
   # o bien:
   npm run build && npm run start:prod
   ```

**Variante: PostgreSQL en Docker y API en tu máquina.** Levanta solo la base de datos y apunta tu `.env` a ella:

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
DB_SSL=false
```


> **Nota de seguridad:** no subas `.env` al repositorio ni compartas credenciales por chats públicos. Cada integrante debe crear su propio `.env` local a partir de `.env.example`.