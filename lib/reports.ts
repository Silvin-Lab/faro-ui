import { api } from './api';
import type { PaymentMethod } from './sales';

export type PaymentBreakdown = { method: PaymentMethod; count: number; totalCents: number };
export type CategoryBreakdown = { categoryName: string; quantity: number; totalCents: number };
export type HourBreakdown = { hour: number; count: number; totalCents: number };
// M7: corte por sucursal. branchId null = bucket "Sin sucursal".
export type BranchBreakdown = {
  branchId: string | null;
  branchName: string;
  totalCents: number;
  salesCount: number;
};

export type SalesReport = {
  totalCents: number;
  salesCount: number;
  byPaymentMethod: PaymentBreakdown[];
  byCategory: CategoryBreakdown[];
  byHour: HourBreakdown[];
  // Aditivo (M7): puede no venir en backends previos.
  byBranch?: BranchBreakdown[];
};

// branchId: undefined = todas · 'none' = sin sucursal (branch_id IS NULL) · <uuid> = una sucursal.
export const getSalesReport = (params: {
  from: string;
  to: string;
  tz: number;
  branchId?: string;
}) => {
  const q = new URLSearchParams({ from: params.from, to: params.to, tz: String(params.tz) });
  if (params.branchId) q.set('branchId', params.branchId);
  return api.get<SalesReport>(`/reports/sales?${q.toString()}`);
};
