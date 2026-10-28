import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { FinanceLayout, type FinancePage } from '../../shared/layout/FinanceLayout';
import { demoAccounts } from './paymentRequest.mock';
import type {
  CreatePaymentRequestPayload,
  OperationType,
  PaymentMethod,
  PaymentRequestErrors,
  PaymentRequestField,
  PaymentRequestFormValues,
} from './paymentRequest.types';
import {
  MAX_DESCRIPTION_LENGTH,
  accountsFor,
  buildPaymentRequestPayload,
  isPayable,
  parseAmount,
  selectedAccount,
  validatePaymentRequest,
} from './paymentRequest.validation';
import './PaymentRequestPage.css';

const currency = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 2,
});
const amountFormat = new Intl.NumberFormat('es-CL', { maximumFractionDigits: 2 });
const dateFormat = new Intl.DateTimeFormat('es-CL');

const operationOptions: { value: OperationType; label: string; hint: string; icon: string }[] = [
  { value: 'cobro', label: 'Cobro a cliente', hint: 'Abono a una cuenta por cobrar', icon: '↓' },
  { value: 'proveedor', label: 'Pago a proveedor', hint: 'Abono a una cuenta por pagar', icon: '↑' },
  { value: 'nomina', label: 'Pago de nómina', hint: 'Remuneración de un empleado', icon: '◎' },
  { value: 'reembolso', label: 'Reembolso', hint: 'Devolución de gastos', icon: '↺' },
];

const methodOptions: { value: PaymentMethod; label: string }[] = [
  { value: 'transferencia', label: 'Transferencia' },
  { value: 'efectivo', label: 'Efectivo' },
  { value: 'tarjeta', label: 'Tarjeta' },
  { value: 'simulado', label: 'Simulado' },
];

// Orden en que se enfocan los campos con error al enviar.
const fieldOrder: PaymentRequestField[] = [
  'operationType', 'accountId', 'payrollId', 'employeeId', 'refundId', 'amount', 'method', 'description', 'confirmed',
];

const emptyForm: PaymentRequestFormValues = {
  operationType: '',
  accountId: '',
  payrollId: '',
  employeeId: '',
  refundId: '',
  amount: '',
  method: '',
  description: '',
  confirmed: false,
};

const fieldId = (field: PaymentRequestField) => `pr-${field}`;
const errorId = (field: PaymentRequestField) => `pr-${field}-error`;

function formatDate(value: string) {
  return dateFormat.format(new Date(`${value}T12:00:00`));
}

function operationLabel(value: OperationType | '') {
  return operationOptions.find((item) => item.value === value)?.label ?? '—';
}

function methodLabel(value: PaymentMethod | '') {
  return methodOptions.find((item) => item.value === value)?.label ?? '—';
}

// La maqueta aún no consume la API. Al conectarla, reemplazar por
// fetch(`${apiBaseUrl}/api/finanzas/pagos`, { method: 'POST', body: JSON.stringify(payload) }).
async function submitPaymentRequest(payload: CreatePaymentRequestPayload) {
  return payload;
}

function FieldError({ field, errors }: { field: PaymentRequestField; errors: PaymentRequestErrors }) {
  if (!errors[field]) return null;
  return <small className="pr-error" id={errorId(field)}><span aria-hidden="true">!</span>{errors[field]}</small>;
}

function ConfirmModal({ onClose, children }: { onClose: () => void; children: ReactNode }) {
  const confirmRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    confirmRef.current?.querySelector<HTMLButtonElement>('.pr-button.primary')?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  return (
    <div className="pr-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="pr-modal" role="alertdialog" aria-modal="true" aria-labelledby="pr-modal-title" ref={confirmRef}>
        <header className="pr-modal-header">
          <div><p>LESGO · CONFIRMACIÓN</p><h2 id="pr-modal-title">Confirmar solicitud de pago</h2></div>
          <button type="button" className="pr-close-button" aria-label="Cerrar ventana" onClick={onClose}>×</button>
        </header>
        <div className="pr-modal-content">{children}</div>
      </section>
    </div>
  );
}

