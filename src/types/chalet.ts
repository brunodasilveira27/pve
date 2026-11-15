export enum ChaletCategory {
  STAND = 'Stand',
  ERMITAO = 'Ermitão',
  HIDRO = 'Hidro',
  CASA = 'Casa',
}

export enum ChaletStatus {
  LIVRE = 'Livre',
  OCUPADO = 'Ocupado',
  BLOQUEADO = 'Bloqueado',
}

export enum PaymentMethod {
  PIX = 'Pix',
  CARTAO = 'Cartão',
  DINHEIRO = 'Dinheiro',
  TRANSFERENCIA = 'Transferência',
}

export type CategoryRates = Record<ChaletCategory, number>;

export interface Guest {
  id: string;
  fullName: string;
  document?: string;
  phone?: string;
  email?: string;
  cityState?: string;
  birthDate?: string;
  vehiclePlate?: string;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Chalet {
  id: number;
  code: string;
  label: string;
  category: ChaletCategory;
  status: ChaletStatus;
  guestId?: string;
  guestName?: string;
  guestCount?: number;
  checkIn?: string;
  checkOut?: string;
  dailyRate?: number;
  extrasAmount?: number;
  extrasNote?: string;
  paidAmount?: number;
  blockReason?: string;
  notes?: string;
  updatedAt: string;
}

export interface CheckoutRecord {
  id: string;
  chaletId: number;
  chaletCode: string;
  chaletLabel: string;
  category: ChaletCategory;
  guestName: string;
  guestCount: number;
  checkIn?: string;
  checkOut?: string;
  nights: number;
  dailyRate: number;
  lodgingTotal: number;
  extrasAmount: number;
  extrasNote?: string;
  totalAmount: number;
  paidBefore: number;
  finalCharged: number;
  paymentMethod: PaymentMethod;
  notes?: string;
  closedAt: string;
}

export type CategoryFilter = 'Todos' | ChaletCategory;
export type StatusFilter = 'Todos' | ChaletStatus;
