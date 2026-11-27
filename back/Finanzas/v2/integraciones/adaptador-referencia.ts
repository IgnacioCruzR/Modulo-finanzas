export type RecursoExterno = 'venta' | 'orden_compra' | 'reembolso' | 'usuario';
export type ResultadoReferencia = 'valida' | 'invalida' | 'inexistente' | 'no_habilitada';

// El adaptador del dueño confirma identidad y elegibilidad para Finanzas.
export interface AdaptadorReferencia {
  consultar(id: string): Promise<ResultadoReferencia>;
}
