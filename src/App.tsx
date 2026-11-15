import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarCheck,
  CalendarClock,
  CheckCircle2,
  DollarSign,
  FileText,
  Lock,
  LogIn,
  Moon,
  RefreshCw,
  Sun,
  Users,
  X,
} from 'lucide-react';
import { AccountReportModal } from './components/AccountReportModal';
import { ChaletCard } from './components/ChaletCard';
import { ChaletModal } from './components/ChaletModal';
import { CheckoutModal } from './components/CheckoutModal';
import { CloseDayModal, CloseDayPayload } from './components/CloseDayModal';
import { GuestsModal } from './components/GuestsModal';
import { RatesModal } from './components/RatesModal';
import { ReservationsModal } from './components/ReservationsModal';
import {
  calculateChaletTotals,
  createInitialChalets,
  DEFAULT_CATEGORY_RATES,
} from './data/initialChalets';
import { createInitialGuests } from './data/initialGuests';
import { createInitialReservations } from './data/initialReservations';
import {
  CategoryRates,
  Chalet,
  ChaletStatus,
  CheckoutRecord,
  DailyClosingRecord,
  Guest,
  Reservation,
  ReservationStatus,
  StatusFilter,
} from './types/chalet';
import { addDaysYMD, getLocalTodayYMD } from './utils/validation';

const STORAGE_KEY = 'pve_chalets_v1';
const RATES_STORAGE_KEY = 'pve_rates_v1';
const CHECKOUTS_STORAGE_KEY = 'pve_checkouts_v1';
const GUESTS_STORAGE_KEY = 'pve_guests_v1';
const RESERVATIONS_STORAGE_KEY = 'pve_reservations_v1';
const BUSINESS_DATE_STORAGE_KEY = 'pve_business_date_v1';
const DAY_CLOSINGS_STORAGE_KEY = 'pve_day_closings_v1';
const THEME_STORAGE_KEY = 'pve_theme_v1';

type ThemeMode = 'light' | 'dark';

const STATUS_FILTERS: Array<{
  key: StatusFilter;
  label: string;
  icon?: typeof CheckCircle2;
  dotColor?: string;
}> = [
  { key: 'Todos', label: 'Todos' },
  {
    key: ChaletStatus.LIVRE,
    label: 'Livre',
    icon: CheckCircle2,
    dotColor: 'text-emerald-700 dark:text-emerald-400',
  },
  {
    key: ChaletStatus.OCUPADO,
    label: 'Ocupado',
    icon: Users,
    dotColor: 'text-rose-700 dark:text-rose-400',
  },
  {
    key: ChaletStatus.BLOQUEADO,
    label: 'Bloqueado',
    icon: Lock,
    dotColor: 'text-amber-700 dark:text-amber-400',
  },
];

function formatDateHeadingFromYMD(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const date = y && m && d ? new Date(y, m - 1, d, 12, 0, 0) : new Date();
  const formatted = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function formatDateShortBR(ymd: string): string {
  const [y, m, d] = ymd.split('-');
  if (!y || !m || !d) return ymd;
  return `${d}/${m}/${y.slice(2)}`;
}

function formatTime(date: Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date);
}

