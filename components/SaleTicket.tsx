'use client';

import { toPesos } from '@/lib/products';
import { paymentMethodLabel, type Sale } from '@/lib/sales';
import { Button } from '@/components/ui/Button';

// Ticket de venta compartido entre el POS (justo tras cobrar) y el detalle de
// venta de Reportes (histórico) — misma vista en los dos lugares a propósito.
// `cashier` es opcional: el POS lo conoce (usuario de la sesión actual), pero
// una venta histórica no guarda quién la hizo, así que esa fila simplemente no
// se muestra ahí.
export function SaleTicket({
  sale,
  cashier,
  onClose,
}: {
  sale: Sale;
  cashier?: string;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="no-print absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div className="relative w-full max-w-xs rounded-lg bg-surface p-5 shadow-lg">
        <div className="ticket-print text-sm text-ink">
          <div className="text-center">
            <div className="text-lg font-bold">Faro</div>
            <div className="text-xs text-muted">Ticket de venta</div>
            <div className="text-xs text-muted">{new Date(sale.createdAt).toLocaleString()}</div>
            {cashier && <div className="text-xs text-muted">Cajero: {cashier}</div>}
          </div>
          <hr className="my-2 border-line" />
          <ul>
            {(sale.items ?? []).map((it) => (
              <li key={it.id} className="flex justify-between">
                <span className="truncate">
                  {it.quantity}× {it.name}
                </span>
                <span>${toPesos(it.lineTotalCents)}</span>
              </li>
            ))}
          </ul>
          <hr className="my-2 border-line" />
          {sale.discountCents > 0 && (
            <>
              <div className="flex justify-between text-muted">
                <span>Subtotal</span>
                <span>${toPesos(sale.totalCents + sale.discountCents)}</span>
              </div>
              <div className="flex justify-between text-muted">
                <span className="min-w-0 truncate pr-2">{sale.promotionName ?? 'Descuento lealtad'}</span>
                <span>−${toPesos(sale.discountCents)}</span>
              </div>
            </>
          )}
          <div className="flex justify-between font-semibold">
            <span>Total</span>
            <span>${toPesos(sale.totalCents)}</span>
          </div>
          <div className="flex justify-between">
            <span>Pago</span>
            <span>{paymentMethodLabel(sale.paymentMethod)}</span>
          </div>
          {sale.customerName && (
            <div className="flex justify-between">
              <span>Cliente</span>
              <span className="truncate">{sale.customerName}</span>
            </div>
          )}
          {sale.paymentMethod === 'cash' && (
            <>
              <div className="flex justify-between">
                <span>Recibido</span>
                <span>${toPesos(sale.amountPaidCents)}</span>
              </div>
              <div className="flex justify-between">
                <span>Cambio</span>
                <span>${toPesos(sale.changeCents)}</span>
              </div>
            </>
          )}
          <div className="mt-3 text-center text-xs text-muted">¡Gracias por su compra!</div>
        </div>
        <div className="no-print mt-4 flex gap-2">
          <Button className="flex-1" onClick={() => window.print()}>
            Imprimir
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Cerrar
          </Button>
        </div>
      </div>
    </div>
  );
}
