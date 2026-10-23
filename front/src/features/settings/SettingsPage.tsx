import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { FinanceLayout, type FinancePage } from '../../shared/layout/FinanceLayout';
import {
  demoUsers,
  initialPreferences,
  initialRolePermissions,
  integrations,
  permissionDefinitions,
  type DemoRole,
  type DemoUser,
  type GeneralPreferences,
  type IntegrationDefinition,
  type SettingsSection,
} from './settings.mock';
import './SettingsPage.css';

function SettingsIcon({ name, size = 20 }: { name: string; size?: number }) {
  const shared = {
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
  if (name === 'general') return <svg {...shared}><path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z" /><path d="m19.4 15 1.2 1-1.5 2.6-1.5-.6a8 8 0 0 1-1.6.9l-.3 1.6h-3l-.3-1.6a8 8 0 0 1-1.6-.9l-1.5.6-1.5-2.6 1.2-1a7 7 0 0 1 0-1.9l-1.2-1 1.5-2.6 1.5.6a8 8 0 0 1 1.6-.9l.3-1.6h3l.3 1.6a8 8 0 0 1 1.6.9l1.5-.6 1.5 2.6-1.2 1a7 7 0 0 1 0 1.9Z" transform="translate(-1 -2)" /></svg>;
  if (name === 'users') return <svg {...shared}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20v-1.5a6.5 6.5 0 0 1 13 0V20h-13Zm14-9a3 3 0 1 0-1.5-5.6M18 14a5 5 0 0 1 3.5 4.8V20H18" /></svg>;
  if (name === 'integration') return <svg {...shared}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /><path d="M14 6.5h3a2 2 0 0 1 2 2v2M10 17.5H7a2 2 0 0 1-2-2v-2" /></svg>;
  if (name === 'info') return <svg {...shared}><circle cx="12" cy="12" r="9" /><path d="M12 11v5m0-8h.01" /></svg>;
  if (name === 'save') return <svg {...shared}><path d="M5 3h12l3 3v15H4V3h1Z" /><path d="M8 3v6h8V3m-8 18v-7h8v7" /></svg>;
  if (name === 'reset') return <svg {...shared}><path d="M20 7v5h-5M4 17v-5h5" /><path d="M5.6 9A7 7 0 0 1 18 6l2 6M4 12l2 6a7 7 0 0 0 12.4-3" /></svg>;
  if (name === 'search') return <svg {...shared}><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 5 5" /></svg>;
  if (name === 'eye') return <svg {...shared}><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" /><circle cx="12" cy="12" r="2.5" /></svg>;
  if (name === 'close') return <svg {...shared}><path d="m6 6 12 12M18 6 6 18" /></svg>;
  if (name === 'sales') return <svg {...shared}><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V10Z" /><path d="M9 21v-7h6v7M3 10h18" /></svg>;
  if (name === 'purchases') return <svg {...shared}><path d="M3 4h2l2.3 11.5a2 2 0 0 0 2 1.5h8.4a2 2 0 0 0 1.9-1.4L22 8H6" /><circle cx="10" cy="20" r="1" /><circle cx="18" cy="20" r="1" /></svg>;
  if (name === 'hr') return <svg {...shared}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20v-1.5a6.5 6.5 0 0 1 13 0V20h-13Zm13-8 2 2 4-4" /></svg>;
  return <svg {...shared}><path d="m5 12 4 4L19 6" /></svg>;
}

function DemoModal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [onClose]);

  return (
    <div className="settings-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-modal-title">
        <header className="settings-modal-header">
          <div><p>LESGO · MODO DE DEMOSTRACIÓN</p><h2 id="settings-modal-title">{title}</h2></div>
          <button className="settings-icon-button" type="button" aria-label="Cerrar ventana" onClick={onClose}><SettingsIcon name="close" /></button>
        </header>
        <div className="settings-modal-content">{children}</div>
      </section>
    </div>
  );
}

