import { FormEvent, useEffect, useState } from 'react';
import { Check, Copy, LogOut, X } from 'lucide-react';
import {
  calculateNights,
  formatCurrencyBRL,
  parseDecimalInput,
} from '../data/initialChalets';
import {
  CategoryRates,
  Chalet,
  CheckoutRecord,
  PaymentMethod,
} from '../types/chalet';

interface CheckoutModalProps {
  chalet: Chalet;
  rates: CategoryRates;
  onClose: () => void;
  onConfirmCheckout: (record: CheckoutRecord) => void;
}

const PAYMENT_METHODS: PaymentMethod[] = [
  PaymentMethod.PIX,
  PaymentMethod.CARTAO,
  PaymentMethod.DINHEIRO,
  PaymentMethod.TRANSFERENCIA,
];

export function CheckoutModal({
  chalet,
  rates,
  onClose,
  onConfirmCheckout,
}: CheckoutModalProps) {
  const defaultNights = calculateNights(chalet.checkIn, chalet.checkOut);
  const [nights, setNights] = useState(String(defaultNights));
  const [dailyRate, setDailyRate] = useState(
    String(chalet.dailyRate ?? rates[chalet.category]),
  );
  const [extrasAmount, setExtrasAmount] = useState(String(chalet.extrasAmount ?? 0));
  const [extrasNote, setExtrasNote] = useState(chalet.extrasNote ?? '');
  const [paidAmount, setPaidAmount] = useState(String(chalet.paidAmount ?? 0));
  const [notes, setNotes] = useState(chalet.notes ?? '');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.PIX);
  const [copiedReceipt, setCopiedReceipt] = useState(false);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const parsedNights = Math.max(1, Number(nights) || 1);
  const parsedRate = parseDecimalInput(dailyRate);
  const parsedExtras = parseDecimalInput(extrasAmount);
  const parsedPaid = parseDecimalInput(paidAmount);

  const lodgingTotal = parsedNights * parsedRate;
  const totalAmount = lodgingTotal + parsedExtras;
  const balanceDue = Math.max(0, totalAmount - parsedPaid);

  const handleCopyReceipt = async () => {
    const lines = [
      `Pousada Vale do Ermitão — Recibo de Check-out`,
      `${chalet.label} (${chalet.category})`,
      `Hóspede: ${chalet.guestName ?? 'Não informado'}`,
      `Diárias: ${parsedNights}x ${formatCurrencyBRL(parsedRate)} = ${formatCurrencyBRL(lodgingTotal)}`,
      ...(parsedExtras > 0
        ? [
            `Consumo/Extras${extrasNote.trim() ? ` (${extrasNote.trim()})` : ''}: ${formatCurrencyBRL(parsedExtras)}`,
          ]
        : []),
      `Total da estadia: ${formatCurrencyBRL(totalAmount)}`,
      ...(parsedPaid > 0 ? [`Já pago/Sinal: -${formatCurrencyBRL(parsedPaid)}`] : []),
      `Saldo no Check-out (${paymentMethod}): ${formatCurrencyBRL(balanceDue)}`,
    ];

    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopiedReceipt(true);
      window.setTimeout(() => setCopiedReceipt(false), 2000);
    } catch {
      // Clipboard unavailable
    }
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const record: CheckoutRecord = {
      id: `${chalet.id}-${Date.now()}`,
      chaletId: chalet.id,
      chaletCode: chalet.code,
      chaletLabel: chalet.label,
      category: chalet.category,
      guestName: chalet.guestName ?? 'Hóspede',
      guestCount: chalet.guestCount ?? 1,
      checkIn: chalet.checkIn,
      checkOut: chalet.checkOut || new Date().toISOString().slice(0, 10),
      nights: parsedNights,
      dailyRate: parsedRate,
      lodgingTotal,
      extrasAmount: parsedExtras,
      extrasNote: extrasNote.trim() || undefined,
      totalAmount,
      paidBefore: parsedPaid,
      finalCharged: balanceDue,
      paymentMethod,
      notes: notes.trim() || undefined,
      closedAt: new Date().toISOString(),
    };
    onConfirmCheckout(record);
  };

  const inputClass =
    'w-full h-10 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-slate-900 dark:focus:border-slate-300 focus:outline-none';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 dark:bg-slate-950/75 p-4 overflow-y-auto"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="checkout-modal-title"
    >
      <div className="w-full max-w-lg rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6 my-auto">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Fechamento de conta · {chalet.label} ({chalet.category})
            </p>
            <h2
              id="checkout-modal-title"
              className="font-display text-xl font-bold text-slate-900 dark:text-slate-100 mt-0.5"
            >
              Check-out — {chalet.guestName ?? 'Hóspede'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="flex h-10 w-10 items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="checkout-nights"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Quantidade de diárias
              </label>
              <input
                id="checkout-nights"
                type="number"
                min={1}
                max={90}
                value={nights}
                onChange={(e) => setNights(e.target.value)}
                className={`${inputClass} font-mono tabular-nums`}
              />
            </div>
            <div>
              <label
                htmlFor="checkout-rate"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Valor da diária (R$)
              </label>
              <input
                id="checkout-rate"
                type="text"
                inputMode="decimal"
                value={dailyRate}
                onChange={(e) => setDailyRate(e.target.value)}
                placeholder="0,00"
                className={`${inputClass} font-mono tabular-nums`}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="checkout-extras"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Consumo / Extras (R$)
              </label>
              <input
                id="checkout-extras"
                type="text"
                inputMode="decimal"
                value={extrasAmount}
                onChange={(e) => setExtrasAmount(e.target.value)}
                placeholder="0,00"
                className={`${inputClass} font-mono tabular-nums`}
              />
            </div>
            <div>
              <label
                htmlFor="checkout-paid"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Sinal / Já pago (R$)
              </label>
              <input
                id="checkout-paid"
                type="text"
                inputMode="decimal"
                value={paidAmount}
                onChange={(e) => setPaidAmount(e.target.value)}
                placeholder="0,00"
                className={`${inputClass} font-mono tabular-nums`}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="checkout-extras-note"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Descrição do consumo (opcional)
              </label>
              <input
                id="checkout-extras-note"
                type="text"
                value={extrasNote}
                onChange={(e) => setExtrasNote(e.target.value)}
                placeholder="Ex.: Frigobar, bebidas, passeio..."
                className={inputClass}
              />
            </div>
            <div>
              <label
                htmlFor="checkout-notes"
                className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
              >
                Observação do fechamento (opcional)
              </label>
              <input
                id="checkout-notes"
                type="text"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex.: Nota fiscal emitida, desconto..."
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <span className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5">
              Forma de pagamento do saldo
            </span>
            <div className="grid grid-cols-4 gap-2">
              {PAYMENT_METHODS.map((method) => (
                <button
                  key={method}
                  type="button"
                  onClick={() => setPaymentMethod(method)}
                  className={`h-9 px-2 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap ${
                    paymentMethod === method
                      ? 'border-slate-900 dark:border-slate-100 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-950'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                  }`}
                >
                  {method}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 p-4 space-y-2 text-sm">
            <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
              <span>
                Hospedagem ({parsedNights} {parsedNights === 1 ? 'diária' : 'diárias'})
              </span>
              <span className="font-mono tabular-nums">{formatCurrencyBRL(lodgingTotal)}</span>
            </div>
            <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
              <span>Consumo / Extras</span>
              <span className="font-mono tabular-nums">{formatCurrencyBRL(parsedExtras)}</span>
            </div>
            <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
              <span>Já pago / Sinal</span>
              <span className="font-mono tabular-nums text-emerald-700 dark:text-emerald-400">
                - {formatCurrencyBRL(parsedPaid)}
              </span>
            </div>
            <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-800 pt-2.5 text-base font-bold text-slate-900 dark:text-slate-100">
              <span>Saldo a receber</span>
              <span className="font-mono text-lg tabular-nums">
                {formatCurrencyBRL(balanceDue)}
              </span>
            </div>
          </div>

          <p className="text-xs text-slate-500 dark:text-slate-400">
            Ao confirmar o check-out, a acomodação entra em status <strong className="text-amber-800 dark:text-amber-300">Bloqueado (Em limpeza)</strong> até ser liberada.
          </p>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-800 pt-4">
            <button
              type="button"
              onClick={handleCopyReceipt}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap"
            >
              {copiedReceipt ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
                  <span>Recibo copiado</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                  <span>Copiar recibo</span>
                </>
              )}
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-emerald-700 dark:bg-emerald-600 rounded-lg hover:bg-emerald-800 dark:hover:bg-emerald-500 transition-colors whitespace-nowrap"
              >
                <LogOut className="h-4 w-4" aria-hidden="true" />
                <span>Confirmar Check-out</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
