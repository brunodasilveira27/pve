import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Copy,
  DollarSign,
  FileText,
  Lock,
  Moon,
  Plus,
  RefreshCw,
  Search,
  Sun,
  Users,
  X,
} from 'lucide-react';
import { AccountReportModal } from './components/AccountReportModal';
import { ChaletCard } from './components/ChaletCard';
import { ChaletModal } from './components/ChaletModal';
import { CheckoutModal } from './components/CheckoutModal';
import { GuestsModal } from './components/GuestsModal';
import { KpiSummary } from './components/KpiSummary';
import { RatesModal } from './components/RatesModal';
import {
  calculateChaletTotals,
  createInitialChalets,
  DEFAULT_CATEGORY_RATES,
  formatCurrencyBRL,
} from './data/initialChalets';
import { createInitialGuests } from './data/initialGuests';
import {
  CategoryFilter,
  CategoryRates,
  Chalet,
  ChaletCategory,
  ChaletStatus,
  CheckoutRecord,
  Guest,
  StatusFilter,
} from './types/chalet';

const STORAGE_KEY = 'pve_chalets_v1';
const RATES_STORAGE_KEY = 'pve_rates_v1';
const CHECKOUTS_STORAGE_KEY = 'pve_checkouts_v1';
const GUESTS_STORAGE_KEY = 'pve_guests_v1';
const THEME_STORAGE_KEY = 'pve_theme_v1';

type ThemeMode = 'light' | 'dark';

const CATEGORY_TABS: Array<{ key: CategoryFilter; label: string }> = [
  { key: 'Todos', label: 'Todas' },
  { key: ChaletCategory.STAND, label: 'Stand' },
  { key: ChaletCategory.ERMITAO, label: 'Ermitão' },
  { key: ChaletCategory.HIDRO, label: 'Hidro' },
  { key: ChaletCategory.CASA, label: 'Casa' },
];

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