function GeneralSettings({
  preferences,
  setPreferences,
  savedPreferences,
  setSavedPreferences,
}: {
  preferences: GeneralPreferences;
  setPreferences: (value: GeneralPreferences) => void;
  savedPreferences: GeneralPreferences;
  setSavedPreferences: (value: GeneralPreferences) => void;
}) {
  const [notice, setNotice] = useState('');
  const dirty = JSON.stringify(preferences) !== JSON.stringify(savedPreferences);

  function updatePreference<K extends keyof GeneralPreferences>(key: K, value: GeneralPreferences[K]) {
    setPreferences({ ...preferences, [key]: value });
    setNotice('');
  }

  function save() {
    setSavedPreferences(preferences);
    setNotice('Preferencias guardadas en el estado demostrativo de esta sesión. No se modificó la configuración real del ERP.');
  }

  function reset() {
    if (dirty && !window.confirm('Hay cambios sin guardar. ¿Quieres descartarlos y restablecer los valores iniciales?')) return;
    setPreferences(initialPreferences);
    setSavedPreferences(initialPreferences);
    setNotice('Se restablecieron los valores iniciales de demostración.');
  }

  return (
    <div className="settings-section-content">
      <div className="settings-section-heading">
        <div><p className="settings-kicker">PREFERENCIAS DEL MÓDULO</p><h2>Configuración general</h2><p>Define cómo se presenta la información financiera en esta interfaz.</p></div>
        {dirty && <span className="settings-unsaved"><i />Cambios sin guardar</span>}
      </div>

      <article className="settings-card module-info-card">
        <div className="settings-card-heading"><span className="settings-icon-tile"><SettingsIcon name="general" /></span><div><h3>Información del módulo</h3><p>Datos informativos del entorno actual</p></div></div>
        <div className="module-info-grid">
          <div><span>Nombre del módulo</span><strong>Finanzas</strong></div>
          <div><span>Sistema</span><strong>ERP LESGO</strong></div>
          <div><span>Estado</span><strong className="module-state"><i />Demostración</strong></div>
        </div>
      </article>

      <form className="settings-card preference-card" onSubmit={(event) => { event.preventDefault(); save(); }}>
        <div className="settings-card-heading"><span className="settings-icon-tile gold"><SettingsIcon name="general" /></span><div><h3>Preferencias generales</h3><p>Estos valores se aplican solo a esta vista de demostración.</p></div></div>
        <div className="preference-grid">
          <label className="settings-field"><span>Moneda de visualización</span><select value={preferences.currency} onChange={(event) => updatePreference('currency', event.target.value)}><option value="CLP">Peso chileno (CLP)</option><option value="USD">Dólar estadounidense (USD)</option><option value="EUR">Euro (EUR)</option></select><small>No convierte los importes contables.</small></label>
          <label className="settings-field"><span>Formato de fecha</span><select value={preferences.dateFormat} onChange={(event) => updatePreference('dateFormat', event.target.value)}><option>DD/MM/AAAA</option><option>AAAA-MM-DD</option></select></label>
          <label className="settings-field"><span>Zona horaria</span><select value={preferences.timezone} onChange={(event) => updatePreference('timezone', event.target.value)}><option>America/Santiago</option><option>America/Bogota</option><option>UTC</option></select></label>
          <label className="settings-field"><span>Registros por página</span><select value={preferences.pageSize} onChange={(event) => updatePreference('pageSize', event.target.value)}><option value="10">10 registros</option><option value="25">25 registros</option><option value="50">50 registros</option></select></label>
        </div>
        <div className="settings-actions-row">
          <button className="settings-button subtle" type="button" onClick={reset}><SettingsIcon name="reset" size={17} />Restablecer valores</button>
          <button className="settings-button primary" type="submit" disabled={!dirty}><SettingsIcon name="save" size={17} />Guardar cambios</button>
        </div>
        {notice && <p className="settings-inline-notice" role="status"><SettingsIcon name="info" size={17} />{notice}</p>}
      </form>
      <p className="settings-demo-notice"><SettingsIcon name="info" size={16} />Las preferencias no se almacenan en el servidor y se perderán al cerrar o recargar la aplicación.</p>
    </div>
  );
}

