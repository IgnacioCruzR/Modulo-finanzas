const { test } = require('node:test');
const assert = require('node:assert/strict');
const nativeFetch = global.fetch;
if (!process.env.FINANZAS_TEST_API?.startsWith('http://finanzas-form-api-')) throw new Error('Solo se permite la API efímera del formulario.');
const base = process.env.FINANZAS_TEST_API;
const submissions = [];
global.fetch = (url, init) => {
  if (init?.method === 'POST') submissions.push(JSON.parse(init.body));
  return nativeFetch(new URL(url, base), init);
};
const { buildPaymentRequestPayload, operationTypeFromPayload, validatePaymentRequest } = require('/tmp/payment-validation.cjs');
const { submitPaymentRequest } = require('/tmp/payment-api.cjs');
const form = { operationType: 'cobro', accountId: '1', payrollId: '', employeeId: '', refundId: '', amount: '10.000', method: 'simulado', description: 'Prueba de contrato del formulario', confirmed: true };
async function request(path, body, status = 200) {
  const response = await nativeFetch(new URL('/api/finanzas' + path, base), body === undefined ? {} : {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  const data = await response.json();
  assert.equal(response.status, status, JSON.stringify(data));
  return data;
}
async function createdOperation(description) {
  const operations = await request('/operaciones');
  const matches = operations.filter(o => o.descripcion === description);
  assert.equal(matches.length, 1);
  return request('/operaciones/' + matches[0].id_operacion);
}

test('el contrato de los tres orígenes excluye propiedades del modelo anterior', () => {
  for (const [operationType, reference] of [['cobro','id_cxc'],['proveedor','id_cxp'],['reembolso','id_reembolso']]) {
    const payload = buildPaymentRequestPayload({ ...form, operationType, refundId: '9001' });
    assert.deepEqual(Object.keys(payload).sort(), ['monto','metodo_pago','descripcion',reference].sort());
    assert.equal(payload.monto, 10000);
    assert.equal(operationTypeFromPayload(payload), operationType);
  }
});
test('la nómina no genera una petición incompatible con el modelo actual', () => {
  const values = { ...form, operationType: 'nomina', payrollId: '1', employeeId: '1' };
  assert.ok(validatePaymentRequest(values, []).operationType);
  assert.throws(() => buildPaymentRequestPayload(values), /nómina/);
});
test('el caso de la captura crea una solicitud y solo reduce la deuda al aprobar', async () => {
  const account = await request('/cuentas-cobrar/1');
  const caja = await request('/caja/saldo');
  const payload = buildPaymentRequestPayload(form);
  const result = await submitPaymentRequest(payload);
  assert.equal(result.monto, 10000);
  assert.deepEqual(submissions.at(-1), { monto: 10000, metodo_pago: 'simulado', id_cxc: 1, descripcion: form.description });
  const pending = await createdOperation(form.description);
  assert.equal(pending.estado, 'pendiente');
  assert.equal(pending.movimiento, null);
  assert.equal((await request('/cuentas-cobrar/1')).saldo_pendiente, account.saldo_pendiente);
  assert.equal((await request('/caja/saldo')).saldo_actual, caja.saldo_actual);
  const done = await request('/operaciones/' + pending.id_operacion + '/decision', { decision: 'aprobada' });
  assert.equal(done.estado, 'ejecutada');
  assert.equal(done.movimiento.tipo_flujo, 'ingreso');
  assert.equal(Number((await request('/cuentas-cobrar/1')).saldo_pendiente), Number(account.saldo_pendiente) - 10000);
  assert.equal(Number((await request('/caja/saldo')).saldo_actual), Number(caja.saldo_actual) + 10000);
});
test('el mismo formulario registra un pago a proveedor con el contrato correcto', async () => {
  const account = await request('/cuentas-pagar/1');
  const caja = await request('/caja/saldo');
  const values = { ...form, operationType: 'proveedor', amount: '1.000', description: 'Prueba formulario proveedor' };
  await submitPaymentRequest(buildPaymentRequestPayload(values));
  assert.equal(submissions.at(-1).id_cxp, 1);
  assert.equal(Object.hasOwn(submissions.at(-1), 'tipo_operacion'), false);
  const pending = await createdOperation(values.description);
  const done = await request('/operaciones/' + pending.id_operacion + '/decision', { decision: 'aprobada' });
  assert.equal(done.movimiento.tipo_flujo, 'egreso');
  assert.equal(Number((await request('/cuentas-pagar/1')).saldo_pendiente), Number(account.saldo_pendiente) - 1000);
  assert.equal(Number((await request('/caja/saldo')).saldo_actual), Number(caja.saldo_actual) - 1000);
});
test('el formulario registra un reembolso y permite rechazarlo sin mover caja', async () => {
  const caja = await request('/caja/saldo');
  const values = { ...form, operationType: 'reembolso', refundId: '9001', amount: '1.000', description: 'Prueba formulario reembolso' };
  await submitPaymentRequest(buildPaymentRequestPayload(values));
  assert.equal(submissions.at(-1).id_reembolso, 9001);
  const pending = await createdOperation(values.description);
  const rejected = await request('/operaciones/' + pending.id_operacion + '/decision', { decision: 'rechazada', observacion: 'Prueba de rechazo' });
  assert.equal(rejected.estado, 'rechazada');
  assert.equal(rejected.movimiento, null);
  assert.equal((await request('/caja/saldo')).saldo_actual, caja.saldo_actual);
});
test('la API mantiene la validación estricta del campo obsoleto', async () => {
  const before = await request('/operaciones');
  const error = await request('/operaciones', { ...buildPaymentRequestPayload(form), tipo_operacion: 'cobro' }, 400);
  assert.ok(error.message.some(m => m.includes('tipo_operacion')));
  assert.equal((await request('/operaciones')).length, before.length);
});