function formatDateHeading(date: Date): string {
  const formatted = new Intl.DateTimeFormat('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
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

  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('Todos');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('Todos');
  const [searchQuery, setSearchQuery] = useState('');
  const [editingChalet, setEditingChalet] = useState<Chalet | null>(null);
  const [checkoutChalet, setCheckoutChalet] = useState<Chalet | null>(null);
  const [isQuickCheckInOpen, setIsQuickCheckInOpen] = useState(false);
  const [isRatesModalOpen, setIsRatesModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isGuestsModalOpen, setIsGuestsModalOpen] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(() => new Date());
  const [copiedSummary, setCopiedSummary] = useState(false);

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

  const availableChalets = useMemo(
    () => chalets.filter((c) => c.status === ChaletStatus.LIVRE),
    [chalets],
  );

  const filteredChalets = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    return chalets.filter((chalet) => {
      if (categoryFilter !== 'Todos' && chalet.category !== categoryFilter) {
        return false;
      }
      if (statusFilter !== 'Todos' && chalet.status !== statusFilter) {
        return false;
      }
      if (!normalizedQuery) return true;

      const haystack = [
        chalet.code,
        chalet.label,
        chalet.category,
        chalet.status,
        chalet.guestName ?? '',
        chalet.blockReason ?? '',
      ]
        .join(' ')
        .toLowerCase();

      return haystack.includes(normalizedQuery);
    });
  }, [chalets, categoryFilter, statusFilter, searchQuery]);

  const handleSaveChalet = (updated: Chalet) => {
    setChalets((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
    setLastUpdated(new Date());
    setEditingChalet(null);
    setIsQuickCheckInOpen(false);
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

  const handleRefresh = () => {
    setLastUpdated(new Date());
  };

  const handleCopySummary = async () => {
    const lines = [
      `Pousada Vale do Ermitão — ${formatDateHeading(new Date())}`,
      `Ocupação: ${counts.occupied}/${counts.total} (${counts.occupancyRate}%)`,
      `Livres: ${counts.available} | Ocupados: ${counts.occupied} | Bloqueados: ${counts.blocked}`,
      `Saldo ativo a receber: ${formatCurrencyBRL(counts.activeReceivable)}`,
      ...(checkoutRecords.length > 0
        ? [`Check-outs realizados (${checkoutRecords.length}): ${formatCurrencyBRL(counts.closedTotal)}`]
        : []),
      '',
      ...chalets.map((c) => {
        if (c.status === ChaletStatus.OCUPADO) {
          const totals = calculateChaletTotals(c, rates);
          return `${c.label} [${c.category}]: Ocupado (${c.guestName ?? 'Hóspede'}) · Saldo ${formatCurrencyBRL(totals.balanceDue)}`;
        }
        if (c.status === ChaletStatus.BLOQUEADO) {
          return `${c.label} [${c.category}]: Bloqueado (${c.blockReason ?? 'Indisponível'})`;
        }
        return `${c.label} [${c.category}]: Livre (${formatCurrencyBRL(rates[c.category])}/dia)`;
      }),
    ];

    try {
      await navigator.clipboard.writeText(lines.join('\n'));
      setCopiedSummary(true);
      window.setTimeout(() => setCopiedSummary(false), 2000);
    } catch {
      // Clipboard API unavailable
    }
  };

  const handleResetFilters = () => {
    setCategoryFilter('Todos');
    setStatusFilter('Todos');
    setSearchQuery('');
  };

  const hasActiveFilters =
    categoryFilter !== 'Todos' || statusFilter !== 'Todos' || searchQuery.trim() !== '';

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-150">
      <header className="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          <a
            href="#painel"
            onClick={(e) => {
              e.preventDefault();
              handleResetFilters();
            }}
            className="font-display text-lg font-bold tracking-tight text-slate-900 dark:text-slate-100 whitespace-nowrap shrink-0"
          >
            Pousada Vale do Ermitão
          </a>

          <nav
            aria-label="Categorias de acomodações"
            className="hidden md:flex items-center gap-6"
          >
            {CATEGORY_TABS.map((tab) => {
              const isActive = categoryFilter === tab.key;
              return (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setCategoryFilter(tab.key)}
                  className={`relative py-1 text-sm font-medium transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-200 rounded ${
                    isActive
                      ? 'text-slate-900 dark:text-slate-100 after:absolute after:inset-x-0 after:-bottom-1 after:h-0.5 after:bg-slate-900 dark:after:bg-slate-100'
                      : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </nav>

          <div className="shrink-0">
            <button
              type="button"
              onClick={() => setIsQuickCheckInOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white dark:text-slate-950 bg-slate-900 dark:bg-slate-100 rounded-lg hover:bg-slate-800 dark:hover:bg-white transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-200 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900"
            >
              <Plus className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>Novo Check-in</span>
            </button>
          </div>
        </div>
      </header>

      <main id="painel" className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2">
          <div>
            <h1 className="font-display text-2xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
              Painel de Acomodações
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 tabular-nums mt-0.5">
              {formatDateHeading(lastUpdated)} · 11 Stand · 6 Ermitão · 1 Hidro · 1 Casa
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-400 tabular-nums">
            <span>
              A receber:{' '}
              <strong className="font-mono text-slate-900 dark:text-slate-100">
                {formatCurrencyBRL(counts.activeReceivable)}
              </strong>
            </span>
            {checkoutRecords.length > 0 && (
              <>
                <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">·</span>
                <button
                  type="button"
                  onClick={() => setIsReportModalOpen(true)}
                  className="hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 dark:focus-visible:ring-slate-200 rounded"
                >
                  Check-outs ({checkoutRecords.length}):{' '}
                  <strong className="font-mono text-emerald-800 dark:text-emerald-300">
                    {formatCurrencyBRL(counts.closedTotal)}
                  </strong>
                </button>
              </>
            )}
          </div>
        </div>

        <KpiSummary
          total={counts.total}
          occupied={counts.occupied}
          available={counts.available}
          blocked={counts.blocked}
          activeStatus={statusFilter}
          onSelectStatus={setStatusFilter}
        />

        <section
          aria-label="Filtros e busca"
          className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3"
        >
          <div className="flex flex-wrap items-center gap-2">
            <div
              className="flex md:hidden items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg overflow-x-auto max-w-full"
              role="group"
              aria-label="Filtrar por categoria"
            >
              {CATEGORY_TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setCategoryFilter(tab.key)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                    categoryFilter === tab.key
                      ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 shadow-sm'
                      : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div
              className="flex items-center gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg overflow-x-auto max-w-full"
              role="group"
              aria-label="Filtrar por status"
            >
              {STATUS_FILTERS.map((item) => {
                const Icon = item.icon;
                const isActive = statusFilter === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setStatusFilter(item.key)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                      isActive
                        ? 'bg-white dark:bg-slate-950 text-slate-900 dark:text-slate-100 shadow-sm'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'
                    }`}
                  >
                    {Icon && (
                      <Icon className={`h-3.5 w-3.5 shrink-0 ${item.dotColor}`} aria-hidden="true" />
                    )}
                    <span>{item.label}</span>
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

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
            <div className="flex flex-wrap items-center gap-2">
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

            <div className="relative w-full sm:w-60 shrink-0">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500"
                aria-hidden="true"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Pesquisar chalé ou hóspede..."
                aria-label="Pesquisar chalé ou hóspede"
                className="w-full h-10 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-950 pl-9 pr-3 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-slate-900 dark:focus:border-slate-300 focus:bg-white dark:focus:bg-slate-950 focus:outline-none"
              />
            </div>
          </div>
        </section>

        <section aria-label="Grade de chalés e acomodações">
          {filteredChalets.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5">
              {filteredChalets.map((chalet) => (
                <ChaletCard
                  key={chalet.id}
                  chalet={chalet}
                  rates={rates}
                  onSelect={(selected) => setEditingChalet(selected)}
                  onCheckout={(selected) => setCheckoutChalet(selected)}
                  onRelease={handleReleaseChalet}
                />
              ))}
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
                onClick={handleCopySummary}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                {copiedSummary ? (
                  <>
                    <Check className="h-3.5 w-3.5 text-emerald-700 dark:text-emerald-400" aria-hidden="true" />
                    <span>Copiado</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" aria-hidden="true" />
                    <span>Copiar resumo</span>
                  </>
                )}
              </button>

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
          onClose={() => setEditingChalet(null)}
          onSave={handleSaveChalet}
          onSaveGuest={handleSaveGuest}
          onOpenCheckout={(updated) => {
            setChalets((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
            setEditingChalet(null);
            setCheckoutChalet(updated);
          }}
        />
      )}

      {isQuickCheckInOpen && (
        <ChaletModal
          chalet={null}
          rates={rates}
          guests={guests}
          availableChalets={availableChalets}
          isQuickCheckIn
          onClose={() => setIsQuickCheckInOpen(false)}
          onSave={handleSaveChalet}
          onSaveGuest={handleSaveGuest}
        />
      )}

      {checkoutChalet && (
        <CheckoutModal
          chalet={checkoutChalet}
          rates={rates}
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
    </div>
  );
}
