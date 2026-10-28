const { test } = require('node:test');
const assert = require('node:assert/strict');
const { toMovement } = require('/tmp/cash-client.cjs');

// El historial y sus filtros usan el calendario local del navegador.
process.env.TZ = 'America/Santiago';
const operacion = {
  id_operacion: '1', id_cxc: null, id_cxp: '1', id_reembolso: null,
  monto: '1000.00', metodo_pago: 'efectivo', estado: 'pendiente', descripcion: null,
};
const casos = [
  ['noche en Chile con día UTC siguiente', '2026-10-28T01:30:00.000Z', '2026-10-27'],
  ['hora diurna', '2026-10-27T15:30:00.000Z', '2026-10-27'],
  ['cambio de año', '2027-01-01T01:30:00.000Z', '2026-12-31'],
  ['horario de invierno y cambio de mes', '2026-07-01T03:30:00.000Z', '2026-06-30'],
  ['instante expresado con offset local', '2026-10-27T22:30:00-03:00', '2026-10-27'],
];
for (const [nombre, fecha_solicitud, esperado] of casos) {
  test(nombre, () => {
    const resultado = toMovement({ ...operacion, fecha_solicitud });
    assert.equal(resultado.requestDate, esperado);
  });
}
