import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react';
import { FinanceLayout, type FinancePage } from '../../shared/layout/FinanceLayout';
import {
  demoLedgerRows,
  demoMonthlyData,
  demoPayableRows,
  demoReceivableRows,
  initialReportHistory,
  reportCategories,
  reportDefinitions,
  type ReportCategory,
  type ReportDefinition,
  type ReportFormat,
  type ReportHistoryItem,
  type ReportPeriodicity,
} from './reports.mock';
import './ReportsPage.css';

const money = new Intl.NumberFormat('es-CL', {
  style: 'currency',
  currency: 'CLP',
  maximumFractionDigits: 0,
});
const amount = (value: number) => money.format(value);
const initialFrom = '2026-05-01';
const initialTo = '2026-10-23';
const periodicities: ReportPeriodicity[] = ['Mensual', 'Trimestral', 'Anual'];

function Icon({ name, size = 20 }: { name: string; size?: number }) {
  const shared = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.9,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true as const,
  };
  if (name === 'chart') return <svg {...shared}><path d="M4 19V9m6 10V4m6 15v-7m5 7H2" /></svg>;
  if (name === 'book') return <svg {...shared}><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v17H6.5A2.5 2.5 0 0 1 4 17.5v-12Z" /><path d="M4 17.5A2.5 2.5 0 0 1 6.5 15H20M8 7h8" /></svg>;
  if (name === 'receipt') return <svg {...shared}><path d="M6 3h12v18l-3-2-3 2-3-2-3 2V3Z" /><path d="M9 8h6m-6 4h6m-6 4h3" /></svg>;
  if (name === 'settings') return <svg {...shared}><path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z" /><path d="m19.4 15 1.2 1-1.5 2.6-1.5-.6a8 8 0 0 1-1.6.9l-.3 1.6h-3l-.3-1.6a8 8 0 0 1-1.6-.9l-1.5.6-1.5-2.6 1.2-1a7 7 0 0 1 0-1.9l-1.2-1 1.5-2.6 1.5.6a8 8 0 0 1 1.6-.9l.3-1.6h3l.3 1.6a8 8 0 0 1 1.6.9l1.5-.6 1.5 2.6-1.2 1a7 7 0 0 1 0 1.9Z" transform="translate(-1 -2)" /></svg>;
  if (name === 'search') return <svg {...shared}><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 5 5" /></svg>;
  if (name === 'eye') return <svg {...shared}><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" /><circle cx="12" cy="12" r="2.5" /></svg>;
  if (name === 'download') return <svg {...shared}><path d="M12 3v12m-5-5 5 5 5-5M4 17v4h16v-4" /></svg>;
  if (name === 'file') return <svg {...shared}><path d="M6 2h8l5 5v15H6z" /><path d="M14 2v6h5M9 13h7m-7 4h7" /></svg>;
  if (name === 'refresh') return <svg {...shared}><path d="M20 7v5h-5M4 17v-5h5" /><path d="M5.6 9A7 7 0 0 1 18 6l2 6M4 12l2 6a7 7 0 0 0 12.4-3" /></svg>;
  if (name === 'close') return <svg {...shared}><path d="m6 6 12 12M18 6 6 18" /></svg>;
  if (name === 'shield') return <svg {...shared}><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" /><path d="m9 12 2 2 4-4" /></svg>;
  return <svg {...shared}><circle cx="12" cy="12" r="9" /><path d="M12 8v4m0 4h.01" /></svg>;
}

function getPeriodLabel(from: string, to: string) {
  const format = new Intl.DateTimeFormat('es-CL', { day: '2-digit', month: 'short', year: 'numeric' });
  if (!from || !to) return 'Selecciona un período';
  return `${format.format(new Date(`${from}T12:00:00`))} - ${format.format(new Date(`${to}T12:00:00`))}`;
}

