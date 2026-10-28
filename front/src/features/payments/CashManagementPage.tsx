import { useCallback, useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { FinanceLayout, type FinancePage } from '../../shared/layout/FinanceLayout';
import { createCashMovement, decideCashMovement, listCashMovements, type MetodoPago } from './cash.api';
import type {
  CashMovement,
  MovementDirection,
  MovementOrigin,
  MovementStatus,
  NewMovementRequest,
} from './cash.types';
import './CashManagementPage.css';

const currency = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
});
const dateFormat = new Intl.DateTimeFormat('es-CL');
const origins: MovementOrigin[] = ['Ventas', 'Compras', 'Reembolsos'];
const directions: MovementDirection[] = ['Ingreso', 'Egreso'];
const statusOptions: MovementStatus[] = ['Pendiente', 'Autorizado', 'Rechazado'];
const demoAdministrator = 'Administrador 1 · entorno local';

function formatDate(value: string) {
  return dateFormat.format(new Date(`${value}T12:00:00`));
}

function currentDate() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function firstDayOfCurrentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
}

function StatusBadge({ status }: { status: MovementStatus }) {
  return <span className={`movement-status ${status.toLocaleLowerCase('es-CL')}`}><i />{status}</span>;
}

function DirectionBadge({ direction }: { direction: MovementDirection }) {
  return <span className={`movement-direction ${direction.toLocaleLowerCase('es-CL')}`}>{direction === 'Ingreso' ? '↓' : '↑'} {direction}</span>;
}

function OriginBadge({ origin }: { origin: MovementOrigin }) {
  return <span className={`movement-origin ${origin === 'Ventas' ? 'sales' : origin === 'Compras' ? 'purchases' : 'hr'}`}>{origin}</span>;
}

function CashModal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
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
    <div className="cash-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="cash-modal" role="dialog" aria-modal="true" aria-labelledby="cash-modal-title">
        <header className="cash-modal-header">
          <div><p>LESGO · OPERACIONES FINANCIERAS</p><h2 id="cash-modal-title">{title}</h2></div>
          <button type="button" className="cash-close-button" aria-label="Cerrar ventana" onClick={onClose}>×</button>
        </header>
        <div className="cash-modal-content">{children}</div>
      </section>
    </div>
  );
}

function MovementDetails({
  movement,
  onClose,
  onAuthorize,
  onReject,
}: {
  movement: CashMovement;
  onClose: () => void;
  onAuthorize: (movement: CashMovement) => void;
  onReject: (movement: CashMovement) => void;
}) {
  return (
    <CashModal title={`Detalle de solicitud · ${movement.id}`} onClose={onClose}>
      <div className="movement-detail-badges"><OriginBadge origin={movement.origin} /><DirectionBadge direction={movement.direction} /><StatusBadge status={movement.status} /></div>
      <dl className="movement-detail-grid">
        <div><dt>ID de solicitud</dt><dd>{movement.id}</dd></div>
        <div><dt>Módulo de origen</dt><dd>{movement.origin}</dd></div>
        <div><dt>Tipo de movimiento</dt><dd>{movement.direction}</dd></div>
        <div><dt>Referencia</dt><dd>{movement.reference}</dd></div>
        <div><dt>Método de pago</dt><dd>{movement.beneficiary}</dd></div>
        <div><dt>Monto solicitado</dt><dd className="movement-detail-amount">{currency.format(movement.amount)}</dd></div>
        <div><dt>Fecha de solicitud</dt><dd>{formatDate(movement.requestDate)}</dd></div>
        <div className="full-detail"><dt>Descripción / concepto</dt><dd>{movement.concept}</dd></div>
        <div className="full-detail"><dt>Respaldo informativo</dt><dd>{movement.supportDescription ?? 'No hay documentos adjuntos a esta operación.'}</dd></div>
        <div className="full-detail"><dt>Estado</dt><dd><StatusBadge status={movement.status} /></dd></div>
        {movement.decision && <>
          <div><dt>Decisión</dt><dd>{movement.decision.status} · registrada</dd></div>
          <div><dt>Decidido por</dt><dd>{movement.decision.decidedBy}</dd></div>
          <div className="full-detail"><dt>Fecha de decisión</dt><dd>{new Intl.DateTimeFormat('es-CL', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(movement.decision.decidedAt))}</dd></div>
          {movement.decision.reason && <div className="full-detail"><dt>Motivo de rechazo</dt><dd>{movement.decision.reason}</dd></div>}
        </>}
      </dl>
      <p className="cash-modal-notice"><span aria-hidden="true">i</span> Aprobar registra inmediatamente la ejecución en la caja local del ERP. No realiza transferencias bancarias.</p>
      <div className="cash-modal-actions">
        {movement.status === 'Pendiente' ? <>
          <button type="button" className="cash-button danger-outline" onClick={() => onReject(movement)}>Rechazar solicitud</button>
          <button type="button" className="cash-button success" onClick={() => onAuthorize(movement)}>Autorizar movimiento</button>
        </> : <button type="button" className="cash-button secondary" onClick={onClose}>Cerrar</button>}
      </div>
    </CashModal>
  );
}