export default function App() {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    try {
      const saved = localStorage.getItem(THEME_STORAGE_KEY);
      if (saved === 'dark' || saved === 'light') {
        return saved;
      }
      if (window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
        return 'dark';
      }
    } catch {
      // Fallback to light theme
    }
    return 'light';
  });

  const [chalets, setChalets] = useState<Chalet[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Chalet[];
        if (Array.isArray(parsed) && parsed.length === 19) {
          return parsed;
        }
      }
    } catch {
      // Fallback to initial dataset
    }
    return createInitialChalets();
  });

  const [rates, setRates] = useState<CategoryRates>(() => {
    try {
      const saved = localStorage.getItem(RATES_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Partial<CategoryRates>;
        return { ...DEFAULT_CATEGORY_RATES, ...parsed };
      }
    } catch {
      // Fallback to default rates
    }
    return DEFAULT_CATEGORY_RATES;
  });

  const [checkoutRecords, setCheckoutRecords] = useState<CheckoutRecord[]>(() => {
    try {
      const saved = localStorage.getItem(CHECKOUTS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as CheckoutRecord[];
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // Fallback to empty records
    }
    return [];
  });

  const [guests, setGuests] = useState<Guest[]>(() => {
    try {
      const saved = localStorage.getItem(GUESTS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Guest[];
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // Fallback to initial guests
    }
    return createInitialGuests();
  });

  const [reservations, setReservations] = useState<Reservation[]>(() => {
    try {
      const saved = localStorage.getItem(RESERVATIONS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as Reservation[];
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // Fallback to initial reservations
    }
    return createInitialReservations();
  });

  const [businessDate, setBusinessDate] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(BUSINESS_DATE_STORAGE_KEY);
      if (saved && /^\d{4}-\d{2}-\d{2}$/.test(saved)) {
        return saved;
      }
    } catch {
      // Fallback to today's local date
    }
    return getLocalTodayYMD();
  });

  const [dayClosings, setDayClosings] = useState<DailyClosingRecord[]>(() => {
    try {
      const saved = localStorage.getItem(DAY_CLOSINGS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved) as DailyClosingRecord[];
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {
      // Fallback to empty history
    }
    return [];
  });

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('Todos');
  const [editingChalet, setEditingChalet] = useState<Chalet | null>(null);
  const [checkoutChalet, setCheckoutChalet] = useState<Chalet | null>(null);
  const [isRatesModalOpen, setIsRatesModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isGuestsModalOpen, setIsGuestsModalOpen] = useState(false);
  const [isReservationsModalOpen, setIsReservationsModalOpen] = useState(false);
  const [isCloseDayModalOpen, setIsCloseDayModalOpen] = useState(false);
  const [reserveTargetChaletId, setReserveTargetChaletId] = useState<number | null>(null);
  const [dayClosingBanner, setDayClosingBanner] = useState<string | null>(null);
  const [dashboardBanner, setDashboardBanner] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(() => new Date());

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Ignore storage quota errors
    }
  }, [theme]);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(chalets));
    } catch {
      // Ignore storage quota errors
    }
  }, [chalets]);

  useEffect(() => {
    try {
      localStorage.setItem(RATES_STORAGE_KEY, JSON.stringify(rates));
    } catch {
      // Ignore storage quota errors
    }
  }, [rates]);

  useEffect(() => {
    try {
      localStorage.setItem(CHECKOUTS_STORAGE_KEY, JSON.stringify(checkoutRecords));
    } catch {
      // Ignore storage quota errors
    }
  }, [checkoutRecords]);

  useEffect(() => {
    try {
      localStorage.setItem(GUESTS_STORAGE_KEY, JSON.stringify(guests));
    } catch {
      // Ignore storage quota errors
    }
  }, [guests]);

  useEffect(() => {
    try {
      localStorage.setItem(RESERVATIONS_STORAGE_KEY, JSON.stringify(reservations));
    } catch {
      // Ignore storage quota errors
    }
  }, [reservations]);

  useEffect(() => {
    try {
      localStorage.setItem(BUSINESS_DATE_STORAGE_KEY, businessDate);
    } catch {
      // Ignore storage quota errors
    }
  }, [businessDate]);

  useEffect(() => {
    try {
      localStorage.setItem(DAY_CLOSINGS_STORAGE_KEY, JSON.stringify(dayClosings));
    } catch {
      // Ignore storage quota errors
    }
  }, [dayClosings]);

  const activeReservationsByChalet = useMemo(() => {
    const map = new Map<number, Reservation[]>();
    const active = reservations
      .filter(
        (r) =>
          r.status === ReservationStatus.CONFIRMADA ||
          r.status === ReservationStatus.PENDENTE,
      )
      .sort((a, b) => a.checkIn.localeCompare(b.checkIn));

    for (const res of active) {
      const list = map.get(res.chaletId) ?? [];
      list.push(res);
      map.set(res.chaletId, list);
    }
    return map;
  }, [reservations]);

  const activeReservationsCount = useMemo(
    () =>
      reservations.filter(
        (r) =>
          r.status === ReservationStatus.CONFIRMADA ||
          r.status === ReservationStatus.PENDENTE,
      ).length,
    [reservations],
  );

  const arrivingReservations = useMemo(
    () =>
      reservations
        .filter(
          (r) =>
            (r.status === ReservationStatus.CONFIRMADA ||
              r.status === ReservationStatus.PENDENTE) &&
            r.checkIn <= businessDate,
        )
        .sort((a, b) => a.checkIn.localeCompare(b.checkIn)),
    [reservations, businessDate],
  );

  const dayPendingCount = useMemo(() => {
    const dueCheckoutsCount = chalets.filter(
      (c) =>
        c.status === ChaletStatus.OCUPADO &&
        Boolean(c.checkOut) &&
        (c.checkOut as string) <= businessDate,
    ).length;

    const dueCheckinsCount = reservations.filter(
      (r) =>
        (r.status === ReservationStatus.CONFIRMADA ||
          r.status === ReservationStatus.PENDENTE) &&
        r.checkIn <= businessDate,
    ).length;

    const missingCheckoutDateCount = chalets.filter(
      (c) => c.status === ChaletStatus.OCUPADO && !c.checkOut,
    ).length;

    return dueCheckoutsCount + dueCheckinsCount + missingCheckoutDateCount;
  }, [chalets, reservations, businessDate]);

  const counts = useMemo(() => {
    const occupiedList = chalets.filter((c) => c.status === ChaletStatus.OCUPADO);
    const occupied = occupiedList.length;
    const available = chalets.filter((c) => c.status === ChaletStatus.LIVRE).length;
    const blocked = chalets.filter((c) => c.status === ChaletStatus.BLOQUEADO).length;
    const occupancyRate = Math.round((occupied / chalets.length) * 100);

    const activeReceivable = occupiedList.reduce(
      (sum, item) => sum + calculateChaletTotals(item, rates).balanceDue,
      0,
    );
    const closedTotal = checkoutRecords.reduce(
      (sum, record) => sum + record.totalAmount,
      0,
    );

    return {
      total: chalets.length,
      occupied,
      available,
      blocked,
      occupancyRate,
      activeReceivable,
      closedTotal,
    };
  }, [chalets, rates, checkoutRecords]);

  const filteredChalets = useMemo(() => {
    return chalets.filter((chalet) => {
      if (statusFilter !== 'Todos' && chalet.status !== statusFilter) {
        return false;
      }
      return true;
    });
  }, [chalets, statusFilter]);

  const handleSaveChalet = (updated: Chalet) => {
    setChalets((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    setLastUpdated(new Date());
    setEditingChalet(null);
  };

  const handleConfirmCheckout = (record: CheckoutRecord) => {
    setChalets((prev) =>
      prev.map((item) => {
        if (item.id !== record.chaletId) return item;
        return {
          ...item,
          status: ChaletStatus.BLOQUEADO,
          guestId: undefined,
          guestName: undefined,
          guestCount: undefined,
          checkIn: undefined,
          checkOut: undefined,
          dailyRate: rates[item.category],
          extrasAmount: undefined,
          extrasNote: undefined,
          paidAmount: undefined,
          blockReason: 'Em limpeza',
          notes: undefined,
          updatedAt: new Date().toISOString(),
        };
      }),
    );
    setCheckoutRecords((prev) => [record, ...prev]);
    setLastUpdated(new Date());
    setCheckoutChalet(null);
    setEditingChalet(null);
  };

  const handleReleaseChalet = (chalet: Chalet) => {
    setChalets((prev) =>
      prev.map((item) => {
        if (item.id !== chalet.id) return item;
        return {
          ...item,
          status: ChaletStatus.LIVRE,
          guestId: undefined,
          guestName: undefined,
          guestCount: undefined,
          checkIn: undefined,
          checkOut: undefined,
          dailyRate: rates[item.category],
          extrasAmount: undefined,
          extrasNote: undefined,
          paidAmount: undefined,
          blockReason: undefined,
          notes: undefined,
          updatedAt: new Date().toISOString(),
        };
      }),
    );
    setLastUpdated(new Date());
  };

  const handleSaveRates = (updatedRates: CategoryRates) => {
    setRates(updatedRates);
    setChalets((prev) =>
      prev.map((item) =>
        item.status === ChaletStatus.LIVRE
          ? { ...item, dailyRate: updatedRates[item.category] }
          : item,
      ),
    );
    setLastUpdated(new Date());
    setIsRatesModalOpen(false);
  };

  const handleDeleteCheckoutRecord = (id: string) => {
    setCheckoutRecords((prev) => prev.filter((item) => item.id !== id));
    setLastUpdated(new Date());
  };

  const handleSaveGuest = (savedGuest: Guest) => {
    setGuests((prev) => {
      const exists = prev.some((item) => item.id === savedGuest.id);
      if (exists) {
        return prev.map((item) => (item.id === savedGuest.id ? savedGuest : item));
      }
      return [savedGuest, ...prev];
    });
    setChalets((prev) =>
      prev.map((chalet) =>
        chalet.guestId === savedGuest.id
          ? { ...chalet, guestName: savedGuest.fullName }
          : chalet,
      ),
    );
    setLastUpdated(new Date());
  };

  const handleDeleteGuest = (id: string) => {
    setGuests((prev) => prev.filter((item) => item.id !== id));
    setChalets((prev) =>
      prev.map((chalet) =>
        chalet.guestId === id ? { ...chalet, guestId: undefined } : chalet,
      ),
    );
    setLastUpdated(new Date());
  };

  const handleSaveReservation = (saved: Reservation) => {
    setReservations((prev) => {
      const exists = prev.some((item) => item.id === saved.id);
      if (exists) {
        return prev.map((item) => (item.id === saved.id ? saved : item));
      }
      return [saved, ...prev];
    });
    setLastUpdated(new Date());
  };

  const handleUpdateReservationStatus = (id: string, status: ReservationStatus) => {
    setReservations((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, status, updatedAt: new Date().toISOString() }
          : item,
      ),
    );
    setLastUpdated(new Date());
  };

  const handleDeleteReservation = (id: string) => {
    setReservations((prev) => prev.filter((item) => item.id !== id));
    setLastUpdated(new Date());
  };

  const handleCheckInReservation = (reservation: Reservation): string | null => {
    const targetChalet = chalets.find((c) => c.id === reservation.chaletId);
    if (!targetChalet) {
      return 'Acomodação não encontrada.';
    }
    if (targetChalet.status !== ChaletStatus.LIVRE) {
      return `${targetChalet.label} está ${targetChalet.status.toLowerCase()} no momento. Libere ou conclua o check-out antes de efetuar este check-in.`;
    }

    const now = new Date().toISOString();
    const effectiveCheckIn =
      reservation.checkIn > businessDate ? businessDate : reservation.checkIn;
    const effectiveCheckOut =
      reservation.checkOut <= effectiveCheckIn
        ? addDaysYMD(effectiveCheckIn, 1)
        : reservation.checkOut;

    setChalets((prev) =>
      prev.map((item) => {
        if (item.id !== reservation.chaletId) return item;
        return {
          ...item,
          status: ChaletStatus.OCUPADO,
          guestId: reservation.guestId,
          guestName: reservation.guestName,
          guestCount: reservation.guestCount,
          checkIn: effectiveCheckIn,
          checkOut: effectiveCheckOut,
          dailyRate: reservation.dailyRate,
          extrasAmount: 0,
          extrasNote: undefined,
          paidAmount: reservation.depositPaid,
          blockReason: undefined,
          notes: reservation.notes,
          updatedAt: now,
        };
      }),
    );

    setReservations((prev) =>
      prev.map((item) =>
        item.id === reservation.id
          ? {
              ...item,
              status: ReservationStatus.CHECKIN_REALIZADO,
              updatedAt: now,
            }
          : item,
      ),
    );
    setLastUpdated(new Date());
    setDashboardBanner({
      type: 'success',
      message: `Check-in de ${reservation.guestName} realizado no ${reservation.chaletLabel}.`,
    });
    return null;
  };

  const handleDashboardCheckInReservation = (reservation: Reservation) => {
    const err = handleCheckInReservation(reservation);
    if (err) {
      setDashboardBanner({ type: 'error', message: err });
    }
  };

  const handleConfirmCloseDay = (payload: CloseDayPayload) => {
    const nowIso = new Date().toISOString();
    const recordTimestamp =
      businessDate === getLocalTodayYMD()
        ? nowIso
        : new Date(`${businessDate}T18:00:00`).toISOString();

    const newCheckoutRecords: CheckoutRecord[] = [];
    const checkoutSelectionMap = new Map(
      payload.checkoutSelections.map((sel) => [sel.chaletId, sel.paymentMethod]),
    );
    const releaseCleaningSet = new Set(payload.releaseCleaningChaletIds);

    let nextChalets = chalets.map((chalet, idx) => {
      const paymentMethod = checkoutSelectionMap.get(chalet.id);
      if (paymentMethod && chalet.status === ChaletStatus.OCUPADO) {
        const totals = calculateChaletTotals(chalet, rates);
        newCheckoutRecords.push({
          id: `${chalet.id}-${Date.now()}-${idx}`,
          chaletId: chalet.id,
          chaletCode: chalet.code,
          chaletLabel: chalet.label,
          category: chalet.category,
          guestName: chalet.guestName ?? 'Hóspede',
          guestCount: chalet.guestCount ?? 1,
          checkIn: chalet.checkIn,
          checkOut: chalet.checkOut || businessDate,
          nights: totals.nights,
          dailyRate: totals.dailyRate,
          lodgingTotal: totals.lodgingTotal,
          extrasAmount: totals.extrasAmount,
          extrasNote: chalet.extrasNote,
          totalAmount: totals.totalAmount,
          paidBefore: totals.paidAmount,
          finalCharged: totals.balanceDue,
          paymentMethod,
          notes: chalet.notes,
          closedAt: recordTimestamp,
        });

        return {
          ...chalet,
          status: ChaletStatus.BLOQUEADO,
          guestId: undefined,
          guestName: undefined,
          guestCount: undefined,
          checkIn: undefined,
          checkOut: undefined,
          dailyRate: rates[chalet.category],
          extrasAmount: undefined,
          extrasNote: undefined,
          paidAmount: undefined,
          blockReason: 'Em limpeza',
          notes: undefined,
          updatedAt: nowIso,
        };
      }

      if (releaseCleaningSet.has(chalet.id) && chalet.status === ChaletStatus.BLOQUEADO) {
        return {
          ...chalet,
          status: ChaletStatus.LIVRE,
          blockReason: undefined,
          dailyRate: rates[chalet.category],
          updatedAt: nowIso,
        };
      }

      return chalet;
    });

    const checkinIdsSet = new Set(payload.checkinReservationIds);
    const checkedInReservations = reservations.filter((r) => checkinIdsSet.has(r.id));

    for (const res of checkedInReservations) {
      nextChalets = nextChalets.map((chalet) => {
        if (chalet.id !== res.chaletId) return chalet;
        return {
          ...chalet,
          status: ChaletStatus.OCUPADO,
          guestId: res.guestId,
          guestName: res.guestName,
          guestCount: res.guestCount,
          checkIn: res.checkIn,
          checkOut: res.checkOut,
          dailyRate: res.dailyRate,
          extrasAmount: 0,
          extrasNote: undefined,
          paidAmount: res.depositPaid,
          blockReason: undefined,
          notes: res.notes,
          updatedAt: nowIso,
        };
      });
    }

    const existingTodayRevenue = checkoutRecords
      .filter((rec) => {
        const closedLocal = getLocalTodayYMD(new Date(rec.closedAt));
        return closedLocal === businessDate || rec.checkOut === businessDate;
      })
      .reduce((sum, rec) => sum + rec.totalAmount, 0);

    const newCheckoutsRevenue = newCheckoutRecords.reduce(
      (sum, rec) => sum + rec.totalAmount,
      0,
    );

    const occupiedEndCount = nextChalets.filter(
      (c) => c.status === ChaletStatus.OCUPADO,
    ).length;
    const availableEndCount = nextChalets.filter(
      (c) => c.status === ChaletStatus.LIVRE,
    ).length;
    const blockedEndCount = nextChalets.filter(
      (c) => c.status === ChaletStatus.BLOQUEADO,
    ).length;

    const closingEntry: DailyClosingRecord = {
      id: `day-${businessDate}-${Date.now()}`,
      businessDate,
      closedAt: nowIso,
      checkoutsCount: newCheckoutRecords.length,
      checkinsCount: checkedInReservations.length,
      releasedCleaningCount: payload.releaseCleaningChaletIds.length,
      occupiedEndCount,
      availableEndCount,
      blockedEndCount,
      dayRevenue: existingTodayRevenue + newCheckoutsRevenue,
      notes: payload.notes || undefined,
      checkoutIds: newCheckoutRecords.map((r) => r.id),
      checkinReservationIds: checkedInReservations.map((r) => r.id),
    };

    setChalets(nextChalets);
    if (newCheckoutRecords.length > 0) {
      setCheckoutRecords((prev) => [...newCheckoutRecords, ...prev]);
    }
    if (checkedInReservations.length > 0) {
      setReservations((prev) =>
        prev.map((item) =>
          checkinIdsSet.has(item.id)
            ? {
                ...item,
                status: ReservationStatus.CHECKIN_REALIZADO,
                updatedAt: nowIso,
              }
            : item,
        ),
      );
    }
    setDayClosings((prev) => [closingEntry, ...prev]);

    const nextBusinessDate = payload.advanceDate
      ? addDaysYMD(businessDate, 1)
      : businessDate;
    if (payload.advanceDate) {
      setBusinessDate(nextBusinessDate);
    }

    setLastUpdated(new Date());
    setIsCloseDayModalOpen(false);
    setDayClosingBanner(
      `Dia ${formatDateShortBR(businessDate)} fechado: ${newCheckoutRecords.length} check-out(s), ${checkedInReservations.length} check-in(s)${
        payload.advanceDate
          ? `. Painel atualizado para ${formatDateShortBR(nextBusinessDate)}.`
          : '.'
      }`,
    );
  };

  const handleSyncToday = () => {
    setBusinessDate(getLocalTodayYMD());
    setLastUpdated(new Date());
  };

  const handleDeleteDayClosing = (id: string) => {
    setDayClosings((prev) => prev.filter((item) => item.id !== id));
    setLastUpdated(new Date());
  };

  const handleRefresh = () => {
    setLastUpdated(new Date());
  };

  const handleResetFilters = () => {
    setStatusFilter('Todos');
  };

  const hasActiveFilters = statusFilter !== 'Todos';

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-150">
      <main id="painel" className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Pousada Vale do Ermitão
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums mt-0.5">
            Painel de Acomodações · {formatDateHeadingFromYMD(businessDate)} · 11 Stand · 6 Ermitão · 1 Hidro · 1 Casa
          </p>
        </div>

        {dayClosingBanner && (
          <div
            role="status"
            className="flex items-center justify-between gap-3 rounded-xl border border-emerald-200 dark:border-emerald-800/80 bg-emerald-50 dark:bg-emerald-950/50 px-4 py-2.5 text-xs font-medium text-emerald-900 dark:text-emerald-200"
          >
            <span>{dayClosingBanner}</span>
            <button
              type="button"
              onClick={() => setDayClosingBanner(null)}
              aria-label="Fechar aviso"
              className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {dashboardBanner && (
          <div
            role={dashboardBanner.type === 'error' ? 'alert' : 'status'}
            className={`flex items-center justify-between gap-3 rounded-xl border px-4 py-2.5 text-xs font-medium ${
              dashboardBanner.type === 'error'
                ? 'border-rose-200 dark:border-rose-800/80 bg-rose-50 dark:bg-rose-950/50 text-rose-900 dark:text-rose-200'
                : 'border-emerald-200 dark:border-emerald-800/80 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-900 dark:text-emerald-200'
            }`}
          >
            <span>{dashboardBanner.message}</span>
            <button
              type="button"
              onClick={() => setDashboardBanner(null)}
              aria-label="Fechar aviso de check-in"
              className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <section
          aria-label="Filtros e busca"
          className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3"
        >
          <div className="flex flex-wrap items-center gap-2">
            <div
              className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg overflow-x-auto max-w-full"
              role="group"
              aria-label="Filtrar por status"
            >
              {STATUS_FILTERS.map((item) => {
                const Icon = item.icon;
                const isActive = statusFilter === item.key;
                const count =
                  item.key === 'Todos'
                    ? counts.total
                    : item.key === ChaletStatus.LIVRE
                      ? counts.available
                      : item.key === ChaletStatus.OCUPADO
                        ? counts.occupied
                        : counts.blocked;

                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setStatusFilter(item.key)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 tabular-nums ${
                      isActive
                        ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 shadow-sm'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {Icon && (
                      <Icon className={`h-3.5 w-3.5 shrink-0 ${item.dotColor}`} aria-hidden="true" />
                    )}
                    <span>
                      {item.label} ({count})
                    </span>
                  </button>
                );
              })}
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100 rounded-md hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Limpar filtros</span>
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setIsCloseDayModalOpen(true)}
              title={
                dayPendingCount > 0
                  ? `${dayPendingCount} pendência(s) operacional(is) para ${formatDateShortBR(businessDate)}`
                  : `Fechar o dia ${formatDateShortBR(businessDate)}`
              }
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 h-10 px-3.5 text-xs font-medium text-white dark:text-slate-950 bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white rounded-lg transition-colors whitespace-nowrap shrink-0 tabular-nums"
            >
              {dayPendingCount > 0 ? (
                <AlertTriangle
                  className="h-3.5 w-3.5 text-amber-300 dark:text-amber-700"
                  aria-hidden="true"
                />
              ) : (
                <CalendarCheck className="h-3.5 w-3.5" aria-hidden="true" />
              )}
              <span>
                Fechar o dia{dayPendingCount > 0 ? ` (${dayPendingCount})` : ''}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setReserveTargetChaletId(null);
                setIsReservationsModalOpen(true);
              }}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 h-10 px-3.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600 rounded-lg transition-colors whitespace-nowrap shrink-0 tabular-nums"
            >
              <CalendarClock
                className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400"
                aria-hidden="true"
              />
              <span>Reservas ({activeReservationsCount})</span>
            </button>

            <button
              type="button"
              onClick={() => setIsGuestsModalOpen(true)}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 h-10 px-3.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600 rounded-lg transition-colors whitespace-nowrap shrink-0 tabular-nums"
            >
              <Users className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" aria-hidden="true" />
              <span>Hóspedes ({guests.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setIsReportModalOpen(true)}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 h-10 px-3.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600 rounded-lg transition-colors whitespace-nowrap shrink-0 tabular-nums"
            >
              <FileText className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" aria-hidden="true" />
              <span>
                Fechamento{checkoutRecords.length > 0 ? ` (${checkoutRecords.length})` : ''}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setIsRatesModalOpen(true)}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-1.5 h-10 px-3.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <DollarSign className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" aria-hidden="true" />
              <span>Valores</span>
            </button>

            <button
              type="button"
              onClick={() => setTheme((prev) => (prev === 'light' ? 'dark' : 'light'))}
              aria-label={theme === 'light' ? 'Ativar modo escuro' : 'Ativar modo claro'}
              title={theme === 'light' ? 'Modo escuro' : 'Modo claro'}
              className="inline-flex items-center justify-center h-10 w-10 text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600 rounded-lg transition-colors shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-200"
            >
              {theme === 'light' ? (
                <Moon className="h-4 w-4" aria-hidden="true" />
              ) : (
                <Sun className="h-4 w-4" aria-hidden="true" />
              )}
            </button>
          </div>
        </section>

        {arrivingReservations.length > 0 && (
          <section
            aria-label="Reservas que estão para chegar"
            className="rounded-xl border border-sky-200 dark:border-sky-800/80 bg-sky-50/70 dark:bg-sky-950/30 p-3.5 space-y-2.5"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-sky-950 dark:text-sky-200">
                <LogIn className="h-4 w-4 text-sky-700 dark:text-sky-400 shrink-0" aria-hidden="true" />
                <span>
                  Reservas para chegar ({arrivingReservations.length})
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setReserveTargetChaletId(null);
                  setIsReservationsModalOpen(true);
                }}
                className="text-xs font-medium text-sky-800 dark:text-sky-300 hover:underline whitespace-nowrap"
              >
                Abrir agenda de reservas
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {arrivingReservations.map((res) => {
                const target = chalets.find((c) => c.id === res.chaletId);
                const isOverdue = res.checkIn < businessDate;
                return (
                  <div
                    key={res.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-sky-200/80 dark:border-sky-800/70 bg-white dark:bg-slate-900 px-3 py-2 text-xs"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 dark:text-slate-100 truncate">
                        {res.chaletLabel} · {res.guestName}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums truncate">
                        {formatDateShortBR(res.checkIn)} → {formatDateShortBR(res.checkOut)}
                        {isOverdue ? ' · em atraso' : ' · chegada hoje'}
                        {target && target.status !== ChaletStatus.LIVRE
                          ? ` · ${target.status === ChaletStatus.BLOQUEADO ? target.blockReason || 'Bloqueado' : 'Ocupado'}`
                          : ''}
                      </p>
                    </div>

                    {target?.status === ChaletStatus.LIVRE ? (
                      <button
                        type="button"
                        onClick={() => handleDashboardCheckInReservation(res)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-white dark:text-slate-950 bg-emerald-700 hover:bg-emerald-800 dark:bg-emerald-400 dark:hover:bg-emerald-300 rounded-lg transition-colors whitespace-nowrap shrink-0"
                      >
                        <LogIn className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Dar check-in</span>
                      </button>
                    ) : target?.status === ChaletStatus.BLOQUEADO ? (
                      <button
                        type="button"
                        onClick={() => handleReleaseChalet(target)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-amber-900 dark:text-amber-200 bg-amber-50 dark:bg-amber-950/70 border border-amber-300 dark:border-amber-800 hover:bg-amber-100 dark:hover:bg-amber-900/70 rounded-lg transition-colors whitespace-nowrap shrink-0"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                        <span>Liberar</span>
                      </button>
                    ) : target ? (
                      <button
                        type="button"
                        onClick={() => setCheckoutChalet(target)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-rose-800 dark:text-rose-200 bg-rose-50 dark:bg-rose-950/70 border border-rose-200 dark:border-rose-800 hover:bg-rose-100 dark:hover:bg-rose-900/70 rounded-lg transition-colors whitespace-nowrap shrink-0"
                      >
                        <span>Check-out atual</span>
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        <section aria-label="Grade de chalés e acomodações">
          {filteredChalets.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5">
              {filteredChalets.map((chalet) => {
                const todayEntries = (activeReservationsByChalet.get(chalet.id) ?? []).filter(
                  (r) => r.checkIn === businessDate,
                );
                return (
                  <ChaletCard
                    key={chalet.id}
                    chalet={chalet}
                    rates={rates}
                    businessDate={businessDate}
                    nextReservation={todayEntries[0]}
                    upcomingCount={todayEntries.length}
                    onSelect={(selected) => setEditingChalet(selected)}
                    onCheckout={(selected) => setCheckoutChalet(selected)}
                    onRelease={handleReleaseChalet}
                    onCheckInReservation={handleDashboardCheckInReservation}
                  />
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 py-14 px-6 text-center">
              <p className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
                Nenhuma acomodação encontrada
              </p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Não há chalés correspondentes aos filtros ou busca aplicados.
              </p>
              <button
                type="button"
                onClick={handleResetFilters}
                className="mt-4 px-4 py-2 text-sm font-medium text-white dark:text-slate-950 bg-slate-900 dark:bg-slate-100 rounded-lg hover:bg-slate-800 dark:hover:bg-white transition-colors"
              >
                Mostrar todas as 19 acomodações
              </button>
            </div>
          )}
        </section>
      </main>

      <footer className="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap tabular-nums">
              Ocupação Atual:{' '}
              <strong className="text-slate-900 dark:text-slate-100">
                {counts.occupancyRate}%
              </strong>
            </span>
            <div
              className="w-40 sm:w-52 h-2 rounded-full bg-slate-100 dark:bg-slate-800 overflow-hidden"
              role="progressbar"
              aria-valuenow={counts.occupancyRate}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Taxa de ocupação atual"
            >
              <div
                className="h-full w-full bg-slate-900 dark:bg-slate-100 transition-transform duration-200 origin-left"
                style={{ transform: `scaleX(${counts.occupancyRate / 100})` }}
              />
            </div>
          </div>

          <div className="flex items-center justify-between sm:justify-end gap-4 text-xs text-slate-500 dark:text-slate-400">
            <span className="tabular-nums whitespace-nowrap">
              Atualizado às {formatTime(lastUpdated)}
            </span>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleRefresh}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Atualizar</span>
              </button>
            </div>
          </div>
        </div>
      </footer>

      {editingChalet && (
        <ChaletModal
          chalet={editingChalet}
          rates={rates}
          guests={guests}
          businessDate={businessDate}
          upcomingReservations={activeReservationsByChalet.get(editingChalet.id) ?? []}
          onClose={() => setEditingChalet(null)}
          onSave={handleSaveChalet}
          onSaveGuest={handleSaveGuest}
          onOpenCheckout={(updated) => {
            setChalets((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
            setEditingChalet(null);
            setCheckoutChalet(updated);
          }}
          onOpenReserve={(target) => {
            setEditingChalet(null);
            setReserveTargetChaletId(target.id);
            setIsReservationsModalOpen(true);
          }}
          onCheckInReservation={handleCheckInReservation}
        />
      )}

      {checkoutChalet && (
        <CheckoutModal
          chalet={checkoutChalet}
          rates={rates}
          businessDate={businessDate}
          onClose={() => setCheckoutChalet(null)}
          onConfirmCheckout={handleConfirmCheckout}
        />
      )}

      {isRatesModalOpen && (
        <RatesModal
          rates={rates}
          onClose={() => setIsRatesModalOpen(false)}
          onSave={handleSaveRates}
        />
      )}

      {isReportModalOpen && (
        <AccountReportModal
          records={checkoutRecords}
          businessDate={businessDate}
          onClose={() => setIsReportModalOpen(false)}
          onDeleteRecord={handleDeleteCheckoutRecord}
        />
      )}

      {isGuestsModalOpen && (
        <GuestsModal
          guests={guests}
          chalets={chalets}
          onClose={() => setIsGuestsModalOpen(false)}
          onSaveGuest={handleSaveGuest}
          onDeleteGuest={handleDeleteGuest}
        />
      )}

      {isReservationsModalOpen && (
        <ReservationsModal
          reservations={reservations}
          chalets={chalets}
          rates={rates}
          guests={guests}
          businessDate={businessDate}
          initialChaletId={reserveTargetChaletId}
          onClose={() => {
            setIsReservationsModalOpen(false);
            setReserveTargetChaletId(null);
          }}
          onSaveReservation={handleSaveReservation}
          onUpdateStatus={handleUpdateReservationStatus}
          onDeleteReservation={handleDeleteReservation}
          onCheckInReservation={handleCheckInReservation}
          onSaveGuest={handleSaveGuest}
        />
      )}

      {isCloseDayModalOpen && (
        <CloseDayModal
          businessDate={businessDate}
          chalets={chalets}
          rates={rates}
          reservations={reservations}
          checkoutRecords={checkoutRecords}
          dayClosings={dayClosings}
          onClose={() => setIsCloseDayModalOpen(false)}
          onConfirmCloseDay={handleConfirmCloseDay}
          onSyncToday={handleSyncToday}
          onDeleteDayClosing={handleDeleteDayClosing}
        />
      )}
    </div>
  );
}
