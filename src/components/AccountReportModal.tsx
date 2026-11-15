import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  Printer,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { formatCurrencyBRL } from '../data/initialChalets';
import { CheckoutRecord, PaymentMethod } from '../types/chalet';

interface AccountReportModalProps {
  records: CheckoutRecord[];
  onClose: () => void;
  onDeleteRecord: (id: string) => void;
}

type PeriodFilter = 'hoje' | '7dias' | 'mes' | 'todos';

const PAYMENT_FILTERS: Array<'Todas' | PaymentMethod> = [
  'Todas',
  PaymentMethod.PIX,
  PaymentMethod.CARTAO,
  PaymentMethod.DINHEIRO,
  PaymentMethod.TRANSFERENCIA,
];

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

function formatDateShortBR(dateStr?: string): string {
  if (!dateStr) return '—';
  const [year, month, day] = dateStr.split('-');
  if (!year || !month || !day) return dateStr;
  return `${day}/${month}/${year.slice(2)}`;
}

function escapeCsvCell(value: string | number | undefined): string {
  const str = String(value ?? '');
  if (/[;"\n\r,]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function AccountReportModal({
  records,
  onClose,
  onDeleteRecord,
}: AccountReportModalProps) {
  const [period, setPeriod] = useState<PeriodFilter>('todos');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<'Todas' | PaymentMethod>('Todas');
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedReport, setCopiedReport] = useState(false);
  const [copiedRowId, setCopiedRowId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const filteredRecords = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const sevenDaysAgo = todayStart - 6 * 24 * 60 * 60 * 1000;
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const query = searchQuery.trim().toLowerCase();

    return records.filter((rec) => {
      const closedTime = new Date(rec.closedAt).getTime();

      if (period === 'hoje' && closedTime < todayStart) return false;
      if (period === '7dias' && closedTime < sevenDaysAgo) return false;
      if (period === 'mes' && closedTime < monthStart) return false;

      if (dateFrom) {
        const fromTime = new Date(`${dateFrom}T00:00:00`).getTime();
        if (closedTime < fromTime) return false;
      }
      if (dateTo) {
        const toTime = new Date(`${dateTo}T23:59:59.999`).getTime();
        if (closedTime > toTime) return false;
      }

      if (paymentFilter !== 'Todas' && rec.paymentMethod !== paymentFilter) {
        return false;
      }

      if (query) {
        const haystack = [
          rec.chaletLabel,
          rec.chaletCode ?? '',
          rec.category,
          rec.guestName,
          rec.extrasNote ?? '',
          rec.notes ?? '',
          rec.paymentMethod,
        ]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(query)) return false;
      }

      return true;
    });
  }, [records, period, dateFrom, dateTo, paymentFilter, searchQuery]);

  const summary = useMemo(() => {
    const initialByMethod: Record<PaymentMethod, number> = {
      [PaymentMethod.PIX]: 0,
      [PaymentMethod.CARTAO]: 0,
      [PaymentMethod.DINHEIRO]: 0,
      [PaymentMethod.TRANSFERENCIA]: 0,
    };

    return filteredRecords.reduce(
      (acc, rec) => {
        const lodging = rec.lodgingTotal ?? rec.nights * rec.dailyRate;
        acc.count += 1;
        acc.nights += rec.nights;
        acc.lodging += lodging;
        acc.extras += rec.extrasAmount;
        acc.paidBefore += rec.paidBefore;
        acc.finalCharged += rec.finalCharged;
        acc.total += rec.totalAmount;
        acc.byMethod[rec.paymentMethod] =
          (acc.byMethod[rec.paymentMethod] ?? 0) + rec.finalCharged;
        return acc;
      },
      {
        count: 0,
        nights: 0,
        lodging: 0,
        extras: 0,
        paidBefore: 0,
        finalCharged: 0,
        total: 0,
        byMethod: initialByMethod,
      },
    );
  }, [filteredRecords]);

  const handleCopyFullReport = async () => {
    const lines = [
      `Pousada Vale do Ermitão — Relatório de Fechamento de Conta`,
      `Emitido em: ${formatDateTimeBR(new Date().toISOString())}`,
      `Contas fechadas: ${summary.count} (${summary.nights} diárias)`,
      `Subtotal hospedagem: ${formatCurrencyBRL(summary.lodging)}`,
      `Subtotal consumo/extras: ${formatCurrencyBRL(summary.extras)}`,
      `Total geral das contas: ${formatCurrencyBRL(summary.total)}`,
      `Sinais recebidos antes: ${formatCurrencyBRL(summary.paidBefore)}`,
      `Recebido no check-out: ${formatCurrencyBRL(summary.finalCharged)}`,
      `Por forma de pagamento (check-out): Pix ${formatCurrencyBRL(summary.byMethod[PaymentMethod.PIX])} | Cartão ${formatCurrencyBRL(summary.byMethod[PaymentMethod.CARTAO])} | Dinheiro ${formatCurrencyBRL(summary.byMethod[PaymentMethod.DINHEIRO])} | Transferência ${formatCurrencyBRL(summary.byMethod[PaymentMethod.TRANSFERENCIA])}`,
      '',
      'Detalhamento:',
      ...filteredRecords.map((rec) => {
        const lodging = rec.lodgingTotal ?? rec.nights * rec.dailyRate;
        const periodInfo =
          rec.checkIn || rec.checkOut
            ? ` (${formatDateShortBR(rec.checkIn)} a ${formatDateShortBR(rec.checkOut)})`
            : '';
        return [
          `• ${formatDateTimeBR(rec.closedAt)} — ${rec.chaletLabel} (${rec.category}) — ${rec.guestName}${periodInfo}`,
          `  Diárias: ${rec.nights}x ${formatCurrencyBRL(rec.dailyRate)} = ${formatCurrencyBRL(lodging)} | Extras: ${formatCurrencyBRL(rec.extrasAmount)}${rec.extrasNote ? ` (${rec.extrasNote})` : ''}`,
          `  Total: ${formatCurrencyBRL(rec.totalAmount)} | Sinal: ${formatCurrencyBRL(rec.paidBefore)} | Pago no check-out: ${formatCurrencyBRL(rec.finalCharged)} (${rec.paymentMethod})${rec.notes ? ` | Obs.: ${rec.notes}` : ''}`,
        ].join('\n');
      }),
    ];

    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopiedReport(true);
      window.setTimeout(() => setCopiedReport(false), 2000);
    } catch {
      // Clipboard API unavailable
    }
  };

  const handleCopySingleReceipt = async (rec: CheckoutRecord) => {
    const lodging = rec.lodgingTotal ?? rec.nights * rec.dailyRate;
    const lines = [
      `Pousada Vale do Ermitão — Comprovante de Fechamento`,
      `Data do fechamento: ${formatDateTimeBR(rec.closedAt)}`,
      `Acomodação: ${rec.chaletLabel} (${rec.category})`,
      `Hóspede: ${rec.guestName} (${rec.guestCount ?? 1} ${(rec.guestCount ?? 1) === 1 ? 'hóspede' : 'hóspedes'})`,
      ...(rec.checkIn || rec.checkOut
        ? [`Período: ${formatDateShortBR(rec.checkIn)} a ${formatDateShortBR(rec.checkOut)}`]
        : []),
      `Diárias: ${rec.nights}x ${formatCurrencyBRL(rec.dailyRate)} = ${formatCurrencyBRL(lodging)}`,
      ...(rec.extrasAmount > 0
        ? [
            `Consumo/Extras${rec.extrasNote ? ` (${rec.extrasNote})` : ''}: ${formatCurrencyBRL(rec.extrasAmount)}`,
          ]
        : []),
      `Total da conta: ${formatCurrencyBRL(rec.totalAmount)}`,
      ...(rec.paidBefore > 0 ? [`Sinal / Já pago: -${formatCurrencyBRL(rec.paidBefore)}`] : []),
      `Pago no check-out (${rec.paymentMethod}): ${formatCurrencyBRL(rec.finalCharged)}`,
      ...(rec.notes ? [`Obs.: ${rec.notes}`] : []),
    ];

    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopiedRowId(rec.id);
      window.setTimeout(() => setCopiedRowId(null), 2000);
    } catch {
      // Clipboard API unavailable
    }
  };

  const handleExportCsv = () => {
    const headers = [
      'Data/Hora Fechamento',
      'Acomodação',
      'Categoria',
      'Hóspede',
      'Qtd Hóspedes',
      'Check-in',
      'Check-out',
      'Diárias',
      'Valor Diária (R$)',
      'Subtotal Hospedagem (R$)',
      'Consumo/Extras (R$)',
      'Descrição Consumo',
      'Total da Conta (R$)',
      'Sinal / Já Pago (R$)',
      'Pago no Check-out (R$)',
      'Forma de Pagamento',
      'Observações',
    ];

    const rows = filteredRecords.map((rec) => {
      const lodging = rec.lodgingTotal ?? rec.nights * rec.dailyRate;
      return [
        formatDateTimeBR(rec.closedAt),
        rec.chaletLabel,
        rec.category,
        rec.guestName,
        rec.guestCount ?? 1,
        formatDateShortBR(rec.checkIn),
        formatDateShortBR(rec.checkOut),
        rec.nights,
        rec.dailyRate.toFixed(2).replace('.', ','),
        lodging.toFixed(2).replace('.', ','),
        rec.extrasAmount.toFixed(2).replace('.', ','),
        rec.extrasNote ?? '',
        rec.totalAmount.toFixed(2).replace('.', ','),
        rec.paidBefore.toFixed(2).replace('.', ','),
        rec.finalCharged.toFixed(2).replace('.', ','),
        rec.paymentMethod,
        rec.notes ?? '',
      ]
        .map(escapeCsvCell)
        .join(';');
    });

    const csvContent = '\uFEFF' + [headers.map(escapeCsvCell).join(';'), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `relatorio-fechamento-pve-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 dark:bg-slate-950/75 p-2 sm:p-4 print:static print:bg-white print:p-0"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="report-modal-title"
    >
      <div className="print-report-root flex flex-col w-full max-w-6xl max-h-[92vh] rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden print:max-h-none print:border-0">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 px-6 py-4">
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Pousada Vale do Ermitão · Conferência financeira
            </p>
            <h2
              id="report-modal-title"
              className="font-display text-xl font-bold text-slate-900 dark:text-slate-100 mt-0.5"
            >
              Relatório de Fechamento de Conta
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <button
              type="button"
              onClick={handleCopyFullReport}
              disabled={filteredRecords.length === 0}
              className="inline-flex items-center gap-1.5 h-9 px-3 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap"
            >
              {copiedReport ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
                  <span>Relatório copiado</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Copiar relatório</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleExportCsv}
              disabled={filteredRecords.length === 0}
              className="inline-flex items-center gap-1.5 h-9 px-3 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Exportar CSV</span>
            </button>

            <button
              type="button"
              onClick={handlePrint}
              disabled={filteredRecords.length === 0}
              className="inline-flex items-center gap-1.5 h-9 px-3 text-xs font-medium text-white dark:text-slate-950 bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap"
            >
              <Printer className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Imprimir</span>
            </button>

            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar relatório"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5 print:overflow-visible">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 pb-4 border-b border-slate-100 dark:border-slate-800 print:hidden">
            <div className="flex flex-wrap items-center gap-2">
              <div
                className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg"
                role="group"
                aria-label="Período"
              >
                {(
                  [
                    { key: 'hoje', label: 'Hoje' },
                    { key: '7dias', label: '7 dias' },
                    { key: 'mes', label: 'Este mês' },
                    { key: 'todos', label: 'Tudo' },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => {
                      setPeriod(item.key);
                      setDateFrom('');
                      setDateTo('');
                    }}
                    className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                      period === item.key && !dateFrom && !dateTo
                        ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 shadow-sm'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <input
                  type="date"
                  aria-label="Data inicial"
                  value={dateFrom}
                  onChange={(e) => {
                    setDateFrom(e.target.value);
                    setPeriod('todos');
                  }}
                  className="h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 text-xs text-slate-900 dark:text-slate-100 tabular-nums focus:border-slate-900 dark:focus:border-slate-300 focus:outline-none"
                />
                <span>até</span>
                <input
                  type="date"
                  aria-label="Data final"
                  value={dateTo}
                  onChange={(e) => {
                    setDateTo(e.target.value);
                    setPeriod('todos');
                  }}
                  className="h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 text-xs text-slate-900 dark:text-slate-100 tabular-nums focus:border-slate-900 dark:focus:border-slate-300 focus:outline-none"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                aria-label="Filtrar por forma de pagamento"
                value={paymentFilter}
                onChange={(e) => setPaymentFilter(e.target.value as 'Todas' | PaymentMethod)}
                className="h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-xs font-medium text-slate-700 dark:text-slate-200 focus:border-slate-900 dark:focus:border-slate-300 focus:outline-none"
              >
                {PAYMENT_FILTERS.map((method) => (
                  <option key={method} value={method}>
                    {method === 'Todas' ? 'Pagamento: Todos' : method}
                  </option>
                ))}
              </select>

              <div className="relative w-full sm:w-56">
                <Search
                  className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 dark:text-slate-500"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar hóspede ou chalé..."
                  aria-label="Buscar hóspede ou chalé no relatório"
                  className="w-full h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 pl-8 pr-3 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-slate-900 dark:focus:border-slate-300 focus:outline-none"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 p-4">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Contas Fechadas
              </p>
              <p className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums mt-1">
                {summary.count}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums mt-0.5">
                {summary.nights} {summary.nights === 1 ? 'diária' : 'diárias'} no total
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 p-4">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Subtotal Hospedagem
              </p>
              <p className="font-mono text-xl font-bold text-slate-900 dark:text-slate-100 tabular-nums mt-1">
                {formatCurrencyBRL(summary.lodging)}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums mt-0.5">
                Diárias cobradas
              </p>
            </div>

            <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 p-4">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
                Consumo / Extras
              </p>
              <p className="font-mono text-xl font-bold text-slate-900 dark:text-slate-100 tabular-nums mt-1">
                {formatCurrencyBRL(summary.extras)}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums mt-0.5">
                Frigobar e adicionais
              </p>
            </div>

            <div className="rounded-xl border border-emerald-200 dark:border-emerald-800/80 bg-emerald-50/60 dark:bg-emerald-950/45 p-4">
              <p className="text-xs font-medium text-emerald-900 dark:text-emerald-200">
                Faturamento Total
              </p>
              <p className="font-mono text-xl font-bold text-emerald-950 dark:text-emerald-100 tabular-nums mt-1">
                {formatCurrencyBRL(summary.total)}
              </p>
              <p className="text-xs text-emerald-800 dark:text-emerald-300 tabular-nums mt-0.5">
                Sinais: {formatCurrencyBRL(summary.paidBefore)} · No check-out:{' '}
                {formatCurrencyBRL(summary.finalCharged)}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/50 px-4 py-3 text-xs">
            {(
              [
                PaymentMethod.PIX,
                PaymentMethod.CARTAO,
                PaymentMethod.DINHEIRO,
                PaymentMethod.TRANSFERENCIA,
              ] as const
            ).map((method) => (
              <div key={method} className="flex items-center justify-between gap-2">
                <span className="text-slate-500 dark:text-slate-400">Check-out em {method}</span>
                <span className="font-mono font-semibold text-slate-900 dark:text-slate-100 tabular-nums">
                  {formatCurrencyBRL(summary.byMethod[method])}
                </span>
              </div>
            ))}
          </div>

          {filteredRecords.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300">
                    <th className="py-2.5 px-3 font-semibold whitespace-nowrap">Fechamento</th>
                    <th className="py-2.5 px-3 font-semibold whitespace-nowrap">Acomodação</th>
                    <th className="py-2.5 px-3 font-semibold whitespace-nowrap">Hóspede / Período</th>
                    <th className="py-2.5 px-3 font-semibold text-right whitespace-nowrap">Hospedagem</th>
                    <th className="py-2.5 px-3 font-semibold text-right whitespace-nowrap">Consumo</th>
                    <th className="py-2.5 px-3 font-semibold text-right whitespace-nowrap">Sinal pago</th>
                    <th className="py-2.5 px-3 font-semibold text-right whitespace-nowrap">Check-out</th>
                    <th className="py-2.5 px-3 font-semibold text-right whitespace-nowrap">Total conta</th>
                    <th className="py-2.5 px-3 font-semibold text-right whitespace-nowrap print:hidden">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredRecords.map((rec) => {
                    const lodging = rec.lodgingTotal ?? rec.nights * rec.dailyRate;
                    return (
                      <tr
                        key={rec.id}
                        className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                      >
                        <td className="py-3 px-3 font-mono text-slate-600 dark:text-slate-300 tabular-nums whitespace-nowrap align-top">
                          {formatDateTimeBR(rec.closedAt)}
                        </td>
                        <td className="py-3 px-3 align-top whitespace-nowrap">
                          <div className="font-semibold text-slate-900 dark:text-slate-100">
                            {rec.chaletLabel}
                          </div>
                          <div className="text-slate-500 dark:text-slate-400">{rec.category}</div>
                        </td>
                        <td className="py-3 px-3 align-top">
                          <div className="font-medium text-slate-900 dark:text-slate-100">
                            {rec.guestName}
                            {rec.guestCount ? (
                              <span className="text-slate-500 dark:text-slate-400 font-normal">
                                {' '}· {rec.guestCount} hósp.
                              </span>
                            ) : null}
                          </div>
                          {(rec.checkIn || rec.checkOut) && (
                            <div className="text-slate-500 dark:text-slate-400 tabular-nums">
                              {formatDateShortBR(rec.checkIn)} → {formatDateShortBR(rec.checkOut)}
                            </div>
                          )}
                          {rec.notes && (
                            <div className="text-slate-500 dark:text-slate-400 mt-0.5">
                              Obs.: {rec.notes}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right align-top whitespace-nowrap">
                          <div className="font-mono font-medium text-slate-900 dark:text-slate-100 tabular-nums">
                            {formatCurrencyBRL(lodging)}
                          </div>
                          <div className="text-slate-500 dark:text-slate-400 tabular-nums">
                            {rec.nights}x {formatCurrencyBRL(rec.dailyRate)}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right align-top">
                          <div className="font-mono text-slate-900 dark:text-slate-100 tabular-nums whitespace-nowrap">
                            {formatCurrencyBRL(rec.extrasAmount)}
                          </div>
                          {rec.extrasNote && (
                            <div
                              className="text-slate-500 dark:text-slate-400 max-w-[160px] ml-auto truncate"
                              title={rec.extrasNote}
                            >
                              {rec.extrasNote}
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-slate-600 dark:text-slate-300 tabular-nums whitespace-nowrap align-top">
                          {formatCurrencyBRL(rec.paidBefore)}
                        </td>
                        <td className="py-3 px-3 text-right align-top whitespace-nowrap">
                          <div className="font-mono font-medium text-emerald-800 dark:text-emerald-300 tabular-nums">
                            {formatCurrencyBRL(rec.finalCharged)}
                          </div>
                          <div className="text-slate-500 dark:text-slate-400">
                            {rec.paymentMethod}
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-slate-900 dark:text-slate-100 tabular-nums whitespace-nowrap align-top">
                          {formatCurrencyBRL(rec.totalAmount)}
                        </td>
                        <td className="py-3 px-3 text-right align-top whitespace-nowrap print:hidden">
                          <div className="inline-flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => handleCopySingleReceipt(rec)}
                              title="Copiar comprovante"
                              className="inline-flex items-center gap-1 px-2 py-1 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                            >
                              {copiedRowId === rec.id ? (
                                <Check className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                              <span>{copiedRowId === rec.id ? 'Copiado' : 'Recibo'}</span>
                            </button>

                            {confirmDeleteId === rec.id ? (
                              <button
                                type="button"
                                onClick={() => {
                                  onDeleteRecord(rec.id);
                                  setConfirmDeleteId(null);
                                }}
                                className="px-2 py-1 text-rose-700 dark:text-rose-200 bg-rose-50 dark:bg-rose-950 hover:bg-rose-100 dark:hover:bg-rose-900 font-medium rounded transition-colors"
                              >
                                Confirmar
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(rec.id)}
                                title="Remover registro"
                                aria-label={`Remover fechamento de ${rec.guestName}`}
                                className="p-1 text-slate-400 dark:text-slate-500 hover:text-rose-700 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded transition-colors"
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
              <p className="font-display text-base font-semibold text-slate-900 dark:text-slate-100">
                Nenhum fechamento encontrado
              </p>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                {records.length === 0
                  ? 'Os fechamentos aparecerão aqui automaticamente assim que um check-out for confirmado.'
                  : 'Nenhum fechamento corresponde aos filtros selecionados.'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