function CashManagementPage({ onNavigate }: { onNavigate: (page: FinancePage) => void }) {
  const [movements, setMovements] = useState<CashMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [storageError, setStorageError] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [query, setQuery] = useState('');
  const [directionFilter, setDirectionFilter] = useState('Todos');
  const [originFilter, setOriginFilter] = useState('Todos');
  const [statusFilter, setStatusFilter] = useState('Todos');
  const [fromDate, setFromDate] = useState(firstDayOfCurrentMonth);
  const [toDate, setToDate] = useState(currentDate);
  const [selectedMovement, setSelectedMovement] = useState<CashMovement | null>(null);
  const [authorizationCandidate, setAuthorizationCandidate] = useState<CashMovement | null>(null);
  const [rejectionCandidate, setRejectionCandidate] = useState<CashMovement | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [reasonError, setReasonError] = useState('');
  const [manualOpen, setManualOpen] = useState(false);
  const [manualForm, setManualForm] = useState<NewMovementRequest>({
    origin: 'Compras',
    direction: 'Egreso',
    reference: '',
    beneficiary: '',
    amount: 0,
    requestDate: currentDate(),
    concept: '',
  });
  const [manualAmount, setManualAmount] = useState('');
  const [manualMethod, setManualMethod] = useState<MetodoPago>('efectivo');
  const [manualErrors, setManualErrors] = useState<Record<string, string>>({});

  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      setMovements(await listCashMovements());
      setStorageError('');
    } catch (error) {
      setStorageError(error instanceof Error ? error.message : 'No se pudieron cargar los movimientos.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const periodMovements = useMemo(() => movements.filter((movement) =>
    (!fromDate || movement.requestDate >= fromDate) && (!toDate || movement.requestDate <= toDate)), [fromDate, movements, toDate]);
  const summary = useMemo(() => ({
    pending: periodMovements.filter((item) => item.status === 'Pendiente').length,
    income: periodMovements.filter((item) => item.status === 'Autorizado' && item.direction === 'Ingreso').reduce((sum, item) => sum + item.amount, 0),
    expense: periodMovements.filter((item) => item.status === 'Autorizado' && item.direction === 'Egreso').reduce((sum, item) => sum + item.amount, 0),
    rejected: periodMovements.filter((item) => item.status === 'Rechazado').length,
  }), [periodMovements]);

  const filteredMovements = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('es-CL');
    return movements.filter((movement) => {
      const matchesQuery = !normalizedQuery || [movement.id, movement.reference, movement.beneficiary, movement.concept]
        .some((value) => value.toLocaleLowerCase('es-CL').includes(normalizedQuery));
      const matchesDirection = directionFilter === 'Todos' || movement.direction === directionFilter;
      const matchesOrigin = originFilter === 'Todos' || movement.origin === originFilter;
      const matchesStatus = statusFilter === 'Todos' || movement.status === statusFilter;
      const matchesFrom = !fromDate || movement.requestDate >= fromDate;
      const matchesTo = !toDate || movement.requestDate <= toDate;
      return matchesQuery && matchesDirection && matchesOrigin && matchesStatus && matchesFrom && matchesTo;
    });
  }, [directionFilter, fromDate, movements, originFilter, query, statusFilter, toDate]);
  const pendingMovements = filteredMovements.filter((item) => item.status === 'Pendiente');

  function showMovement(movement: CashMovement) {
    setSelectedMovement(movement);
  }

  function beginAuthorization(movement: CashMovement) {
    setSelectedMovement(null);
    setManualMethod(['efectivo','transferencia','tarjeta','simulado'].includes(movement.beneficiary) ? movement.beneficiary as MetodoPago : 'efectivo');
    setAuthorizationCandidate(movement);
  }

  function beginRejection(movement: CashMovement) {
    setSelectedMovement(null);
    setRejectionCandidate(movement);
    setRejectionReason('');
    setReasonError('');
  }

  async function confirmAuthorization() {
    if (!authorizationCandidate || saving) return;
    setSaving(true);
    try {
      await decideCashMovement(authorizationCandidate.id, 'Autorizado', '', manualMethod);
      setFeedback({ type: 'success', message: `Operación ${authorizationCandidate.id} ejecutada. La caja fue actualizada.` });
      setAuthorizationCandidate(null);
    } catch (error) {
      setFeedback({ type: 'error', message: error instanceof Error ? error.message : 'No se pudo completar la autorización.' });
    } finally {
      await refresh(); // muestra el estado real, también si falló a mitad del flujo
      setSaving(false);
    }
  }

  async function confirmRejection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!rejectionCandidate || saving) return;
    if (!rejectionReason.trim()) {
      setReasonError('Ingresa un motivo para rechazar esta solicitud.');
      return;
    }
    setSaving(true);
    try {
      await decideCashMovement(rejectionCandidate.id, 'Rechazado', rejectionReason);
      setFeedback({ type: 'success', message: `Operación ${rejectionCandidate.id} rechazada. No se modificó la caja.` });
      setRejectionCandidate(null);
      setRejectionReason('');
      setReasonError('');
    } catch (error) {
      setFeedback({ type: 'error', message: error instanceof Error ? error.message : 'No se pudo completar el rechazo.' });
    } finally {
      await refresh();
      setSaving(false);
    }
  }

  async function createManualRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving) return;
    setFeedback(null);
    const errors: Record<string, string> = {};
    if (!manualForm.reference.trim()) errors.reference = 'Ingresa la referencia de la operación.';
    const value = Number(manualAmount);
    if (!manualAmount || !Number.isFinite(value) || value <= 0) errors.amount = 'El monto debe ser mayor que cero.';
    if (!manualForm.requestDate) errors.requestDate = 'Selecciona la fecha de solicitud.';
    if (!manualForm.concept.trim()) errors.concept = 'Ingresa una descripción del movimiento.';
    setManualErrors(errors);
    if (Object.keys(errors).length) return;
    setSaving(true);
    try {
      const created = await createCashMovement({ ...manualForm, amount: value }, manualMethod);
      await refresh();
      setManualForm((current) => ({ ...current, reference: '', beneficiary: '', amount: 0, requestDate: currentDate(), concept: '' }));
      setManualAmount('');
      setManualErrors({});
      setManualOpen(false);
      setFeedback({ type: 'success', message: `Solicitud ${created.id} creada con estado Pendiente. Debe revisarse antes de autorizarse.` });
      setStatusFilter('Todos');
      setFromDate('');
      setToDate('');
    } catch (error) {
      setFeedback({ type: 'error', message: error instanceof Error ? error.message : 'No se pudo registrar la solicitud.' });
    } finally {
      setSaving(false);
    }
  }

  function clearFilters() {
    setQuery('');
    setDirectionFilter('Todos');
    setOriginFilter('Todos');
    setStatusFilter('Todos');
    setFromDate('');
    setToDate('');
  }

  function updateManual<K extends keyof NewMovementRequest>(key: K, value: NewMovementRequest[K]) {
    setManualForm((current) => ({ ...current, [key]: value }));
    setManualErrors((current) => ({ ...current, [key]: '' }));
  }

  return (
    <FinanceLayout activePage="Registro de pagos" onNavigate={onNavigate} footerNote="Operaciones financieras locales" layoutClassName="cash-layout">
      <main className="dashboard-content cash-content">
        <header className="page-heading cash-page-heading">
          <div>
            <p className="page-eyebrow">LESGO · MÓDULO FINANCIERO</p>
            <h1>Autorización de movimientos</h1>
            <p className="cash-subtitle">Revisa y autoriza las entradas y salidas de dinero del ERP LESGO.</p>
          </div>
          <div className="cash-header-badges"><span className="cash-mode-badge">Entorno local</span><span className="cash-role-badge">{demoAdministrator}</span></div>
        </header>

        <div className="cash-disclaimer" role="note"><span aria-hidden="true">i</span><p><strong>Caja local del ERP.</strong> Aprobar ejecuta la operación y actualiza los saldos en PostgreSQL. No se realizan transferencias bancarias. La identidad y las referencias externas son de prueba.</p></div>

        {storageError && <div className="cash-alert error" role="alert"><span>{storageError}</span><button type="button" onClick={refresh}>Reintentar</button></div>}
        {feedback && <div className={`cash-alert ${feedback.type}`} role={feedback.type === 'error' ? 'alert' : 'status'}><span>{feedback.message}</span><button type="button" aria-label="Cerrar notificación" onClick={() => setFeedback(null)}>×</button></div>}

        <section className="cash-summary" aria-label="Indicadores de autorizaciones">
          <article className="cash-summary-card pending"><span className="cash-summary-icon">◷</span><div><h2>Pendientes de autorización</h2><p>{loading ? '—' : summary.pending}</p></div></article>
          <article className="cash-summary-card income"><span className="cash-summary-icon">↓</span><div><h2>Ingresos autorizados</h2><p>{loading ? '—' : currency.format(summary.income)}</p><small>Período filtrado</small></div></article>
          <article className="cash-summary-card expense"><span className="cash-summary-icon">↑</span><div><h2>Egresos autorizados</h2><p>{loading ? '—' : currency.format(summary.expense)}</p><small>Período filtrado</small></div></article>
          <article className="cash-summary-card rejected"><span className="cash-summary-icon">!</span><div><h2>Solicitudes rechazadas</h2><p>{loading ? '—' : summary.rejected}</p><small>Período filtrado</small></div></article>
        </section>

        <section className="cash-panel requests-panel" aria-labelledby="pending-movements-heading">
          <div className="cash-panel-heading"><div><h2 id="pending-movements-heading">Solicitudes pendientes</h2><p>Movimientos enviados por Ventas, Compras y Recursos Humanos</p></div><span className="cash-count-pill">{pendingMovements.length} pendientes visibles</span></div>
          <div className="cash-filters">
            <label className="cash-search"><span aria-hidden="true">⌕</span><span className="visually-hidden">Buscar por ID, referencia o beneficiario</span><input placeholder="Buscar por ID, referencia o beneficiario" value={query} onChange={(event) => setQuery(event.target.value)} /></label>
            <label className="cash-filter-field"><span>Tipo</span><select value={directionFilter} onChange={(event) => setDirectionFilter(event.target.value)}><option>Todos</option>{directions.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label className="cash-filter-field"><span>Origen</span><select value={originFilter} onChange={(event) => setOriginFilter(event.target.value)}><option>Todos</option>{origins.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label className="cash-filter-field"><span>Estado</span><select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}><option>Todos</option>{statusOptions.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label className="cash-filter-field"><span>Desde</span><input type="date" value={fromDate} max={toDate || undefined} onChange={(event) => setFromDate(event.target.value)} /></label>
            <label className="cash-filter-field"><span>Hasta</span><input type="date" value={toDate} min={fromDate || undefined} onChange={(event) => setToDate(event.target.value)} /></label>
            <button className="cash-clear-filters" type="button" onClick={clearFilters}>Limpiar filtros</button>
          </div>
          <div className="cash-table-wrap">
            <table className="cash-table">
              <thead><tr><th>ID</th><th>Origen</th><th>Tipo</th><th>Referencia</th><th>Método / concepto</th><th>Monto solicitado</th><th>Fecha</th><th>Estado</th><th>Acción</th></tr></thead>
              <tbody>{pendingMovements.map((movement) => <tr key={movement.id}>
                <td><strong>{movement.id}</strong></td><td><OriginBadge origin={movement.origin} /></td><td><DirectionBadge direction={movement.direction} /></td><td>{movement.reference}</td><td><span className="cash-beneficiary">{movement.beneficiary}</span><small className="cash-concept">{movement.concept}</small></td><td className="cash-amount">{currency.format(movement.amount)}</td><td>{formatDate(movement.requestDate)}</td><td><StatusBadge status={movement.status} /></td><td><button className="cash-review-button" type="button" onClick={() => showMovement(movement)}>Revisar</button></td>
              </tr>)}</tbody>
            </table>
            {!pendingMovements.length && <div className="cash-empty"><span>⌕</span><strong>No hay solicitudes pendientes</strong><p>{filteredMovements.length ? 'Los filtros actuales no incluyen solicitudes pendientes.' : 'No encontramos movimientos que coincidan con los filtros seleccionados.'}</p></div>}
          </div>
          <p className="cash-table-count">{pendingMovements.length} solicitudes pendientes · {filteredMovements.length} movimientos coinciden con los filtros</p>
        </section>

        <section className="cash-panel movement-history" aria-labelledby="movement-history-heading">
          <div className="cash-panel-heading"><div><h2 id="movement-history-heading">Historial de movimientos</h2><p>Solicitudes y decisiones registradas en PostgreSQL</p></div><span className="cash-history-demo">Historial local</span></div>
          <div className="cash-table-wrap">
            <table className="cash-table history-table">
              <thead><tr><th>Identificador</th><th>Origen</th><th>Tipo</th><th>Concepto</th><th>Monto</th><th>Fecha</th><th>Estado</th><th>Acción</th></tr></thead>
              <tbody>{filteredMovements.map((movement) => <tr key={movement.id}>
                <td><strong>{movement.id}</strong></td><td><OriginBadge origin={movement.origin} /></td><td><DirectionBadge direction={movement.direction} /></td><td><span className="cash-beneficiary">{movement.concept}</span><small className="cash-concept">{movement.reference} · {movement.beneficiary}</small></td><td className="cash-amount">{currency.format(movement.amount)}</td><td>{formatDate(movement.requestDate)}</td><td><StatusBadge status={movement.status} /></td><td><button className="cash-review-button" type="button" onClick={() => showMovement(movement)}>Ver detalle</button></td>
              </tr>)}</tbody>
            </table>
            {!filteredMovements.length && <div className="cash-empty"><strong>Sin movimientos para mostrar</strong><p>Modifica los filtros o límpialos para volver a consultar el historial.</p></div>}
          </div>
          <p className="cash-table-count">{filteredMovements.length} movimientos encontrados</p>
        </section>

        <section className="cash-panel manual-panel">
          <button type="button" className="manual-toggle" aria-expanded={manualOpen} onClick={() => setManualOpen((open) => !open)}><span><strong>Registro manual de movimientos</strong><small>Crea una solicitud pendiente vinculada a una obligación o reembolso.</small></span><span className={`manual-chevron${manualOpen ? ' open' : ''}`}>⌄</span></button>
          {manualOpen && <form className="manual-movement-form" onSubmit={createManualRequest} noValidate>
            <label className="manual-field"><span>Tipo de movimiento <b>*</b></span><select value={manualForm.direction} onChange={(event) => updateManual('direction', event.target.value as MovementDirection)}>{directions.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label className="manual-field"><span>Módulo de origen <b>*</b></span><select value={manualForm.origin} onChange={(event) => updateManual('origin', event.target.value as MovementOrigin)}>{origins.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label className="manual-field"><span>Referencia <b>*</b></span><input value={manualForm.reference} maxLength={60} onChange={(event) => updateManual('reference', event.target.value)} placeholder="ID de cuenta por cobrar, pagar o reembolso" aria-invalid={Boolean(manualErrors.reference)} />{manualErrors.reference && <small className="manual-error">{manualErrors.reference}</small>}</label>
            <label className="manual-field"><span>Método de pago <b>*</b></span><select value={manualMethod} onChange={event => setManualMethod(event.target.value as MetodoPago)}>{['efectivo','transferencia','tarjeta','simulado'].map(method => <option key={method}>{method}</option>)}</select></label>
            <label className="manual-field"><span>Monto solicitado (CLP) <b>*</b></span><input type="number" min="0.01" step="0.01" value={manualAmount} onChange={(event) => { setManualAmount(event.target.value); setManualErrors((current) => ({ ...current, amount: '' })); }} placeholder="0" aria-invalid={Boolean(manualErrors.amount)} />{manualErrors.amount && <small className="manual-error">{manualErrors.amount}</small>}</label>
            <label className="manual-field full"><span>Concepto / observaciones <b>*</b></span><textarea rows={3} maxLength={300} value={manualForm.concept} onChange={(event) => updateManual('concept', event.target.value)} placeholder="Describe el motivo de la solicitud" aria-invalid={Boolean(manualErrors.concept)} />{manualErrors.concept && <small className="manual-error">{manualErrors.concept}</small>}</label>
            <div className="manual-form-actions"><p>La solicitud se creará siempre con estado <strong>Pendiente</strong>. La caja se actualiza al aprobar.</p><button className="cash-button primary" type="submit" disabled={Boolean(storageError)}>Crear solicitud pendiente</button></div>
          </form>}
        </section>
        <p className="cash-security-note">Administrador 1 es un usuario de prueba local. Las decisiones se validan y registran en el backend.</p>
      </main>

      {selectedMovement && <MovementDetails movement={selectedMovement} onClose={() => setSelectedMovement(null)} onAuthorize={beginAuthorization} onReject={beginRejection} />}
      {authorizationCandidate && <CashModal title="Aprobar y ejecutar operación" onClose={() => setAuthorizationCandidate(null)}>
        <div className="decision-summary"><div><span>ID</span><strong>{authorizationCandidate.id}</strong></div><div><span>Origen</span><strong>{authorizationCandidate.origin}</strong></div><div><span>Tipo</span><DirectionBadge direction={authorizationCandidate.direction} /></div><div><span>Monto</span><strong>{currency.format(authorizationCandidate.amount)}</strong></div></div>
        <p className="decision-copy">Vas a <strong>aprobar y ejecutar</strong> esta operación. Se registrará el movimiento y se actualizarán los saldos dentro de una misma transacción.</p>
        <label className="manual-field"><span>Método para ejecutar <b>*</b></span><select value={manualMethod} onChange={event => setManualMethod(event.target.value as MetodoPago)}>{['efectivo','transferencia','tarjeta','simulado'].map(method => <option key={method}>{method}</option>)}</select></label>
        <div className="cash-modal-actions"><button className="cash-button secondary" type="button" onClick={() => setAuthorizationCandidate(null)}>Cancelar</button><button className="cash-button success" type="button" disabled={saving} onClick={confirmAuthorization}>Aprobar y ejecutar</button></div>
      </CashModal>}
      {rejectionCandidate && <CashModal title="Rechazar solicitud" onClose={() => { setRejectionCandidate(null); setReasonError(''); }}>
        <div className="decision-summary"><div><span>ID</span><strong>{rejectionCandidate.id}</strong></div><div><span>Origen</span><strong>{rejectionCandidate.origin}</strong></div><div><span>Tipo</span><DirectionBadge direction={rejectionCandidate.direction} /></div><div><span>Monto</span><strong>{currency.format(rejectionCandidate.amount)}</strong></div></div>
        <form onSubmit={confirmRejection} noValidate><label className="rejection-reason"><span>Motivo del rechazo <b>*</b></span><textarea rows={4} maxLength={500} value={rejectionReason} onChange={(event) => { setRejectionReason(event.target.value); setReasonError(''); }} placeholder="Indica por qué no se autoriza esta solicitud" aria-invalid={Boolean(reasonError)} aria-describedby={reasonError ? 'reject-reason-error' : undefined} />{reasonError && <small id="reject-reason-error">{reasonError}</small>}</label><p className="decision-copy">El rechazo se guardará en el historial. No generará un movimiento de caja.</p><div className="cash-modal-actions"><button className="cash-button secondary" type="button" onClick={() => { setRejectionCandidate(null); setReasonError(''); }}>Cancelar</button><button className="cash-button danger" type="submit">Confirmar rechazo</button></div></form>
      </CashModal>}
    </FinanceLayout>
  );
}

export default CashManagementPage;
