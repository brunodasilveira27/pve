import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  CalendarCheck,
  CalendarClock,
  CheckCircle2,
  Clock,
  LogIn,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
  XCircle,
} from 'lucide-react';
import {
  calculateNights,
  formatCurrencyBRL,
  parseDecimalInput,
} from '../data/initialChalets';
import {
  CategoryRates,
  Chalet,
  ChaletStatus,
  Guest,
  Reservation,
  ReservationStatus,
} from '../types/chalet';
import {
  addDaysYMD,
  datesOverlap,
  formatCpfOrDocument,
  formatPhoneBR,
  getLocalTodayYMD,
  validateCpfOrDocument,
  validateFullName,
  validateFutureReservationDates,
  validatePhoneBR,
} from '../utils/validation';
import { FieldFeedback, getFieldBorderClass } from './FieldFeedback';

interface ReservationsModalProps {
  reservations: Reservation[];
  chalets: Chalet[];
  rates: CategoryRates;
  guests: Guest[];
  businessDate?: string;
  initialChaletId?: number | null;
  onClose: () => void;
  onSaveReservation: (reservation: Reservation) => void;
  onUpdateStatus: (id: string, status: ReservationStatus) => void;
  onDeleteReservation: (id: string) => void;
  onCheckInReservation: (reservation: Reservation) => string | null;
  onSaveGuest: (guest: Guest) => void;
}

type ReservationFilterTab =
  | 'para_chegar'
  | 'ativas'
  | 'confirmadas'
  | 'pendentes'
  | 'historico'
  | 'todas';

type ReservationFieldKey = 'guestName' | 'guestDocument' | 'guestPhone' | 'dates';

function formatDateShortBR(ymd?: string): string {
  if (!ymd) return '—';
  const [year, month, day] = ymd.split('-');
  if (!year || !month || !day) return ymd;
  return `${day}/${month}/${year.slice(2)}`;
}

