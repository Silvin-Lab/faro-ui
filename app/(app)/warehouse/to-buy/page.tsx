'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useUser } from '@/lib/user-context';
import { listToBuy, type ToBuyItem } from '@/lib/warehouse';
import { formatBase } from '@/lib/supplies';
import { ApiError } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';

export default function ToBuyPage() {
  const me = useUser();
  const [items, setItems] = useState<ToBuyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!me.isSuperAdmin) return;
    listToBuy()
      .then((its) => {
        setItems(its);
        setError(null);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : 'Error al cargar la lista'))
      .finally(() => setLoading(false));
  }, [me.isSuperAdmin]);

  if (!me.isSuperAdmin) {
    return (
      <Card>
        <p className="text-muted">Solo el administrador del negocio gestiona el almacén.</p>
      </Card>
    );
  }

  return (
    <div>
      <div className="mb-1">
        <h1 className="text-2xl font-semibold text-ink">Productos a comprar</h1>
      </div>
      <p className="mb-4 text-xs text-muted">Insumos en o por debajo de su mínimo de almacén.</p>

      <Card>
        {error && <p className="mb-2 text-sm text-danger">{error}</p>}
        {loading ? (
          <p className="py-2 text-sm text-muted">Cargando…</p>
        ) : items.length === 0 ? (
          <p className="py-2 text-sm text-muted">
            Todo en orden. Ningún insumo está por debajo de su mínimo.
          </p>
        ) : (
          <div className="-mx-2 overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-line text-xs uppercase tracking-wide text-muted">
                  <th className="px-2 py-2 font-medium">Insumo</th>
                  <th className="px-2 py-2 text-right font-medium">Stock</th>
                  <th className="px-2 py-2 text-right font-medium">Mín</th>
                  <th className="px-2 py-2 text-right font-medium">Faltan</th>
                  <th className="px-2 py-2 font-medium">Presentación</th>
                  <th className="px-2 py-2 font-medium">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {items.map((i) => (
                  <tr key={i.supplyId} className="text-ink">
                    <td className="px-2 py-2">{i.name}</td>
                    <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">
                      {formatBase(i.stockBase)} {i.baseUnit}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">
                      {formatBase(i.minQuantity)} {i.baseUnit}
                    </td>
                    <td className="whitespace-nowrap px-2 py-2 text-right font-medium tabular-nums text-danger">
                      {formatBase(i.missing)} {i.baseUnit}
                    </td>
                    <td className="px-2 py-2 text-muted">{i.packageName}</td>
                    <td className="px-2 py-2">
                      <Link href={`/warehouse/purchases?supplyId=${i.supplyId}`}>
                        <Button variant="outline">Comprar</Button>
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
