const { test } = require('node:test');
const assert = require('node:assert/strict');
const nativeFetch = global.fetch;
if (!process.env.FINANZAS_TEST_API?.startsWith('http://finanzas-qa-api-')) throw new Error('Solo se permite la API efímera de pruebas.');
const calls = [];
global.fetch = (url, init) => {
  calls.push(String(url));
  return nativeFetch(new URL(url, process.env.FINANZAS_TEST_API), init);
};
const client = require('/tmp/cash-client.cjs');
test('cliente React -> NestJS -> PostgreSQL: crear, aprobar y consultar sin llamada de ejecución', async () => {
  const op = await client.createCashMovement({
    origin: 'Reembolsos', direction: 'Egreso', reference: '9001', beneficiary: '', amount: 2,
    requestDate: '2026-10-27', concept: 'Reembolso de prueba de integración',
  }, 'simulado');
  assert.equal(op.status, 'Pendiente');
  const before = calls.length;
  const done = await client.decideCashMovement(op.id, 'Autorizado', '');
  assert.equal(calls.length - before, 1);
  assert.equal(done.status, 'Autorizado');
  assert.equal(done.simulated, false);
  assert.equal(done.origin, 'Reembolsos');
  assert.equal(done.decision.simulated, false);
  const refreshed = await client.listCashMovements();
  assert.equal(refreshed.find(item => item.id === op.id).status, 'Autorizado');
  assert.ok(!calls.some(url => url.includes('/pagos') || url.endsWith('/ejecutar')));
});
test('cliente rechaza conservando el motivo y el estado', async () => {
  const op = await client.createCashMovement({
    origin: 'Reembolsos', direction: 'Egreso', reference: '9002', beneficiary: '', amount: 3,
    requestDate: '2026-10-27', concept: 'Solicitud de prueba',
  }, 'simulado');
  const rejected = await client.decideCashMovement(op.id, 'Rechazado', 'No corresponde');
  assert.equal(rejected.status, 'Rechazado');
  assert.equal(rejected.decision.reason, 'No corresponde');
});
