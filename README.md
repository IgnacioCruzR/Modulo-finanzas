# Módulo de Finanzas

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

Las carpetas [back](back/README.md) y [database](database/README.md) están
preparadas para organizar la API, las migraciones y los scripts de PostgreSQL.
La base indicada para el proyecto usa el esquema `finanzas` y permite consultar
entidades comunes del esquema `public`. La documentación recibida no incluye el
detalle de las tablas y columnas.

La conexión y las credenciales de PostgreSQL deben manejarse desde el backend,
nunca desde el frontend.
