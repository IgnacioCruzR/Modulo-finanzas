import { useState } from 'react';
import Dashboard from '../features/dashboard/Dashboard';
import CashManagementPage from '../features/payments/CashManagementPage';
import PaymentRequestPage from '../features/payments/PaymentRequestPage';
import ReportsPage from '../features/reports/ReportsPage';
import SettingsPage from '../features/settings/SettingsPage';
import { FinanceLayout, type FinancePage } from '../shared/layout/FinanceLayout';

function App() {
  const [activePage, setActivePage] = useState<FinancePage>('Dashboard');

  if (activePage === 'Dashboard') {
    return <Dashboard onNavigate={setActivePage} />;
  }

  if (activePage === 'Registro de pagos') {
    return <CashManagementPage onNavigate={setActivePage} />;
  }

  if (activePage === 'Registrar pago') {
    return <PaymentRequestPage onNavigate={setActivePage} />;
  }

  if (activePage === 'Emisión de informes') {
    return <ReportsPage onNavigate={setActivePage} />;
  }

  if (activePage === 'Configuraciones') {
    return <SettingsPage onNavigate={setActivePage} />;
  }

  return (
    <FinanceLayout activePage={activePage} onNavigate={setActivePage}>
      <main className="dashboard-content">
        <div className="page-heading">
          <div>
            <p className="page-eyebrow">LESGO · MÓDULO FINANCIERO</p>
            <h1>{activePage}</h1>
          </div>
        </div>
        <section className="metric-card">
          <h2>Sección en preparación</h2>
          <p className="payments-subtitle">Esta pestaña estará disponible en una próxima etapa.</p>
        </section>
      </main>
    </FinanceLayout>
  );
}

export default App;