function getGroupedData(from: string, to: string, periodicity: ReportPeriodicity) {
  const selected = demoMonthlyData.filter((item) => item.date <= to && new Date(`${item.date.slice(0, 7)}-31`) >= new Date(`${from}T00:00:00`));
  const grouped = new Map<string, typeof selected[number]>();
  selected.forEach((item) => {
    const date = new Date(`${item.date}T12:00:00`);
    const quarter = Math.floor(date.getMonth() / 3) + 1;
    const key = periodicity === 'Anual'
      ? `${date.getFullYear()}`
      : periodicity === 'Trimestral'
        ? `T${quarter} ${date.getFullYear()}`
        : item.month;
    const existing = grouped.get(key);
    grouped.set(key, existing
      ? {
          ...existing,
          income: existing.income + item.income,
          expense: existing.expense + item.expense,
          cashIn: existing.cashIn + item.cashIn,
          cashOut: existing.cashOut + item.cashOut,
        }
      : { ...item, month: key });
  });
  return Array.from(grouped.values());
}

function ReportChart({
  data,
  incomeLabel = 'Ingresos',
  expenseLabel = 'Gastos',
}: {
  data: ReturnType<typeof getGroupedData>;
  incomeLabel?: string;
  expenseLabel?: string;
}) {
  if (!data.length) return <div className="reports-empty-chart">No hay datos demostrativos para el período seleccionado.</div>;
  const max = Math.max(...data.flatMap((item) => [item.income, item.expense])) * 1.2;
  const plot = { x: 43, y: 16, width: 580, height: 135 };
  const groupWidth = plot.width / data.length;
  const barWidth = Math.min(24, groupWidth * 0.27);
  const yAt = (value: number) => plot.y + plot.height - (value / max) * plot.height;
  const ticks = [0, 0.5, 1].map((factor) => max * factor);

  return (
    <div className="reports-chart-wrap">
      <svg className="reports-chart" viewBox="0 0 650 205" role="img" aria-label={`${incomeLabel} comparados con ${expenseLabel}`}>
        {ticks.map((tick) => {
          const y = yAt(tick);
          return <g key={tick}><line x1={plot.x} x2={plot.x + plot.width} y1={y} y2={y} className="report-chart-grid" /><text x={plot.x - 7} y={y + 4} textAnchor="end" className="report-chart-axis">{Math.round(tick / 1000).toLocaleString('es-CL')}</text></g>;
        })}
        {data.map((item, index) => {
          const center = plot.x + groupWidth * index + groupWidth / 2;
          return (
            <g key={item.month}>
              <rect x={center - barWidth - 2} y={yAt(item.income)} width={barWidth} height={plot.y + plot.height - yAt(item.income)} rx="3" className="report-chart-income" />
              <rect x={center + 2} y={yAt(item.expense)} width={barWidth} height={plot.y + plot.height - yAt(item.expense)} rx="3" className="report-chart-expense" />
              <text x={center} y={plot.y + plot.height + 19} textAnchor="middle" className="report-chart-label">{item.month}</text>
            </g>
          );
        })}
        <line x1={plot.x} x2={plot.x + plot.width} y1={plot.y + plot.height} y2={plot.y + plot.height} className="report-chart-baseline" />
      </svg>
      <div className="report-chart-legend"><span><i className="legend-income" />{incomeLabel}</span><span><i className="legend-expense" />{expenseLabel}</span></div>
    </div>
  );
}

