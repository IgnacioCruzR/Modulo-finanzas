-- SOLO entorno local. Ejecutar UNA vez en una base recién creada.
INSERT INTO finanzas.cuenta_cobrar(id_venta,id_cliente,monto_total,saldo_pendiente,fecha_vencimiento)
VALUES(101,20,150000,150000,CURRENT_DATE+30);
INSERT INTO finanzas.cuenta_pagar(id_oc,id_proveedor,monto_total,saldo_pendiente,fecha_vencimiento)
VALUES(75,12,300000,300000,CURRENT_DATE+30);
INSERT INTO finanzas.pago(id_cxc,tipo_operacion,monto,metodo_pago,descripcion)
VALUES(1,'cobro',50000,'simulado','Abono venta 101');
INSERT INTO finanzas.pago(id_cxp,tipo_operacion,monto,metodo_pago,descripcion)
VALUES(1,'proveedor',120000,'transferencia','Abono orden compra 75');
SELECT finanzas.decidir_pago(1,7,true,'Cobro validado');
SELECT finanzas.ejecutar_pago(1);
SELECT finanzas.decidir_pago(2,7,false,'Documentación incompleta');
SELECT id_pago,tipo_operacion,monto,estado FROM finanzas.pago ORDER BY id_pago;
SELECT id_cxc,saldo_pendiente,estado FROM finanzas.cuenta_cobrar;
SELECT id_cxp,saldo_pendiente,estado FROM finanzas.cuenta_pagar;
SELECT * FROM finanzas.v_saldo_caja;
