import { Bath, BedDouble, CheckCircle2, Home, Lock, LogIn, LogOut, User } from 'lucide-react';
import { calculateChaletTotals, formatCurrencyBRL } from '../data/initialChalets';
import { CategoryRates, Chalet, ChaletCategory, ChaletStatus, Reservation } from '../types/chalet';

interface ChaletCardProps {
  chalet: Chalet;
  rates: CategoryRates;
  businessDate?: string;
  nextReservation?: Reservation;
  upcomingCount?: number;
  onSelect: (chalet: Chalet) => void;
  onCheckout: (chalet: Chalet) => void;
  onRelease?: (chalet: Chalet) => void;
  onCheckInReservation?: (reservation: Reservation) => void;
}

function formatDayMonth(ymd: string): string {
  const parts = ymd.split('-');
  if (parts.length !== 3) return ymd;
  return `${parts[2]}/${parts[1]}`;
}

const STATUS_STYLES: Record<
  ChaletStatus,
  {
    container: string;
    numberText: string;
    categoryText: string;
    statusText: string;
    detailText: string;
    iconColor: string;
    divider: string;
    checkoutBtn: string;
  }
> = {
  [ChaletStatus.LIVRE]: {
    container:
      'bg-emerald-100/80 dark:bg-emerald-950/50 border-emerald-300 dark:border-emerald-800/80 hover:bg-emerald-100 dark:hover:bg-emerald-950/70 hover:border-emerald-400 dark:hover:border-emerald-700',
    numberText: 'text-emerald-950 dark:text-emerald-100',
    categoryText: 'text-emerald-800 dark:text-emerald-300',
    statusText: 'text-emerald-950 dark:text-emerald-100',
    detailText: 'text-emerald-800 dark:text-emerald-300',
    iconColor: 'text-emerald-800 dark:text-emerald-300',
    divider: 'border-emerald-200 dark:border-emerald-800',
    checkoutBtn: '',
  },
  [ChaletStatus.OCUPADO]: {
    container:
      'bg-rose-100/85 dark:bg-rose-950/50 border-rose-300 dark:border-rose-800/80 hover:border-rose-400 dark:hover:border-rose-700',
    numberText: 'text-rose-950 dark:text-rose-100',
    categoryText: 'text-rose-800 dark:text-rose-300',
    statusText: 'text-rose-950 dark:text-rose-100',
    detailText: 'text-rose-800 dark:text-rose-300',
    iconColor: 'text-rose-800 dark:text-rose-300',
    divider: 'border-rose-200/90 dark:border-rose-800/80',
    checkoutBtn:
      'bg-white/60 dark:bg-slate-900/70 hover:bg-white dark:hover:bg-slate-900 text-rose-950 dark:text-rose-100',
  },
  [ChaletStatus.BLOQUEADO]: {
    container:
      'bg-amber-100/85 dark:bg-amber-950/45 border-amber-300 dark:border-amber-800/80 hover:bg-amber-100 dark:hover:bg-amber-950/65 hover:border-amber-400 dark:hover:border-amber-700',
    numberText: 'text-amber-950 dark:text-amber-100',
    categoryText: 'text-amber-800 dark:text-amber-300',
    statusText: 'text-amber-950 dark:text-amber-100',
    detailText: 'text-amber-800 dark:text-amber-300',
    iconColor: 'text-amber-800 dark:text-amber-300',
    divider: 'border-amber-200 dark:border-amber-800',
    checkoutBtn: '',
  },
};

function getChaletIcon(chalet: Chalet) {
  if (chalet.status === ChaletStatus.BLOQUEADO) return Lock;
  if (chalet.category === ChaletCategory.CASA) return Home;
  if (chalet.category === ChaletCategory.HIDRO) return Bath;
  if (chalet.status === ChaletStatus.OCUPADO) return User;
  return BedDouble;
}

