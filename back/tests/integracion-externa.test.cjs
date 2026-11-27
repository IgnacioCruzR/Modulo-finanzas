const assert = require('node:assert/strict');
const { test } = require('node:test');
const { IntegracionExternaService } = require('../dist/Finanzas/v2/integracion-externa.service');
const { crearAdaptadoresReferencias } = require('../dist/Finanzas/v2/integraciones/adaptadores');
const { PuenteHttp } = require('../dist/Finanzas/v2/integraciones/puente-http');
const { MockAdminGuard } = require('../dist/Finanzas/v2/mock-admin.guard');

const local = { APP_ENV: 'local', DB_HOST: 'db', DB_NAME: 'erp_local', INTEGRATION_MODE: 'local-fixtures' };
const modulos = [
  ['venta', 7001, 'INTEGRATION_VENTA'],
  ['orden_compra', 8001, 'INTEGRATION_ORDEN_COMPRA'],
  ['reembolso', 9001, 'INTEGRATION_REEMBOLSO'],
  ['usuario', 1, 'INTEGRATION_USUARIO'],
];
const leer = valores => ({ get: clave => valores[clave] });
function crearServicio(valores) {
  const config = leer(valores);
  return new IntegracionExternaService(config, crearAdaptadoresReferencias(config));
}
const estado = esperado => error => error.getStatus?.() === esperado;
const json = body => Response.json(body);

test('fixtures deterministas y separados por módulo, sin depender de cuentas financieras', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', () => assert.fail('El fixture no consulta HTTP.'));
  const service = crearServicio(local);
  for (const [recurso, id] of modulos) {
    await service.validar(recurso, id);
    await assert.rejects(() => service.validar(recurso, 999999), estado(400));
  }
  await assert.rejects(() => service.validar('venta', 8001), estado(400));
  assert.equal(fetch.mock.callCount(), 0);
});

test('rechaza IDs ambiguos, números inseguros y valores fuera de BIGINT antes del adaptador', async t => {
  const consultar = t.mock.fn(async () => 'valida');
  const service = new IntegracionExternaService(leer(local), { venta: { consultar } });
  for (const id of [0, -1, 1.1, NaN, Number.MAX_SAFE_INTEGER + 1, '01', '1e2', ' 1', '9223372036854775808']) {
    await assert.rejects(() => service.validar('venta', id), estado(400));
  }
  assert.equal(consultar.mock.callCount(), 0);
  await service.validar('venta', '9223372036854775807');
  assert.deepEqual(consultar.mock.calls[0].arguments, ['9223372036854775807']);
});

test('un entorno real o una base compartida impide usar fixtures y el administrador simulado', async () => {
  for (const override of [{ APP_ENV: 'production' }, { DB_HOST: 'cloud.example' }, { DB_NAME: 'erp_compartido' }]) {
    const valores = { ...local, ...override, MOCK_AUTH_ENABLED: 'true' };
    const service = crearServicio(valores);
    for (const [recurso, id] of modulos) await assert.rejects(() => service.validar(recurso, id), estado(503));
    const admin = new MockAdminGuard(leer(valores));
    assert.equal(admin.habilitado, false);
    assert.throws(() => admin.canActivate({}), estado(403));
  }
});

