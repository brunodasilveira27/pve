import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  CalendarCheck,
  CheckCircle2,
  FileDown,
  History,
  LogIn,
  LogOut,
  RotateCcw,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { calculateChaletTotals, formatCurrencyBRL } from '../data/initialChalets';
import {
  CategoryRates,
  Chalet,
  ChaletStatus,
  CheckoutRecord,
  DailyClosingRecord,
  PaymentMethod,
  Reservation,
  ReservationStatus,
} from '../types/chalet';
import { addDaysYMD, getLocalTodayYMD } from '../utils/validation';

export interface CloseDayPayload {
  checkoutSelections: Array<{
    chaletId: number;
    paymentMethod: PaymentMethod;
  }>;
  checkinReservationIds: string[];
  releaseCleaningChaletIds: number[];
  advanceDate: boolean;
  notes: string;
}

interface CloseDayModalProps {
  businessDate: string;
  chalets: Chalet[];
  rates: CategoryRates;
  reservations: Reservation[];
  checkoutRecords: CheckoutRecord[];
  dayClosings: DailyClosingRecord[];
  onClose: () => void;
  onConfirmCloseDay: (payload: CloseDayPayload) => void;
  onSyncToday: () => void;
  onDeleteDayClosing: (id: string) => void;
}

const PAYMENT_METHODS: PaymentMethod[] = [
  PaymentMethod.PIX,
  PaymentMethod.CARTAO,
  PaymentMethod.DINHEIRO,
  PaymentMethod.TRANSFERENCIA,
];

