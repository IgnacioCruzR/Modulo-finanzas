import { useState } from 'react';
import { FinanceLayout, type FinancePage } from '../../shared/layout/FinanceLayout';
import './Dashboard.css';

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
        <svg
          className="monthly-chart"
          viewBox="0 0 930 280"
          preserveAspectRatio="none"
          role="img"
          aria-labelledby="chart-title chart-description"
        >
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

function Dashboard({ onNavigate }: { onNavigate: (page: FinancePage) => void }) {
  return (
    <FinanceLayout activePage="Dashboard" onNavigate={onNavigate}>
        <main className="dashboard-content">
          <div className="page-heading">
            <div>
              <p className="page-eyebrow">LESGO · MÓDULO FINANCIERO</p>
              <h1>Panel de Control Financiero</h1>
            </div>
            <span className="period-badge">Resumen anual</span>
          </div>
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
    </FinanceLayout>
  );
}

export default Dashboard;
