import { api } from './api';
import type { PaymentMethod } from './sales';

export type PaymentBreakdown = { method: PaymentMethod; count: number; totalCents: number };
export type CategoryBreakdown = { categoryName: string; quantity: number; totalCents: number };
export type ProductBreakdown = {
  categoryName: string;
  productName: string;
  quantity: number;
  totalCents: number;
};
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
  // Aditivo: puede no venir en backends previos.
  byProduct?: ProductBreakdown[];
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

// --- Historial de ventas (solo rangos ≤48h — el backend lo hace cumplir) ---
export type SaleListItem = {
  id: string;
  createdAt: string;
  customerName: string | null;
  totalCents: number;
  paymentMethod: PaymentMethod;
};

export const getSalesList = (params: { from: string; to: string; branchId?: string }) => {
  const q = new URLSearchParams({ from: params.from, to: params.to });
  if (params.branchId) q.set('branchId', params.branchId);
  return api.get<{ items: SaleListItem[] }>(`/reports/sales/list?${q.toString()}`).then((r) => r.items);
};

// --- Reporte de gastos (módulo Gastos) --------------------------------------
export type ExpenseCategoryBreakdown = { categoryName: string; count: number; totalCents: number };
export type ExpenseBranchBreakdown = {
  branchId: string;
  branchName: string;
  count: number;
  totalCents: number;
};

export type ExpensesReport = {
  summary: { expensesCount: number; totalCents: number };
  byCategory: ExpenseCategoryBreakdown[];
  byBranch: ExpenseBranchBreakdown[];
};

// Misma firma/estilo que getSalesReport (mismo rango y filtro de sucursal).
export const getExpensesReport = (params: {
  from: string;
  to: string;
  tz: number;
  branchId?: string;
}) => {
  const q = new URLSearchParams({ from: params.from, to: params.to, tz: String(params.tz) });
  if (params.branchId) q.set('branchId', params.branchId);
  return api.get<ExpensesReport>(`/reports/expenses?${q.toString()}`);
};
