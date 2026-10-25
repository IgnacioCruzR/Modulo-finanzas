# Frontend

Aplicación web del módulo financiero, construida con React, TypeScript y Vite.

## Estado actual después de la reversión parcial

Se restauró la interfaz original del equipo. No está conectada a la base local:
las operaciones de caja usan la demostración en `localStorage`. Se retiraron
nuestro formulario conectado, el cliente compartido y las pruebas automatizadas
para que el equipo implemente esas tareas. Los archivos originales se conservan.

Docker continúa disponible: desde la raíz, `docker compose up -d --wait` y abrir
http://localhost:8080. Para reconstruir con la CA local de este equipo:
`docker compose -f compose.yaml -f compose.ca.yaml build` y luego
`docker compose up -d --no-build --wait`.

La API NestJS activa permite consultar cuentas por cobrar y procesar pagos en
tres pasos: crear una solicitud, aprobarla o rechazarla y ejecutarla. El frontend
de demostración descrito aquí aún no consume esos endpoints. La base conserva
sus cuentas, cuotas, aplicaciones, funciones y datos anteriores.

La API expone `GET /api/finanzas/cuentas-cobrar`,
`POST /api/finanzas/pagos`,
`POST /api/finanzas/pagos/:id/decision` y
`POST /api/finanzas/pagos/:id/ejecutar`. El backend no expone
`/pagos/:id/aprobar` ni `/cuentas-por-cobrar`.

**Nota técnica:** `finanzas.cuenta_financiera` opera con una única caja,
restringida a `id_cuenta = 1`.

La vista inicial presenta el dashboard del mockup con indicadores y un gráfico
mensual de demostración; los datos se reemplazarán por información de la API
cuando el backend esté disponible.

## Requisitos

- Node.js 20.19+ o 22.12+
- npm

## Comandos

Desde esta carpeta:

```bash
npm install
npm run dev
```

Otros comandos disponibles:

```bash
npm run build
npm run preview
```

## Gestión de caja

La pestaña visible como «Gestión de caja» usa movimientos y decisiones demostrativos
guardados en `localStorage` en esta versión. Autorizar o rechazar solo cambia el estado
de la simulación; no ejecuta pagos, no actualiza saldos ni constituye autorización real.
Las solicitudes manuales también se crean como pendientes demostrativas.

## Registrar pago

La pestaña «Registrar pago» (`src/features/payments/PaymentRequestPage.tsx`) es la
maqueta del formulario transaccional para `POST /api/finanzas/pagos`. Valida en el
cliente las mismas reglas de `CrearPagoDto` (tipo de operación y sus referencias
excluyentes, monto positivo con hasta dos decimales y sin superar el saldo de la
cuenta, método de pago y largo de la descripción); las reglas están en
`paymentRequest.validation.ts`. Usa cuentas de ejemplo (`paymentRequest.mock.ts`) y
todavía no envía la solicitud: para conectarla basta reemplazar
`submitPaymentRequest` por la llamada a la API.

El flujo de pagos anterior permanece en `src/features/payments/PaymentsPage.tsx` y
conserva su servicio/API, pero no es la interfaz actualmente enlazada en la navegación.
La gestión de caja todavía no consume endpoints.

Las autorizaciones reales requieren identidad, permisos y validaciones en el backend
antes de conectarse a cualquier módulo o flujo financiero.

## Estructura

```text
front/
├── src/
│   ├── app/                    # Arranque y configuración de la aplicación
│   ├── assets/                 # Recursos estáticos
│   ├── features/
│   │   ├── dashboard/          # Panel e indicadores financieros
│   │   ├── payments/           # Registro de pagos
│   │   ├── reports/            # Emisión y consulta de informes
│   │   └── settings/           # Configuración del módulo
│   ├── shared/
│   │   ├── components/         # Componentes reutilizables
│   │   ├── hooks/              # Hooks reutilizables
│   │   ├── layout/             # Estructura visual compartida
│   │   ├── services/api/       # Cliente para la API del backend
│   │   ├── types/              # Tipos compartidos
│   │   └── utils/              # Funciones auxiliares
│   └── main.tsx                # Punto de entrada de Vite
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

El frontend consumirá la API del backend. No debe conectarse directamente a
PostgreSQL ni almacenar credenciales de base de datos.
