import { useState } from 'react';
import './Dashboard.css';

type IconName = 'dashboard' | 'payments' | 'reports' | 'settings' | 'user' | 'bell' | 'logout';

function Icon({ name, size = 24 }: { name: IconName; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.8,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true as const,
  };

  switch (name) {
    case 'dashboard':
      return (
        <svg {...common}>
          <path d="M3 13h8V3H3v10Zm10 8h8V11h-8v10Zm0-18v6h8V3h-8ZM3 21h8v-6H3v6Z" fill="currentColor" stroke="none" />
        </svg>
      );
    case 'payments':
      return (
        <svg {...common}>
          <rect x="2.5" y="5" width="19" height="14" rx="2" />
          <path d="M3 9h18M6 15h4m-4 2h7" />
        </svg>
      );
    case 'reports':
      return (
        <svg {...common}>
          <rect x="3" y="2.5" width="18" height="19" rx="2" />
          <path d="m7 15 3-3 2 2 5-6m-1 0h3v3M7 18v-1m4 1v-3m4 3v-5m4 5v-2" />
        </svg>
      );
    case 'settings':
      return (
        <svg {...common}>
          <path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z" />
          <path d="m19.4 15 .1.1 1.2 1-1.5 2.6-1.5-.6a8 8 0 0 1-1.6.9l-.3 1.6h-3l-.3-1.6a8 8 0 0 1-1.6-.9l-1.5.6-1.5-2.6 1.2-1a7 7 0 0 1 0-1.9l-1.2-1 1.5-2.6 1.5.6a8 8 0 0 1 1.6-.9l.3-1.6h3l.3 1.6a8 8 0 0 1 1.6.9l1.5-.6 1.5 2.6-1.2 1a7 7 0 0 1 0 1.9Z" transform="translate(-1 -2)" />
        </svg>
      );
    case 'user':
      return (
        <svg {...common} fill="currentColor" stroke="none">
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21v-2a8 8 0 0 1 16 0v2H4Z" />
        </svg>
      );
    case 'bell':
      return (
        <svg {...common}>
          <path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9Zm-8 12h4" />
          <circle cx="19" cy="5" r="2" fill="#c71f1a" stroke="none" />
        </svg>
      );
    case 'logout':
      return (
        <svg {...common}>
          <path d="M10 17 15 12 10 7m5 5H3" />
          <path d="M13 3h6a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-6" />
        </svg>
      );
  }
}

function BrandMark() {
  return (
    <svg className="brand-mark" viewBox="0 0 52 48" role="img" aria-label="LESGO">
      <path d="M4 14 26 3l22 11v24L26 47 4 38V14Z" fill="#ffb900" />
      <path d="m4 14 22 10v23L4 38V14Zm22 10 22-10v24L26 47V24Z" fill="#f3a900" />
      <path d="M13 9 26 3l13 6-13 6-13-6Z" fill="#ffc928" />
      <g fill="#fff2bd" stroke="#d99500" strokeWidth="1">
        <ellipse cx="17" cy="10" rx="4" ry="2.2" />
        <ellipse cx="26" cy="6.5" rx="4" ry="2.2" />
        <ellipse cx="35" cy="10" rx="4" ry="2.2" />
        <ellipse cx="22" cy="16" rx="4" ry="2.2" />
        <ellipse cx="31" cy="16" rx="4" ry="2.2" />
      </g>
    </svg>
  );
}

const navigation: { label: string; icon: IconName }[] = [
  { label: 'Dashboard', icon: 'dashboard' },
  { label: 'Registro de pagos', icon: 'payments' },
  { label: 'Emisión de informes', icon: 'reports' },
  { label: 'Configuraciones', icon: 'settings' },
];

const monthlyData = [
  { month: 'Ene', income: 3200, expenses: 4500 },
  { month: 'Feb', income: 5200, expenses: 6800 },
  { month: 'Mar', income: 3900, expenses: 5100 },
  { month: 'Abr', income: 7900, expenses: 9800 },
  { month: 'May', income: 6800, expenses: 8100 },
  { month: 'Jun', income: 13200, expenses: 15100 },
  { month: 'Jul', income: 8600, expenses: 9200 },
  { month: 'Ago', income: 11900, expenses: 14500 },
  { month: 'Sep', income: 14800, expenses: 15900 },
  { month: 'Oct', income: 9800, expenses: 7500 },
  { month: 'Nov', income: 12100, expenses: 6200 },
  { month: 'Dic', income: 8200, expenses: 13800 },
];

const chart = {
  left: 66,
  right: 780,
  top: 28,
  bottom: 246,
  max: 20000,
};

function chartY(value: number) {
  return chart.bottom - (value / chart.max) * (chart.bottom - chart.top);
}