function PaymentRequestPage({ onNavigate }: { onNavigate: (page: FinancePage) => void }) {
  const [values, setValues] = useState<PaymentRequestFormValues>(emptyForm);
  const [touched, setTouched] = useState<Partial<Record<PaymentRequestField, boolean>>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [candidate, setCandidate] = useState<CreatePaymentRequestPayload | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [registered, setRegistered] = useState<CreatePaymentRequestPayload | null>(null);
  const errorSummaryRef = useRef<HTMLDivElement>(null);

  const errors = useMemo(() => validatePaymentRequest(values, demoAccounts), [values]);
  const visibleErrors = useMemo(() => {
    const visible: PaymentRequestErrors = {};
    for (const field of fieldOrder) {
      if (errors[field] && (submitAttempted || touched[field])) visible[field] = errors[field];
    }
    return visible;
  }, [errors, submitAttempted, touched]);

  const accountOptions = accountsFor(values.operationType, demoAccounts);
  const account = selectedAccount(values, demoAccounts);
  const amount = parseAmount(values.amount);
  const remainingBalance = account && amount !== null ? account.outstandingBalance - amount : null;
  const needsAccount = values.operationType === 'cobro' || values.operationType === 'proveedor';
  const accountLabel = values.operationType === 'cobro' ? 'Cuenta por cobrar' : 'Cuenta por pagar';
  const summaryErrors = fieldOrder.filter((field) => visibleErrors[field]);
  const step = registered ? 3 : candidate ? 2 : 1;

  function update<K extends PaymentRequestField>(field: K, value: PaymentRequestFormValues[K]) {
    setValues((current) => ({ ...current, [field]: value }));
    setSubmitError('');
  }

  function markTouched(field: PaymentRequestField) {
    setTouched((current) => (current[field] ? current : { ...current, [field]: true }));
  }

  function changeOperation(operationType: OperationType) {
    setValues((current) => ({ ...current, operationType, accountId: '', payrollId: '', employeeId: '', refundId: '' }));
    setTouched((current) => ({ ...current, operationType: true, accountId: false, payrollId: false, employeeId: false, refundId: false }));
  }

  function formatAmountOnBlur() {
    markTouched('amount');
    const parsed = parseAmount(values.amount);
    if (parsed !== null && parsed > 0) update('amount', amountFormat.format(parsed));
  }

  function payFullBalance() {
    if (!account) return;
    update('amount', amountFormat.format(account.outstandingBalance));
    markTouched('amount');
  }

  function resetForm() {
    setValues(emptyForm);
    setTouched({});
    setSubmitAttempted(false);
    setCandidate(null);
    setSubmitError('');
    setRegistered(null);
  }

  function focusField(field: PaymentRequestField) {
    document.getElementById(fieldId(field))?.focus();
  }

  function reviewRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitAttempted(true);
    setSubmitError('');
    const firstInvalid = fieldOrder.find((field) => errors[field]);
    if (firstInvalid) {
      // Se espera al render que muestra el resumen para anunciarlo y luego enfocar el campo.
      requestAnimationFrame(() => {
        errorSummaryRef.current?.scrollIntoView({ block: 'nearest' });
        focusField(firstInvalid);
      });
      return;
    }
    setCandidate(buildPaymentRequestPayload(values));
  }

  async function confirmRequest() {
    if (!candidate || submitting) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      setRegistered(await submitPaymentRequest(candidate));
      setCandidate(null);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'No se pudo registrar la solicitud de pago.');
    } finally {
      setSubmitting(false);
    }
  }

  function describedBy(field: PaymentRequestField, hintId?: string) {
    return [hintId, visibleErrors[field] ? errorId(field) : undefined].filter(Boolean).join(' ') || undefined;
  }

  return (
    <FinanceLayout activePage="Registrar pago" onNavigate={onNavigate} footerNote="Formulario de maqueta" layoutClassName="payment-request-layout">
      <main className="dashboard-content pr-content">
        <header className="page-heading pr-page-heading">
          <div>
            <p className="page-eyebrow">LESGO · MÓDULO FINANCIERO</p>
            <h1>Registrar solicitud de pago</h1>
            <p className="pr-subtitle">Crea una solicitud que quedará <strong>pendiente</strong> hasta su aprobación en Gestión de caja.</p>
          </div>
          <span className="pr-mode-badge">Maqueta · sin conexión a la API</span>
        </header>

        <ol className="pr-steps" aria-label="Progreso del registro">
          {['Datos del pago', 'Confirmación', 'Solicitud registrada'].map((label, index) => (
            <li key={label} className={step === index + 1 ? 'is-current' : step > index + 1 ? 'is-done' : ''} aria-current={step === index + 1 ? 'step' : undefined}>
              <span>{step > index + 1 ? '✓' : index + 1}</span>{label}
            </li>
          ))}
        </ol>

        {registered ? (
          <section className="pr-panel pr-success" role="status" aria-labelledby="pr-success-title">
            <span className="pr-success-icon" aria-hidden="true">✓</span>
            <h2 id="pr-success-title">Solicitud validada y lista para enviar</h2>
            <p>
              {operationLabel(registered.tipo_operacion)} por <strong>{currency.format(registered.monto)}</strong> mediante {methodLabel(registered.metodo_pago).toLocaleLowerCase('es-CL')}.
              Al conectarse a la API quedará en estado <strong>pendiente</strong> hasta que un administrador la apruebe.
            </p>
            <details className="pr-payload">
              <summary>Ver cuerpo de POST /api/finanzas/pagos</summary>
              <pre>{JSON.stringify(registered, null, 2)}</pre>
            </details>
            <div className="pr-success-actions">
              <button type="button" className="pr-button secondary" onClick={() => onNavigate('Registro de pagos')}>Ir a Gestión de caja</button>
              <button type="button" className="pr-button primary" onClick={resetForm}>Registrar otra solicitud</button>
            </div>
          </section>
        ) : (
          <div className="pr-workspace">
            <form className="pr-panel pr-form" onSubmit={reviewRequest} noValidate aria-labelledby="pr-form-title">
              <div className="pr-panel-heading">
                <h2 id="pr-form-title">Datos de la solicitud</h2>
                <p>Los campos marcados con <b>*</b> son obligatorios.</p>
              </div>

              {submitAttempted && summaryErrors.length > 0 && (
                <div className="pr-error-summary" role="alert" ref={errorSummaryRef} tabIndex={-1}>
                  <strong>Revisa {summaryErrors.length === 1 ? 'el siguiente campo' : `los siguientes ${summaryErrors.length} campos`}:</strong>
                  <ul>
                    {summaryErrors.map((field) => (
                      <li key={field}><a href={`#${fieldId(field)}`} onClick={(event) => { event.preventDefault(); focusField(field); }}>{visibleErrors[field]}</a></li>
                    ))}
                  </ul>
                </div>
              )}

              <fieldset className="pr-section">
                <legend><span>1</span>Origen de la operación</legend>
                <div
                  className="pr-option-grid"
                  role="radiogroup"
                  aria-label="Tipo de operación"
                  aria-required="true"
                  aria-invalid={Boolean(visibleErrors.operationType)}
                  aria-describedby={describedBy('operationType')}
                >
                  {operationOptions.map((option, index) => (
                    <label key={option.value} className={`pr-option-card${values.operationType === option.value ? ' is-selected' : ''}`}>
                      <input
                        type="radio"
                        name="operationType"
                        id={index === 0 ? fieldId('operationType') : undefined}
                        value={option.value}
                        checked={values.operationType === option.value}
                        onChange={() => changeOperation(option.value)}
                      />
                      <span className="pr-option-icon" aria-hidden="true">{option.icon}</span>
                      <span className="pr-option-text"><strong>{option.label}</strong><small>{option.hint}</small></span>
                    </label>
                  ))}
                </div>
                <FieldError field="operationType" errors={visibleErrors} />

                {needsAccount && (
                  <div className="pr-field">
                    <label htmlFor={fieldId('accountId')}>{accountLabel} <b>*</b></label>
                    <select
                      id={fieldId('accountId')}
                      value={values.accountId}
                      onChange={(event) => { update('accountId', event.target.value); markTouched('accountId'); }}
                      onBlur={() => markTouched('accountId')}
                      aria-invalid={Boolean(visibleErrors.accountId)}
                      aria-describedby={describedBy('accountId')}
                    >
                      <option value="">Selecciona una cuenta</option>
                      {accountOptions.map((item) => (
                        <option key={item.id} value={item.id} disabled={!isPayable(item)}>
                          #{item.id} · {item.originReference} · {item.counterparty} · {isPayable(item) ? `saldo ${currency.format(item.outstandingBalance)}` : item.status}
                        </option>
                      ))}
                    </select>
                    <FieldError field="accountId" errors={visibleErrors} />
                  </div>
                )}

                {values.operationType === 'nomina' && (
                  <div className="pr-field-row">
                    <div className="pr-field">
                      <label htmlFor={fieldId('payrollId')}>ID de nómina <b>*</b></label>
                      <input
                        id={fieldId('payrollId')}
                        inputMode="numeric"
                        autoComplete="off"
                        placeholder="Ej.: 42"
                        value={values.payrollId}
                        onChange={(event) => update('payrollId', event.target.value)}
                        onBlur={() => markTouched('payrollId')}
                        aria-invalid={Boolean(visibleErrors.payrollId)}
                        aria-describedby={describedBy('payrollId')}
                      />
                      <FieldError field="payrollId" errors={visibleErrors} />
                    </div>
                    <div className="pr-field">
                      <label htmlFor={fieldId('employeeId')}>ID de empleado <b>*</b></label>
                      <input
                        id={fieldId('employeeId')}
                        inputMode="numeric"
                        autoComplete="off"
                        placeholder="Ej.: 108"
                        value={values.employeeId}
                        onChange={(event) => update('employeeId', event.target.value)}
                        onBlur={() => markTouched('employeeId')}
                        aria-invalid={Boolean(visibleErrors.employeeId)}
                        aria-describedby={describedBy('employeeId')}
                      />
                      <FieldError field="employeeId" errors={visibleErrors} />
                    </div>
                  </div>
                )}

                {values.operationType === 'reembolso' && (
                  <div className="pr-field">
                    <label htmlFor={fieldId('refundId')}>ID de reembolso <b>*</b></label>
                    <input
                      id={fieldId('refundId')}
                      inputMode="numeric"
                      autoComplete="off"
                      placeholder="Ej.: 15"
                      value={values.refundId}
                      onChange={(event) => update('refundId', event.target.value)}
                      onBlur={() => markTouched('refundId')}
                      aria-invalid={Boolean(visibleErrors.refundId)}
                      aria-describedby={describedBy('refundId')}
                    />
                    <FieldError field="refundId" errors={visibleErrors} />
                  </div>
                )}
              </fieldset>

              <fieldset className="pr-section">
                <legend><span>2</span>Detalle del pago</legend>
                <div className="pr-field">
                  <label htmlFor={fieldId('amount')}>Monto (CLP) <b>*</b></label>
                  <div className={`pr-amount-input${visibleErrors.amount ? ' is-invalid' : ''}`}>
                    <span aria-hidden="true">$</span>
                    <input
                      id={fieldId('amount')}
                      inputMode="decimal"
                      autoComplete="off"
                      placeholder="0"
                      value={values.amount}
                      onChange={(event) => update('amount', event.target.value)}
                      onBlur={formatAmountOnBlur}
                      aria-invalid={Boolean(visibleErrors.amount)}
                      aria-describedby={describedBy('amount', account ? 'pr-amount-hint' : undefined)}
                    />
                    {account && isPayable(account) && (
                      <button type="button" className="pr-inline-button" onClick={payFullBalance}>Saldo total</button>
                    )}
                  </div>
                  {account && isPayable(account) && (
                    <small className="pr-hint" id="pr-amount-hint">Saldo pendiente: {currency.format(account.outstandingBalance)}</small>
                  )}
                  <FieldError field="amount" errors={visibleErrors} />
                </div>

                <div className="pr-field">
                  <span className="pr-label" id="pr-method-label">Método de pago <b>*</b></span>
                  <div
                    className="pr-segmented"
                    role="radiogroup"
                    aria-labelledby="pr-method-label"
                    aria-required="true"
                    aria-invalid={Boolean(visibleErrors.method)}
                    aria-describedby={describedBy('method')}
                  >
                    {methodOptions.map((option, index) => (
                      <label key={option.value} className={values.method === option.value ? 'is-selected' : ''}>
                        <input
                          type="radio"
                          name="method"
                          id={index === 0 ? fieldId('method') : undefined}
                          value={option.value}
                          checked={values.method === option.value}
                          onChange={() => { update('method', option.value); markTouched('method'); }}
                        />
                        {option.label}
                      </label>
                    ))}
                  </div>
                  <FieldError field="method" errors={visibleErrors} />
                </div>

                <div className="pr-field">
                  <label htmlFor={fieldId('description')}>Descripción <em>(opcional)</em></label>
                  <textarea
                    id={fieldId('description')}
                    rows={3}
                    placeholder="Ej.: Abono de la venta #101"
                    value={values.description}
                    onChange={(event) => update('description', event.target.value)}
                    onBlur={() => markTouched('description')}
                    aria-invalid={Boolean(visibleErrors.description)}
                    aria-describedby={describedBy('description', 'pr-description-count')}
                  />
                  <small className={`pr-counter${values.description.trim().length > MAX_DESCRIPTION_LENGTH ? ' is-over' : ''}`} id="pr-description-count">
                    {values.description.trim().length} / {MAX_DESCRIPTION_LENGTH}
                  </small>
                  <FieldError field="description" errors={visibleErrors} />
                </div>
              </fieldset>

              <div className="pr-confirm">
                <label className="pr-checkbox">
                  <input
                    type="checkbox"
                    id={fieldId('confirmed')}
                    checked={values.confirmed}
                    onChange={(event) => { update('confirmed', event.target.checked); markTouched('confirmed'); }}
                    aria-invalid={Boolean(visibleErrors.confirmed)}
                    aria-describedby={describedBy('confirmed')}
                  />
                  <span>Confirmo que revisé el origen, el monto y el método de pago. <b>*</b></span>
                </label>
                <FieldError field="confirmed" errors={visibleErrors} />
              </div>

              <div className="pr-form-actions">
                <button type="button" className="pr-button secondary" onClick={resetForm}>Limpiar</button>
                <button type="submit" className="pr-button primary">Revisar y registrar</button>
              </div>
            </form>

            <aside className="pr-panel pr-summary" aria-labelledby="pr-summary-title">
              <div className="pr-panel-heading"><h2 id="pr-summary-title">Resumen</h2><p>Se actualiza mientras completas el formulario.</p></div>
              <dl className="pr-summary-list">
                <div><dt>Operación</dt><dd>{operationLabel(values.operationType)}</dd></div>
                {account && <>
                  <div><dt>{accountLabel}</dt><dd>#{account.id} · {account.originReference}</dd></div>
                  <div><dt>{values.operationType === 'cobro' ? 'Cliente' : 'Proveedor'}</dt><dd>{account.counterparty}</dd></div>
                  <div><dt>Vencimiento</dt><dd>{formatDate(account.dueDate)}</dd></div>
                  <div><dt>Saldo actual</dt><dd>{currency.format(account.outstandingBalance)}</dd></div>
                </>}
                {values.operationType === 'nomina' && <div><dt>Nómina / empleado</dt><dd>{values.payrollId || '—'} / {values.employeeId || '—'}</dd></div>}
                {values.operationType === 'reembolso' && <div><dt>Reembolso</dt><dd>{values.refundId || '—'}</dd></div>}
                <div><dt>Método</dt><dd>{methodLabel(values.method)}</dd></div>
                <div className="pr-summary-total"><dt>Monto</dt><dd>{amount !== null && amount > 0 ? currency.format(amount) : '—'}</dd></div>
                {remainingBalance !== null && amount !== null && amount > 0 && (
                  <div className={remainingBalance < 0 ? 'is-negative' : ''}><dt>Saldo tras ejecutar</dt><dd>{currency.format(remainingBalance)}</dd></div>
                )}
              </dl>
              <p className="pr-notice"><span aria-hidden="true">i</span>Registrar crea una solicitud pendiente. No mueve dinero hasta que sea aprobada y ejecutada.</p>
            </aside>
          </div>
        )}
      </main>

      {candidate && (
        <ConfirmModal onClose={() => { if (!submitting) setCandidate(null); }}>
          <dl className="pr-summary-list pr-modal-summary">
            <div><dt>Operación</dt><dd>{operationLabel(candidate.tipo_operacion)}</dd></div>
            {account && <div><dt>{accountLabel}</dt><dd>#{account.id} · {account.counterparty}</dd></div>}
            {candidate.id_nomina && <div><dt>Nómina / empleado</dt><dd>{candidate.id_nomina} / {candidate.id_empleado}</dd></div>}
            {candidate.id_reembolso && <div><dt>Reembolso</dt><dd>{candidate.id_reembolso}</dd></div>}
            <div><dt>Método</dt><dd>{methodLabel(candidate.metodo_pago)}</dd></div>
            {candidate.descripcion && <div><dt>Descripción</dt><dd>{candidate.descripcion}</dd></div>}
            <div className="pr-summary-total"><dt>Monto</dt><dd>{currency.format(candidate.monto)}</dd></div>
          </dl>
          {submitError && <p className="pr-submit-error" role="alert">{submitError}</p>}
          <div className="pr-modal-actions">
            <button type="button" className="pr-button secondary" onClick={() => setCandidate(null)} disabled={submitting}>Volver a editar</button>
            <button type="button" className="pr-button primary" onClick={() => void confirmRequest()} disabled={submitting} aria-busy={submitting}>
              {submitting ? 'Registrando…' : 'Confirmar solicitud'}
            </button>
          </div>
        </ConfirmModal>
      )}
    </FinanceLayout>
  );
}

export default PaymentRequestPage;
