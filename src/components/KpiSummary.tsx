import { BedDouble, CheckCircle2, Lock, Users } from 'lucide-react';
import { ChaletStatus, StatusFilter } from '../types/chalet';

interface KpiSummaryProps {
  total: number;
  occupied: number;
  available: number;
  blocked: number;
  activeStatus: StatusFilter;
  onSelectStatus: (status: StatusFilter) => void;
}

export function KpiSummary({
  total,
  occupied,
  available,
  blocked,
  activeStatus,
  onSelectStatus,
}: KpiSummaryProps) {
  const cards: Array<{
    key: StatusFilter;
    label: string;
    value: number;
    icon: typeof BedDouble;
    iconBg: string;
    iconColor: string;
    activeRing: string;
  }> = [
    {
      key: 'Todos',
      label: 'Total de Acomodações',
      value: total,
      icon: BedDouble,
      iconBg: 'bg-slate-100 dark:bg-slate-800',
      iconColor: 'text-slate-700 dark:text-slate-200',
      activeRing: 'border-slate-900 dark:border-slate-200 bg-white dark:bg-slate-900',
    },
    {
      key: ChaletStatus.OCUPADO,
      label: 'Ocupados',
      value: occupied,
      icon: Users,
      iconBg: 'bg-rose-50 dark:bg-rose-950/60',
      iconColor: 'text-rose-700 dark:text-rose-300',
      activeRing: 'border-rose-600 dark:border-rose-500 bg-rose-50/30 dark:bg-rose-950/30',
    },
    {
      key: ChaletStatus.LIVRE,
      label: 'Livres',
      value: available,
      icon: CheckCircle2,
      iconBg: 'bg-emerald-50 dark:bg-emerald-950/60',
      iconColor: 'text-emerald-700 dark:text-emerald-300',
      activeRing: 'border-emerald-600 dark:border-emerald-500 bg-emerald-50/30 dark:bg-emerald-950/30',
    },
    {
      key: ChaletStatus.BLOQUEADO,
      label: 'Bloqueados',
      value: blocked,
      icon: Lock,
      iconBg: 'bg-amber-50 dark:bg-amber-950/60',
      iconColor: 'text-amber-700 dark:text-amber-300',
      activeRing: 'border-amber-600 dark:border-amber-500 bg-amber-50/30 dark:bg-amber-950/30',
    },
  ];

  return (
    <section aria-label="Resumo de ocupação" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => {
        const Icon = card.icon;
        const isActive = activeStatus === card.key;
        return (
          <button
            key={card.key}
            type="button"
            onClick={() =>
              onSelectStatus(activeStatus === card.key && card.key !== 'Todos' ? 'Todos' : card.key)
            }
            aria-pressed={isActive}
            className={`group flex items-center gap-4 p-4 rounded-xl border text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-200 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-950 ${
              isActive
                ? card.activeRing
                : 'border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 hover:border-slate-300 dark:hover:border-slate-700'
            }`}
          >
            <div
              className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${card.iconBg} ${card.iconColor}`}
            >
              <Icon className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 truncate">
                {card.label}
              </p>
              <p className="font-display text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums leading-tight mt-0.5">
                {card.value}
              </p>
            </div>
          </button>
        );
      })}
    </section>
  );
}