function MonthlyChart() {
  const [showOptions, setShowOptions] = useState(false);
  const plotWidth = chart.right - chart.left;
  const groupWidth = plotWidth / monthlyData.length;
  const incomeLine = monthlyData
    .map((item, index) => `${chart.left + groupWidth * (index + 0.5)},${chartY(item.income)}`)
    .join(' ');
  const expenseLine = monthlyData
    .map((item, index) => `${chart.left + groupWidth * (index + 0.5)},${chartY(item.expenses)}`)
    .join(' ');

  return (
    <section className="chart-card" aria-labelledby="chart-title">
      <div className="chart-heading">
        <h2 id="chart-title">Ingresos vs. Gastos Mensuales</h2>
        <div className="chart-actions">
          <button
            className="icon-button chart-menu-button"
            type="button"
            aria-label="Opciones del gráfico"
            aria-expanded={showOptions}
            onClick={() => setShowOptions((isOpen) => !isOpen)}
          >
            <span aria-hidden="true">•••</span>
          </button>
          {showOptions && (
            <div className="chart-options" role="status">
              <span>Periodo: últimos 12 meses</span>
            </div>
          )}
        </div>
      </div>
      <div className="chart-scroll">
        <svg className="monthly-chart" viewBox="0 0 930 280" role="img" aria-labelledby="chart-title chart-description">
          <desc id="chart-description">
            Comparación mensual de ingresos y gastos en pesos. Las barras muestran los valores mensuales y las líneas su
            tendencia.
          </desc>
          {[0, 5000, 10000, 15000, 20000].map((value) => {
            const y = chartY(value);
            return (
              <g key={value}>
                <line x1={chart.left} y1={y} x2={chart.right} y2={y} className="chart-grid" />
                <text x={chart.left - 9} y={y + 4} className="chart-axis-label" textAnchor="end">
                  ${value.toLocaleString('es-CL')}
                </text>
              </g>
            );
          })}
          {monthlyData.map((item, index) => {
            const center = chart.left + groupWidth * (index + 0.5);
            const incomeY = chartY(item.income);
            const expenseY = chartY(item.expenses);
            return (
              <g key={item.month}>
                <rect
                  x={center - 19}
                  y={incomeY}
                  width="27"
                  height={chart.bottom - incomeY}
                  rx="3"
                  className="chart-bar-income"
                />
                <rect
                  x={center + 10}
                  y={expenseY}
                  width="27"
                  height={chart.bottom - expenseY}
                  rx="3"
                  className="chart-bar-expense"
                />
                <text x={center + 9} y={chart.bottom + 23} className="chart-month-label" textAnchor="middle">
                  {item.month}
                </text>
              </g>
            );
          })}
          <polyline points={incomeLine} className="chart-line-income" />
          <polyline points={expenseLine} className="chart-line-expense" />
          <g className="chart-legend">
            <line x1="800" y1="128" x2="822" y2="128" className="chart-line-income" />
            <text x="830" y="133">Ingresos</text>
            <line x1="800" y1="154" x2="822" y2="154" className="chart-line-expense" />
            <text x="830" y="159">Gastos</text>
          </g>
        </svg>
      </div>
    </section>
  );
}

function Dashboard() {
  const [activePage, setActivePage] = useState('Dashboard');
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  return (
    <div className="dashboard-shell">
      <header className="topbar">
        <a className="brand" href="#inicio" aria-label="LESGO, inicio">
          <BrandMark />
          <span>LESGO</span>
        </a>
        <div className="header-divider" />
        <h1>Panel de Control Financiero</h1>
        <div className="header-actions">
          <button className="header-action" type="button">
            <Icon name="user" size={21} />
            <span>Mi Perfil</span>
          </button>
          <div className="notification-wrap">
            <button
              className="header-action"
              type="button"
              aria-expanded={notificationsOpen}
              onClick={() => setNotificationsOpen((isOpen) => !isOpen)}
            >
              <Icon name="bell" size={22} />
              <span>Notificaciones</span>
            </button>
            {notificationsOpen && (
              <div className="notification-popover" role="status">
                No tienes notificaciones nuevas.
              </div>
            )}
          </div>
          <button className="header-action" type="button">
            <Icon name="logout" size={21} />
            <span>Cerrar sesión</span>
          </button>
        </div>
      </header>

      <div className="workspace">
        <aside className="sidebar" aria-label="Navegación principal">
          <nav className="sidebar-nav">
            {navigation.map((item) => (
              <button
                className={`nav-card${activePage === item.label ? ' is-active' : ''}`}
                key={item.label}
                type="button"
                aria-current={activePage === item.label ? 'page' : undefined}
                onClick={() => setActivePage(item.label)}
              >
                <Icon name={item.icon} size={48} />
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
        </aside>

        <main className="dashboard-content">
          <section className="metrics-grid" aria-label="Resumen financiero">
            <article className="metric-card">
              <h2>Ingresos Totales</h2>
              <p className="metric-value">$145,280.00 <span className="metric-change is-positive">+12%</span></p>
            </article>
            <article className="metric-card">
              <h2>Gastos Operativos</h2>
              <p className="metric-value">$72,150.00 <span className="metric-change is-negative">+8%</span></p>
            </article>
            <article className="metric-card">
              <h2>Beneficio Neto</h2>
              <p className="metric-value">$73,130.00 <span className="metric-change is-positive">+15%</span></p>
            </article>
          </section>

          <article className="metric-card net-summary">
            <h2>Beneficio Neto</h2>
            <p className="metric-value">$73,130.00 <span className="metric-change is-positive">+15%</span></p>
          </article>

          <MonthlyChart />
        </main>
      </div>

      <footer className="footer">
        © 2023 Juguetes LESGO S.A. Todos los derechos reservados.
        <span>Datos de demostración</span>
      </footer>
    </div>
  );
}

export default Dashboard;