export function ChaletCard({
  chalet,
  rates,
  businessDate,
  nextReservation,
  upcomingCount = 0,
  onSelect,
  onCheckout,
  onRelease,
  onCheckInReservation,
}: ChaletCardProps) {
  const styles = STATUS_STYLES[chalet.status];
  const Icon = getChaletIcon(chalet);
  const totals = calculateChaletTotals(chalet, rates);
  const defaultRate = rates[chalet.category];
  const showEntry = Boolean(
    nextReservation && businessDate && nextReservation.checkIn === businessDate,
  );

  const secondaryLine =
    chalet.status === ChaletStatus.OCUPADO
      ? chalet.guestName
        ? chalet.guestName
        : 'Hóspede registrado'
      : chalet.status === ChaletStatus.BLOQUEADO
        ? chalet.blockReason || 'Indisponível'
        : `${formatCurrencyBRL(defaultRate)}/dia`;

  return (
    <div
      className={`group flex flex-col justify-between rounded-xl border min-h-[168px] overflow-hidden transition-colors duration-150 ${styles.container}`}
    >
      <button
        type="button"
        onClick={() => onSelect(chalet)}
        aria-label={`${chalet.label}, categoria ${chalet.category}, status ${chalet.status}${
          showEntry && nextReservation
            ? `, entrada prevista hoje para ${nextReservation.guestName}`
            : ''
        }`}
        className="flex-1 flex flex-col justify-between p-4 text-center w-full cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-900 dark:focus-visible:ring-slate-200"
      >
        <div className="flex items-baseline justify-between gap-2 w-full">
          <div className="inline-flex items-center gap-1.5 min-w-0">
            <span className={`font-mono text-lg font-bold tabular-nums tracking-tight ${styles.numberText}`}>
              {chalet.code}
            </span>
            {showEntry && nextReservation && (
              <span
                title={
                  upcomingCount > 1
                    ? `${upcomingCount} entradas previstas para hoje (${formatDayMonth(nextReservation.checkIn)})`
                    : `Entrada prevista para hoje (${formatDayMonth(nextReservation.checkIn)})`
                }
                className="inline-flex items-center gap-0.5 text-xs font-semibold tabular-nums text-sky-800 dark:text-sky-300"
              >
                <LogIn className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                {upcomingCount > 1 && <span>{upcomingCount}</span>}
              </span>
            )}
          </div>
          <span className={`text-xs font-medium truncate ${styles.categoryText}`}>
            {chalet.category === ChaletCategory.CASA ? 'Casa' : chalet.category}
          </span>
        </div>

        <div className="my-1.5 flex flex-col items-center justify-center">
          <Icon
            className={`h-6 w-6 transition-transform duration-150 group-hover:scale-105 ${styles.iconColor}`}
            strokeWidth={2}
            aria-hidden="true"
          />
        </div>

        <div className="w-full space-y-0.5">
          <p className={`text-sm font-semibold leading-tight ${styles.statusText}`}>
            {chalet.status}
          </p>
          <p className={`text-xs truncate ${styles.detailText}`} title={secondaryLine}>
            {secondaryLine}
          </p>
          {chalet.status === ChaletStatus.OCUPADO && (
            <p className={`font-mono text-xs font-semibold tabular-nums pt-0.5 ${styles.numberText}`}>
              {totals.balanceDue > 0
                ? `Saldo: ${formatCurrencyBRL(totals.balanceDue)}`
                : `Total: ${formatCurrencyBRL(totals.totalAmount)}`}
            </p>
          )}
          {showEntry && nextReservation && (
            <div
              className={`mt-1.5 pt-1.5 border-t ${styles.divider} flex items-center justify-center gap-1 text-[11px] font-semibold tabular-nums text-sky-900 dark:text-sky-200`}
              title={`Entrada hoje: ${formatDayMonth(nextReservation.checkIn)} a ${formatDayMonth(nextReservation.checkOut)} — ${nextReservation.guestName}`}
            >
              <LogIn className="h-3 w-3 shrink-0" aria-hidden="true" />
              <span className="truncate">
                Entrada hoje · {nextReservation.guestName}
              </span>
            </div>
          )}
        </div>
      </button>

      {chalet.status === ChaletStatus.OCUPADO && (
        <button
          type="button"
          onClick={() => onCheckout(chalet)}
          aria-label={`Fazer check-out do ${chalet.label}`}
          className={`flex items-center justify-center gap-1.5 w-full py-2 px-3 border-t ${styles.divider} ${styles.checkoutBtn} text-xs font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-900 dark:focus-visible:ring-slate-200`}
        >
          <LogOut className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>Check-out</span>
        </button>
      )}

      {chalet.status === ChaletStatus.BLOQUEADO && onRelease && (
        <button
          type="button"
          onClick={() => onRelease(chalet)}
          aria-label={`Liberar ${chalet.label}`}
          className={`flex items-center justify-center gap-1.5 w-full py-2 px-3 border-t ${styles.divider} bg-white/60 dark:bg-slate-900/70 hover:bg-white dark:hover:bg-slate-900 text-amber-950 dark:text-amber-100 text-xs font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-900 dark:focus-visible:ring-slate-200`}
        >
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>Liberar</span>
        </button>
      )}

      {chalet.status === ChaletStatus.LIVRE &&
        showEntry &&
        nextReservation &&
        onCheckInReservation && (
          <button
            type="button"
            onClick={() => onCheckInReservation(nextReservation)}
            aria-label={`Dar check-in de ${nextReservation.guestName} no ${chalet.label}`}
            className={`flex items-center justify-center gap-1.5 w-full py-2 px-3 border-t ${styles.divider} bg-white/75 dark:bg-slate-900/75 hover:bg-white dark:hover:bg-slate-900 text-emerald-950 dark:text-emerald-100 text-xs font-semibold transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-900 dark:focus-visible:ring-slate-200`}
          >
            <LogIn className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span>Check-in</span>
          </button>
        )}
    </div>
  );
}