function ReportPreview({
  report,
  from,
  to,
  periodicity,
  detailed = false,
}: {
  report: ReportDefinition;
  from: string;
  to: string;
  periodicity: ReportPeriodicity;
  detailed?: boolean;
}) {
  const grouped = getGroupedData(from, to, periodicity);
  const totals = grouped.reduce((result, item) => ({
    income: result.income + item.income,
    expense: result.expense + item.expense,
    cashIn: result.cashIn + item.cashIn,
    cashOut: result.cashOut + item.cashOut,
  }), { income: 0, expense: 0, cashIn: 0, cashOut: 0 });
  const result = totals.income - totals.expense;
  const isCash = report.preview === 'cash-flow';
  const isTax = report.preview === 'tax';
  const hasChart = ['results', 'cash-flow', 'summary'].includes(report.preview);
  const rows = report.preview === 'transactions' ? demoLedgerRows
    : report.preview === 'payables' ? demoPayableRows
      : report.preview === 'receivables' ? demoReceivableRows
        : [];
  const visibleRows = rows.filter((row) => {
    const rawDate = 'description' in row ? row.date : row.dueDate;
    const [day, month, year] = rawDate.split('-');
    const date = `${year}-${month}-${day}`;
    return (!from || date >= from) && (!to || date <= to);
  });
  const metrics = isTax
    ? [
        { label: 'Base demostrativa', value: amount(totals.income), tone: 'amber' },
        { label: 'Referencia 19%*', value: amount(Math.round(totals.income * 0.19)), tone: 'red' },
        { label: 'Operaciones', value: `${grouped.length} períodos`, tone: 'green' },
      ]
    : isCash
      ? [
          { label: 'Entradas de caja', value: amount(totals.cashIn), tone: 'amber' },
          { label: 'Salidas de caja', value: amount(totals.cashOut), tone: 'red' },
          { label: 'Flujo neto', value: amount(totals.cashIn - totals.cashOut), tone: 'green' },
        ]
      : [
          { label: 'Ingresos', value: amount(totals.income), tone: 'amber' },
          { label: 'Gastos', value: amount(totals.expense), tone: 'red' },
          { label: 'Resultado neto', value: amount(result), tone: 'green' },
        ];
  const chartData = isCash
    ? grouped.map((item) => ({ ...item, income: item.cashIn, expense: item.cashOut }))
    : grouped;
  const title = isCash ? 'Entradas y salidas de caja' : 'Ingresos y egresos';

  return (
    <div className={`report-preview-body${detailed ? ' detailed' : ''}`}>
      {isTax && <p className="tax-demo-notice"><Icon name="info" size={16} /> Vista tributaria demostrativa, no constituye declaración ni asesoría oficial. Cálculo ilustrativo al 19% sobre los ingresos cargados.</p>}
      {['results', 'cash-flow', 'summary', 'tax'].includes(report.preview) ? (
        <>
          <div className="report-preview-metrics">
            {metrics.map((metric) => <article className={`report-preview-metric ${metric.tone}`} key={metric.label}><span>{metric.label}</span><strong>{metric.value}</strong></article>)}
          </div>
          {hasChart && <><h3 className="report-chart-title">{title} <span>· montos en miles de pesos</span></h3><ReportChart data={chartData} incomeLabel={isCash ? 'Entradas' : 'Ingresos'} expenseLabel={isCash ? 'Salidas' : 'Gastos'} /></>}
          {!hasChart && <div className="report-tax-footnote">*Cálculo referencial ficticio para demostración; no representa obligaciones tributarias reales.</div>}
        </>
      ) : visibleRows.length ? (
        <div className="report-preview-table-wrap">
          <p className="report-preview-intro">{report.preview === 'transactions' ? 'Movimientos demostrativos del período.' : report.preview === 'payables' ? 'Obligaciones por pagar de ejemplo.' : 'Saldos por cobrar de ejemplo.'}</p>
          <table className="report-preview-table">
            <thead><tr>{report.preview === 'transactions' ? <><th>Fecha</th><th>Descripción</th><th>Tipo</th><th>Monto</th></> : <><th>Concepto</th><th>Fecha</th><th>Estado</th><th>Monto</th></>}</tr></thead>
            <tbody>{visibleRows.map((row, index) => <tr key={`${'description' in row ? row.description : row.name}-${index}`}>{'description' in row ? <><td>{row.date}</td><td>{row.description}</td><td>{row.type}</td><td>{amount(row.amount)}</td></> : <><td>{row.name}</td><td>{row.dueDate}</td><td>{row.status}</td><td>{amount(row.amount)}</td></>}</tr>)}</tbody>
          </table>
        </div>
      ) : ['transactions', 'payables', 'receivables'].includes(report.preview)
        ? <div className="reports-empty-chart">No hay registros demostrativos dentro del período seleccionado.</div>
        : <div className="reports-empty-chart">No hay una vista previa disponible para este informe.</div>}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  return (
    <div className="report-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="report-modal" role="dialog" aria-modal="true" aria-labelledby="report-modal-title">
        <header className="report-modal-header"><div><p>LESGO · MÓDULO FINANCIERO</p><h2 id="report-modal-title">{title}</h2></div><button type="button" className="report-icon-button" onClick={onClose} aria-label="Cerrar ventana"><Icon name="close" /></button></header>
        <div className="report-modal-content">{children}</div>
      </section>
    </div>
  );
}

function ReportsPage({ onNavigate }: { onNavigate: (page: FinancePage) => void }) {
  const [category, setCategory] = useState<ReportCategory>('Financiero');
  const [reportId, setReportId] = useState('income-statement');
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);
  const [periodicity, setPeriodicity] = useState<ReportPeriodicity>('Mensual');
  const [format, setFormat] = useState<ReportFormat>('PDF');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState('');
  const [generating, setGenerating] = useState(false);
  const [history, setHistory] = useState(initialReportHistory);
  const [query, setQuery] = useState('');
  const [formatFilter, setFormatFilter] = useState('Todos');
  const [fullPreview, setFullPreview] = useState(false);
  const [selectedHistory, setSelectedHistory] = useState<ReportHistoryItem | null>(null);
  const availableReports = reportDefinitions.filter((item) => item.category === category);
  const report = availableReports.find((item) => item.id === reportId) ?? availableReports[0];
  const filteredHistory = useMemo(() => history.filter((item) =>
    item.reportName.toLocaleLowerCase('es-CL').includes(query.trim().toLocaleLowerCase('es-CL'))
    && (formatFilter === 'Todos' || item.format === formatFilter)), [formatFilter, history, query]);
  const periodLabel = getPeriodLabel(from, to);

  function chooseCategory(next: ReportCategory) {
    setCategory(next);
    const first = reportDefinitions.find((item) => item.category === next);
    if (first) setReportId(first.id);
    setFeedback('');
  }

  function clearFilters() {
    setCategory('Financiero');
    setReportId('income-statement');
    setFrom(initialFrom);
    setTo(initialTo);
    setPeriodicity('Mensual');
    setFormat('PDF');
    setErrors({});
    setFeedback('');
  }

  async function generateReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors: Record<string, string> = {};
    if (!reportId) nextErrors.report = 'Selecciona un tipo de informe.';
    if (!from) nextErrors.from = 'Ingresa una fecha de inicio.';
    if (!to) nextErrors.to = 'Ingresa una fecha de término.';
    if (from && to && from > to) nextErrors.to = 'La fecha de término debe ser igual o posterior al inicio.';
    if (!format) nextErrors.format = 'Selecciona un formato.';
    setErrors(nextErrors);
    setFeedback('');
    if (Object.keys(nextErrors).length) return;

    setGenerating(true);
    await new Promise((resolve) => window.setTimeout(resolve, 450));
    const generatedAt = new Intl.DateTimeFormat('es-CL', { dateStyle: 'short', timeStyle: 'short' }).format(new Date());
    const id = `R-${Date.now().toString().slice(-6)}`;
    setHistory((current) => [{
      id,
      reportName: report.name,
      period: periodLabel,
      generatedBy: 'Administrador (demo)',
      generatedAt,
      format,
      simulated: true,
      category,
      fromDate: from,
      toDate: to,
      periodicity,
    }, ...current]);
    setFeedback(`Simulación completada: «${report.name}» (${format}). No se generó ni descargó ningún archivo.`);
    setGenerating(false);
  }

  function reportFromHistory(item: ReportHistoryItem) {
    return reportDefinitions.find((definition) => definition.name === item.reportName) ?? reportDefinitions[0];
  }

  return (
    <FinanceLayout activePage="Emisión de informes" onNavigate={onNavigate} footerNote="Datos de demostración" layoutClassName="reports-layout">
      <main className="dashboard-content reports-content">
        <header className="page-heading reports-page-heading">
          <div><p className="page-eyebrow">LESGO · MÓDULO FINANCIERO</p><h1>Emisión de informes</h1><p className="reports-subtitle">Configura, previsualiza y exporta informes financieros</p></div>
          <div className="reports-identities"><span className="report-identity admin"><Icon name="shield" size={16} />Administrador</span><span className="report-identity demo"><Icon name="info" size={16} />Datos de demostración</span></div>
        </header>

        <div className="reports-main-grid">
          <section className="report-panel configuration-panel" aria-labelledby="configure-report-heading">
            <div className="report-panel-heading"><Icon name="settings" size={23} /><h2 id="configure-report-heading">Configurar informe</h2></div>
            <div className="report-categories" role="tablist" aria-label="Categoría de informe">
              {reportCategories.map((item) => <button type="button" role="tab" aria-selected={category === item} className={`report-category${category === item ? ' selected' : ''}`} key={item} onClick={() => chooseCategory(item)}><Icon name={item === 'Financiero' ? 'chart' : item === 'Contable' ? 'book' : 'receipt'} size={19} />{item}</button>)}
            </div>
            <form className="report-form" onSubmit={(event) => void generateReport(event)} noValidate>
              <label className="report-field full"><span>Tipo de informe <b>*</b></span><select value={reportId} aria-invalid={Boolean(errors.report)} aria-describedby={errors.report ? 'report-type-error' : undefined} onChange={(event) => { setReportId(event.target.value); setErrors((current) => ({ ...current, report: '' })); }}><option value="">Selecciona un informe</option>{availableReports.map((item) => <option value={item.id} key={item.id}>{item.name}</option>)}</select>{errors.report && <small id="report-type-error" className="field-error">{errors.report}</small>}</label>
              <label className="report-field"><span>Desde <b>*</b></span><input type="date" value={from} max={to || undefined} aria-invalid={Boolean(errors.from)} aria-describedby={errors.from ? 'report-from-error' : undefined} onChange={(event) => { setFrom(event.target.value); setErrors((current) => ({ ...current, from: '', to: '' })); }} />{errors.from && <small id="report-from-error" className="field-error">{errors.from}</small>}</label>
              <label className="report-field"><span>Hasta <b>*</b></span><input type="date" value={to} min={from || undefined} aria-invalid={Boolean(errors.to)} aria-describedby={errors.to ? 'report-to-error' : undefined} onChange={(event) => { setTo(event.target.value); setErrors((current) => ({ ...current, to: '' })); }} />{errors.to && <small id="report-to-error" className="field-error">{errors.to}</small>}</label>
              <label className="report-field"><span>Periodicidad</span><select value={periodicity} onChange={(event) => setPeriodicity(event.target.value as ReportPeriodicity)}>{periodicities.map((item) => <option key={item}>{item}</option>)}</select></label>
              <fieldset className="report-field format-field"><legend>Formato de exportación <b>*</b></legend><div className="format-options">{(['PDF', 'Excel'] as ReportFormat[]).map((item) => <label className={`format-option ${item.toLowerCase()}${format === item ? ' selected' : ''}`} key={item}><input type="radio" name="report-format" value={item} checked={format === item} onChange={() => { setFormat(item); setErrors((current) => ({ ...current, format: '' })); }} /><span className="format-radio" /><Icon name="file" size={16} />{item}</label>)}</div>{errors.format && <small className="field-error">{errors.format}</small>}</fieldset>
              <div className="report-form-actions"><button className="report-button secondary" type="button" onClick={clearFilters}><Icon name="refresh" size={17} />Limpiar filtros</button><button className="report-button primary" type="submit" disabled={generating}><Icon name="file" size={17} />{generating ? 'Preparando simulación…' : 'Generar informe'}</button></div>
            </form>
            {feedback && <div className="report-feedback" role="status"><Icon name="info" size={17} /><span>{feedback}</span><button type="button" aria-label="Cerrar mensaje" onClick={() => setFeedback('')}><Icon name="close" size={16} /></button></div>}
          </section>

          <section className="report-panel preview-panel" aria-labelledby="report-preview-heading">
            <div className="report-panel-heading preview-heading"><Icon name="chart" size={23} /><h2 id="report-preview-heading">Vista previa del informe</h2><span className="preview-type">{report.name}</span></div>
            <p className="preview-period">{periodLabel} <span>· {periodicity}</span></p>
            <ReportPreview report={report} from={from} to={to} periodicity={periodicity} />
            <button className="full-preview-link" type="button" onClick={() => setFullPreview(true)}>Ver vista completa <span aria-hidden="true">↗</span></button>
          </section>
        </div>

        <section className="report-panel history-panel" aria-labelledby="report-history-heading">
          <div className="history-heading-row"><div className="history-title"><Icon name="file" size={25} /><div><h2 id="report-history-heading">Historial de informes</h2><p>Informes generados recientemente · datos de demostración</p></div></div><div className="history-filters"><label className="history-search"><Icon name="search" size={17} /><span className="visually-hidden">Buscar informe</span><input placeholder="Buscar informe" value={query} onChange={(event) => setQuery(event.target.value)} /></label><label className="history-format"><span className="visually-hidden">Filtrar por formato</span><select value={formatFilter} onChange={(event) => setFormatFilter(event.target.value)}><option value="Todos">Todos los formatos</option><option value="PDF">PDF</option><option value="Excel">Excel</option></select></label></div></div>
          <div className="report-history-table-wrap"><table className="report-history-table"><thead><tr><th>Informe</th><th>Período</th><th>Generado por</th><th>Fecha</th><th>Formato</th><th>Acciones</th></tr></thead><tbody>{filteredHistory.map((item) => <tr key={item.id}><td><strong>{item.reportName}</strong>{item.simulated && <span className="simulation-tag">Simulado</span>}</td><td>{item.period}</td><td>{item.generatedBy}</td><td>{item.generatedAt}</td><td><span className={`history-format-badge ${item.format.toLowerCase()}`}>{item.format}</span></td><td><div className="history-actions"><button type="button" onClick={() => setSelectedHistory(item)}><Icon name="eye" size={16} />Ver</button><span aria-hidden="true">|</span><button type="button" disabled title="Descarga disponible próximamente"><Icon name="download" size={16} />Próximamente</button></div></td></tr>)}</tbody></table>
            {!filteredHistory.length && <p className="history-empty">{history.length ? 'No hay informes que coincidan con los filtros.' : 'Aún no hay informes en el historial.'}</p>}
          </div>
          <p className="history-count">{filteredHistory.length} {filteredHistory.length === 1 ? 'informe' : 'informes'} encontrados</p>
        </section>
      </main>

      {fullPreview && <Modal title="Vista completa del informe" onClose={() => setFullPreview(false)}><div className="modal-report-summary"><div><span>Informe</span><strong>{report.name}</strong></div><div><span>Período</span><strong>{periodLabel}</strong></div><div><span>Periodicidad</span><strong>{periodicity}</strong></div></div><ReportPreview report={report} from={from} to={to} periodicity={periodicity} detailed /></Modal>}
      {selectedHistory && <Modal title="Detalle del informe" onClose={() => setSelectedHistory(null)}><div className="modal-report-summary history-detail"><div><span>Informe</span><strong>{selectedHistory.reportName}</strong></div><div><span>Período</span><strong>{selectedHistory.period}</strong></div><div><span>Generado por</span><strong>{selectedHistory.generatedBy}</strong></div><div><span>Fecha</span><strong>{selectedHistory.generatedAt}</strong></div><div><span>Formato</span><strong>{selectedHistory.format}</strong></div><div><span>Origen</span><strong>{selectedHistory.simulated ? 'Simulación de esta sesión' : 'Registro demostrativo'}</strong></div></div><ReportPreview report={reportFromHistory(selectedHistory)} from={selectedHistory.fromDate ?? initialFrom} to={selectedHistory.toDate ?? initialTo} periodicity={selectedHistory.periodicity ?? 'Mensual'} detailed />{selectedHistory.simulated && <p className="modal-simulation-note"><Icon name="info" size={16} />Este registro es una simulación. No se creó ni almacenó un archivo.</p>}</Modal>}
    </FinanceLayout>
  );
}

export default ReportsPage;