test('cada módulo selecciona su propio puente HTTP explícito', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async url => json({ id: url.pathname.split('/').at(-1), habilitada: true }));
  const valores = { INTEGRATION_MODE: 'http' };
  for (const [recurso, , clave] of modulos) valores[`${clave}_URL`] = `https://bridge.example/${recurso}/`;
  for (const [recurso, id] of modulos) await assert.rejects(() => crearServicio(valores).validar(recurso, id), estado(503));
  assert.equal(fetch.mock.callCount(), 0);

  for (const [, , clave] of modulos) valores[`${clave}_ADAPTER`] = 'http-bridge';
  const service = crearServicio(valores);
  for (const [recurso, id] of modulos) await service.validar(recurso, id);
  assert.deepEqual(fetch.mock.calls.map(({ arguments: [url] }) => url.href),
    modulos.map(([recurso, id]) => `https://bridge.example/${recurso}/${id}`));
  assert.equal(fetch.mock.calls[0].arguments[1].redirect, 'error');

  const mixto = crearServicio({ ...local, INTEGRATION_VENTA_URL: valores.INTEGRATION_VENTA_URL, INTEGRATION_VENTA_ADAPTER: 'http-bridge' });
  await mixto.validar('venta', 42);
  await mixto.validar('orden_compra', 8001);
  assert.equal(fetch.mock.callCount(), 5);
  await assert.rejects(() => crearServicio({ ...valores, INTEGRATION_VENTA_ADAPTER: 'fixture' }).validar('venta', 7001), estado(503));
});

test('HTTP distingue entrada inválida, ausencia, conflicto e indisponibilidad', async t => {
  let respuesta;
  t.mock.method(globalThis, 'fetch', async () => respuesta);
  const service = crearServicio({ INTEGRATION_VENTA_ADAPTER: 'http-bridge', INTEGRATION_VENTA_URL: 'https://bridge.example/ventas' });
  for (const [remoto, publico] of [[400, 400], [404, 400], [409, 409], [401, 503], [403, 503], [429, 503], [500, 503], [503, 503], [204, 503]]) {
    respuesta = new Response(null, { status: remoto });
    await assert.rejects(() => service.validar('venta', 7), estado(publico));
  }
  respuesta = json({ id: '7', habilitada: false });
  await assert.rejects(() => service.validar('venta', 7), estado(409));
});

test('HTTP rechaza formatos, identidades y configuración incompatibles', async t => {
  let respuesta;
  t.mock.method(globalThis, 'fetch', async () => respuesta);
  const adaptador = new PuenteHttp('https://bridge.example/ventas', 5000);
  for (const body of [null, [], { id: '8', habilitada: true }, { id: 7, habilitada: true }, { id: '7' }, { id: '7', habilitada: 'true' }]) {
    respuesta = json(body);
    await assert.rejects(() => adaptador.consultar('7'), estado(503));
  }
  respuesta = new Response('{', { headers: { 'Content-Type': 'application/json' } });
  await assert.rejects(() => adaptador.consultar('7'), estado(503));
  respuesta = new Response('{"id":"7","habilitada":true}', { headers: { 'Content-Type': 'text/html' } });
  await assert.rejects(() => adaptador.consultar('7'), estado(503));
  for (const url of ['ventas', 'file:///ventas', 'https://example.test/?q=1', 'https://example.test/#ventas']) {
    await assert.rejects(() => new PuenteHttp(url, 5000).consultar('7'), estado(503));
  }
  const valores = { INTEGRATION_VENTA_ADAPTER: 'http-bridge', INTEGRATION_VENTA_URL: 'https://bridge.example/ventas' };
  await assert.rejects(() => crearServicio({ ...valores, INTEGRATION_TIMEOUT_MS: '-1' }).validar('venta', 7), estado(503));
});

test('HTTP devuelve 503 al perder la conexión o agotar el tiempo de espera', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => { throw new TypeError('conexión fallida'); });
  const adaptador = new PuenteHttp('https://bridge.example/ventas', 20);
  await assert.rejects(() => adaptador.consultar('7'), estado(503));
  fetch.mock.mockImplementation((_url, { signal }) => new Promise((resolve, reject) => {
    const timer = setTimeout(() => resolve(json({ id: '7', habilitada: true })), 1000);
    signal.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(signal.reason);
    }, { once: true });
  }));
  await assert.rejects(() => adaptador.consultar('7'), estado(503));
  assert.equal(fetch.mock.calls[1].arguments[1].signal.reason.name, 'TimeoutError');
});
