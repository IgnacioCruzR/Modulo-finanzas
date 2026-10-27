const { test } = require('node:test');
const assert = require('node:assert/strict');
const { Client } = require('pg');
const { ConfigService } = require('@nestjs/config');
const { IntegracionExternaService } = require('/app/dist/Finanzas/v2/integracion-externa.service');
const { cuentas } = require('./tomas-seed.expected.json');
if (process.env.FINANZAS_TEST_ISOLATED !== '1' || process.env.DB_HOST !== 'db') throw new Error('Solo se admite la base efímera.');

test('diez registros de Tomas: importes originales, integridad y consultas', async () => {
  const db = new Client({ host: 'db', user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME });
  await db.connect();
  try {
    const { rows } = await db.query(`SELECT c.id_venta,c.monto_total,c.saldo_pendiente,c.estado,
      o.id_operacion,o.monto AS abono,o.metodo_pago,o.estado AS estado_operacion,
      a.decision,m.tipo_flujo,m.monto AS movimiento
      FROM finanzas.cuenta_cobrar c JOIN finanzas.operacion_financiera o USING(id_cxc)
      JOIN finanzas.autorizacion_financiera a USING(id_operacion)
      JOIN finanzas.movimiento_financiero m USING(id_operacion)
      WHERE c.id_venta BETWEEN 5001 AND 5010 ORDER BY c.id_venta`);
    assert.equal(rows.length, 10);
    assert.deepEqual(rows.map(({ id_venta,monto_total,saldo_pendiente,abono,metodo_pago }) =>
      ({ id_venta,monto_total,saldo_pendiente,abono,metodo_pago })), cuentas);
    const integracion = new IntegracionExternaService(new ConfigService({ APP_ENV: 'local', DB_NAME: 'erp_local', INTEGRATION_MODE: 'local-fixtures' }));
    for (const row of rows) {
      assert.equal(row.estado, 'parcial');
      assert.equal(row.estado_operacion, 'ejecutada');
      assert.equal(row.decision, 'aprobada');
      assert.equal(row.tipo_flujo, 'ingreso');
      assert.equal(row.movimiento, row.abono);
      await integracion.validar('venta', row.id_venta);
      const r = await fetch('http://127.0.0.1:3000/api/finanzas/operaciones/' + row.id_operacion);
      assert.equal(r.status, 200);
      assert.equal((await r.json()).movimiento.monto, row.abono);
    }
  } finally { await db.end(); }
});
