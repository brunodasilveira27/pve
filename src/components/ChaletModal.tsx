import { FormEvent, useEffect, useMemo, useState } from 'react';
import { CalendarClock, CheckCircle2, Lock, LogIn, LogOut, Users, X } from 'lucide-react';
import { calculateNights, formatCurrencyBRL, parseDecimalInput } from '../data/initialChalets';
import {
  CategoryRates,
  Chalet,
  ChaletCategory,
  ChaletStatus,
  Guest,
  Reservation,
} from '../types/chalet';
import {
  formatCpfOrDocument,
  formatPhoneBR,
  getLocalTodayYMD,
  validateCpfOrDocument,
  validateFullName,
  validatePhoneBR,
  validateStayDates,
} from '../utils/validation';
import { FieldFeedback, getFieldBorderClass } from './FieldFeedback';

interface ChaletModalProps {
  chalet: Chalet | null;
  rates: CategoryRates;
  guests: Guest[];
  businessDate?: string;
  upcomingReservations?: Reservation[];
  availableChalets?: Chalet[];
  isQuickCheckIn?: boolean;
  onClose: () => void;
  onSave: (updated: Chalet) => void;
  onSaveGuest?: (guest: Guest) => void;
  onOpenCheckout?: (chalet: Chalet) => void;
  onOpenReserve?: (chalet: Chalet) => void;
  onCheckInReservation?: (reservation: Reservation) => string | null;
}

const BLOCK_REASONS = ['Em limpeza', 'Manutenção', 'Reservado', 'Uso interno'];

function formatShortDate(ymd: string): string {
  const parts = ymd.split('-');
  if (parts.length !== 3) return ymd;
  return `${parts[2]}/${parts[1]}/${parts[0].slice(2)}`;
}

