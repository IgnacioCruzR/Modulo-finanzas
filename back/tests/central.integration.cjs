const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Client } = require('pg');
const http = require('node:http');
if (process.env.FINANZAS_TEST_ISOLATED !== '1' || process.env.DB_HOST !== 'db') throw new Error('Esta suite solo admite el PostgreSQL efímero con alias db.');
const db = new Client({ host: process.env.DB_HOST, user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME, port: 5432 });
const base = 'http://127.0.0.1:3000/api/finanzas';
async function req(path, body, status = 200) {
  const r = await fetch(base + path, body === undefined ? {} : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await r.json(); assert.equal(r.status, status, JSON.stringify(data)); return data;
}
async function scalar(sql, args) { return (await db.query(sql, args)).rows[0]; }
async function invalidTransaction(sql) {
  await db.query('BEGIN');
  try { await assert.rejects(async () => { await db.query(sql); await db.query('SET CONSTRAINTS ALL IMMEDIATE'); }); }
  finally { await db.query('ROLLBACK'); }
}
test('Modelo central: migración, API e integridad PostgreSQL', async t => {
  await db.connect();
  try {
    await t.test('preserva historial y saldo; seis tablas y cinco FK', async () => {
      assert.equal((await scalar("SELECT count(*)::int n FROM information_schema.tables WHERE table_schema='finanzas' AND table_type='BASE TABLE'")).n, 6);
      assert.equal((await scalar("SELECT count(*)::int n FROM pg_constraint WHERE connamespace='finanzas'::regnamespace AND contype='f'")).n, 5);
      assert.equal((await scalar('SELECT saldo_actual FROM finanzas.v_saldo_caja')).saldo_actual, '10030000.00');
      assert.equal((await scalar('SELECT count(*)::int n FROM finanzas.operacion_financiera')).n, 4);
      assert.equal((await scalar("SELECT count(*)::int n FROM information_schema.columns WHERE table_schema='finanzas' AND column_name IN ('id_cliente','id_proveedor','cantidad_cuotas')")).n, 0);
      assert.equal((await req('/salud')).modo, 'transaccional');
      await req('/pagos', undefined, 404);
      await req('/operaciones/1/ejecutar', {}, 404);
    });
    let cxc, cxp, finalizada;
    await t.test('crea obligaciones sin terceros ni cuotas y valida integración y fechas', async () => {
      cxc = await req('/cuentas-cobrar', { id_venta: 7001, monto_total: 100 }, 201);
      cxp = await req('/cuentas-pagar', { id_oc: 8001, monto_total: 100 }, 201);
      assert.equal(cxc.saldo_pendiente, '100.00');
      await req('/cuentas-cobrar', { id_venta: 7001, monto_total: 100 }, 409);
      await req('/cuentas-cobrar', { id_venta: 999999, monto_total: 100 }, 400);
      await req('/cuentas-pagar', { id_oc: 8002, monto_total: 100, id_proveedor: 1 }, 400);
      await req('/cuentas-cobrar', { id_venta: 7002, monto_total: 100, cantidad_cuotas: 2 }, 400);
      await req('/cuentas-cobrar', { id_venta: 7002, monto_total: 100, fecha_emision: '2026-10-20', fecha_vencimiento: '2026-10-19' }, 400);
    });
    await t.test('exactamente un origen, monto positivo y solo campos del contrato', async () => {
      for (const payload of [
        { monto: 1 }, { monto: 1, id_cxc: Number(cxc.id_cxc), id_cxp: Number(cxp.id_cxp) },
        { monto: 0, id_cxc: Number(cxc.id_cxc) }, { monto: 1.001, id_cxc: Number(cxc.id_cxc) },
        { monto: 1, id_reembolso: 0 }, { monto: 1, id_nomina: 1, id_empleado: 1 },
        { monto: 1, id_reembolso: 999999 }, { monto: 1, id_reembolso: 9001, tipo_operacion: 'reembolso' },
      ]) await req('/operaciones', payload, 400);
      await req('/operaciones', { monto: 101, id_cxc: Number(cxc.id_cxc) }, 409);
    });
    await t.test('aprobar ejecuta en una llamada; método obligatorio solo al ejecutar', async () => {
      const op = await req('/operaciones', { id_cxc: Number(cxc.id_cxc), id_cxp: null, monto: 50 }, 201);
      assert.equal(op.metodo_pago, null);
      await req('/operaciones/' + op.id_operacion + '/decision', { decision: 'aprobada' }, 400);
      assert.equal((await req('/operaciones/' + op.id_operacion)).autorizacion, null);
      finalizada = await req('/operaciones/' + op.id_operacion + '/decision', { decision: 'aprobada', metodo_pago: 'transferencia' });
      assert.equal(finalizada.estado, 'ejecutada');
      assert.equal(finalizada.movimiento.monto, '50.00');
      assert.equal(finalizada.autorizacion.decision, 'aprobada');
      assert.equal((await req('/cuentas-cobrar/' + cxc.id_cxc)).saldo_pendiente, '50.00');
      await req('/operaciones/' + op.id_operacion + '/decision', { decision: 'aprobada' }, 409);
    });
    await t.test('rechazo exige motivo y no mueve caja', async () => {
      const saldo = await req('/caja/saldo');
      const op = await req('/operaciones', { id_reembolso: 9001, monto: 10 }, 201);
      await req('/operaciones/' + op.id_operacion + '/decision', { decision: 'rechazada', observacion: ' ' }, 400);
      const rechazo = await req('/operaciones/' + op.id_operacion + '/decision', { decision: 'rechazada', observacion: 'No corresponde' });
      assert.equal(rechazo.estado, 'rechazada'); assert.equal(rechazo.movimiento, null);
      assert.equal((await req('/caja/saldo')).saldo_actual, saldo.saldo_actual);
    });
    await t.test('caja insuficiente revierte autorización, movimiento y estado', async () => {
      const op = await req('/operaciones', { id_reembolso: 9001, monto: 99999999, metodo_pago: 'efectivo' }, 201);
      await req('/operaciones/' + op.id_operacion + '/decision', { decision: 'aprobada' }, 409);
      const pendiente = await req('/operaciones/' + op.id_operacion);
      assert.equal(pendiente.estado, 'pendiente'); assert.equal(pendiente.autorizacion, null); assert.equal(pendiente.movimiento, null);
    });
    await t.test('concurrencia sobre una obligación; solo se ejecuta el importe disponible', async () => {
      const body = { id_cxp: Number(cxp.id_cxp), monto: 80, metodo_pago: 'simulado' };
      const a = await req('/operaciones', body, 201), b = await req('/operaciones', body, 201);
      const send = id => fetch(base + '/operaciones/' + id + '/decision', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"decision":"aprobada"}' });
      const responses = await Promise.all([send(a.id_operacion), send(b.id_operacion)]);
      assert.deepEqual(responses.map(r => r.status).sort(), [200, 409]);
      const cuenta = await req('/cuentas-pagar/' + cxp.id_cxp); assert.equal(cuenta.saldo_pendiente, '20.00');
    });
    await t.test('dos decisiones simultáneas de la misma operación no duplican movimiento', async () => {
      const op = await req('/operaciones', { id_reembolso: 9002, monto: 1, metodo_pago: 'simulado' }, 201);
      const send = () => fetch(base + '/operaciones/' + op.id_operacion + '/decision', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{"decision":"aprobada"}' });
      assert.deepEqual((await Promise.all([send(), send()])).map(r => r.status).sort(), [200, 409]);
      assert.equal((await scalar('SELECT count(*)::int n FROM finanzas.movimiento_financiero WHERE id_operacion=$1', [op.id_operacion])).n, 1);
    });
    await t.test('no se ejecutan obligaciones anuladas ni caja inactiva', async () => {
      const op = await req('/operaciones', { id_cxp: Number(cxp.id_cxp), monto: 1, metodo_pago: 'simulado' }, 201);
      await db.query("UPDATE finanzas.cuenta_pagar SET estado='anulada' WHERE id_cxp=$1", [cxp.id_cxp]);
      await req('/operaciones/' + op.id_operacion + '/decision', { decision: 'aprobada' }, 409);
      await db.query("UPDATE finanzas.cuenta_pagar SET estado='parcial' WHERE id_cxp=$1", [cxp.id_cxp]);
      await db.query('UPDATE finanzas.cuenta_financiera SET activa=false');
      await req('/operaciones', { id_reembolso: 9001, monto: 1 }, 409);
      await db.query('UPDATE finanzas.cuenta_financiera SET activa=true');
    });
    await t.test('SQL impide alterar históricos, falsificar saldos o movimientos', async () => {
      await invalidTransaction('UPDATE finanzas.operacion_financiera SET monto=monto+1 WHERE id_operacion=' + finalizada.id_operacion);
      await invalidTransaction('DELETE FROM finanzas.autorizacion_financiera WHERE id_operacion=' + finalizada.id_operacion);
      await invalidTransaction('UPDATE finanzas.movimiento_financiero SET monto=monto+1 WHERE id_operacion=' + finalizada.id_operacion);
      await invalidTransaction('UPDATE finanzas.cuenta_cobrar SET saldo_pendiente=49 WHERE id_cxc=' + cxc.id_cxc);
      await invalidTransaction("INSERT INTO finanzas.cuenta_financiera(nombre) VALUES('Segunda caja')");
      await invalidTransaction("UPDATE finanzas.operacion_financiera SET estado='ejecutada',fecha_ejecucion=now() WHERE estado='pendiente'");
    });
    await t.test('adaptador HTTP comprueba existencia, habilitación y contrato; fallo cerrado', async () => {
      const { ConfigService } = require('@nestjs/config');
      const { IntegracionExternaService } = require('/app/dist/Finanzas/v2/integracion-externa.service');
      const server = http.createServer((r, s) => {
        s.setHeader('Content-Type', 'application/json');
        if (r.url === '/404') { s.statusCode = 404; return s.end('{}'); }
        if (r.url === '/500') { s.statusCode = 500; return s.end('{}'); }
        s.end(JSON.stringify({ id: r.url.slice(1), habilitada: r.url !== '/2' }));
      });
      await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
      const url = 'http://127.0.0.1:' + server.address().port;
      const service = new IntegracionExternaService(new ConfigService({ INTEGRATION_MODE: 'http', INTEGRATION_VENTA_URL: url }));
      try {
        await service.validar('venta', '1');
        await assert.rejects(() => service.validar('venta', '2'), e => e.getStatus() === 400);
        await assert.rejects(() => service.validar('venta', '404'), e => e.getStatus() === 400);
        await assert.rejects(() => service.validar('venta', '500'), e => e.getStatus() === 503);
        await assert.rejects(() => service.validar('reembolso', '1'), e => e.getStatus() === 503);
        const fixture = new IntegracionExternaService(new ConfigService({ INTEGRATION_MODE: 'local-fixtures', APP_ENV: 'produccion' }));
        await assert.rejects(() => fixture.validar('usuario', '1'), e => e.getStatus() === 503);
      } finally { await new Promise(resolve => server.close(resolve)); }
      await assert.rejects(() => service.validar('venta', '1'), e => e.getStatus() === 503);
    });
  } finally { await db.end(); }
});
