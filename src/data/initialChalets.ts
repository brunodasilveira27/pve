import { CategoryRates, Chalet, ChaletCategory, ChaletStatus } from '../types/chalet';

const NOW = new Date().toISOString();

export const DEFAULT_CATEGORY_RATES: CategoryRates = {
  [ChaletCategory.STAND]: 350,
  [ChaletCategory.ERMITAO]: 450,
  [ChaletCategory.HIDRO]: 650,
  [ChaletCategory.CASA]: 850,
};

export function formatCurrencyBRL(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);
}

export function parseDecimalInput(raw: string): number {
  const cleaned = raw.trim().replace(/\s+/g, '');
  if (!cleaned) return 0;
  const normalized = cleaned.includes(',')
    ? cleaned.replace(/\./g, '').replace(',', '.')
    : cleaned;
  const num = Number(normalized);
  if (!Number.isFinite(num) || num < 0) return 0;
  return Math.round(num * 100) / 100;
}

export function calculateNights(checkIn?: string, checkOut?: string): number {
  if (!checkIn || !checkOut) return 1;
  const start = new Date(`${checkIn}T12:00:00`);
  const end = new Date(`${checkOut}T12:00:00`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 1;
  const diffDays = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  return Math.max(1, diffDays);
}

export function calculateChaletTotals(chalet: Chalet, rates: CategoryRates) {
  const nights = calculateNights(chalet.checkIn, chalet.checkOut);
  const dailyRate = chalet.dailyRate ?? rates[chalet.category];
  const lodgingTotal = nights * dailyRate;
  const extrasAmount = Math.max(0, chalet.extrasAmount ?? 0);
  const totalAmount = lodgingTotal + extrasAmount;
  const paidAmount = Math.max(0, chalet.paidAmount ?? 0);
  const balanceDue = Math.max(0, totalAmount - paidAmount);

  return {
    nights,
    dailyRate,
    lodgingTotal,
    extrasAmount,
    totalAmount,
    paidAmount,
    balanceDue,
  };
}

function padCode(num: number): string {
  return String(num).padStart(2, '0');
}

function getCategoryForNumber(num: number): ChaletCategory {
  if (num >= 1 && num <= 11) return ChaletCategory.STAND;
  if (num >= 12 && num <= 17) return ChaletCategory.ERMITAO;
  if (num === 18) return ChaletCategory.HIDRO;
  return ChaletCategory.CASA;
}

function getLabelForNumber(num: number): string {
  if (num === 19) return 'Casa';
  return `Chalé ${padCode(num)}`;
}

const SAMPLE_STATES: Record<
  number,
  Partial<
    Pick<
      Chalet,
      | 'status'
      | 'guestName'
      | 'guestCount'
      | 'checkIn'
      | 'checkOut'
      | 'dailyRate'
      | 'extrasAmount'
      | 'extrasNote'
      | 'paidAmount'
      | 'blockReason'
    >
  >
> = {
  2: {
    status: ChaletStatus.OCUPADO,
    guestName: 'Família Silva',
    guestCount: 2,
    checkIn: '2026-11-13',
    checkOut: '2026-11-16',
    dailyRate: 350,
    extrasAmount: 80,
    extrasNote: 'Frigobar',
    paidAmount: 500,
  },
  3: {
    status: ChaletStatus.OCUPADO,
    guestName: 'Mariana Souza',
    guestCount: 2,
    checkIn: '2026-11-14',
    checkOut: '2026-11-17',
    dailyRate: 350,
    extrasAmount: 0,
    paidAmount: 525,
  },
  5: { status: ChaletStatus.BLOQUEADO, blockReason: 'Manutenção' },
  6: {
    status: ChaletStatus.OCUPADO,
    guestName: 'Carlos Costa',
    guestCount: 3,
    checkIn: '2026-11-12',
    checkOut: '2026-11-15',
    dailyRate: 390,
    extrasAmount: 120,
    extrasNote: 'Cama extra e bebidas',
    paidAmount: 600,
  },
  8: {
    status: ChaletStatus.OCUPADO,
    guestName: 'Ana Lima',
    guestCount: 2,
    checkIn: '2026-11-14',
    checkOut: '2026-11-16',
    dailyRate: 350,
    extrasAmount: 0,
    paidAmount: 350,
  },
  10: {
    status: ChaletStatus.OCUPADO,
    guestName: 'Roberto Pereira',
    guestCount: 2,
    checkIn: '2026-11-13',
    checkOut: '2026-11-15',
    dailyRate: 350,
    extrasAmount: 45,
    extrasNote: 'Consumo bar',
    paidAmount: 0,
  },
  12: { status: ChaletStatus.BLOQUEADO, blockReason: 'Reservado' },
  13: {
    status: ChaletStatus.OCUPADO,
    guestName: 'Juliana Almeida',
    guestCount: 2,
    checkIn: '2026-11-14',
    checkOut: '2026-11-18',
    dailyRate: 450,
    extrasAmount: 0,
    paidAmount: 900,
  },
  15: {
    status: ChaletStatus.OCUPADO,
    guestName: 'Lucas Oliveira',
    guestCount: 2,
    checkIn: '2026-11-13',
    checkOut: '2026-11-15',
    dailyRate: 450,
    extrasAmount: 60,
    paidAmount: 450,
  },
  17: {
    status: ChaletStatus.OCUPADO,
    guestName: 'Fernanda Rodrigues',
    guestCount: 2,
    checkIn: '2026-11-14',
    checkOut: '2026-11-16',
    dailyRate: 450,
    extrasAmount: 0,
    paidAmount: 450,
  },
  18: {
    status: ChaletStatus.OCUPADO,
    guestName: 'Casal Mendes',
    guestCount: 2,
    checkIn: '2026-11-14',
    checkOut: '2026-11-17',
    dailyRate: 650,
    extrasAmount: 150,
    extrasNote: 'Kit lareira e vinho',
    paidAmount: 1000,
  },
};

export function createInitialChalets(): Chalet[] {
  return Array.from({ length: 19 }, (_, idx) => {
    const id = idx + 1;
    const category = getCategoryForNumber(id);
    const sample = SAMPLE_STATES[id];
    return {
      id,
      code: padCode(id),
      label: getLabelForNumber(id),
      category,
      status: sample?.status ?? ChaletStatus.LIVRE,
      guestName: sample?.guestName,
      guestCount: sample?.guestCount,
      checkIn: sample?.checkIn,
      checkOut: sample?.checkOut,
      dailyRate: sample?.dailyRate ?? DEFAULT_CATEGORY_RATES[category],
      extrasAmount: sample?.extrasAmount,
      extrasNote: sample?.extrasNote,
      paidAmount: sample?.paidAmount,
      blockReason: sample?.blockReason,
      updatedAt: NOW,
    };
  });
}
