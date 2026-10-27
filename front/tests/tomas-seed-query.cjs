const { test } = require('node:test');
const assert = require('node:assert/strict');
if (!process.env.FINANZAS_TEST_API?.startsWith('http://finanzas-qa-api-')) throw new Error('Solo se admite la API efímera.');
const nativeFetch = global.fetch;
global.fetch = (url, init) => nativeFetch(new URL(url, process.env.FINANZAS_TEST_API), init);
const { listCashMovements } = require('/tmp/cash-client.cjs');

test('el cliente del historial recibe las diez operaciones recuperadas', async () => {
  const cuentas = await (await fetch('/api/finanzas/cuentas-cobrar')).json();
  const ids = new Set(cuentas.filter(c => Number(c.id_venta) >= 5001 && Number(c.id_venta) <= 5010).map(c => c.id_cxc));
  assert.equal(ids.size, 10);
  const historial = await listCashMovements();
  const recuperadas = historial.filter(o => o.origin === 'Ventas' && ids.has(o.reference.replace('Cuenta por cobrar #', '')));
  assert.equal(recuperadas.length, 10);
  assert.ok(recuperadas.every(o => o.status === 'Autorizado' && o.simulated === false));
  assert.equal(recuperadas.reduce((total, o) => total + o.amount, 0), 1175000);
});
