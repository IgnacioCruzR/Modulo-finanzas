import { useState, type ReactNode } from 'react';

export type FinancePage = 'Dashboard' | 'Registro de pagos' | 'Emisión de informes' | 'Configuraciones';

type IconName = 'dashboard' | 'payments' | 'reports' | 'settings' | 'user' | 'bell' | 'logout';

const navigation: { page: FinancePage; label: string; icon: IconName }[] = [
  { page: 'Dashboard', label: 'Dashboard', icon: 'dashboard' },
  { page: 'Registro de pagos', label: 'Gestión de caja', icon: 'payments' },
  { page: 'Emisión de informes', label: 'Emisión de informes', icon: 'reports' },
  { page: 'Configuraciones', label: 'Configuraciones', icon: 'settings' },
];

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

export function FinanceLayout({
  activePage,
  onNavigate,
  footerNote = 'Datos de demostración',
  layoutClassName = '',
  children,
}: {
  activePage: FinancePage;
  onNavigate: (page: FinancePage) => void;
  footerNote?: string;
  layoutClassName?: string;
  children: ReactNode;
}) {
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  return (
    <div className={`dashboard-shell ${layoutClassName}`.trim()}>
      <header className="topbar">
        <a className="brand" href="#inicio" aria-label="LESGO, inicio" onClick={() => onNavigate('Dashboard')}>
          <BrandMark />
          <span>LESGO</span>
        </a>
        <nav className="header-nav" aria-label="Navegación principal">
          {navigation.map((item) => (
            <button
              className={`header-nav-link${activePage === item.page ? ' is-active' : ''}`}
              key={item.page}
              type="button"
              aria-current={activePage === item.page ? 'page' : undefined}
              onClick={() => onNavigate(item.page)}
            >
              <Icon name={item.icon} size={18} />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
        <div className="header-actions">
          <button className="header-action" type="button" aria-label="Mi Perfil">
            <Icon name="user" size={21} />
            <span className="action-label">Mi Perfil</span>
          </button>
          <div className="notification-wrap">
            <button
              className="header-action"
              type="button"
              aria-label="Notificaciones"
              aria-expanded={notificationsOpen}
              onClick={() => setNotificationsOpen((isOpen) => !isOpen)}
            >
              <Icon name="bell" size={22} />
              <span className="action-label">Notificaciones</span>
            </button>
            {notificationsOpen && (
              <div className="notification-popover" role="status">
                No tienes notificaciones nuevas.
              </div>
            )}
          </div>
          <button className="header-action" type="button" aria-label="Cerrar sesión">
            <Icon name="logout" size={21} />
            <span className="action-label">Cerrar sesión</span>
          </button>
        </div>
      </header>

      <div className="workspace">{children}</div>

      <footer className="footer">
        © 2023 Juguetes LESGO S.A. Todos los derechos reservados.
        <span>{footerNote}</span>
      </footer>
    </div>
  );
}