function UsersAndPermissions({
  rolePermissions,
  setRolePermissions,
}: {
  rolePermissions: Record<DemoRole, string[]>;
  setRolePermissions: (permissions: Record<DemoRole, string[]>) => void;
}) {
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('Todos');
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [selectedUserId, setSelectedUserId] = useState(demoUsers[0].id);
  const [editingUser, setEditingUser] = useState<DemoUser | null>(null);
  const [draftPermissions, setDraftPermissions] = useState<string[]>([]);
  const [notice, setNotice] = useState('');
  const filteredUsers = useMemo(() => demoUsers.filter((user) => {
    const search = query.trim().toLocaleLowerCase('es-CL');
    const matchesSearch = !search || user.name.toLocaleLowerCase('es-CL').includes(search) || user.email.toLocaleLowerCase('es-CL').includes(search);
    const matchesRole = roleFilter === 'Todos' || user.role === roleFilter;
    const matchesStatus = statusFilter === 'Todos' || (statusFilter === 'Activo' ? user.active : !user.active);
    return matchesSearch && matchesRole && matchesStatus;
  }), [query, roleFilter, statusFilter]);
  const selectedUser = demoUsers.find((user) => user.id === selectedUserId) ?? demoUsers[0];

  function openEditor(user: DemoUser) {
    setSelectedUserId(user.id);
    setEditingUser(user);
    setDraftPermissions([...rolePermissions[user.role]]);
    setNotice('');
  }

  function closeEditor() {
    if (editingUser && JSON.stringify(draftPermissions) !== JSON.stringify(rolePermissions[editingUser.role])
      && !window.confirm('Descartar los cambios demostrativos de permisos?')) return;
    setEditingUser(null);
  }

  function savePermissions() {
    if (!editingUser) return;
    setRolePermissions({ ...rolePermissions, [editingUser.role]: draftPermissions });
    setNotice(`Permisos demostrativos actualizados para el rol ${editingUser.role}. Esto no cambia la autorización real del sistema.`);
    setEditingUser(null);
  }

  function togglePermission(permissionId: string) {
    setDraftPermissions((current) => current.includes(permissionId)
      ? current.filter((id) => id !== permissionId)
      : [...current, permissionId]);
  }

  return (
    <div className="settings-section-content">
      <div className="settings-section-heading">
        <div><p className="settings-kicker">ACCESO DEMOSTRATIVO</p><h2>Usuarios y permisos</h2><p>Explora cómo podrían organizarse los accesos al módulo financiero.</p></div>
        <span className="settings-readonly-badge"><SettingsIcon name="info" size={15} />Solo demostración</span>
      </div>
      <div className="user-role-cards">
        <article className="role-summary-card admin-role"><span className="role-avatar"><SettingsIcon name="users" size={19} /></span><div><h3>Administrador de Finanzas</h3><p>Administración y gestión financiera del módulo.</p><span>{rolePermissions['Administrador de Finanzas'].length} permisos demostrativos</span></div></article>
        <article className="role-summary-card analyst-role"><span className="role-avatar"><SettingsIcon name="eye" size={19} /></span><div><h3>Analista</h3><p>Consulta información financiera sin modificar operaciones.</p><span>{rolePermissions.Analista.length} permisos demostrativos</span></div></article>
      </div>

      <section className="settings-card users-card">
        <div className="users-card-heading"><div><h3>Usuarios de ejemplo</h3><p>Identidades ficticias, no vinculadas a cuentas reales.</p></div><div className="user-filters">
          <label className="settings-search"><SettingsIcon name="search" size={16} /><span className="visually-hidden">Buscar por nombre o correo</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar usuario" /></label>
          <label><span className="visually-hidden">Filtrar por rol</span><select value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}><option>Todos</option><option>Administrador de Finanzas</option><option>Analista</option></select></label>
          <label><span className="visually-hidden">Filtrar por estado</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option>Todos</option><option>Activo</option><option>Inactivo</option></select></label>
        </div></div>
        <div className="settings-table-wrap">
          <table className="settings-table">
            <thead><tr><th>Usuario</th><th>Correo</th><th>Rol</th><th>Estado</th><th>Acciones</th></tr></thead>
            <tbody>{filteredUsers.map((user) => <tr key={user.id} className={selectedUserId === user.id ? 'selected-user-row' : ''}>
              <td><button className="user-name-button" type="button" onClick={() => setSelectedUserId(user.id)}>{user.name}</button></td><td>{user.email}</td>
              <td><span className={`role-badge ${user.role === 'Analista' ? 'analyst' : 'admin'}`}>{user.role}</span></td>
              <td><span className={`user-status ${user.active ? 'active' : 'inactive'}`}><i />{user.active ? 'Activo' : 'Inactivo'}</span></td>
              <td><div className="user-row-actions"><button type="button" onClick={() => setSelectedUserId(user.id)}>Ver permisos</button><button type="button" onClick={() => openEditor(user)}>Editar</button></div></td>
            </tr>)}</tbody>
          </table>
          {!filteredUsers.length && <p className="settings-empty">{demoUsers.length ? 'No hay usuarios que coincidan con los filtros.' : 'No hay usuarios de demostración.'}</p>}
        </div>
        <p className="settings-table-count">{filteredUsers.length} {filteredUsers.length === 1 ? 'usuario' : 'usuarios'} encontrados</p>
      </section>

      <section className="settings-card permission-matrix">
        <div className="settings-card-heading"><span className="settings-icon-tile"><SettingsIcon name="users" /></span><div><h3>Matriz de permisos demostrativa</h3><p>Permisos asignados al rol de <strong>{selectedUser.name}</strong> · {selectedUser.role}</p></div><button className="settings-button small-outline" type="button" onClick={() => openEditor(selectedUser)}>Editar permisos</button></div>
        <div className="permission-list">{permissionDefinitions.map((permission) => <label className="permission-row" key={permission.id}><span><strong>{permission.label}</strong><small>{permission.description}</small></span><input type="checkbox" checked={rolePermissions[selectedUser.role].includes(permission.id)} disabled aria-label={`${permission.label} (solo lectura)`} /></label>)}</div>
        <p className="settings-demo-notice"><SettingsIcon name="info" size={16} />Esta matriz es ilustrativa. Los cambios locales no conceden ni revocan acceso real; la autorización debe validarse en el backend.</p>
        {notice && <p className="settings-inline-notice" role="status"><SettingsIcon name="info" size={17} />{notice}</p>}
      </section>

      {editingUser && <DemoModal title={`Editar permisos · ${editingUser.name}`} onClose={closeEditor}>
        <p className="settings-modal-lead">Rol: <strong>{editingUser.role}</strong>. Los cambios se aplican solo a la vista demostrativa de esta sesión.</p>
        <div className="permission-edit-list">{permissionDefinitions.map((permission) => <label className="permission-row" key={permission.id}><span><strong>{permission.label}</strong><small>{permission.description}</small></span><input type="checkbox" checked={draftPermissions.includes(permission.id)} onChange={() => togglePermission(permission.id)} aria-label={permission.label} /></label>)}</div>
        <p className="settings-warning"><SettingsIcon name="info" size={17} />Editar estos permisos no cambia la seguridad real ni configura mecanismos de autorización.</p>
        <div className="settings-modal-actions"><button className="settings-button subtle" type="button" onClick={closeEditor}>Cancelar</button><button className="settings-button primary" type="button" onClick={savePermissions}><SettingsIcon name="save" size={16} />Guardar cambios demo</button></div>
      </DemoModal>}
    </div>
  );
}

