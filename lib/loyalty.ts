import { api } from './api';

// Lealtad v2: CRUD de promociones por visitas (por negocio) + estado de
// elegibilidad de un cliente para el POS. Reemplaza la config única de la v1.

// Una promoción: al alcanzar `visitThreshold` visitas, el cajero puede otorgar
// `discountPercent` (100 = producto gratis) sobre UNA unidad de alguno de sus
// productos elegibles. `resetsCounter` reinicia el contador de ciclo al aplicarla.
export type Promotion = {
  id: string;
  name: string;
  discountPercent: number; // 1..100 (100 = gratis)
  visitThreshold: number; // umbral de visitas (> 0)
  resetsCounter: boolean;
  status: 'active' | 'inactive'; // inactive = archivada
  productIds: string[];
  createdAt: string;
  updatedAt: string;
};

// Datos editables de una promoción (POST/PUT).
export type PromotionInput = {
  name: string;
  discountPercent: number;
  visitThreshold: number;
  resetsCounter: boolean;
  productIds: string[];
};

export type PromotionStatusFilter = 'active' | 'inactive' | 'all';

export const listPromotions = (status: PromotionStatusFilter = 'active') =>
  api.get<{ items: Promotion[] }>(`/loyalty/promotions?status=${status}`).then((r) => r.items);

export const getPromotion = (id: string) =>
  api.get<{ promotion: Promotion }>(`/loyalty/promotions/${id}`).then((r) => r.promotion);

export const createPromotion = (input: PromotionInput) =>
  api.post<{ promotion: Promotion }>('/loyalty/promotions', input).then((r) => r.promotion);

export const updatePromotion = (id: string, input: PromotionInput) =>
  api.put<{ promotion: Promotion }>(`/loyalty/promotions/${id}`, input).then((r) => r.promotion);

// Baja = archivar (soft delete → status='inactive'). Responde 204 sin cuerpo.
export const archivePromotion = (id: string) => api.delete<void>(`/loyalty/promotions/${id}`);

// --- Estado de lealtad de un cliente (POS) ---

// Un producto elegible de una promoción (para mostrar "para qué es" y elegir la
// unidad beneficiada cuando la promo es aplicable).
export type PromoProduct = {
  id: string;
  name: string;
  priceCents: number;
};

// Elegibilidad de una promoción para un cliente concreto.
export type PromotionStatus = {
  promotionId: string;
  name: string;
  discountPercent: number;
  visitThreshold: number;
  resetsCounter: boolean;
  visitsRemaining: number; // max(0, visitThreshold - visits)
  applicableNow: boolean; // (visits + 1) >= visitThreshold  ⇔ visitsRemaining <= 1
  redeemedThisCycle: boolean; // ya se aplicó esta promo en el ciclo vigente
  products: PromoProduct[];
};

// Resumen de lealtad de un cliente: visitas y promociones (orden ascendente por
// visitsRemaining, las aplicables primero).
export type CustomerLoyaltyStatus = {
  customerId: string;
  visits: number;
  visitsLifetime: number;
  promotions: PromotionStatus[];
};

export const getCustomerLoyaltyStatus = (customerId: string) =>
  api.get<CustomerLoyaltyStatus>(`/loyalty/customers/${customerId}/status`);
