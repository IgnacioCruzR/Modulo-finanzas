# Módulo de Finanzas

## Base local activa

Frontend, API y base local se inician desde la raíz con `docker compose up -d --wait`.
Abrir **http://localhost:8080** para utilizar la interfaz de demostración original.
Después de la reversión parcial, los formularios conectados, POST transaccionales
y pruebas automatizadas quedan pendientes para el equipo. NestJS conserva la
conexión, entidades, contratos y consultas GET; la base y Docker se mantienen.
Utiliza PostgreSQL 17 en `localhost:15433`, base `erp_local`, esquema `finanzas`.
Consultar [la guía local](database/local/USO_LOCAL.md) para credenciales,
persistencia y pruebas. La [API activa](back/Finanzas/v2/README.md) utiliza las
seis tablas originales más el soporte de cuotas y Administrador 1 como usuario local de prueba en
`http://localhost:3000/api/finanzas`. El Compose de `back/` corresponde al modelo
anterior y se conserva como referencia.

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
La identidad mock de consulta es Administrador 1. La base remota del
profesor no está conectada. Los archivos de modelos anteriores se conservan
como referencia, pero no deben ejecutarse sobre la base v2.

La conexión y las credenciales de PostgreSQL deben manejarse desde el backend,
nunca desde el frontend.