function IntegrationsPanel() {
  const [selectedIntegration, setSelectedIntegration] = useState<IntegrationDefinition | null>(null);
  return (
    <div className="settings-section-content">
      <div className="settings-section-heading">
        <div><p className="settings-kicker">ECOSISTEMA LESGO</p><h2>Integraciones</h2><p>Consulta los módulos que podrían compartir información con Finanzas.</p></div>
        <span className="settings-readonly-badge"><SettingsIcon name="info" size={15} />Conexiones no activas</span>
      </div>
      <div className="integration-grid">
        {integrations.map((integration) => <article className="settings-card integration-card" key={integration.id}>
          <div className={`integration-icon ${integration.id}`}><SettingsIcon name={integration.id === 'sales' ? 'sales' : integration.id === 'purchases' ? 'purchases' : 'hr'} size={22} /></div>
          <div className="integration-title-row"><h3>{integration.name}</h3><span className={`integration-status ${integration.status === 'Demostración' ? 'demo' : 'pending'}`}><i />{integration.status}</span></div>
          <p className="integration-description">{integration.description}</p>
          <div className="integration-data"><span>Información prevista</span><ul>{integration.data.map((data) => <li key={data}>{data}</li>)}</ul></div>
          <div className="integration-actions"><button className="settings-button small-outline" type="button" onClick={() => setSelectedIntegration(integration)}><SettingsIcon name="eye" size={16} />Ver detalles</button><button className="settings-button connection-button" type="button" disabled title="La conexión estará disponible en una etapa posterior">Probar conexión · Próximamente</button></div>
        </article>)}
      </div>
      <p className="settings-demo-notice"><SettingsIcon name="info" size={16} />No se realizaron conexiones y no se solicitaron ni almacenaron credenciales.</p>
      {selectedIntegration && <DemoModal title={`Integración con ${selectedIntegration.name}`} onClose={() => setSelectedIntegration(null)}>
        <div className="integration-detail-status"><span className={`integration-status ${selectedIntegration.status === 'Demostración' ? 'demo' : 'pending'}`}><i />{selectedIntegration.status}</span></div>
        <h3 className="integration-modal-subheading">Información que Finanzas espera recibir</h3>
        <ul className="integration-modal-list">{selectedIntegration.data.map((item) => <li key={item}>{item}</li>)}</ul>
        <h3 className="integration-modal-subheading">Dependencias pendientes</h3>
        <ul className="integration-pending-list">{selectedIntegration.pending.map((item) => <li key={item}>{item}</li>)}</ul>
        <p className="settings-warning"><SettingsIcon name="info" size={17} />La integración no está conectada. Esta ficha solo documenta dependencias previstas.</p>
        <div className="settings-modal-actions"><button className="settings-button subtle" type="button" onClick={() => setSelectedIntegration(null)}>Cerrar</button></div>
      </DemoModal>}
    </div>
  );
}

