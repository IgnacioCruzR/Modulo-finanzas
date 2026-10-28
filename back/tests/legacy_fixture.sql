-- Historial anterior de referencia para la suite aislada.
BEGIN;
INSERT INTO finanzas.cuenta_cobrar(id_venta,id_cliente,monto_total,saldo_pendiente) VALUES(101,20,150000,150000);
INSERT INTO finanzas.cuenta_pagar(id_oc,id_proveedor,monto_total,saldo_pendiente) VALUES(75,12,300000,300000);
DO $$ DECLARE c BIGINT; p BIGINT; o BIGINT; BEGIN
 SELECT id_cxc INTO c FROM finanzas.cuenta_cobrar WHERE id_venta=101;
 SELECT id_cxp INTO p FROM finanzas.cuenta_pagar WHERE id_oc=75;
 INSERT INTO finanzas.pago(id_cxc,tipo_operacion,monto,metodo_pago,descripcion) VALUES(c,'cobro',50000,'simulado','Abono venta 101') RETURNING id_pago INTO o;
 PERFORM finanzas.decidir_pago(o,1,true); PERFORM finanzas.ejecutar_pago(o);
 INSERT INTO finanzas.pago(id_cxp,tipo_operacion,monto,metodo_pago) VALUES(p,'proveedor',120000,'simulado') RETURNING id_pago INTO o;
 PERFORM finanzas.decidir_pago(o,1,false,'Solicitud no autorizada');
 INSERT INTO finanzas.pago(id_cxp,tipo_operacion,monto,metodo_pago) VALUES(p,'proveedor',120000,'simulado') RETURNING id_pago INTO o;
 PERFORM finanzas.decidir_pago(o,1,true); PERFORM finanzas.ejecutar_pago(o);
 INSERT INTO finanzas.pago(id_cxc,tipo_operacion,monto,metodo_pago) VALUES(c,'cobro',100000,'simulado') RETURNING id_pago INTO o;
 PERFORM finanzas.decidir_pago(o,1,true); PERFORM finanzas.ejecutar_pago(o);
END $$;
COMMIT;
