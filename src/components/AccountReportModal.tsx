import { useEffect, useMemo, useState } from 'react';
import {
  FileDown,
  Printer,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCurrencyBRL } from '../data/initialChalets';
import { CheckoutRecord, PaymentMethod } from '../types/chalet';

interface AccountReportModalProps {
  records: CheckoutRecord[];
  businessDate?: string;
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

export function AccountReportModal({
  records,
  businessDate,
  onClose,
  onDeleteRecord,
}: AccountReportModalProps) {
  const [period, setPeriod] = useState<PeriodFilter>('todos');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [paymentFilter, setPaymentFilter] = useState<'Todas' | PaymentMethod>('Todas');
  const [searchQuery, setSearchQuery] = useState('');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const filteredRecords = useMemo(() => {
    const refDate = businessDate ? new Date(`${businessDate}T12:00:00`) : new Date();
    const todayStart = new Date(
      refDate.getFullYear(),
      refDate.getMonth(),
      refDate.getDate(),
    ).getTime();
    const sevenDaysAgo = todayStart - 6 * 24 * 60 * 60 * 1000;
    const monthStart = new Date(refDate.getFullYear(), refDate.getMonth(), 1).getTime();
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

  const handleDownloadPdf = () => {
    if (filteredRecords.length === 0) return;

    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'mm',
      format: 'a4',
    });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginX = 14;
    const usableWidth = pageWidth - marginX * 2;

    const periodLabels: Record<PeriodFilter, string> = {
      hoje: 'Hoje',
      '7dias': 'Últimos 7 dias',
      mes: 'Este mês',
      todos: 'Todo o período',
    };
    const activePeriodText =
      dateFrom || dateTo
        ? `${dateFrom ? formatDateShortBR(dateFrom) : '...'} até ${dateTo ? formatDateShortBR(dateTo) : '...'}`
        : periodLabels[period];

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(15);
    doc.setTextColor(15, 23, 42);
    doc.text('Pousada Vale do Ermitão — Relatório de Fechamento de Conta', marginX, 16);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    const filterLine = [
      `Emitido em: ${formatDateTimeBR(new Date().toISOString())}`,
      `Período: ${activePeriodText}`,
      `Pagamento: ${paymentFilter}`,
      ...(searchQuery.trim() ? [`Busca: "${searchQuery.trim()}"`] : []),
    ].join('   |   ');
    doc.text(filterLine, marginX, 22);

    const boxGap = 4;
    const boxWidth = (usableWidth - boxGap * 3) / 4;
    const boxY = 27;
    const boxHeight = 18;

    const kpiBoxes = [
      {
        label: 'Contas Fechadas',
        value: String(summary.count),
        sub: `${summary.nights} ${summary.nights === 1 ? 'diária' : 'diárias'} no total`,
        highlight: false,
      },
      {
        label: 'Subtotal Hospedagem',
        value: formatCurrencyBRL(summary.lodging),
        sub: 'Diárias cobradas',
        highlight: false,
      },
      {
        label: 'Consumo / Extras',
        value: formatCurrencyBRL(summary.extras),
        sub: 'Frigobar e adicionais',
        highlight: false,
      },
      {
        label: 'Faturamento Total',
        value: formatCurrencyBRL(summary.total),
        sub: `Sinais: ${formatCurrencyBRL(summary.paidBefore)} | Check-out: ${formatCurrencyBRL(summary.finalCharged)}`,
        highlight: true,
      },
    ];

    kpiBoxes.forEach((box, idx) => {
      const x = marginX + idx * (boxWidth + boxGap);
      if (box.highlight) {
        doc.setFillColor(236, 253, 245);
        doc.setDrawColor(167, 243, 208);
      } else {
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
      }
      doc.roundedRect(x, boxY, boxWidth, boxHeight, 2, 2, 'FD');

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(box.highlight ? 6 : 100, box.highlight ? 78 : 116, box.highlight ? 59 : 139);
      doc.text(box.label, x + 3, boxY + 5);

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(box.highlight ? 6 : 15, box.highlight ? 78 : 23, box.highlight ? 59 : 42);
      doc.text(box.value, x + 3, boxY + 11.2);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(box.highlight ? 4 : 100, box.highlight ? 120 : 116, box.highlight ? 87 : 139);
      doc.text(box.sub, x + 3, boxY + 15.8, { maxWidth: boxWidth - 6 });
    });

    const methodY = boxY + boxHeight + 4;
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(marginX, methodY, usableWidth, 9, 1.5, 1.5, 'FD');

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(51, 65, 85);
    const paymentSummaryText = [
      `Check-out por forma de pagamento:`,
      `Pix: ${formatCurrencyBRL(summary.byMethod[PaymentMethod.PIX])}`,
      `Cartão: ${formatCurrencyBRL(summary.byMethod[PaymentMethod.CARTAO])}`,
      `Dinheiro: ${formatCurrencyBRL(summary.byMethod[PaymentMethod.DINHEIRO])}`,
      `Transferência: ${formatCurrencyBRL(summary.byMethod[PaymentMethod.TRANSFERENCIA])}`,
    ].join('   |   ');
    doc.text(paymentSummaryText, marginX + 3, methodY + 5.8);

    const tableRows = filteredRecords.map((rec) => {
      const lodging = rec.lodgingTotal ?? rec.nights * rec.dailyRate;
      const guestLines = [
        `${rec.guestName}${rec.guestCount ? ` (${rec.guestCount} hósp.)` : ''}`,
        ...(rec.checkIn || rec.checkOut
          ? [`${formatDateShortBR(rec.checkIn)} a ${formatDateShortBR(rec.checkOut)}`]
          : []),
        ...(rec.notes ? [`Obs.: ${rec.notes}`] : []),
      ];

      return [
        formatDateTimeBR(rec.closedAt),
        `${rec.chaletLabel}\n${rec.category}`,
        guestLines.join('\n'),
        `${formatCurrencyBRL(lodging)}\n(${rec.nights}x ${formatCurrencyBRL(rec.dailyRate)})`,
        rec.extrasNote
          ? `${formatCurrencyBRL(rec.extrasAmount)}\n${rec.extrasNote}`
          : formatCurrencyBRL(rec.extrasAmount),
        formatCurrencyBRL(rec.paidBefore),
        `${formatCurrencyBRL(rec.finalCharged)}\n(${rec.paymentMethod})`,
        formatCurrencyBRL(rec.totalAmount),
      ];
    });

    autoTable(doc, {
      startY: methodY + 13,
      margin: { left: marginX, right: marginX, bottom: 16 },
      head: [
        [
          'Fechamento',
          'Acomodação',
          'Hóspede / Período / Obs.',
          'Hospedagem',
          'Consumo / Extras',
          'Sinal pago',
          'Check-out',
          'Total conta',
        ],
      ],
      body: tableRows,
      foot: [
        [
          'TOTAL GERAL',
          `${summary.count} ${summary.count === 1 ? 'conta' : 'contas'}`,
          `${summary.nights} ${summary.nights === 1 ? 'diária' : 'diárias'}`,
          formatCurrencyBRL(summary.lodging),
          formatCurrencyBRL(summary.extras),
          formatCurrencyBRL(summary.paidBefore),
          formatCurrencyBRL(summary.finalCharged),
          formatCurrencyBRL(summary.total),
        ],
      ],
      theme: 'grid',
      styles: {
        font: 'helvetica',
        fontSize: 8,
        cellPadding: 2.5,
        textColor: [30, 41, 59],
        lineColor: [226, 232, 240],
        lineWidth: 0.2,
        valign: 'top',
      },
      headStyles: {
        fillColor: [15, 23, 42],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        halign: 'left',
      },
      footStyles: {
        fillColor: [241, 245, 249],
        textColor: [15, 23, 42],
        fontStyle: 'bold',
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252],
      },
      columnStyles: {
        0: { cellWidth: 27 },
        1: { cellWidth: 28 },
        2: { cellWidth: 70 },
        3: { cellWidth: 32, halign: 'right' },
        4: { cellWidth: 34, halign: 'right' },
        5: { cellWidth: 24, halign: 'right' },
        6: { cellWidth: 28, halign: 'right' },
        7: { cellWidth: 26, halign: 'right', fontStyle: 'bold' },
      },
      didParseCell: (data) => {
        if (data.section === 'head' || data.section === 'foot') {
          if (data.column.index >= 3) {
            data.cell.styles.halign = 'right';
          }
        }
      },
    });

    const totalPages = doc.getNumberOfPages();
    for (let page = 1; page <= totalPages; page++) {
      doc.setPage(page);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text('Pousada Vale do Ermitão — Conferência financeira', marginX, pageHeight - 7);
      doc.text(
        `Página ${page} de ${totalPages}`,
        pageWidth - marginX,
        pageHeight - 7,
        { align: 'right' },
      );
    }

    doc.save(`relatorio-fechamento-pve-${new Date().toISOString().slice(0, 10)}.pdf`);
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
              onClick={handleDownloadPdf}
              disabled={filteredRecords.length === 0}
              className="inline-flex items-center gap-1.5 h-9 px-3 text-xs font-medium text-slate-700 dark:text-slate-200 bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap"
            >
              <FileDown className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Baixar PDF</span>
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