const sections: { id: SettingsSection; label: string; description: string; icon: string }[] = [
  { id: 'general', label: 'Configuración general', description: 'Preferencias del módulo', icon: 'general' },
  { id: 'users', label: 'Usuarios y permisos', description: 'Accesos demostrativos', icon: 'users' },
  { id: 'integrations', label: 'Integraciones', description: 'Conexiones entre módulos', icon: 'integration' },
];

function SettingsPage({ onNavigate }: { onNavigate: (page: FinancePage) => void }) {
  const [section, setSection] = useState<SettingsSection>('general');
  const [preferences, setPreferences] = useState(initialPreferences);
  const [savedPreferences, setSavedPreferences] = useState(initialPreferences);
  const [rolePermissions, setRolePermissions] = useState(initialRolePermissions);
  const hasUnsavedPreferences = JSON.stringify(preferences) !== JSON.stringify(savedPreferences);

  function navigate(page: FinancePage) {
    if (hasUnsavedPreferences && !window.confirm('Hay cambios sin guardar. ¿Quieres salir y descartarlos?')) return;
    onNavigate(page);
  }

  return (
    <FinanceLayout activePage="Configuraciones" onNavigate={navigate} footerNote="Modo de demostración" layoutClassName="settings-layout">
      <main className="dashboard-content settings-content">
        <header className="page-heading settings-page-heading">
          <div><p className="page-eyebrow">LESGO · MÓDULO FINANCIERO</p><h1>Configuraciones</h1><p className="settings-subtitle">Administra los parámetros, permisos e integraciones del módulo financiero</p></div>
          <span className="settings-mode-pill"><SettingsIcon name="info" size={16} />Modo de demostración</span>
        </header>
        <div className="settings-workspace">
          <nav className="settings-navigation" aria-label="Secciones de configuración">
            <p className="settings-navigation-label">CONFIGURACIÓN</p>
            {sections.map((item) => <button type="button" className={`settings-navigation-item${section === item.id ? ' selected' : ''}`} aria-current={section === item.id ? 'page' : undefined} key={item.id} onClick={() => setSection(item.id)}><span className="settings-navigation-icon"><SettingsIcon name={item.icon} size={19} /></span><span><strong>{item.label}</strong><small>{item.description}</small></span></button>)}
            <div className="settings-navigation-note"><SettingsIcon name="info" size={16} /><span>Los cambios de esta pantalla son demostrativos y no alteran datos reales.</span></div>
          </nav>
          <div className="settings-main">
            {section === 'general' && <GeneralSettings preferences={preferences} setPreferences={setPreferences} savedPreferences={savedPreferences} setSavedPreferences={setSavedPreferences} />}
            {section === 'users' && <UsersAndPermissions rolePermissions={rolePermissions} setRolePermissions={setRolePermissions} />}
            {section === 'integrations' && <IntegrationsPanel />}
          </div>
        </div>
      </main>
    </FinanceLayout>
  );
}

export default SettingsPage;