export function ChaletModal({
  chalet,
  rates,
  guests,
  businessDate,
  upcomingReservations = [],
  availableChalets = [],
  isQuickCheckIn = false,
  onClose,
  onSave,
  onSaveGuest,
  onOpenCheckout,
  onOpenReserve,
  onCheckInReservation,
}: ChaletModalProps) {
  const [selectedId, setSelectedId] = useState<number>(
    chalet?.id ?? availableChalets[0]?.id ?? 1,
  );
  const activeChalet =
    chalet ?? availableChalets.find((item) => item.id === selectedId) ?? null;

  const matchedInitialGuest = activeChalet
    ? guests.find(
        (g) =>
          g.id === activeChalet.guestId ||
          (activeChalet.guestName &&
            g.fullName.trim().toLowerCase() === activeChalet.guestName.trim().toLowerCase()),
      )
    : undefined;

  const [status, setStatus] = useState<ChaletStatus>(
    isQuickCheckIn ? ChaletStatus.OCUPADO : (activeChalet?.status ?? ChaletStatus.LIVRE),
  );
  const [selectedGuestId, setSelectedGuestId] = useState<string>(
    matchedInitialGuest?.id ?? '',
  );
  const [guestName, setGuestName] = useState(activeChalet?.guestName ?? '');
  const [guestDocument, setGuestDocument] = useState(matchedInitialGuest?.document ?? '');
  const [guestPhone, setGuestPhone] = useState(matchedInitialGuest?.phone ?? '');
  const [saveToRegistry, setSaveToRegistry] = useState(true);

  const [guestCount, setGuestCount] = useState(String(activeChalet?.guestCount ?? 2));
  const [checkIn, setCheckIn] = useState(
    activeChalet?.checkIn ?? businessDate ?? getLocalTodayYMD(),
  );
  const [checkOut, setCheckOut] = useState(activeChalet?.checkOut ?? '');
  const [dailyRate, setDailyRate] = useState(
    String(
      activeChalet
        ? (activeChalet.dailyRate ?? rates[activeChalet.category])
        : rates[availableChalets[0]?.category ?? ChaletCategory.STAND],
    ),
  );
  const [extrasAmount, setExtrasAmount] = useState(String(activeChalet?.extrasAmount ?? 0));
  const [extrasNote, setExtrasNote] = useState(activeChalet?.extrasNote ?? '');
  const [paidAmount, setPaidAmount] = useState(String(activeChalet?.paidAmount ?? 0));
  const [blockReason, setBlockReason] = useState(activeChalet?.blockReason ?? 'Manutenção');
  const [notes, setNotes] = useState(activeChalet?.notes ?? '');
  const [touched, setTouched] = useState<{
    guestName?: boolean;
    guestDocument?: boolean;
    guestPhone?: boolean;
    dates?: boolean;
  }>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const validations = useMemo(
    () => ({
      guestName: validateFullName(guestName),
      guestDocument: validateCpfOrDocument(guestDocument, false),
      guestPhone: validatePhoneBR(guestPhone, false),
      dates: validateStayDates(checkIn, checkOut),
    }),
    [guestName, guestDocument, guestPhone, checkIn, checkOut],
  );

  if (!activeChalet) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 dark:bg-slate-950/75 p-4"
        role="dialog"
        aria-modal="true"
        aria-label="Sem acomodações livres"
      >
        <div className="w-full max-w-md rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-slate-900 dark:text-slate-100">
              Novo Check-in
            </h2>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
            Todas as 19 acomodações estão ocupadas ou bloqueadas no momento. Selecione um chalé no painel para liberar ou fazer check-out.
          </p>
          <div className="mt-6 flex justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-white dark:text-slate-950 bg-slate-900 dark:bg-slate-100 rounded-lg hover:bg-slate-800 dark:hover:bg-white"
            >
              Entendi
            </button>
          </div>
        </div>
      </div>
    );
  }

  const nights = calculateNights(checkIn, checkOut);
  const parsedRate = parseDecimalInput(dailyRate);
  const parsedExtras = parseDecimalInput(extrasAmount);
  const parsedPaid = parseDecimalInput(paidAmount);
  const totalAmount = nights * parsedRate + parsedExtras;
  const balanceDue = Math.max(0, totalAmount - parsedPaid);

  const selectedGuestObj = guests.find((g) => g.id === selectedGuestId);

  const handleSelectRegisteredGuest = (guestId: string) => {
    setSelectedGuestId(guestId);
    if (!guestId) {
      return;
    }
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
      if (error) setError('');
    }
  };

  const handleQuickChaletChange = (newId: number) => {
    setSelectedId(newId);
    const chosen = availableChalets.find((item) => item.id === newId);
    if (chosen) {
      setDailyRate(String(rates[chosen.category]));
    }
  };

  const ensureGuestSavedIfRequested = (): string | undefined => {
    if (status !== ChaletStatus.OCUPADO || !guestName.trim()) return undefined;
    if (selectedGuestId && selectedGuestObj) {
      if (
        onSaveGuest &&
        (guestDocument.trim() !== (selectedGuestObj.document ?? '') ||
          guestPhone.trim() !== (selectedGuestObj.phone ?? ''))
      ) {
        onSaveGuest({
          ...selectedGuestObj,
          document: guestDocument.trim() || undefined,
          phone: guestPhone.trim() || undefined,
          updatedAt: new Date().toISOString(),
        });
      }
      return selectedGuestObj.id;
    }

    const existingByName = guests.find(
      (g) => g.fullName.trim().toLowerCase() === guestName.trim().toLowerCase(),
    );
    if (existingByName) {
      return existingByName.id;
    }

    if (saveToRegistry && onSaveGuest) {
      const now = new Date().toISOString();
      const newGuest: Guest = {
        id: `guest-${Date.now()}`,
        fullName: guestName.trim().replace(/\s+/g, ' '),
        document: guestDocument.trim() || undefined,
        phone: guestPhone.trim() || undefined,
        createdAt: now,
        updatedAt: now,
      };
      onSaveGuest(newGuest);
      return newGuest.id;
    }

    return undefined;
  };

  const buildUpdatedChalet = (resolvedGuestId?: string): Chalet => ({
    ...activeChalet,
    status,
    guestId: status === ChaletStatus.OCUPADO ? resolvedGuestId : undefined,
    guestName: status === ChaletStatus.OCUPADO ? guestName.trim().replace(/\s+/g, ' ') : undefined,
    guestCount:
      status === ChaletStatus.OCUPADO ? Math.max(1, Number(guestCount) || 1) : undefined,
    checkIn: status === ChaletStatus.OCUPADO && checkIn ? checkIn : undefined,
    checkOut: status === ChaletStatus.OCUPADO && checkOut ? checkOut : undefined,
    dailyRate: status === ChaletStatus.OCUPADO ? parsedRate : rates[activeChalet.category],
    extrasAmount: status === ChaletStatus.OCUPADO ? parsedExtras : undefined,
    extrasNote:
      status === ChaletStatus.OCUPADO && extrasNote.trim() ? extrasNote.trim() : undefined,
    paidAmount: status === ChaletStatus.OCUPADO ? parsedPaid : undefined,
    blockReason:
      status === ChaletStatus.BLOQUEADO ? blockReason.trim() || 'Indisponível' : undefined,
    notes: notes.trim() || undefined,
    updatedAt: new Date().toISOString(),
  });

  const validateOccupiedForm = (): boolean => {
    if (status !== ChaletStatus.OCUPADO) return true;
    const isOk =
      validations.guestName.valid &&
      validations.guestDocument.valid &&
      validations.guestPhone.valid &&
      validations.dates.valid;

    if (!isOk) {
      setError('Corrija os campos destacados antes de salvar a ocupação.');
      return false;
    }
    return true;
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setSubmitAttempted(true);

    if (!validateOccupiedForm()) {
      return;
    }

    const resolvedGuestId = ensureGuestSavedIfRequested();
    onSave(buildUpdatedChalet(resolvedGuestId));
  };

  const handleQuickRelease = () => {
    onSave({
      ...activeChalet,
      status: ChaletStatus.LIVRE,
      guestId: undefined,
      guestName: undefined,
      guestCount: undefined,
      checkIn: undefined,
      checkOut: undefined,
      dailyRate: rates[activeChalet.category],
      extrasAmount: undefined,
      extrasNote: undefined,
      paidAmount: undefined,
      blockReason: undefined,
      notes: undefined,
      updatedAt: new Date().toISOString(),
    });
  };

  const baseInputClass =
    'w-full h-10 rounded-lg border bg-white dark:bg-slate-950 px-3 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none transition-colors';
  const defaultInputClass = `${baseInputClass} border-slate-200 dark:border-slate-700 focus:border-slate-900 dark:focus:border-slate-300`;

  const sortedGuests = [...guests].sort((a, b) =>
    a.fullName.localeCompare(b.fullName, 'pt-BR'),
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 dark:bg-slate-950/75 p-4 overflow-y-auto"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="chalet-modal-title"
    >
      <div className="w-full max-w-lg rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 my-auto">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              {isQuickCheckIn
                ? 'Check-in rápido'
                : `Acomodação ${activeChalet.code} · ${activeChalet.category}`}
            </p>
            <h2
              id="chalet-modal-title"
              className="font-display text-xl font-bold text-slate-900 dark:text-slate-100 mt-0.5"
            >
              {isQuickCheckIn ? 'Registrar Ocupação' : activeChalet.label}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar modal"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-200"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="mt-5 space-y-4">
          {isQuickCheckIn && (
            <div>
              <label
                htmlFor="quick-chalet-select"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Acomodação disponível
              </label>
              <select
                id="quick-chalet-select"
                value={selectedId}
                onChange={(e) => handleQuickChaletChange(Number(e.target.value))}
                className={defaultInputClass}
              >
                {availableChalets.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label} — {item.category} ({formatCurrencyBRL(rates[item.category])}/dia)
                  </option>
                ))}
              </select>
            </div>
          )}

          {!isQuickCheckIn && (
            <div>
              <span className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-2">
                Situação da acomodação
              </span>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setStatus(ChaletStatus.LIVRE);
                    setError('');
                  }}
                  className={`flex items-center justify-center gap-2 h-10 px-3 rounded-lg border text-sm font-medium transition-colors whitespace-nowrap ${
                    status === ChaletStatus.LIVRE
                      ? 'border-emerald-600 dark:border-emerald-500 bg-emerald-50 dark:bg-emerald-950/60 text-emerald-900 dark:text-emerald-100'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>Livre</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStatus(ChaletStatus.OCUPADO);
                    setError('');
                  }}
                  className={`flex items-center justify-center gap-2 h-10 px-3 rounded-lg border text-sm font-medium transition-colors whitespace-nowrap ${
                    status === ChaletStatus.OCUPADO
                      ? 'border-rose-600 dark:border-rose-500 bg-rose-50 dark:bg-rose-950/60 text-rose-900 dark:text-rose-100'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <Users className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>Ocupado</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setStatus(ChaletStatus.BLOQUEADO);
                    setError('');
                  }}
                  className={`flex items-center justify-center gap-2 h-10 px-3 rounded-lg border text-sm font-medium transition-colors whitespace-nowrap ${
                    status === ChaletStatus.BLOQUEADO
                      ? 'border-amber-600 dark:border-amber-500 bg-amber-50 dark:bg-amber-950/60 text-amber-900 dark:text-amber-100'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  <Lock className="h-4 w-4 shrink-0" aria-hidden="true" />
                  <span>Bloqueado</span>
                </button>
              </div>
            </div>
          )}

          {status === ChaletStatus.OCUPADO && (
            <div className="space-y-4">
              {sortedGuests.length > 0 && (
                <div>
                  <label
                    htmlFor="registered-guest-select"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                  >
                    Hóspede cadastrado
                  </label>
                  <select
                    id="registered-guest-select"
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

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label
                    htmlFor="guest-name"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                  >
                    Nome do hóspede
                  </label>
                  <input
                    id="guest-name"
                    type="text"
                    value={guestName}
                    onChange={(e) => {
                      setGuestName(e.target.value);
                      if (selectedGuestId) setSelectedGuestId('');
                      if (error) setError('');
                    }}
                    onBlur={() => {
                      setGuestName((prev) => prev.trim().replace(/\s+/g, ' '));
                      setTouched((prev) => ({ ...prev, guestName: true }));
                    }}
                    placeholder="Ex.: Família Silva"
                    autoFocus={!sortedGuests.length}
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
                    htmlFor="guest-count"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                  >
                    Hóspedes
                  </label>
                  <input
                    id="guest-count"
                    type="number"
                    min={1}
                    max={12}
                    value={guestCount}
                    onChange={(e) => setGuestCount(e.target.value)}
                    className={`${defaultInputClass} tabular-nums`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label
                    htmlFor="modal-guest-doc"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                  >
                    CPF / Documento (opcional)
                  </label>
                  <input
                    id="modal-guest-doc"
                    type="text"
                    value={guestDocument}
                    onChange={(e) => {
                      setGuestDocument(formatCpfOrDocument(e.target.value));
                      if (error) setError('');
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
                    htmlFor="modal-guest-phone"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                  >
                    Telefone / WhatsApp (opcional)
                  </label>
                  <input
                    id="modal-guest-phone"
                    type="tel"
                    value={guestPhone}
                    onChange={(e) => {
                      setGuestPhone(formatPhoneBR(e.target.value));
                      if (error) setError('');
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
                  (g) => g.fullName.trim().toLowerCase() === guestName.trim().toLowerCase(),
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

              <div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="checkin-date"
                      className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                    >
                      Check-in
                    </label>
                    <input
                      id="checkin-date"
                      type="date"
                      value={checkIn}
                      onChange={(e) => {
                        setCheckIn(e.target.value);
                        setTouched((prev) => ({ ...prev, dates: true }));
                        if (error) setError('');
                      }}
                      className={`${defaultInputClass} tabular-nums`}
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="checkout-date"
                      className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                    >
                      Check-out previsto
                    </label>
                    <input
                      id="checkout-date"
                      type="date"
                      value={checkOut}
                      onChange={(e) => {
                        setCheckOut(e.target.value);
                        setTouched((prev) => ({ ...prev, dates: true }));
                        if (error) setError('');
                      }}
                      className={`${baseInputClass} tabular-nums ${getFieldBorderClass(
                        validations.dates,
                        Boolean(touched.dates || submitAttempted),
                        false,
                      )}`}
                    />
                  </div>
                </div>
                <FieldFeedback
                  result={validations.dates}
                  showFeedback={Boolean(touched.dates || submitAttempted)}
                  hasValue={false}
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label
                    htmlFor="daily-rate"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                  >
                    Diária (R$)
                  </label>
                  <input
                    id="daily-rate"
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
                    htmlFor="extras-amount"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                  >
                    Consumo (R$)
                  </label>
                  <input
                    id="extras-amount"
                    type="text"
                    inputMode="decimal"
                    value={extrasAmount}
                    onChange={(e) => setExtrasAmount(e.target.value)}
                    placeholder="0,00"
                    className={`${defaultInputClass} font-mono tabular-nums`}
                  />
                </div>
                <div>
                  <label
                    htmlFor="paid-amount"
                    className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                  >
                    Sinal pago (R$)
                  </label>
                  <input
                    id="paid-amount"
                    type="text"
                    inputMode="decimal"
                    value={paidAmount}
                    onChange={(e) => setPaidAmount(e.target.value)}
                    placeholder="0,00"
                    className={`${defaultInputClass} font-mono tabular-nums`}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 px-3.5 py-2.5 text-xs">
                <span className="text-slate-600 dark:text-slate-300 tabular-nums">
                  {nights} {nights === 1 ? 'diária' : 'diárias'} · Total{' '}
                  <strong className="font-mono text-slate-900 dark:text-slate-100">
                    {formatCurrencyBRL(totalAmount)}
                  </strong>
                </span>
                <span className="text-slate-600 dark:text-slate-300 tabular-nums">
                  A receber:{' '}
                  <strong className="font-mono text-slate-900 dark:text-slate-100">
                    {formatCurrencyBRL(balanceDue)}
                  </strong>
                </span>
              </div>
            </div>
          )}

          {status === ChaletStatus.BLOQUEADO && (
            <div className="space-y-3">
              <div>
                <label
                  htmlFor="block-reason"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Motivo do bloqueio
                </label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {BLOCK_REASONS.map((reason) => (
                    <button
                      key={reason}
                      type="button"
                      onClick={() => setBlockReason(reason)}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap ${
                        blockReason === reason
                          ? 'border-amber-600 dark:border-amber-500 bg-amber-50 dark:bg-amber-950/60 text-amber-900 dark:text-amber-100'
                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                      }`}
                    >
                      {reason}
                    </button>
                  ))}
                </div>
                <input
                  id="block-reason"
                  type="text"
                  value={blockReason}
                  onChange={(e) => setBlockReason(e.target.value)}
                  placeholder="Descreva o motivo..."
                  className={defaultInputClass}
                />
              </div>
            </div>
          )}

          {status !== ChaletStatus.LIVRE && (
            <div>
              <label
                htmlFor="chalet-notes"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Observação (opcional)
              </label>
              <input
                id="chalet-notes"
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex.: Berço extra, café da manhã no chalé..."
                className={defaultInputClass}
              />
            </div>
          )}

          {!isQuickCheckIn && upcomingReservations.length > 0 && (
            <div className="rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 p-3 space-y-2">
              <p className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                <LogIn className="h-3.5 w-3.5 text-sky-700 dark:text-sky-400" aria-hidden="true" />
                <span>Entradas agendadas ({upcomingReservations.length})</span>
              </p>
              <div className="divide-y divide-slate-200/70 dark:divide-slate-800">
                {upcomingReservations.slice(0, 5).map((res) => {
                  const refDate = businessDate ?? getLocalTodayYMD();
                  const isToday = res.checkIn === refDate;
                  const isOverdue = res.checkIn < refDate;
                  return (
                    <div
                      key={res.id}
                      className="flex flex-wrap items-center justify-between gap-2 py-2 first:pt-0 last:pb-0 text-xs text-slate-600 dark:text-slate-300"
                    >
                      <div className="min-w-0">
                        <span className="font-medium text-slate-900 dark:text-slate-100">
                          {res.guestName}
                        </span>{' '}
                        · <span>{res.status}</span>
                        {isToday && (
                          <span className="ml-1.5 font-semibold text-sky-700 dark:text-sky-400">
                            · Chegada hoje
                          </span>
                        )}
                        {isOverdue && (
                          <span className="ml-1.5 font-semibold text-amber-700 dark:text-amber-400">
                            · Chegada em atraso
                          </span>
                        )}
                        <div className="font-mono text-[11px] tabular-nums text-slate-500 dark:text-slate-400">
                          {formatShortDate(res.checkIn)} → {formatShortDate(res.checkOut)}
                        </div>
                      </div>

                      {onCheckInReservation && (
                        <button
                          type="button"
                          onClick={() => {
                            const err = onCheckInReservation(res);
                            if (err) {
                              setError(err);
                            } else {
                              onClose();
                            }
                          }}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-emerald-800 dark:text-emerald-200 bg-emerald-50 dark:bg-emerald-950/70 hover:bg-emerald-100 dark:hover:bg-emerald-900/70 border border-emerald-200 dark:border-emerald-800/80 rounded-lg transition-colors whitespace-nowrap shrink-0"
                        >
                          <LogIn className="h-3.5 w-3.5" aria-hidden="true" />
                          <span>Dar check-in</span>
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {error && (
            <p role="alert" className="text-xs font-medium text-rose-700 dark:text-rose-400">
              {error}
            </p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-800 pt-4">
            <div className="flex flex-wrap items-center gap-2">
              {!isQuickCheckIn &&
                activeChalet.status === ChaletStatus.OCUPADO &&
                onOpenCheckout && (
                  <button
                    type="button"
                    onClick={() => {
                      setSubmitAttempted(true);
                      if (!validateOccupiedForm()) return;
                      const resolvedGuestId = ensureGuestSavedIfRequested();
                      onOpenCheckout(buildUpdatedChalet(resolvedGuestId));
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-emerald-800 dark:text-emerald-200 bg-emerald-50 dark:bg-emerald-950/60 hover:bg-emerald-100 dark:hover:bg-emerald-900/70 rounded-lg transition-colors whitespace-nowrap"
                  >
                    <LogOut className="h-4 w-4" aria-hidden="true" />
                    <span>Fazer Check-out</span>
                  </button>
                )}
              {!isQuickCheckIn && activeChalet.status === ChaletStatus.BLOQUEADO && (
                <button
                  type="button"
                  onClick={handleQuickRelease}
                  className="px-3 py-2 text-sm font-medium text-emerald-800 dark:text-emerald-200 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 rounded-lg transition-colors whitespace-nowrap"
                >
                  Liberar acomodação
                </button>
              )}
              {!isQuickCheckIn && onOpenReserve && (
                <button
                  type="button"
                  onClick={() => onOpenReserve(activeChalet)}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap"
                >
                  <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Reservar data futura</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white dark:text-slate-950 bg-slate-900 dark:bg-slate-100 rounded-lg hover:bg-slate-800 dark:hover:bg-white transition-colors whitespace-nowrap"
              >
                Salvar
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