function formatDateFullBR(ymd: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  if (!y || !m || !d) return ymd;
  const date = new Date(y, m - 1, d, 12, 0, 0);
  const formatted = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(date);
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function formatDateShortBR(ymd?: string): string {
  if (!ymd) return '—';
  const [year, month, day] = ymd.split('-');
  if (!year || !month || !day) return ymd;
  return `${day}/${month}/${year.slice(2)}`;
}

function formatDateTimeBR(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function CloseDayModal({
  businessDate,
  chalets,
  rates,
  reservations,
  checkoutRecords,
  dayClosings,
  onClose,
  onConfirmCloseDay,
  onSyncToday,
  onDeleteDayClosing,
}: CloseDayModalProps) {
  const realTodayYMD = getLocalTodayYMD();
  const nextDateYMD = addDaysYMD(businessDate, 1);

  const [activeTab, setActiveTab] = useState<'fechar' | 'historico'>('fechar');
  const [advanceDate, setAdvanceDate] = useState(true);
  const [notes, setNotes] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [blockedAttemptMessage, setBlockedAttemptMessage] = useState(false);

  // Occupied chalets with checkout due on or before businessDate
  const dueCheckouts = useMemo(
    () =>
      chalets.filter(
        (c) =>
          c.status === ChaletStatus.OCUPADO &&
          Boolean(c.checkOut) &&
          (c.checkOut as string) <= businessDate,
      ),
    [chalets, businessDate],
  );

  // Occupied chalets staying past businessDate
  const stayingChalets = useMemo(
    () =>
      chalets.filter(
        (c) =>
          c.status === ChaletStatus.OCUPADO &&
          (!c.checkOut || c.checkOut > businessDate),
      ),
    [chalets, businessDate],
  );

  // Checkouts already recorded on businessDate
  const alreadyClosedToday = useMemo(
    () =>
      checkoutRecords.filter((rec) => {
        const closedLocal = getLocalTodayYMD(new Date(rec.closedAt));
        return closedLocal === businessDate || rec.checkOut === businessDate;
      }),
    [checkoutRecords, businessDate],
  );

  // Active reservations scheduled to check-in on or before businessDate
  const dueCheckins = useMemo(
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

  // Chalets currently blocked with 'Em limpeza'
  const cleaningChalets = useMemo(
    () =>
      chalets.filter(
        (c) =>
          c.status === ChaletStatus.BLOQUEADO &&
          c.blockReason?.toLowerCase() === 'em limpeza',
      ),
    [chalets],
  );

  // Upcoming tomorrow preview
  const tomorrowCheckouts = useMemo(
    () =>
      chalets.filter(
        (c) => c.status === ChaletStatus.OCUPADO && c.checkOut === nextDateYMD,
      ),
    [chalets, nextDateYMD],
  );

  const tomorrowCheckins = useMemo(
    () =>
      reservations.filter(
        (r) =>
          (r.status === ReservationStatus.CONFIRMADA ||
            r.status === ReservationStatus.PENDENTE) &&
          r.checkIn === nextDateYMD,
      ),
    [reservations, nextDateYMD],
  );

  // Selection state for check-outs
  const [selectedCheckoutIds, setSelectedCheckoutIds] = useState<number[]>(() =>
    dueCheckouts.map((c) => c.id),
  );
  const [paymentMethodsByChalet, setPaymentMethodsByChalet] = useState<
    Record<number, PaymentMethod>
  >({});

  // Selection state for check-ins
  const [selectedCheckinIds, setSelectedCheckinIds] = useState<string[]>(() =>
    dueCheckins
      .filter((res) => {
        const target = chalets.find((c) => c.id === res.chaletId);
        if (!target) return false;
        if (target.status === ChaletStatus.LIVRE) return true;
        return dueCheckouts.some((dc) => dc.id === target.id);
      })
      .map((r) => r.id),
  );

  // Selection state for releasing already-cleaning chalets
  const [releaseCleaningIds, setReleaseCleaningIds] = useState<number[]>([]);

  // Keep selections synced if businessDate changes (e.g. after syncing to today)
  useEffect(() => {
    setSelectedCheckoutIds(dueCheckouts.map((c) => c.id));
    setSelectedCheckinIds(
      dueCheckins
        .filter((res) => {
          const target = chalets.find((c) => c.id === res.chaletId);
          if (!target) return false;
          if (target.status === ChaletStatus.LIVRE) return true;
          return dueCheckouts.some((dc) => dc.id === target.id);
        })
        .map((r) => r.id),
    );
    setReleaseCleaningIds([]);
  }, [businessDate, dueCheckouts, dueCheckins, chalets]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const toggleCheckout = (id: number) => {
    setSelectedCheckoutIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const toggleCheckin = (id: string) => {
    setSelectedCheckinIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const toggleReleaseCleaning = (id: number) => {
    setReleaseCleaningIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const { blockingPendencies, informationalNotices } = useMemo(() => {
    const blocking: Array<{
      id: string;
      title: string;
      detail: string;
      actionHint: string;
    }> = [];

    const notices: Array<{
      id: string;
      title: string;
      detail: string;
    }> = [];

    // 1. Due or overdue check-outs that are NOT selected to be closed
    const unselectedCheckouts = dueCheckouts.filter(
      (c) => !selectedCheckoutIds.includes(c.id),
    );
    if (unselectedCheckouts.length > 0) {
      blocking.push({
        id: 'pending-checkouts',
        title: `${unselectedCheckouts.length} check-out(s) previsto(s) em aberto`,
        detail: unselectedCheckouts
          .map((c) => {
            const overdue = c.checkOut && c.checkOut < businessDate;
            return `${c.label} (${c.guestName ?? 'Hóspede'}${overdue ? ` · saída ${formatDateShortBR(c.checkOut)}` : ''})`;
          })
          .join(', '),
        actionHint:
          'Marque o check-out acima para encerrar agora ou altere a data de saída na acomodação.',
      });
    }

    // 2 & 3. Due or overdue check-ins that are blocked by occupancy or not checked
    const blockedCheckins: Reservation[] = [];
    const unselectedCheckins: Reservation[] = [];

    for (const res of dueCheckins) {
      const target = chalets.find((c) => c.id === res.chaletId);
      const willCheckout = selectedCheckoutIds.includes(res.chaletId);
      const willReleaseCleaning = releaseCleaningIds.includes(res.chaletId);
      const canCheckIn =
        Boolean(target) &&
        (target?.status === ChaletStatus.LIVRE ||
          target?.status === ChaletStatus.BLOQUEADO ||
          willCheckout ||
          willReleaseCleaning);

      if (!canCheckIn) {
        blockedCheckins.push(res);
      } else if (!selectedCheckinIds.includes(res.id)) {
        unselectedCheckins.push(res);
      }
    }

    if (blockedCheckins.length > 0) {
      blocking.push({
        id: 'blocked-checkins',
        title: `${blockedCheckins.length} check-in(s) impedido(s) por ocupação atual`,
        detail: blockedCheckins
          .map((r) => `${r.chaletLabel} (${r.guestName} · prevista ${formatDateShortBR(r.checkIn)})`)
          .join(', '),
        actionHint:
          'Conclua o check-out da hospedagem atual ou remaneje/cancele a reserva em "Reservas".',
      });
    }

    if (unselectedCheckins.length > 0) {
      blocking.push({
        id: 'unselected-checkins',
        title: `${unselectedCheckins.length} check-in(s) previsto(s) não confirmado(s)`,
        detail: unselectedCheckins
          .map((r) => `${r.chaletLabel} (${r.guestName} · ${formatDateShortBR(r.checkIn)})`)
          .join(', '),
        actionHint:
          'Marque o check-in acima para dar entrada ou cancele/altere a data em "Reservas".',
      });
    }

    // 4. Occupied chalets without a checkout date defined
    const occupiedWithoutCheckoutDate = chalets.filter(
      (c) => c.status === ChaletStatus.OCUPADO && !c.checkOut,
    );
    if (occupiedWithoutCheckoutDate.length > 0) {
      blocking.push({
        id: 'missing-checkout-date',
        title: `${occupiedWithoutCheckoutDate.length} acomodação(ões) ocupada(s) sem data de saída`,
        detail: occupiedWithoutCheckoutDate
          .map((c) => `${c.label} (${c.guestName ?? 'Hóspede'})`)
          .join(', '),
        actionHint:
          'Abra a acomodação no painel e informe a data prevista de saída ou efetue o check-out.',
      });
    }

    // Non-blocking operational reminders (cleaning status & tomorrow pending reservations)
    const checkedInChaletIds = new Set(
      dueCheckins
        .filter((res) => {
          if (!selectedCheckinIds.includes(res.id)) return false;
          const target = chalets.find((c) => c.id === res.chaletId);
          const willCheckout = selectedCheckoutIds.includes(res.chaletId);
          const willRelease = releaseCleaningIds.includes(res.chaletId);
          return (
            Boolean(target) &&
            (target?.status === ChaletStatus.LIVRE ||
              target?.status === ChaletStatus.BLOQUEADO ||
              willCheckout ||
              willRelease)
          );
        })
        .map((r) => r.chaletId),
    );

    const remainingCleaningMap = new Map<number, Chalet>();
    for (const c of cleaningChalets) {
      if (!releaseCleaningIds.includes(c.id) && !checkedInChaletIds.has(c.id)) {
        remainingCleaningMap.set(c.id, c);
      }
    }
    for (const c of dueCheckouts) {
      if (selectedCheckoutIds.includes(c.id) && !checkedInChaletIds.has(c.id)) {
        remainingCleaningMap.set(c.id, c);
      }
    }

    const remainingCleaning = Array.from(remainingCleaningMap.values());
    if (remainingCleaning.length > 0) {
      const cleaningWithTomorrowEntry = remainingCleaning.filter((c) =>
        reservations.some(
          (r) =>
            r.chaletId === c.id &&
            (r.status === ReservationStatus.CONFIRMADA ||
              r.status === ReservationStatus.PENDENTE) &&
            r.checkIn === nextDateYMD,
        ),
      );

      if (cleaningWithTomorrowEntry.length > 0) {
        notices.push({
          id: 'cleaning-tomorrow-entry',
          title: `${cleaningWithTomorrowEntry.length} chalé(s) "Em limpeza" com entrada amanhã (${formatDateShortBR(nextDateYMD)})`,
          detail: cleaningWithTomorrowEntry
            .map((c) => {
              const nextRes = reservations.find(
                (r) =>
                  r.chaletId === c.id &&
                  (r.status === ReservationStatus.CONFIRMADA ||
                    r.status === ReservationStatus.PENDENTE) &&
                  r.checkIn === nextDateYMD,
              );
              return `${c.label} (${nextRes?.guestName ?? ''})`;
            })
            .join(', '),
        });
      }

      const otherCleaning = remainingCleaning.filter(
        (c) => !cleaningWithTomorrowEntry.some((item) => item.id === c.id),
      );
      if (otherCleaning.length > 0) {
        notices.push({
          id: 'cleaning-pending',
          title: `${otherCleaning.length} acomodação(ões) seguirá(ão) "Em limpeza" após fechar o dia`,
          detail: otherCleaning.map((c) => c.label).join(', '),
        });
      }
    }

    const pendingTomorrowReservations = reservations.filter(
      (r) => r.status === ReservationStatus.PENDENTE && r.checkIn === nextDateYMD,
    );
    if (pendingTomorrowReservations.length > 0) {
      notices.push({
        id: 'pending-tomorrow-reservations',
        title: `${pendingTomorrowReservations.length} reserva(s) com status "Pendente" para amanhã (${formatDateShortBR(nextDateYMD)})`,
        detail: pendingTomorrowReservations
          .map((r) => `${r.chaletLabel} (${r.guestName})`)
          .join(', '),
      });
    }

    return {
      blockingPendencies: blocking,
      informationalNotices: notices,
    };
  }, [
    dueCheckouts,
    selectedCheckoutIds,
    businessDate,
    dueCheckins,
    chalets,
    releaseCleaningIds,
    selectedCheckinIds,
    cleaningChalets,
    reservations,
    nextDateYMD,
  ]);

  const hasBlockingPendencies = blockingPendencies.length > 0;

  useEffect(() => {
    setBlockedAttemptMessage(false);
  }, [selectedCheckoutIds, selectedCheckinIds, releaseCleaningIds, advanceDate, businessDate]);

  const dayTotals = useMemo(() => {
    const selectedCheckoutsTotal = dueCheckouts
      .filter((c) => selectedCheckoutIds.includes(c.id))
      .reduce((sum, c) => sum + calculateChaletTotals(c, rates).totalAmount, 0);

    const selectedCheckoutsBalance = dueCheckouts
      .filter((c) => selectedCheckoutIds.includes(c.id))
      .reduce((sum, c) => sum + calculateChaletTotals(c, rates).balanceDue, 0);

    const alreadyClosedTotal = alreadyClosedToday.reduce(
      (sum, rec) => sum + rec.totalAmount,
      0,
    );

    return {
      selectedCheckoutsTotal,
      selectedCheckoutsBalance,
      alreadyClosedTotal,
      projectedDayRevenue: alreadyClosedTotal + selectedCheckoutsTotal,
    };
  }, [dueCheckouts, selectedCheckoutIds, rates, alreadyClosedToday]);

  const handleDownloadDailyPdf = () => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const marginX = 14;
    const usableWidth = pageWidth - marginX * 2;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.setTextColor(15, 23, 42);
    doc.text(
      `Pousada Vale do Ermitão — Resumo do Dia (${formatDateShortBR(businessDate)})`,
      marginX,
      16,
    );

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(
      `${formatDateFullBR(businessDate)}   |   Emitido em: ${formatDateTimeBR(new Date().toISOString())}`,
      marginX,
      22,
    );

    const summaryRows = [
      ['Check-outs previstos para o dia', String(dueCheckouts.length)],
      ['Check-outs já encerrados no dia', String(alreadyClosedToday.length)],
      ['Check-ins previstos para o dia', String(dueCheckins.length)],
      ['Acomodações que permanecem hospedadas', String(stayingChalets.length)],
      ['Acomodações em limpeza', String(cleaningChalets.length)],
      ['Receita prevista / consolidada no dia', formatCurrencyBRL(dayTotals.projectedDayRevenue)],
    ];

    autoTable(doc, {
      startY: 27,
      margin: { left: marginX, right: marginX },
      head: [['Indicador operacional do dia', 'Valor']],
      body: summaryRows,
      theme: 'grid',
      styles: {
        font: 'helvetica',
        fontSize: 9,
        cellPadding: 2.5,
        textColor: [30, 41, 59],
        lineColor: [226, 232, 240],
      },
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
      columnStyles: {
        0: { cellWidth: usableWidth - 45 },
        1: { cellWidth: 45, halign: 'right', fontStyle: 'bold' },
      },
    });

    const afterSummaryY =
      (doc as jsPDF & { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? 75;

    const movementRows: string[][] = [
      ...dueCheckouts.map((c) => {
        const totals = calculateChaletTotals(c, rates);
        return [
          'Check-out previsto',
          c.label,
          c.guestName ?? 'Hóspede',
          `${formatDateShortBR(c.checkIn)} a ${formatDateShortBR(c.checkOut)}`,
          `Saldo ${formatCurrencyBRL(totals.balanceDue)}`,
        ];
      }),
      ...alreadyClosedToday.map((rec) => [
        'Check-out concluído',
        rec.chaletLabel,
        rec.guestName,
        `${formatDateShortBR(rec.checkIn)} a ${formatDateShortBR(rec.checkOut)}`,
        `Total ${formatCurrencyBRL(rec.totalAmount)} (${rec.paymentMethod})`,
      ]),
      ...dueCheckins.map((res) => [
        'Check-in previsto',
        res.chaletLabel,
        res.guestName,
        `${formatDateShortBR(res.checkIn)} a ${formatDateShortBR(res.checkOut)}`,
        `Sinal ${formatCurrencyBRL(res.depositPaid)} (${res.status})`,
      ]),
    ];

    autoTable(doc, {
      startY: afterSummaryY + 6,
      margin: { left: marginX, right: marginX },
      head: [['Movimento', 'Acomodação', 'Hóspede', 'Período', 'Financeiro / Status']],
      body:
        movementRows.length > 0
          ? movementRows
          : [['—', '—', 'Nenhum check-out ou check-in previsto para este dia.', '—', '—']],
      theme: 'grid',
      styles: {
        font: 'helvetica',
        fontSize: 8.5,
        cellPadding: 2.5,
        textColor: [30, 41, 59],
        lineColor: [226, 232, 240],
      },
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
    });

    doc.save(`fechamento-dia-${businessDate}.pdf`);
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();

    if (hasBlockingPendencies) {
      setBlockedAttemptMessage(true);
      return;
    }

    const checkoutSelections = dueCheckouts
      .filter((c) => selectedCheckoutIds.includes(c.id))
      .map((c) => ({
        chaletId: c.id,
        paymentMethod: paymentMethodsByChalet[c.id] ?? PaymentMethod.PIX,
      }));

    const validCheckinIds = dueCheckins
      .filter((res) => {
        if (!selectedCheckinIds.includes(res.id)) return false;
        const target = chalets.find((c) => c.id === res.chaletId);
        if (!target) return false;
        const isBeingCheckedOut = checkoutSelections.some((s) => s.chaletId === target.id);
        const isBeingCleaned = releaseCleaningIds.includes(target.id);
        return (
          target.status === ChaletStatus.LIVRE ||
          target.status === ChaletStatus.BLOQUEADO ||
          isBeingCheckedOut ||
          isBeingCleaned
        );
      })
      .map((r) => r.id);

    onConfirmCloseDay({
      checkoutSelections,
      checkinReservationIds: validCheckinIds,
      releaseCleaningChaletIds: releaseCleaningIds,
      advanceDate,
      notes: notes.trim(),
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 dark:bg-slate-950/75 p-2 sm:p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="close-day-modal-title"
    >
      <div className="flex flex-col w-full max-w-4xl max-h-[92vh] rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 px-6 py-4">
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Pousada Vale do Ermitão · Encerramento operacional do dia
            </p>
            <h2
              id="close-day-modal-title"
              className="font-display text-xl font-bold text-slate-900 dark:text-slate-100 mt-0.5"
            >
              Fechar o Dia · {formatDateShortBR(businessDate)}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {businessDate !== realTodayYMD && (
              <button
                type="button"
                onClick={onSyncToday}
                className="inline-flex items-center gap-1.5 h-9 px-3 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Voltar para hoje ({formatDateShortBR(realTodayYMD)})</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleDownloadDailyPdf}
              className="inline-flex items-center gap-1.5 h-9 px-3 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors whitespace-nowrap"
            >
              <FileDown className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Baixar PDF</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar janela de encerramento do dia"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="border-b border-slate-100 dark:border-slate-800 px-6 py-2.5 flex items-center justify-between gap-3">
          <div
            className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg"
            role="tablist"
            aria-label="Seções do fechamento diário"
          >
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'fechar'}
              onClick={() => setActiveTab('fechar')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                activeTab === 'fechar'
                  ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <CalendarCheck className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Fechar o dia</span>
            </button>

            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'historico'}
              onClick={() => setActiveTab('historico')}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap tabular-nums ${
                activeTab === 'historico'
                  ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              <History className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Histórico ({dayClosings.length})</span>
            </button>
          </div>

          <span className="text-xs text-slate-500 dark:text-slate-400 hidden sm:inline">
            {formatDateFullBR(businessDate)}
          </span>
        </div>

        {activeTab === 'fechar' ? (
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 p-3.5">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Check-outs do dia
                </p>
                <p className="font-display text-xl font-bold text-slate-900 dark:text-slate-100 tabular-nums mt-0.5">
                  {selectedCheckoutIds.length}/{dueCheckouts.length}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                  {alreadyClosedToday.length > 0
                    ? `+ ${alreadyClosedToday.length} já encerrado(s)`
                    : 'Previstos para hoje'}
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 p-3.5">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Check-ins do dia
                </p>
                <p className="font-display text-xl font-bold text-slate-900 dark:text-slate-100 tabular-nums mt-0.5">
                  {selectedCheckinIds.length}/{dueCheckins.length}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                  Reservas previstas
                </p>
              </div>

              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 p-3.5">
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  Permanências
                </p>
                <p className="font-display text-xl font-bold text-slate-900 dark:text-slate-100 tabular-nums mt-0.5">
                  {stayingChalets.length}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  Seguem hospedados
                </p>
              </div>

              <div className="rounded-xl border border-emerald-200 dark:border-emerald-800/80 bg-emerald-50/60 dark:bg-emerald-950/45 p-3.5">
                <p className="text-xs font-medium text-emerald-900 dark:text-emerald-200">
                  Receita do dia
                </p>
                <p className="font-mono text-lg font-bold text-emerald-950 dark:text-emerald-100 tabular-nums mt-0.5">
                  {formatCurrencyBRL(dayTotals.projectedDayRevenue)}
                </p>
                <p className="text-[11px] text-emerald-800 dark:text-emerald-300 tabular-nums">
                  Saldo agora: {formatCurrencyBRL(dayTotals.selectedCheckoutsBalance)}
                </p>
              </div>
            </div>

            {/* Section 1: Check-outs of the day */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <h3 className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-900 dark:text-slate-100">
                  <LogOut className="h-4 w-4 text-rose-700 dark:text-rose-400" aria-hidden="true" />
                  <span>Check-outs previstos para {formatDateShortBR(businessDate)}</span>
                </h3>
                {dueCheckouts.length > 0 && (
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Ao confirmar, entram em &quot;Em limpeza&quot;
                  </span>
                )}
              </div>

              {dueCheckouts.length > 0 ? (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
                  {dueCheckouts.map((chalet) => {
                    const totals = calculateChaletTotals(chalet, rates);
                    const isChecked = selectedCheckoutIds.includes(chalet.id);
                    const isOverdue = Boolean(chalet.checkOut && chalet.checkOut < businessDate);
                    const selectedMethod =
                      paymentMethodsByChalet[chalet.id] ?? PaymentMethod.PIX;

                    return (
                      <div
                        key={chalet.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5"
                      >
                        <label className="flex items-start gap-3 cursor-pointer flex-1 min-w-0">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleCheckout(chalet.id)}
                            className="mt-0.5 h-4 w-4 rounded border-slate-300 dark:border-slate-600 accent-slate-900 dark:accent-slate-100"
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                              {chalet.label} ({chalet.category}) · {chalet.guestName ?? 'Hóspede'}
                              {isOverdue && (
                                <span className="ml-2 font-medium text-amber-700 dark:text-amber-400">
                                  (saída prevista {formatDateShortBR(chalet.checkOut)})
                                </span>
                              )}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums mt-0.5">
                              {formatDateShortBR(chalet.checkIn)} →{' '}
                              {formatDateShortBR(chalet.checkOut)} · {totals.nights}{' '}
                              {totals.nights === 1 ? 'diária' : 'diárias'} · Total{' '}
                              <span className="font-mono text-slate-700 dark:text-slate-200">
                                {formatCurrencyBRL(totals.totalAmount)}
                              </span>{' '}
                              · Saldo{' '}
                              <span className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                                {formatCurrencyBRL(totals.balanceDue)}
                              </span>
                            </p>
                          </div>
                        </label>

                        {isChecked && (
                          <div className="flex items-center gap-2 pl-7 sm:pl-0 shrink-0">
                            <select
                              aria-label={`Forma de pagamento do ${chalet.label}`}
                              value={selectedMethod}
                              onChange={(e) =>
                                setPaymentMethodsByChalet((prev) => ({
                                  ...prev,
                                  [chalet.id]: e.target.value as PaymentMethod,
                                }))
                              }
                              className="h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 text-xs font-medium text-slate-700 dark:text-slate-200 focus:border-slate-900 dark:focus:border-slate-300 focus:outline-none"
                            >
                              {PAYMENT_METHODS.map((method) => (
                                <option key={method} value={method}>
                                  {method}
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/50 px-4 py-3 text-xs text-slate-600 dark:text-slate-300">
                  Nenhum check-out pendente previsto para {formatDateShortBR(businessDate)}.
                  {tomorrowCheckouts.length > 0 && (
                    <span className="block text-slate-500 dark:text-slate-400 mt-1">
                      Previstos para amanhã ({formatDateShortBR(nextDateYMD)}):{' '}
                      {tomorrowCheckouts.map((c) => c.label).join(', ')}.
                    </span>
                  )}
                </div>
              )}

              {alreadyClosedToday.length > 0 && (
                <div className="rounded-lg border border-emerald-200 dark:border-emerald-900/70 bg-emerald-50/50 dark:bg-emerald-950/30 px-3.5 py-2.5 text-xs text-emerald-900 dark:text-emerald-200">
                  <span className="font-semibold">
                    Já encerrados neste dia ({alreadyClosedToday.length}):
                  </span>{' '}
                  {alreadyClosedToday
                    .map(
                      (rec) =>
                        `${rec.chaletLabel} (${rec.guestName} · ${formatCurrencyBRL(rec.totalAmount)})`,
                    )
                    .join(' · ')}
                </div>
              )}
            </div>

            {/* Section 2: Check-ins of the day */}
            <div className="space-y-2.5">
              <h3 className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-900 dark:text-slate-100">
                <LogIn className="h-4 w-4 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
                <span>Check-ins de reservas previstos para {formatDateShortBR(businessDate)}</span>
              </h3>

              {dueCheckins.length > 0 ? (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
                  {dueCheckins.map((res) => {
                    const target = chalets.find((c) => c.id === res.chaletId);
                    const willCheckoutSameChalet = selectedCheckoutIds.includes(res.chaletId);
                    const willReleaseCleaning = releaseCleaningIds.includes(res.chaletId);
                    const canCheckIn =
                      Boolean(target) &&
                      (target?.status === ChaletStatus.LIVRE ||
                        target?.status === ChaletStatus.BLOQUEADO ||
                        willCheckoutSameChalet ||
                        willReleaseCleaning);

                    const isChecked = canCheckIn && selectedCheckinIds.includes(res.id);

                    return (
                      <label
                        key={res.id}
                        className={`flex items-start justify-between gap-3 p-3.5 ${
                          canCheckIn ? 'cursor-pointer' : 'opacity-65 cursor-not-allowed'
                        }`}
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            disabled={!canCheckIn}
                            onChange={() => toggleCheckin(res.id)}
                            className="mt-0.5 h-4 w-4 rounded border-slate-300 dark:border-slate-600 accent-slate-900 dark:accent-slate-100"
                          />
                          <div className="min-w-0">
                            <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                              {res.chaletLabel} ({res.category}) · {res.guestName}
                            </p>
                            <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums mt-0.5">
                              {formatDateShortBR(res.checkIn)} → {formatDateShortBR(res.checkOut)}{' '}
                              · Sinal pago: {formatCurrencyBRL(res.depositPaid)} · {res.status}
                            </p>
                          </div>
                        </div>

                        <span className="text-xs font-medium whitespace-nowrap shrink-0">
                          {!target ? (
                            <span className="text-rose-700 dark:text-rose-400">Indisponível</span>
                          ) : target.status === ChaletStatus.LIVRE ? (
                            <span className="text-emerald-700 dark:text-emerald-400">
                              Acomodação livre
                            </span>
                          ) : willCheckoutSameChalet || target.status === ChaletStatus.BLOQUEADO ? (
                            <span className="text-amber-700 dark:text-amber-400">
                              Libera limpeza e entra
                            </span>
                          ) : (
                            <span className="text-rose-700 dark:text-rose-400">
                              Chalé ocupado agora
                            </span>
                          )}
                        </span>
                      </label>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-950/50 px-4 py-3 text-xs text-slate-600 dark:text-slate-300">
                  Nenhum check-in de reserva previsto para {formatDateShortBR(businessDate)}.
                  {tomorrowCheckins.length > 0 && (
                    <span className="block text-slate-500 dark:text-slate-400 mt-1">
                      Previstos para amanhã ({formatDateShortBR(nextDateYMD)}):{' '}
                      {tomorrowCheckins
                        .map((r) => `${r.chaletLabel} (${r.guestName})`)
                        .join(', ')}
                      .
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Section 3: Cleaning & rollover options */}
            <div className="space-y-3 border-t border-slate-100 dark:border-slate-800 pt-4">
              {cleaningChalets.length > 0 && (
                <div className="rounded-xl border border-amber-200 dark:border-amber-900/70 bg-amber-50/50 dark:bg-amber-950/30 p-3.5 space-y-2">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-amber-950 dark:text-amber-200">
                    <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>
                      Acomodações atualmente &quot;Em limpeza&quot; ({cleaningChalets.length}) — marcar para liberar:
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {cleaningChalets.map((chalet) => {
                      const checked = releaseCleaningIds.includes(chalet.id);
                      return (
                        <label
                          key={chalet.id}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium cursor-pointer transition-colors ${
                            checked
                              ? 'border-emerald-600 dark:border-emerald-500 bg-emerald-50 dark:bg-emerald-950/70 text-emerald-900 dark:text-emerald-100'
                              : 'border-amber-300 dark:border-amber-800 bg-white dark:bg-slate-950 text-amber-950 dark:text-amber-100'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleReleaseCleaning(chalet.id)}
                            className="h-3.5 w-3.5 rounded accent-emerald-700"
                          />
                          <span>{chalet.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              <label className="flex items-center gap-2.5 text-xs font-medium text-slate-700 dark:text-slate-200 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={advanceDate}
                  onChange={(e) => setAdvanceDate(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 accent-slate-900 dark:accent-slate-100"
                />
                <span>
                  Avançar data operacional do sistema para {formatDateShortBR(nextDateYMD)} após encerrar este dia
                </span>
              </label>

              <div>
                <label
                  htmlFor="close-day-notes"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Observações do fechamento do dia (opcional)
                </label>
                <input
                  id="close-day-notes"
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex.: Turno encerrado sem pendências, caixa conferido..."
                  className="w-full h-10 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-slate-900 dark:focus:border-slate-300 focus:outline-none"
                />
              </div>
            </div>

            {/* Section 4: Blocking pendencies & non-blocking reminders */}
            {hasBlockingPendencies ? (
              <div
                role="alert"
                className="rounded-xl border border-rose-300 dark:border-rose-800/80 bg-rose-50/90 dark:bg-rose-950/40 p-4 space-y-2.5"
              >
                <div className="flex items-center gap-2 text-xs font-semibold text-rose-950 dark:text-rose-200">
                  <AlertTriangle
                    className="h-4 w-4 text-rose-700 dark:text-rose-400 shrink-0"
                    aria-hidden="true"
                  />
                  <span>
                    Não é possível concluir o fechamento: há {blockingPendencies.length} pendência(s)
                    a ser(em) resolvida(s)
                  </span>
                </div>
                <ul className="space-y-2 pl-6 list-disc text-xs text-rose-900 dark:text-rose-200">
                  {blockingPendencies.map((item) => (
                    <li key={item.id}>
                      <p>
                        <span className="font-semibold">{item.title}:</span>{' '}
                        <span>{item.detail}.</span>
                      </p>
                      <p className="text-[11px] text-rose-800 dark:text-rose-300 mt-0.5">
                        Como resolver: {item.actionHint}
                      </p>
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-200 dark:border-emerald-800/80 bg-emerald-50/70 dark:bg-emerald-950/35 px-4 py-3 text-xs font-medium text-emerald-900 dark:text-emerald-200">
                <CheckCircle2
                  className="h-4 w-4 text-emerald-700 dark:text-emerald-400 shrink-0"
                  aria-hidden="true"
                />
                <span>
                  Nenhuma pendência impeditiva encontrada: check-outs, check-ins e acomodações do
                  dia estão em ordem para encerramento.
                </span>
              </div>
            )}

            {informationalNotices.length > 0 && (
              <div className="rounded-xl border border-amber-200 dark:border-amber-900/70 bg-amber-50/60 dark:bg-amber-950/25 p-3.5 space-y-1.5">
                <p className="text-xs font-semibold text-amber-950 dark:text-amber-200">
                  Lembretes operacionais (não impedem o fechamento):
                </p>
                <ul className="space-y-1 pl-5 list-disc text-xs text-amber-900 dark:text-amber-200">
                  {informationalNotices.map((notice) => (
                    <li key={notice.id}>
                      <span className="font-medium">{notice.title}:</span> {notice.detail}.
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {blockedAttemptMessage && hasBlockingPendencies && (
              <div
                role="status"
                className="rounded-xl border border-rose-300 dark:border-rose-800 bg-rose-100/80 dark:bg-rose-950/60 px-4 py-2.5 text-xs font-medium text-rose-950 dark:text-rose-100"
              >
                Resolva todas as pendências destacadas acima antes de concluir o fechamento do dia.
              </div>
            )}

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={hasBlockingPendencies}
                title={
                  hasBlockingPendencies
                    ? 'Resolva todas as pendências antes de concluir o fechamento'
                    : 'Confirmar fechamento do dia'
                }
                className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  hasBlockingPendencies
                    ? 'bg-slate-200 dark:bg-slate-800 text-slate-500 dark:text-slate-400 cursor-not-allowed'
                    : 'text-white dark:text-slate-950 bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white'
                }`}
              >
                {hasBlockingPendencies ? (
                  <AlertTriangle className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                )}
                <span>
                  {hasBlockingPendencies
                    ? 'Resolva as pendências para fechar'
                    : 'Confirmar fechamento do dia'}
                </span>
              </button>
            </div>
          </form>
        ) : (
          <div className="flex-1 overflow-y-auto p-6">
            {dayClosings.length > 0 ? (
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300">
                      <th className="py-2.5 px-3 font-semibold whitespace-nowrap">Dia fechado</th>
                      <th className="py-2.5 px-3 font-semibold text-right whitespace-nowrap">
                        Check-outs
                      </th>
                      <th className="py-2.5 px-3 font-semibold text-right whitespace-nowrap">
                        Check-ins
                      </th>
                      <th className="py-2.5 px-3 font-semibold text-right whitespace-nowrap">
                        Receita do dia
                      </th>
                      <th className="py-2.5 px-3 font-semibold whitespace-nowrap">
                        Ocupação ao fechar
                      </th>
                      <th className="py-2.5 px-3 font-semibold whitespace-nowrap">Observações</th>
                      <th className="py-2.5 px-3 font-semibold text-right whitespace-nowrap">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {dayClosings.map((item) => (
                      <tr
                        key={item.id}
                        className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="py-3 px-3 align-top whitespace-nowrap">
                          <div className="font-mono font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                            {formatDateShortBR(item.businessDate)}
                          </div>
                          <div className="text-slate-500 dark:text-slate-400 tabular-nums">
                            Registrado em {formatDateTimeBR(item.closedAt)}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-900 dark:text-slate-100 align-top">
                          {item.checkoutsCount}
                        </td>
                        <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-900 dark:text-slate-100 align-top">
                          {item.checkinsCount}
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-semibold tabular-nums text-emerald-800 dark:text-emerald-300 align-top whitespace-nowrap">
                          {formatCurrencyBRL(item.dayRevenue)}
                        </td>
                        <td className="py-3 px-3 align-top whitespace-nowrap tabular-nums text-slate-600 dark:text-slate-300">
                          {item.occupiedEndCount}/19 ocup. · {item.availableEndCount} livres ·{' '}
                          {item.blockedEndCount} bloq.
                        </td>
                        <td className="py-3 px-3 align-top text-slate-600 dark:text-slate-300">
                          {item.notes || '—'}
                        </td>
                        <td className="py-3 px-3 text-right align-top whitespace-nowrap">
                          {confirmDeleteId === item.id ? (
                            <button
                              type="button"
                              onClick={() => {
                                onDeleteDayClosing(item.id);
                                setConfirmDeleteId(null);
                              }}
                              className="px-2 py-1 text-rose-700 dark:text-rose-200 bg-rose-50 dark:bg-rose-950 hover:bg-rose-100 dark:hover:bg-rose-900 font-medium rounded transition-colors"
                            >
                              Confirmar
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(item.id)}
                              title="Remover registro"
                              aria-label={`Remover fechamento do dia ${formatDateShortBR(item.businessDate)}`}
                              className="p-1 text-slate-400 dark:text-slate-500 hover:text-rose-700 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded transition-colors"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 py-12 px-6 text-center">
                <p className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
                  Nenhum dia fechado ainda
                </p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  Ao confirmar o fechamento diário, o resumo de check-outs, check-ins e receita ficará salvo aqui.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
