'use client';

import { useEffect, useState } from 'react';
import { ApiError } from '@/lib/api';
import type { InsightParams } from '@/lib/insights';

// Estado de una tarjeta de insight con carga aislada (handoff §4): cada tarjeta
// resuelve su propio loading/error; una que falla no tumba a las demás.
export type InsightState<T> = { data?: T; error?: string; loading: boolean };

// useInsight ejecuta el fetcher de un endpoint cada vez que cambia el filtro
// (from/to/branchId). Cancela respuestas obsoletas para evitar parpadeos al
// cambiar de rango rápido. `filter` null => aún sin filtro aplicado (loading).
export function useInsight<T>(
  fetcher: (p: InsightParams) => Promise<T>,
  filter: InsightParams | null,
): InsightState<T> {
  const [state, setState] = useState<InsightState<T>>({ loading: true });

  useEffect(() => {
    if (!filter) {
      setState({ loading: true });
      return;
    }
    let cancelled = false;
    setState({ loading: true });
    fetcher(filter)
      .then((d) => {
        if (!cancelled) setState({ data: d, loading: false });
      })
      .catch((e) => {
        if (!cancelled) {
          setState({
            error: e instanceof ApiError ? e.message : 'No se pudo cargar este insight',
            loading: false,
          });
        }
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetcher, filter?.from, filter?.to, filter?.branchId]);

  return state;
}
