import { FormEvent, useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { parseDecimalInput } from '../data/initialChalets';
import { CategoryRates, ChaletCategory } from '../types/chalet';

interface RatesModalProps {
  rates: CategoryRates;
  onClose: () => void;
  onSave: (updatedRates: CategoryRates) => void;
}

const CATEGORY_INFO: Array<{
  category: ChaletCategory;
  label: string;
  units: string;
}> = [
  { category: ChaletCategory.STAND, label: 'Stand', units: 'Chalés 01 ao 11 (11 unidades)' },
  { category: ChaletCategory.ERMITAO, label: 'Ermitão', units: 'Chalés 12 ao 17 (6 unidades)' },
  { category: ChaletCategory.HIDRO, label: 'Hidro', units: 'Chalé 18 (1 unidade)' },
  { category: ChaletCategory.CASA, label: 'Casa', units: 'Acomodação 19 (1 unidade)' },
];

export function RatesModal({ rates, onClose, onSave }: RatesModalProps) {
  const [formRates, setFormRates] = useState<Record<ChaletCategory, string>>({
    [ChaletCategory.STAND]: String(rates[ChaletCategory.STAND]),
    [ChaletCategory.ERMITAO]: String(rates[ChaletCategory.ERMITAO]),
    [ChaletCategory.HIDRO]: String(rates[ChaletCategory.HIDRO]),
    [ChaletCategory.CASA]: String(rates[ChaletCategory.CASA]),
  });

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const parsed: CategoryRates = {
      [ChaletCategory.STAND]: parseDecimalInput(formRates[ChaletCategory.STAND]),
      [ChaletCategory.ERMITAO]: parseDecimalInput(formRates[ChaletCategory.ERMITAO]),
      [ChaletCategory.HIDRO]: parseDecimalInput(formRates[ChaletCategory.HIDRO]),
      [ChaletCategory.CASA]: parseDecimalInput(formRates[ChaletCategory.CASA]),
    };
    onSave(parsed);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 dark:bg-slate-950/75 p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="rates-modal-title"
    >
      <div className="w-full max-w-md rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-6">
        <div className="flex items-start justify-between gap-4 border-b border-slate-100 dark:border-slate-800 pb-4">
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400">
              Tarifário padrão
            </p>
            <h2
              id="rates-modal-title"
              className="font-display text-xl font-bold text-slate-900 dark:text-slate-100 mt-0.5"
            >
              Valores das Diárias
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
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Estes valores são aplicados automaticamente aos novos check-ins de cada categoria.
          </p>

          <div className="space-y-3">
            {CATEGORY_INFO.map((item) => (
              <div
                key={item.category}
                className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950/40 px-3.5 py-2.5"
              >
                <div className="min-w-0">
                  <label
                    htmlFor={`rate-${item.category}`}
                    className="block text-sm font-semibold text-slate-900 dark:text-slate-100"
                  >
                    {item.label}
                  </label>
                  <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {item.units}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    R$
                  </span>
                  <input
                    id={`rate-${item.category}`}
                    type="text"
                    inputMode="decimal"
                    value={formRates[item.category]}
                    onChange={(e) =>
                      setFormRates((prev) => ({
                        ...prev,
                        [item.category]: e.target.value,
                      }))
                    }
                    placeholder="0,00"
                    className="w-24 h-9 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-2.5 text-right text-sm font-mono font-medium text-slate-900 dark:text-slate-100 tabular-nums focus:border-slate-900 dark:focus:border-slate-300 focus:outline-none"
                  />
                </div>
              </div>
            ))}
          </div>

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
              className="px-4 py-2 text-sm font-medium text-white dark:text-slate-950 bg-slate-900 dark:bg-slate-100 rounded-lg hover:bg-slate-800 dark:hover:bg-white transition-colors"
            >
              Salvar valores
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
