import { api } from './api';

// Módulo Gastos. Espejo de categorías/conceptos (sin imagen) + registro de gastos.
// Precios en centavos en la API; la UI usa toPesos/toCents de lib/products.

export type ExpenseCategory = {
  id: string;
  name: string;
  status: 'active' | 'inactive';
  sortOrder: number;
};

export type ExpenseConcept = {
  id: string;
  name: string;
  status: 'active' | 'inactive';
  categoryId: string;
  categoryName: string;
};

// Gasto registrado: el backend snapshotea concepto/categoría/sucursal y quién lo capturó.
export type Expense = {
  id: string;
  conceptName: string;
  categoryName: string;
  branchName: string;
  createdByName: string;
  amountCents: number;
  createdAt: string;
};

// --- Categorías de gasto -----------------------------------------------------

export const listExpenseCategories = () =>
  api.get<{ items: ExpenseCategory[] }>('/expenses/categories').then((r) => r.items);

// No hay GET individual en el contrato: el edit resuelve desde el listado.
export const getExpenseCategory = (id: string) =>
  listExpenseCategories().then((items) => items.find((c) => c.id === id));

export const createExpenseCategory = (input: { name: string; sortOrder?: number }) =>
  api.post<{ category: ExpenseCategory }>('/expenses/categories', input).then((r) => r.category);

export const updateExpenseCategory = (
  id: string,
  input: { name?: string; status?: 'active' | 'inactive'; sortOrder?: number },
) => api.patch<{ category: ExpenseCategory }>(`/expenses/categories/${id}`, input).then((r) => r.category);

// --- Conceptos de gasto ------------------------------------------------------

export const listExpenseConcepts = () =>
  api.get<{ items: ExpenseConcept[] }>('/expenses/concepts').then((r) => r.items);

export const getExpenseConcept = (id: string) =>
  listExpenseConcepts().then((items) => items.find((c) => c.id === id));

export const createExpenseConcept = (input: { name: string; categoryId: string }) =>
  api.post<{ concept: ExpenseConcept }>('/expenses/concepts', input).then((r) => r.concept);

export const updateExpenseConcept = (
  id: string,
  input: { name?: string; categoryId?: string; status?: 'active' | 'inactive' },
) => api.patch<{ concept: ExpenseConcept }>(`/expenses/concepts/${id}`, input).then((r) => r.concept);

// --- Gastos ------------------------------------------------------------------

// from/to en ISO. branchId opcional (solo super admin; el backend fuerza la sucursal del cajero).
export const listExpenses = (params: { from: string; to: string; branchId?: string }) => {
  const q = new URLSearchParams({ from: params.from, to: params.to });
  if (params.branchId) q.set('branchId', params.branchId);
  return api.get<{ items: Expense[] }>(`/expenses?${q.toString()}`).then((r) => r.items);
};

export const createExpense = (input: { conceptId: string; amountCents: number }) =>
  api.post<{ expense: Expense }>('/expenses', input).then((r) => r.expense);

export const deleteExpense = (id: string) => api.delete<void>(`/expenses/${id}`);