function getRelativeDayLabel(checkIn: string, todayYMD: string): string {
  const start = new Date(`${todayYMD}T12:00:00`);
  const target = new Date(`${checkIn}T12:00:00`);
  const diff = Math.round((target.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  if (diff < 0) return `há ${Math.abs(diff)} ${Math.abs(diff) === 1 ? 'dia' : 'dias'}`;
  if (diff === 0) return 'chegada hoje';
  if (diff === 1) return 'chegada amanhã';
  return `em ${diff} dias`;
}

function getChaletConflictForPeriod(
  chalet: Chalet,
  checkIn: string,
  checkOut: string,
  reservations: Reservation[],
  excludeReservationId?: string,
  referenceTodayYMD?: string,
): string | null {
  if (!checkIn || !checkOut || checkOut <= checkIn) return null;
  const todayYMD = referenceTodayYMD || getLocalTodayYMD();

  if (chalet.status === ChaletStatus.OCUPADO) {
    if (chalet.checkIn && chalet.checkOut) {
      if (datesOverlap(checkIn, checkOut, chalet.checkIn, chalet.checkOut)) {
        return `Ocupado por ${chalet.guestName ?? 'hóspede'} até ${formatDateShortBR(chalet.checkOut)}`;
      }
    } else if (checkIn <= todayYMD) {
      return `Ocupado no momento (${chalet.guestName ?? 'hóspede'})`;
    }
  }

  const conflictingRes = reservations.find(
    (res) =>
      res.id !== excludeReservationId &&
      res.chaletId === chalet.id &&
      (res.status === ReservationStatus.CONFIRMADA ||
        res.status === ReservationStatus.PENDENTE) &&
      datesOverlap(checkIn, checkOut, res.checkIn, res.checkOut),
  );

  if (conflictingRes) {
    return `Já reservado para ${conflictingRes.guestName} (${formatDateShortBR(conflictingRes.checkIn)} a ${formatDateShortBR(conflictingRes.checkOut)})`;
  }

  return null;
}

const STATUS_META: Record<
  ReservationStatus,
  {
    textClass: string;
    icon: typeof CheckCircle2;
  }
> = {
  [ReservationStatus.CONFIRMADA]: {
    textClass: 'text-emerald-700 dark:text-emerald-400',
    icon: CheckCircle2,
  },
  [ReservationStatus.PENDENTE]: {
    textClass: 'text-amber-700 dark:text-amber-400',
    icon: Clock,
  },
  [ReservationStatus.CHECKIN_REALIZADO]: {
    textClass: 'text-slate-600 dark:text-slate-300',
    icon: CalendarCheck,
  },
  [ReservationStatus.CANCELADA]: {
    textClass: 'text-rose-700 dark:text-rose-400',
    icon: XCircle,
  },
};

export function ReservationsModal({
  reservations,
  chalets,
  rates,
  guests,
  businessDate,
  initialChaletId = null,
  onClose,
  onSaveReservation,
  onUpdateStatus,
  onDeleteReservation,
  onCheckInReservation,
  onSaveGuest,
}: ReservationsModalProps) {
  const todayYMD = businessDate || getLocalTodayYMD();
  const initialTargetChalet =
    chalets.find((c) => c.id === initialChaletId) ?? chalets[0];

  const [filterTab, setFilterTab] = useState<ReservationFilterTab>(() => {
    const hasArriving = reservations.some(
      (r) =>
        (r.status === ReservationStatus.CONFIRMADA ||
          r.status === ReservationStatus.PENDENTE) &&
        r.checkIn <= todayYMD,
    );
    return hasArriving ? 'para_chegar' : 'ativas';
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [isFormOpen, setIsFormOpen] = useState<boolean>(Boolean(initialChaletId));
  const [editingReservation, setEditingReservation] = useState<Reservation | null>(null);
  const [confirmCancelId, setConfirmCancelId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{
    type: 'error' | 'success';
    message: string;
  } | null>(null);

  // Form states
  const [chaletId, setChaletId] = useState<number>(initialTargetChalet?.id ?? 1);
  const [selectedGuestId, setSelectedGuestId] = useState('');
  const [guestName, setGuestName] = useState('');
  const [guestDocument, setGuestDocument] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  const [saveToRegistry, setSaveToRegistry] = useState(true);
  const [guestCount, setGuestCount] = useState('2');
  const [checkIn, setCheckIn] = useState(() => addDaysYMD(todayYMD, 1));
  const [checkOut, setCheckOut] = useState(() => addDaysYMD(todayYMD, 3));
  const [dailyRate, setDailyRate] = useState(() =>
    String(initialTargetChalet ? rates[initialTargetChalet.category] : 350),
  );
  const [depositPaid, setDepositPaid] = useState('0');
  const [resStatus, setResStatus] = useState<
    ReservationStatus.CONFIRMADA | ReservationStatus.PENDENTE
  >(ReservationStatus.CONFIRMADA);
  const [notes, setNotes] = useState('');
  const [touched, setTouched] = useState<Partial<Record<ReservationFieldKey, boolean>>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (isFormOpen) {
          setIsFormOpen(false);
          setEditingReservation(null);
          setFormError('');
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, isFormOpen]);

  const sortedGuests = useMemo(
    () => [...guests].sort((a, b) => a.fullName.localeCompare(b.fullName, 'pt-BR')),
    [guests],
  );

  const tabCounts = useMemo(() => {
    const paraChegar = reservations.filter(
      (r) =>
        (r.status === ReservationStatus.CONFIRMADA ||
          r.status === ReservationStatus.PENDENTE) &&
        r.checkIn <= todayYMD,
    ).length;
    const confirmadas = reservations.filter(
      (r) => r.status === ReservationStatus.CONFIRMADA,
    ).length;
    const pendentes = reservations.filter(
      (r) => r.status === ReservationStatus.PENDENTE,
    ).length;
    const historico = reservations.filter(
      (r) =>
        r.status === ReservationStatus.CHECKIN_REALIZADO ||
        r.status === ReservationStatus.CANCELADA,
    ).length;

    return {
      para_chegar: paraChegar,
      ativas: confirmadas + pendentes,
      confirmadas,
      pendentes,
      historico,
      todas: reservations.length,
    };
  }, [reservations, todayYMD]);

  const filteredReservations = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return [...reservations]
      .filter((res) => {
        if (filterTab === 'para_chegar') {
          if (
            (res.status !== ReservationStatus.CONFIRMADA &&
              res.status !== ReservationStatus.PENDENTE) ||
            res.checkIn > todayYMD
          ) {
            return false;
          }
        } else if (filterTab === 'ativas') {
          if (
            res.status !== ReservationStatus.CONFIRMADA &&
            res.status !== ReservationStatus.PENDENTE
          ) {
            return false;
          }
        } else if (filterTab === 'confirmadas') {
          if (res.status !== ReservationStatus.CONFIRMADA) return false;
        } else if (filterTab === 'pendentes') {
          if (res.status !== ReservationStatus.PENDENTE) return false;
        } else if (filterTab === 'historico') {
          if (
            res.status !== ReservationStatus.CHECKIN_REALIZADO &&
            res.status !== ReservationStatus.CANCELADA
          ) {
            return false;
          }
        }

        if (!query) return true;
        const haystack = [
          res.chaletLabel,
          res.chaletCode,
          res.category,
          res.guestName,
          res.guestPhone ?? '',
          res.notes ?? '',
          res.status,
        ]
          .join(' ')
          .toLowerCase();
        return haystack.includes(query);
      })
      .sort((a, b) => {
        const aActive =
          a.status === ReservationStatus.CONFIRMADA ||
          a.status === ReservationStatus.PENDENTE;
        const bActive =
          b.status === ReservationStatus.CONFIRMADA ||
          b.status === ReservationStatus.PENDENTE;
        if (aActive && bActive) {
          return a.checkIn.localeCompare(b.checkIn);
        }
        return b.updatedAt.localeCompare(a.updatedAt);
      });
  }, [reservations, filterTab, searchQuery]);

  const activeSummary = useMemo(() => {
    const active = reservations.filter(
      (r) =>
        r.status === ReservationStatus.CONFIRMADA ||
        r.status === ReservationStatus.PENDENTE,
    );
    return active.reduce(
      (acc, res) => {
        const nights = calculateNights(res.checkIn, res.checkOut);
        acc.count += 1;
        acc.nights += nights;
        acc.totalValue += nights * res.dailyRate;
        acc.deposits += res.depositPaid;
        return acc;
      },
      { count: 0, nights: 0, totalValue: 0, deposits: 0 },
    );
  }, [reservations]);

  const validations = useMemo(
    () => ({
      guestName: validateFullName(guestName),
      guestDocument: validateCpfOrDocument(guestDocument, false),
      guestPhone: validatePhoneBR(guestPhone, false),
      dates: validateFutureReservationDates(checkIn, checkOut, todayYMD),
    }),
    [guestName, guestDocument, guestPhone, checkIn, checkOut, todayYMD],
  );

  const chaletAvailability = useMemo(() => {
    return chalets.map((chalet) => {
      const conflict = getChaletConflictForPeriod(
        chalet,
        checkIn,
        checkOut,
        reservations,
        editingReservation?.id,
        todayYMD,
      );
      return { chalet, conflict };
    });
  }, [chalets, checkIn, checkOut, reservations, editingReservation, todayYMD]);

  const selectedChaletInfo = chaletAvailability.find(
    (item) => item.chalet.id === chaletId,
  );
  const availableInPeriodCount = chaletAvailability.filter(
    (item) => !item.conflict,
  ).length;

  const openNewForm = (preferredChaletId?: number) => {
    const defaultStart = addDaysYMD(todayYMD, 1);
    const defaultEnd = addDaysYMD(todayYMD, 3);
    const target =
      (preferredChaletId
        ? chalets.find((c) => c.id === preferredChaletId)
        : undefined) ??
      chalets.find(
        (c) =>
          !getChaletConflictForPeriod(c, defaultStart, defaultEnd, reservations, undefined, todayYMD),
      ) ??
      chalets[0];

    setEditingReservation(null);
    setChaletId(target.id);
    setSelectedGuestId('');
    setGuestName('');
    setGuestDocument('');
    setGuestPhone('');
    setSaveToRegistry(true);
    setGuestCount('2');
    setCheckIn(defaultStart);
    setCheckOut(defaultEnd);
    setDailyRate(String(rates[target.category]));
    setDepositPaid('0');
    setResStatus(ReservationStatus.CONFIRMADA);
    setNotes('');
    setTouched({});
    setSubmitAttempted(false);
    setFormError('');
    setIsFormOpen(true);
  };

  const openEditForm = (res: Reservation) => {
    setEditingReservation(res);
    setChaletId(res.chaletId);
    setSelectedGuestId(res.guestId ?? '');
    setGuestName(res.guestName);
    setGuestDocument(res.guestDocument ?? '');
    setGuestPhone(res.guestPhone ?? '');
    setSaveToRegistry(false);
    setGuestCount(String(res.guestCount));
    setCheckIn(res.checkIn);
    setCheckOut(res.checkOut);
    setDailyRate(String(res.dailyRate));
    setDepositPaid(String(res.depositPaid));
    setResStatus(
      res.status === ReservationStatus.PENDENTE
        ? ReservationStatus.PENDENTE
        : ReservationStatus.CONFIRMADA,
    );
    setNotes(res.notes ?? '');
    setTouched({
      guestName: true,
      guestDocument: Boolean(res.guestDocument),
      guestPhone: Boolean(res.guestPhone),
      dates: true,
    });
    setSubmitAttempted(false);
    setFormError('');
    setIsFormOpen(true);
  };

  const handleSelectRegisteredGuest = (guestId: string) => {
    setSelectedGuestId(guestId);
    if (!guestId) return;
    const found = guests.find((g) => g.id === guestId);
    if (found) {
      setGuestName(found.fullName);
      setGuestDocument(found.document ?? '');
      setGuestPhone(found.phone ?? '');
      setTouched((prev) => ({
        ...prev,
        guestName: true,
        guestDocument: Boolean(found.document),
        guestPhone: Boolean(found.phone),
      }));
      if (formError) setFormError('');
    }
  };

  const handleChaletSelectChange = (newChaletId: number) => {
    setChaletId(newChaletId);
    const chosen = chalets.find((c) => c.id === newChaletId);
    if (chosen && !editingReservation) {
      setDailyRate(String(rates[chosen.category]));
    }
    if (formError) setFormError('');
  };

  const handleFormSubmit = (event: FormEvent) => {
    event.preventDefault();
    setSubmitAttempted(true);

    const fieldsValid =
      validations.guestName.valid &&
      validations.guestDocument.valid &&
      validations.guestPhone.valid &&
      validations.dates.valid;

    if (!fieldsValid) {
      setFormError('Corrija os campos destacados antes de salvar a reserva.');
      return;
    }

    if (selectedChaletInfo?.conflict) {
      setFormError(`Conflito de datas: ${selectedChaletInfo.conflict}.`);
      return;
    }

    const chosenChalet = chalets.find((c) => c.id === chaletId);
    if (!chosenChalet) {
      setFormError('Selecione uma acomodação válida.');
      return;
    }

    const cleanName = guestName.trim().replace(/\s+/g, ' ');
    let resolvedGuestId = selectedGuestId || undefined;

    if (resolvedGuestId) {
      const existingGuest = guests.find((g) => g.id === resolvedGuestId);
      if (
        existingGuest &&
        (guestDocument.trim() !== (existingGuest.document ?? '') ||
          guestPhone.trim() !== (existingGuest.phone ?? ''))
      ) {
        onSaveGuest({
          ...existingGuest,
          document: guestDocument.trim() || undefined,
          phone: guestPhone.trim() || undefined,
          updatedAt: new Date().toISOString(),
        });
      }
    } else {
      const existingByName = guests.find(
        (g) => g.fullName.trim().toLowerCase() === cleanName.toLowerCase(),
      );
      if (existingByName) {
        resolvedGuestId = existingByName.id;
      } else if (saveToRegistry) {
        const now = new Date().toISOString();
        const newGuest: Guest = {
          id: `guest-${Date.now()}`,
          fullName: cleanName,
          document: guestDocument.trim() || undefined,
          phone: guestPhone.trim() || undefined,
          createdAt: now,
          updatedAt: now,
        };
        onSaveGuest(newGuest);
        resolvedGuestId = newGuest.id;
      }
    }

    const now = new Date().toISOString();
    const reservation: Reservation = {
      id: editingReservation?.id ?? `res-${Date.now()}`,
      chaletId: chosenChalet.id,
      chaletCode: chosenChalet.code,
      chaletLabel: chosenChalet.label,
      category: chosenChalet.category,
      guestId: resolvedGuestId,
      guestName: cleanName,
      guestDocument: guestDocument.trim() || undefined,
      guestPhone: guestPhone.trim() || undefined,
      guestCount: Math.max(1, Number(guestCount) || 1),
      checkIn,
      checkOut,
      dailyRate: parseDecimalInput(dailyRate),
      depositPaid: parseDecimalInput(depositPaid),
      notes: notes.trim() || undefined,
      status: resStatus,
      createdAt: editingReservation?.createdAt ?? now,
      updatedAt: now,
    };

    onSaveReservation(reservation);
    setActionFeedback({
      type: 'success',
      message: editingReservation
        ? `Reserva de ${cleanName} no ${chosenChalet.label} atualizada.`
        : `Reserva futura criada para ${cleanName} no ${chosenChalet.label} (${formatDateShortBR(checkIn)} a ${formatDateShortBR(checkOut)}).`,
    });
    setIsFormOpen(false);
    setEditingReservation(null);
    setFilterTab('ativas');
  };

  const handleTriggerCheckIn = (res: Reservation) => {
    const errorMsg = onCheckInReservation(res);
    if (errorMsg) {
      setActionFeedback({ type: 'error', message: errorMsg });
    } else {
      setActionFeedback({
        type: 'success',
        message: `Check-in de ${res.guestName} realizado no ${res.chaletLabel}.`,
      });
    }
  };

  const formNights =
    checkIn && checkOut && checkOut > checkIn
      ? calculateNights(checkIn, checkOut)
      : 0;
  const parsedFormRate = parseDecimalInput(dailyRate);
  const parsedFormDeposit = parseDecimalInput(depositPaid);
  const formTotal = formNights * parsedFormRate;
  const formRemaining = Math.max(0, formTotal - parsedFormDeposit);

  const baseInputClass =
    'w-full h-10 rounded-lg border bg-white dark:bg-slate-950 px-3 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none transition-colors';
  const defaultInputClass = `${baseInputClass} border-slate-200 dark:border-slate-700 focus:border-slate-900 dark:focus:border-slate-300`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 dark:bg-slate-950/75 p-2 sm:p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="reservations-modal-title"
    >
      <div className="flex flex-col w-full max-w-5xl max-h-[92vh] rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 px-6 py-4">
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Pousada Vale do Ermitão · Agenda de reservas futuras
            </p>
            <h2
              id="reservations-modal-title"
              className="font-display text-xl font-bold text-slate-900 dark:text-slate-100 mt-0.5"
            >
              {isFormOpen
                ? editingReservation
                  ? 'Editar Reserva'
                  : 'Nova Reserva Futura'
                : 'Reservas Futuras'}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isFormOpen ? (
              <button
                type="button"
                onClick={() => {
                  setIsFormOpen(false);
                  setEditingReservation(null);
                  setFormError('');
                }}
                className="inline-flex items-center gap-1.5 h-9 px-3 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap"
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Voltar à agenda</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => openNewForm()}
                className="inline-flex items-center gap-1.5 h-9 px-3.5 text-xs font-medium text-white dark:text-slate-950 bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white rounded-lg transition-colors whitespace-nowrap"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Nova reserva</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar janela de reservas"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {actionFeedback && !isFormOpen && (
            <div
              role={actionFeedback.type === 'error' ? 'alert' : 'status'}
              className={`mb-4 flex items-center justify-between gap-3 rounded-lg border px-4 py-2.5 text-xs font-medium ${
                actionFeedback.type === 'error'
                  ? 'border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-200'
                  : 'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200'
              }`}
            >
              <span>{actionFeedback.message}</span>
              <button
                type="button"
                onClick={() => setActionFeedback(null)}
                aria-label="Dispensar aviso"
                className="p-1 rounded hover:bg-black/5 dark:hover:bg-white/10"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {isFormOpen ? (
            <form onSubmit={handleFormSubmit} noValidate className="max-w-2xl mx-auto space-y-4">
              <div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="res-checkin"
                      className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                    >
                      Check-in previsto *
                    </label>
                    <input
                      id="res-checkin"
                      type="date"
                      min={todayYMD}
                      value={checkIn}
                      onChange={(e) => {
                        const nextCheckIn = e.target.value;
                        setCheckIn(nextCheckIn);
                        if (nextCheckIn && (!checkOut || checkOut <= nextCheckIn)) {
                          setCheckOut(addDaysYMD(nextCheckIn, 1));
                        }
                        setTouched((prev) => ({ ...prev, dates: true }));
                        if (formError) setFormError('');
                      }}
                      className={`${baseInputClass} tabular-nums ${getFieldBorderClass(
                        validations.dates,
                        Boolean(touched.dates || submitAttempted),
                        Boolean(checkIn),
                      )}`}
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="res-checkout"
                      className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                    >
                      Check-out previsto *
                    </label>
                    <input
                      id="res-checkout"
                      type="date"
                      min={checkIn ? addDaysYMD(checkIn, 1) : addDaysYMD(todayYMD, 1)}
                      value={checkOut}
                      onChange={(e) => {
                        setCheckOut(e.target.value);
                        setTouched((prev) => ({ ...prev, dates: true }));
                        if (formError) setFormError('');
                      }}
                      className={`${baseInputClass} tabular-nums ${getFieldBorderClass(
                        validations.dates,
                        Boolean(touched.dates || submitAttempted),
                        Boolean(checkOut),
                      )}`}
                    />
                  </div>
                </div>
                <FieldFeedback
                  result={validations.dates}
                  showFeedback={Boolean(touched.dates || submitAttempted || (checkIn && checkOut))}
                  hasValue={Boolean(checkIn && checkOut)}
                />
              </div>

              <div>
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <label
                    htmlFor="res-chalet"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300"
                  >
                    Acomodação *
                  </label>
                  <span className="text-xs text-slate-500 dark:text-slate-400 tabular-nums">
                    Disponíveis no período: {availableInPeriodCount} de {chalets.length}
                  </span>
                </div>
                <select
                  id="res-chalet"
                  value={chaletId}
                  onChange={(e) => handleChaletSelectChange(Number(e.target.value))}
                  className={`${baseInputClass} ${
                    selectedChaletInfo?.conflict
                      ? 'border-rose-500 dark:border-rose-400 focus:border-rose-600'
                      : 'border-slate-200 dark:border-slate-700 focus:border-slate-900 dark:focus:border-slate-300'
                  }`}
                >
                  {chaletAvailability.map(({ chalet, conflict }) => (
                    <option key={chalet.id} value={chalet.id}>
                      {chalet.label} — {chalet.category} ({formatCurrencyBRL(rates[chalet.category])}/dia)
                      {conflict ? ' [Indisponível nessas datas]' : ''}
                    </option>
                  ))}
                </select>
                {selectedChaletInfo?.conflict && (
                  <p className="mt-1 text-xs font-medium text-rose-700 dark:text-rose-400">
                    Conflito neste período: {selectedChaletInfo.conflict}. Escolha outra data ou acomodação.
                  </p>
                )}
              </div>

              {sortedGuests.length > 0 && (
                <div>
                  <label
                    htmlFor="res-registered-guest"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                  >
                    Hóspede cadastrado
                  </label>
                  <select
                    id="res-registered-guest"
                    value={selectedGuestId}
                    onChange={(e) => handleSelectRegisteredGuest(e.target.value)}
                    className={defaultInputClass}
                  >
                    <option value="">— Digitar ou cadastrar novo hóspede —</option>
                    {sortedGuests.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.fullName}
                        {g.phone ? ` · ${g.phone}` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <label
                    htmlFor="res-guest-name"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                  >
                    Nome completo do hóspede *
                  </label>
                  <input
                    id="res-guest-name"
                    type="text"
                    value={guestName}
                    onChange={(e) => {
                      setGuestName(e.target.value);
                      if (selectedGuestId) setSelectedGuestId('');
                      if (formError) setFormError('');
                    }}
                    onBlur={() => {
                      setGuestName((prev) => prev.trim().replace(/\s+/g, ' '));
                      setTouched((prev) => ({ ...prev, guestName: true }));
                    }}
                    placeholder="Ex.: Mariana Souza"
                    className={`${baseInputClass} ${getFieldBorderClass(
                      validations.guestName,
                      Boolean(touched.guestName || submitAttempted),
                      guestName.trim().length > 0,
                    )}`}
                  />
                  <FieldFeedback
                    result={validations.guestName}
                    showFeedback={Boolean(touched.guestName || submitAttempted)}
                    hasValue={guestName.trim().length > 0}
                  />
                </div>

                <div>
                  <label
                    htmlFor="res-guest-count"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                  >
                    Hóspedes
                  </label>
                  <input
                    id="res-guest-count"
                    type="number"
                    min={1}
                    max={12}
                    value={guestCount}
                    onChange={(e) => setGuestCount(e.target.value)}
                    className={`${defaultInputClass} tabular-nums`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label
                    htmlFor="res-guest-doc"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                  >
                    CPF / Documento (opcional)
                  </label>
                  <input
                    id="res-guest-doc"
                    type="text"
                    value={guestDocument}
                    onChange={(e) => {
                      setGuestDocument(formatCpfOrDocument(e.target.value));
                      if (formError) setFormError('');
                    }}
                    onBlur={() => setTouched((prev) => ({ ...prev, guestDocument: true }))}
                    placeholder="000.000.000-00"
                    className={`${baseInputClass} font-mono tabular-nums ${getFieldBorderClass(
                      validations.guestDocument,
                      Boolean(
                        touched.guestDocument ||
                          submitAttempted ||
                          guestDocument.trim().length > 0,
                      ),
                      guestDocument.trim().length > 0,
                    )}`}
                  />
                  <FieldFeedback
                    result={validations.guestDocument}
                    showFeedback={Boolean(
                      touched.guestDocument ||
                        submitAttempted ||
                        guestDocument.trim().length > 0,
                    )}
                    hasValue={guestDocument.trim().length > 0}
                  />
                </div>

                <div>
                  <label
                    htmlFor="res-guest-phone"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                  >
                    Telefone / WhatsApp (opcional)
                  </label>
                  <input
                    id="res-guest-phone"
                    type="tel"
                    value={guestPhone}
                    onChange={(e) => {
                      setGuestPhone(formatPhoneBR(e.target.value));
                      if (formError) setFormError('');
                    }}
                    onBlur={() => setTouched((prev) => ({ ...prev, guestPhone: true }))}
                    placeholder="(24) 99999-9999"
                    className={`${baseInputClass} font-mono tabular-nums ${getFieldBorderClass(
                      validations.guestPhone,
                      Boolean(
                        touched.guestPhone ||
                          submitAttempted ||
                          guestPhone.trim().length > 0,
                      ),
                      guestPhone.trim().length > 0,
                    )}`}
                  />
                  <FieldFeedback
                    result={validations.guestPhone}
                    showFeedback={Boolean(
                      touched.guestPhone ||
                        submitAttempted ||
                        guestPhone.trim().length > 0,
                    )}
                    hasValue={guestPhone.trim().length > 0}
                  />
                </div>
              </div>

              {!selectedGuestId &&
                guestName.trim() !== '' &&
                !guests.some(
                  (g) =>
                    g.fullName.trim().toLowerCase() === guestName.trim().toLowerCase(),
                ) && (
                  <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={saveToRegistry}
                      onChange={(e) => setSaveToRegistry(e.target.checked)}
                      className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 accent-slate-900 dark:accent-slate-100"
                    />
                    <span>Salvar este hóspede no cadastro geral</span>
                  </label>
                )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label
                    htmlFor="res-daily-rate"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                  >
                    Diária combinada (R$)
                  </label>
                  <input
                    id="res-daily-rate"
                    type="text"
                    inputMode="decimal"
                    value={dailyRate}
                    onChange={(e) => setDailyRate(e.target.value)}
                    placeholder="0,00"
                    className={`${defaultInputClass} font-mono tabular-nums`}
                  />
                </div>

                <div>
                  <label
                    htmlFor="res-deposit"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                  >
                    Sinal / Reserva paga (R$)
                  </label>
                  <input
                    id="res-deposit"
                    type="text"
                    inputMode="decimal"
                    value={depositPaid}
                    onChange={(e) => setDepositPaid(e.target.value)}
                    placeholder="0,00"
                    className={`${defaultInputClass} font-mono tabular-nums`}
                  />
                </div>

                <div>
                  <label
                    htmlFor="res-status"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                  >
                    Situação da reserva
                  </label>
                  <select
                    id="res-status"
                    value={resStatus}
                    onChange={(e) =>
                      setResStatus(
                        e.target.value as
                          | ReservationStatus.CONFIRMADA
                          | ReservationStatus.PENDENTE,
                      )
                    }
                    className={defaultInputClass}
                  >
                    <option value={ReservationStatus.CONFIRMADA}>Confirmada</option>
                    <option value={ReservationStatus.PENDENTE}>Pendente</option>
                  </select>
                </div>
              </div>

              <div>
                <label
                  htmlFor="res-notes"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Observações da reserva (opcional)
                </label>
                <input
                  id="res-notes"
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex.: Chegada após 18h, berço extra, decoração especial..."
                  className={defaultInputClass}
                />
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 px-4 py-2.5 text-xs">
                <span className="text-slate-600 dark:text-slate-300 tabular-nums">
                  {formNights} {formNights === 1 ? 'diária' : 'diárias'} · Total previsto{' '}
                  <strong className="font-mono text-slate-900 dark:text-slate-100">
                    {formatCurrencyBRL(formTotal)}
                  </strong>
                </span>
                <span className="text-slate-600 dark:text-slate-300 tabular-nums">
                  Saldo no check-in:{' '}
                  <strong className="font-mono text-slate-900 dark:text-slate-100">
                    {formatCurrencyBRL(formRemaining)}
                  </strong>
                </span>
              </div>

              {formError && (
                <p role="alert" className="text-xs font-medium text-rose-700 dark:text-rose-400">
                  {formError}
                </p>
              )}

              <div className="flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setIsFormOpen(false);
                    setEditingReservation(null);
                    setFormError('');
                  }}
                  className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white dark:text-slate-950 bg-slate-900 dark:bg-slate-100 rounded-lg hover:bg-slate-800 dark:hover:bg-white transition-colors"
                >
                  {editingReservation ? 'Salvar alterações' : 'Confirmar reserva'}
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 px-4 py-3">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Reservas Ativas
                  </p>
                  <p className="font-display text-xl font-bold text-slate-900 dark:text-slate-100 tabular-nums mt-0.5">
                    {activeSummary.count}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 px-4 py-3">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Diárias Reservadas
                  </p>
                  <p className="font-display text-xl font-bold text-slate-900 dark:text-slate-100 tabular-nums mt-0.5">
                    {activeSummary.nights}
                  </p>
                </div>
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 px-4 py-3">
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Previsto / Sinais
                  </p>
                  <p className="font-mono text-lg font-bold text-slate-900 dark:text-slate-100 tabular-nums mt-0.5">
                    {formatCurrencyBRL(activeSummary.totalValue)}{' '}
                    <span className="text-xs font-normal text-slate-500 dark:text-slate-400">
                      ({formatCurrencyBRL(activeSummary.deposits)} sinal)
                    </span>
                  </p>
                </div>
              </div>

              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
                <div
                  className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg overflow-x-auto max-w-full"
                  role="group"
                  aria-label="Filtrar reservas"
                >
                  {(
                    [
                      {
                        key: 'para_chegar',
                        label: 'Para chegar',
                        count: tabCounts.para_chegar,
                      },
                      { key: 'ativas', label: 'Ativas', count: tabCounts.ativas },
                      {
                        key: 'confirmadas',
                        label: 'Confirmadas',
                        count: tabCounts.confirmadas,
                      },
                      {
                        key: 'pendentes',
                        label: 'Pendentes',
                        count: tabCounts.pendentes,
                      },
                      {
                        key: 'historico',
                        label: 'Histórico',
                        count: tabCounts.historico,
                      },
                      { key: 'todas', label: 'Todas', count: tabCounts.todas },
                    ] as const
                  ).map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setFilterTab(tab.key)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 tabular-nums ${
                        filterTab === tab.key
                          ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 shadow-sm'
                          : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {tab.label} ({tab.count})
                    </button>
                  ))}
                </div>

                <div className="relative w-full md:w-64">
                  <Search
                    className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 dark:text-slate-500"
                    aria-hidden="true"
                  />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Buscar hóspede ou chalé..."
                    aria-label="Buscar reserva por hóspede ou chalé"
                    className="w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 pl-8 pr-3 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-slate-900 dark:focus:border-slate-300 focus:outline-none"
                  />
                </div>
              </div>

              {filteredReservations.length > 0 ? (
                <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300">
                        <th className="py-2.5 px-3 font-semibold whitespace-nowrap">
                          Período
                        </th>
                        <th className="py-2.5 px-3 font-semibold whitespace-nowrap">
                          Acomodação
                        </th>
                        <th className="py-2.5 px-3 font-semibold whitespace-nowrap">
                          Hóspede
                        </th>
                        <th className="py-2.5 px-3 font-semibold text-right whitespace-nowrap">
                          Valores
                        </th>
                        <th className="py-2.5 px-3 font-semibold whitespace-nowrap">
                          Status
                        </th>
                        <th className="py-2.5 px-3 font-semibold text-right whitespace-nowrap">
                          Ações
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {filteredReservations.map((res) => {
                        const nights = calculateNights(res.checkIn, res.checkOut);
                        const total = nights * res.dailyRate;
                        const remaining = Math.max(0, total - res.depositPaid);
                        const isActive =
                          res.status === ReservationStatus.CONFIRMADA ||
                          res.status === ReservationStatus.PENDENTE;
                        const meta = STATUS_META[res.status];
                        const StatusIcon = meta.icon;

                        return (
                          <tr
                            key={res.id}
                            className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                          >
                            <td className="py-3 px-3 align-top whitespace-nowrap">
                              <div className="font-mono font-medium text-slate-900 dark:text-slate-100 tabular-nums">
                                {formatDateShortBR(res.checkIn)} → {formatDateShortBR(res.checkOut)}
                              </div>
                              <div className="text-slate-500 dark:text-slate-400 tabular-nums">
                                {nights} {nights === 1 ? 'diária' : 'diárias'}
                                {isActive ? ` · ${getRelativeDayLabel(res.checkIn, todayYMD)}` : ''}
                              </div>
                            </td>

                            <td className="py-3 px-3 align-top whitespace-nowrap">
                              <div className="font-semibold text-slate-900 dark:text-slate-100">
                                {res.chaletLabel}
                              </div>
                              <div className="text-slate-500 dark:text-slate-400">
                                {res.category}
                                {isActive && (() => {
                                  const target = chalets.find((c) => c.id === res.chaletId);
                                  if (!target) return null;
                                  if (target.status === ChaletStatus.LIVRE) {
                                    return (
                                      <span className="ml-1 text-emerald-700 dark:text-emerald-400">
                                        · Livre
                                      </span>
                                    );
                                  }
                                  if (target.status === ChaletStatus.BLOQUEADO) {
                                    return (
                                      <span className="ml-1 text-amber-700 dark:text-amber-400">
                                        · {target.blockReason || 'Bloqueado'}
                                      </span>
                                    );
                                  }
                                  return (
                                    <span className="ml-1 text-rose-700 dark:text-rose-400">
                                      · Ocupado
                                    </span>
                                  );
                                })()}
                              </div>
                            </td>

                            <td className="py-3 px-3 align-top">
                              <div className="font-medium text-slate-900 dark:text-slate-100">
                                {res.guestName}
                                <span className="text-slate-500 dark:text-slate-400 font-normal">
                                  {' '}· {res.guestCount} hósp.
                                </span>
                              </div>
                              {res.guestPhone && (
                                <div className="font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                                  {res.guestPhone}
                                </div>
                              )}
                              {res.notes && (
                                <div className="text-slate-500 dark:text-slate-400 mt-0.5">
                                  Obs.: {res.notes}
                                </div>
                              )}
                            </td>

                            <td className="py-3 px-3 text-right align-top whitespace-nowrap">
                              <div className="font-mono font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                                {formatCurrencyBRL(total)}
                              </div>
                              <div className="font-mono text-slate-500 dark:text-slate-400 tabular-nums">
                                Sinal: {formatCurrencyBRL(res.depositPaid)} · Rest.:{' '}
                                {formatCurrencyBRL(remaining)}
                              </div>
                            </td>

                            <td className="py-3 px-3 align-top whitespace-nowrap">
                              <span
                                className={`inline-flex items-center gap-1 font-medium ${meta.textClass}`}
                              >
                                <StatusIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                                <span>{res.status}</span>
                              </span>
                            </td>

                            <td className="py-3 px-3 text-right align-top whitespace-nowrap">
                              <div className="inline-flex items-center justify-end gap-1">
                                {isActive ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => handleTriggerCheckIn(res)}
                                      title="Dar check-in nesta reserva agora"
                                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-emerald-800 dark:text-emerald-200 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/70 rounded transition-colors"
                                    >
                                      <LogIn className="h-3.5 w-3.5" aria-hidden="true" />
                                      <span>Dar check-in</span>
                                    </button>

                                    {res.status === ReservationStatus.PENDENTE && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          onUpdateStatus(res.id, ReservationStatus.CONFIRMADA)
                                        }
                                        title="Confirmar reserva"
                                        className="px-2 py-1 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                                      >
                                        Confirmar
                                      </button>
                                    )}

                                    <button
                                      type="button"
                                      onClick={() => openEditForm(res)}
                                      title="Editar reserva"
                                      aria-label={`Editar reserva de ${res.guestName}`}
                                      className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </button>

                                    {confirmCancelId === res.id ? (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          onUpdateStatus(res.id, ReservationStatus.CANCELADA);
                                          setConfirmCancelId(null);
                                        }}
                                        className="px-2 py-1 text-rose-700 dark:text-rose-200 bg-rose-50 dark:bg-rose-950 hover:bg-rose-100 dark:hover:bg-rose-900 font-medium rounded transition-colors"
                                      >
                                        Confirmar
                                      </button>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => setConfirmCancelId(res.id)}
                                        title="Cancelar reserva"
                                        aria-label={`Cancelar reserva de ${res.guestName}`}
                                        className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-rose-700 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded transition-colors"
                                      >
                                        <XCircle className="h-3.5 w-3.5" />
                                      </button>
                                    )}
                                  </>
                                ) : confirmDeleteId === res.id ? (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      onDeleteReservation(res.id);
                                      setConfirmDeleteId(null);
                                    }}
                                    className="px-2 py-1 text-rose-700 dark:text-rose-200 bg-rose-50 dark:bg-rose-950 hover:bg-rose-100 dark:hover:bg-rose-900 font-medium rounded transition-colors"
                                  >
                                    Confirmar
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => setConfirmDeleteId(res.id)}
                                    title="Excluir do histórico"
                                    aria-label={`Excluir reserva de ${res.guestName}`}
                                    className="p-1.5 text-slate-400 dark:text-slate-500 hover:text-rose-700 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded transition-colors"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 py-12 px-6 text-center">
                  <CalendarClock
                    className="mx-auto h-7 w-7 text-slate-400 dark:text-slate-500 mb-2"
                    aria-hidden="true"
                  />
                  <p className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
                    Nenhuma reserva encontrada
                  </p>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                    {reservations.length === 0
                      ? 'Cadastre a primeira reserva futura clicando no botão acima.'
                      : 'Nenhuma reserva corresponde ao filtro ou busca selecionados.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => openNewForm()}
                    className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white dark:text-slate-950 bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white rounded-lg transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Fazer reserva futura</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
