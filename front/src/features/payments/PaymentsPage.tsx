import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { FinanceLayout, type FinancePage } from '../../shared/layout/FinanceLayout';
import { paymentsMode, paymentsService } from './payments.service';
import type {
  CreatePaymentInput,
  PaymentDetails,
  PaymentObligation,
  PaymentOrigin,
  PaymentRecord,
  PaymentSummary,
} from './payments.types';
import './PaymentsPage.css';

const currency = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
});

const dateFormat = new Intl.DateTimeFormat('es-CL');

function formatMoney(amount: number) {
  return currency.format(amount);
}

function formatDate(value: string) {
  return dateFormat.format(new Date(`${value}T12:00:00`));
}

function displayPaymentId(id: string) {
  return id.startsWith('P-') ? id : `P-${id}`;
}

function todayAsInput() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function isOverdue(obligation: PaymentObligation) {
  return obligation.outstandingBalance > 0 && obligation.dueDate < todayAsInput();
}

function PaymentsPage({ onNavigate }: { onNavigate: (page: FinancePage) => void }) {
  const [obligations, setObligations] = useState<PaymentObligation[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [summary, setSummary] = useState<PaymentSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [origin, setOrigin] = useState<PaymentOrigin>('PROVEEDOR');
  const [obligationId, setObligationId] = useState('');
  const [amount, setAmount] = useState('');
  const [paymentDate, setPaymentDate] = useState(todayAsInput);
  const [method, setMethod] = useState('Transferencia bancaria');
  const [bankReference, setBankReference] = useState('');
  const [notes, setNotes] = useState('');
  const [candidate, setCandidate] = useState<CreatePaymentInput | null>(null);
  const [candidateIdempotencyKey, setCandidateIdempotencyKey] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [originFilter, setOriginFilter] = useState('TODOS');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [page, setPage] = useState(1);
  const [selectedPayment, setSelectedPayment] = useState<PaymentDetails | null>(null);
  const [detailError, setDetailError] = useState('');
  const pageSize = 8;

  const reload = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const [nextObligations, nextPayments, nextSummary] = await Promise.all([
        paymentsService.listObligations(),
        paymentsService.listPayments(),
        paymentsService.getSummary(),
      ]);
      setObligations(nextObligations);
      setPayments(nextPayments);
      setSummary(nextSummary);
      setObligationId((current) => {
        if (current && nextObligations.some((item) => String(item.id) === current && item.origin === origin)) {
          return current;
        }
        return String(nextObligations.find((item) => item.origin === origin)?.id ?? '');
      });
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'No se pudieron cargar los datos de pagos.');
    } finally {
      setLoading(false);
    }
  }, [origin]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const selectedObligation = obligations.find(
    (item) => String(item.id) === obligationId && item.origin === origin,
  );
  const transferMethod = method.toLocaleLowerCase('es-CL').includes('transferencia');

  const filteredPayments = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase('es-CL');
    return payments.filter((payment) => {
      const matchesQuery =
        !normalizedQuery ||
        [payment.id, payment.obligationCode, payment.beneficiary]
          .some((value) => value.toLocaleLowerCase('es-CL').includes(normalizedQuery));
      const matchesOrigin = originFilter === 'TODOS' || payment.origin === originFilter;
      const matchesFrom = !fromDate || payment.paymentDate >= fromDate;
      const matchesTo = !toDate || payment.paymentDate <= toDate;
      return matchesQuery && matchesOrigin && matchesFrom && matchesTo;
    });
  }, [fromDate, originFilter, payments, query, toDate]);

  const pageCount = Math.max(1, Math.ceil(filteredPayments.length / pageSize));
  const pagePayments = filteredPayments.slice((page - 1) * pageSize, page * pageSize);

  function changeOrigin(nextOrigin: PaymentOrigin) {
    setOrigin(nextOrigin);
    setObligationId(String(obligations.find((item) => item.origin === nextOrigin)?.id ?? ''));
    setAmount('');
  }

  function clearForm() {
    setOrigin('PROVEEDOR');
    setObligationId(String(obligations.find((item) => item.origin === 'PROVEEDOR')?.id ?? ''));
    setAmount('');
    setPaymentDate(todayAsInput());
    setMethod('Transferencia bancaria');
    setBankReference('');
    setNotes('');
    setCandidate(null);
    setCandidateIdempotencyKey(null);
    setFeedback(null);
  }

  function preparePayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    const obligation = obligations.find((item) => item.id === Number(obligationId));
    const numericAmount = Number(amount);
    if (!obligation) {
      setFeedback({ type: 'error', message: 'Selecciona una obligación pendiente válida.' });
      return;
    }
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      setFeedback({ type: 'error', message: 'El monto debe ser mayor que cero.' });
      return;
    }
    if (numericAmount > obligation.outstandingBalance) {
      setFeedback({ type: 'error', message: `El monto supera el saldo pendiente de ${formatMoney(obligation.outstandingBalance)}.` });
      return;
    }
    if (!paymentDate || !method) {
      setFeedback({ type: 'error', message: 'Completa todos los campos obligatorios.' });
      return;
    }
    if (transferMethod && !bankReference.trim()) {
      setFeedback({ type: 'error', message: 'La referencia bancaria es obligatoria para una transferencia.' });
      return;
    }

    setCandidate({
      obligationId: obligation.id,
      amount: numericAmount,
      paymentDate,
      method,
      bankReference: bankReference.trim() || null,
      notes: notes.trim() || null,
    });
    setCandidateIdempotencyKey(crypto.randomUUID());
  }

  async function confirmPayment() {
    if (!candidate || saving) return;
    const idempotencyKey = candidateIdempotencyKey ?? crypto.randomUUID();
    if (!candidateIdempotencyKey) setCandidateIdempotencyKey(idempotencyKey);
    setSaving(true);
    setFeedback(null);
    try {
      const payment = await paymentsService.createPayment(candidate, idempotencyKey);
      setCandidate(null);
      setCandidateIdempotencyKey(null);
      setFeedback({
        type: 'success',
        message: `Pago ${displayPaymentId(payment.id)} registrado en el ERP. Esta operación no ejecuta una transferencia bancaria.`,
      });
      setAmount('');
      setBankReference('');
      setNotes('');
      await reload();
    } catch (error) {
      setFeedback({ type: 'error', message: error instanceof Error ? error.message : 'No se pudo registrar el pago.' });
    } finally {
      setSaving(false);
    }
  }

  async function showPayment(id: string) {
    setSelectedPayment(null);
    setDetailError('');
    try {
      setSelectedPayment(await paymentsService.getPayment(id));
    } catch (error) {
      setDetailError(error instanceof Error ? error.message : 'No se pudo cargar el detalle del pago.');
    }
  }

  function changeFilter(action: () => void) {
    action();
    setPage(1);
  }

  const dataLabel = paymentsMode === 'demo' ? 'Datos de demostración · guardados en este navegador' : 'Datos conectados a PostgreSQL';

  return (
    <FinanceLayout
      activePage="Registro de pagos"
      onNavigate={onNavigate}
      footerNote={paymentsMode === 'demo' ? 'Datos de demostración' : 'Datos conectados a PostgreSQL'}
      layoutClassName="payments-layout"
    >
      <main className="dashboard-content payments-content">
        <div className="page-heading payments-page-heading">
          <div>
            <p className="page-eyebrow">LESGO · MÓDULO FINANCIERO</p>
            <h1>Registro de pagos</h1>
            <p className="payments-subtitle">Registra y consulta movimientos financieros</p>
          </div>
          <span className={`period-badge data-mode-badge ${paymentsMode}`}>{dataLabel}</span>
        </div>

        {loadError && (
          <div className="payments-alert error" role="alert">
            <span>{loadError}</span>
            <button className="text-button" type="button" onClick={() => void reload()}>Reintentar</button>
          </div>
        )}
        {feedback && (
          <div className={`payments-alert ${feedback.type}`} role={feedback.type === 'error' ? 'alert' : 'status'}>
            {feedback.message}
          </div>
        )}

        <section className="payment-stats" aria-label="Indicadores de pagos">
          <article className="payment-stat pending-stat">
            <span className="stat-icon" aria-hidden="true">◷</span>
            <div><h2>Pendientes de pago</h2><p>{loading ? '—' : summary?.pendingObligations ?? 0}</p></div>
          </article>
          <article className="payment-stat monthly-stat">
            <span className="stat-icon" aria-hidden="true">$</span>
            <div><h2>Pagados este mes</h2><p>{loading ? '—' : formatMoney(summary?.paidThisMonth ?? 0)}</p></div>
          </article>
          <article className="payment-stat overdue-stat">
            <span className="stat-icon" aria-hidden="true">!</span>
            <div><h2>Pagos vencidos</h2><p>{loading ? '—' : summary?.overdueObligations ?? 0}</p></div>
          </article>
        </section>

        <section className="payment-workspace">
          <article className="payment-panel payment-form-panel">
            <div className="panel-heading"><h2>Registrar nuevo pago</h2></div>
            <form className="payment-form" onSubmit={preparePayment}>
              <label className="form-field">
                <span>Tipo de pago <b>*</b></span>
                <select value={origin} onChange={(event) => changeOrigin(event.target.value as PaymentOrigin)} required>
                  <option value="PROVEEDOR">Proveedor</option>
                  <option value="NOMINA">Nómina</option>
                </select>
              </label>
              <label className="form-field">
                <span>Obligación asociada <b>*</b></span>
                <select
                  value={obligationId}
                  onChange={(event) => setObligationId(event.target.value)}
                  required
                  disabled={loading || obligations.filter((item) => item.origin === origin).length === 0}
                >
                  <option value="">Selecciona una obligación</option>
                  {obligations.filter((item) => item.origin === origin).map((item) => (
                    <option value={item.id} key={item.id}>
                      {item.code} · saldo {formatMoney(item.outstandingBalance)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="form-field">
                <span>Beneficiario</span>
                <input value={selectedObligation?.beneficiary ?? ''} placeholder="Se completa con la obligación" readOnly />
              </label>
              <label className="form-field">
                <span>Monto a pagar <b>*</b></span>
                <div className="amount-input">
                  <span aria-hidden="true">$</span>
                  <input
                    type="number"
                    min="0.01"
                    max={selectedObligation?.outstandingBalance}
                    step="0.01"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    placeholder="0"
                    required
                    disabled={!selectedObligation}
                  />
                </div>
                {selectedObligation && <small>Saldo máximo: {formatMoney(selectedObligation.outstandingBalance)}</small>}
              </label>
              <label className="form-field">
                <span>Fecha de pago <b>*</b></span>
                <input type="date" value={paymentDate} onChange={(event) => setPaymentDate(event.target.value)} required />
              </label>
              <label className="form-field">
                <span>Método de pago <b>*</b></span>
                <select value={method} onChange={(event) => setMethod(event.target.value)} required>
                  <option>Transferencia bancaria</option>
                  <option>Efectivo</option>
                  <option>Cheque</option>
                  <option>Otro</option>
                </select>
              </label>
              <label className="form-field">
                <span>Referencia bancaria {transferMethod && <b>*</b>}</span>
                <input
                  value={bankReference}
                  onChange={(event) => setBankReference(event.target.value)}
                  maxLength={100}
                  placeholder={transferMethod ? 'Identificador de la operación' : 'No aplica'}
                  required={transferMethod}
                />
              </label>
              <label className="form-field">
                <span>Observaciones <em>(opcional)</em></span>
                <input
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  maxLength={500}
                  placeholder="Descripción adicional"
                />
              </label>
              <div className="payment-form-actions">
                <button className="button-secondary" type="button" onClick={clearForm} disabled={saving}>Limpiar</button>
                <button className="button-primary" type="submit" disabled={loading || saving || !selectedObligation}>
                  Registrar pago
                </button>
              </div>
              {obligations.filter((item) => item.origin === origin).length === 0 && !loading && (
                <p className="form-empty">No hay obligaciones pendientes para este tipo.</p>
              )}
            </form>
          </article>

          <aside className="payment-panel obligation-panel" aria-labelledby="obligation-title">
            <div className="panel-heading"><h2 id="obligation-title">Detalle de la obligación</h2></div>
            {selectedObligation ? (
              <>
                <dl className="obligation-details">
                  <div><dt>Identificador:</dt><dd>{selectedObligation.code}</dd></div>
                  <div><dt>Beneficiario:</dt><dd>{selectedObligation.beneficiary}</dd></div>
                  <div><dt>Monto original:</dt><dd>{formatMoney(selectedObligation.originalAmount)}</dd></div>
                  <div><dt>Saldo pendiente:</dt><dd className="balance-value">{formatMoney(selectedObligation.outstandingBalance)}</dd></div>
                  <div><dt>Fecha de vencimiento:</dt><dd>{formatDate(selectedObligation.dueDate)}</dd></div>
                  <div>
                    <dt>Estado:</dt>
                    <dd><span className={`obligation-status ${isOverdue(selectedObligation) ? 'overdue' : selectedObligation.status.toLowerCase()}`}>
                      {isOverdue(selectedObligation) ? 'Vencida' : selectedObligation.status === 'PARCIAL' ? 'Parcial' : 'Pendiente'}
                    </span></dd>
                  </div>
                </dl>
                <p className="payment-notice"><span aria-hidden="true">i</span> Registrar un pago no ejecuta una transferencia bancaria.</p>
              </>
            ) : (
              <div className="obligation-empty">Selecciona una obligación pendiente para consultar su detalle.</div>
            )}
          </aside>
        </section>

        <section className="payment-panel payment-history" aria-labelledby="history-title">
          <div className="panel-heading history-heading"><h2 id="history-title">Consulta de pagos</h2></div>
          <div className="payment-filters">
            <label className="search-field">
              <span className="visually-hidden">Buscar por ID, obligación o beneficiario</span>
              <input
                type="search"
                value={query}
                onChange={(event) => changeFilter(() => setQuery(event.target.value))}
                placeholder="Buscar por ID, obligación o beneficiario..."
              />
            </label>
            <label className="filter-field">
              <span>Tipo</span>
              <select value={originFilter} onChange={(event) => changeFilter(() => setOriginFilter(event.target.value))}>
                <option value="TODOS">Todos</option>
                <option value="PROVEEDOR">Proveedor</option>
                <option value="NOMINA">Nómina</option>
              </select>
            </label>
            <label className="filter-field">
              <span>Desde</span>
              <input type="date" value={fromDate} onChange={(event) => changeFilter(() => setFromDate(event.target.value))} />
            </label>
            <label className="filter-field">
              <span>Hasta</span>
              <input type="date" value={toDate} onChange={(event) => changeFilter(() => setToDate(event.target.value))} />
            </label>
          </div>
          <p className="status-note">El estado “Registrado” indica que el movimiento está guardado en el ERP; no confirma una transferencia.</p>
          <div className="payment-table-wrap">
            <table className="payment-table">
              <thead>
                <tr>
                  <th>ID</th><th>Origen</th><th>Beneficiario</th><th>Monto</th><th>Fecha</th><th>Estado</th><th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="table-message">Cargando pagos...</td></tr>
                ) : loadError ? (
                  <tr><td colSpan={7} className="table-message">No se pudo cargar el historial. Revisa el mensaje anterior e inténtalo de nuevo.</td></tr>
                ) : pagePayments.length === 0 ? (
                  <tr><td colSpan={7} className="table-message">No hay pagos que coincidan con la búsqueda.</td></tr>
                ) : pagePayments.map((payment) => (
                  <tr key={payment.id}>
                    <td className="payment-id">{displayPaymentId(payment.id)}</td>
                    <td>{payment.origin === 'PROVEEDOR' ? 'Proveedor' : 'Nómina'}</td>
                    <td>{payment.beneficiary}</td>
                    <td className="table-amount">{formatMoney(payment.amount)}</td>
                    <td>{formatDate(payment.paymentDate)}</td>
                    <td><span className="payment-status registered">Registrado</span></td>
                    <td><button className="detail-button" type="button" onClick={() => void showPayment(payment.id)}>Ver detalle</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="table-footer">
            <span>{filteredPayments.length} pago{filteredPayments.length === 1 ? '' : 's'} encontrados</span>
            {pageCount > 1 && (
              <div className="pagination" aria-label="Paginación">
                <button type="button" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1}>Anterior</button>
                <span>Página {page} de {pageCount}</span>
                <button type="button" onClick={() => setPage((current) => Math.min(pageCount, current + 1))} disabled={page === pageCount}>Siguiente</button>
              </div>
            )}
          </div>
        </section>

        {candidate && selectedObligation && (
          <div className="modal-backdrop">
            <section className="payment-modal" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title">
              <h2 id="confirm-title">Confirmar registro del pago</h2>
              <p>¿Registrar <strong>{formatMoney(candidate.amount)}</strong> para <strong>{selectedObligation.beneficiary}</strong> ({selectedObligation.code})?</p>
              <p className="modal-warning">Esta acción registra el movimiento en el ERP. No realiza una transferencia bancaria.</p>
              <div className="modal-actions">
                <button className="button-secondary" type="button" onClick={() => { setCandidate(null); setCandidateIdempotencyKey(null); }} disabled={saving}>Cancelar</button>
                <button className="button-primary" type="button" onClick={() => void confirmPayment()} disabled={saving}>
                  {saving ? 'Registrando...' : 'Confirmar pago'}
                </button>
              </div>
            </section>
          </div>
        )}

        {(selectedPayment || detailError) && (
          <div className="modal-backdrop" onMouseDown={(event) => {
            if (event.target === event.currentTarget) setSelectedPayment(null);
          }}>
            <section className="payment-modal detail-modal" role="dialog" aria-modal="true" aria-labelledby="detail-title">
              <button className="modal-close" type="button" aria-label="Cerrar detalle" onClick={() => setSelectedPayment(null)}>×</button>
              <h2 id="detail-title">Detalle del pago</h2>
              {detailError ? <p role="alert">{detailError}</p> : selectedPayment && (
                <>
                  <dl className="obligation-details modal-details">
                    <div><dt>ID del pago:</dt><dd>{displayPaymentId(selectedPayment.id)}</dd></div>
                    <div><dt>Obligación:</dt><dd>{selectedPayment.obligationCode}</dd></div>
                    <div><dt>Origen:</dt><dd>{selectedPayment.origin === 'PROVEEDOR' ? 'Proveedor' : 'Nómina'}</dd></div>
                    <div><dt>Beneficiario:</dt><dd>{selectedPayment.beneficiary}</dd></div>
                    <div><dt>Monto:</dt><dd>{formatMoney(selectedPayment.amount)}</dd></div>
                    <div><dt>Fecha de pago:</dt><dd>{formatDate(selectedPayment.paymentDate)}</dd></div>
                    <div><dt>Método:</dt><dd>{selectedPayment.method}</dd></div>
                    <div><dt>Referencia:</dt><dd>{selectedPayment.bankReference || 'No informada'}</dd></div>
                    <div><dt>Observaciones:</dt><dd>{selectedPayment.notes || 'Sin observaciones'}</dd></div>
                    <div><dt>Registro:</dt><dd>{new Date(selectedPayment.createdAt).toLocaleString('es-CL')}</dd></div>
                    {'balanceBeforePayment' in selectedPayment && (
                      <div><dt>Saldo tras el registro:</dt><dd>{formatMoney(selectedPayment.balanceAfterPayment)}</dd></div>
                    )}
                  </dl>
                  <p className="modal-warning">El pago está registrado en el ERP. No se ejecutó una transferencia bancaria.</p>
                </>
              )}
              <div className="modal-actions"><button className="button-secondary" type="button" onClick={() => setSelectedPayment(null)}>Cerrar</button></div>
            </section>
          </div>
        )}
      </main>
    </FinanceLayout>
  );
}

export default PaymentsPage;
