# Frontend

Aplicación web del módulo financiero, construida con React, TypeScript y Vite.

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
