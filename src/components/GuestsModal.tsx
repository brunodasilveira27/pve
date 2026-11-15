import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  Pencil,
  Plus,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { Chalet, ChaletStatus, Guest } from '../types/chalet';
import {
  formatCityState,
  formatCpfOrDocument,
  formatPhoneBR,
  formatVehiclePlate,
  validateBirthDate,
  validateCityState,
  validateCpfOrDocument,
  validateEmail,
  validateFullName,
  validatePhoneBR,
  validateVehiclePlate,
} from '../utils/validation';
import { FieldFeedback, getFieldBorderClass } from './FieldFeedback';

interface GuestsModalProps {
  guests: Guest[];
  chalets: Chalet[];
  onClose: () => void;
  onSaveGuest: (guest: Guest) => void;
  onDeleteGuest: (id: string) => void;
}

type GuestFieldKey =
  | 'fullName'
  | 'document'
  | 'phone'
  | 'email'
  | 'cityState'
  | 'birthDate'
  | 'vehiclePlate';

export function GuestsModal({
  guests,
  chalets,
  onClose,
  onSaveGuest,
  onDeleteGuest,
}: GuestsModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingGuest, setEditingGuest] = useState<Guest | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const [fullName, setFullName] = useState('');
  const [guestDoc, setGuestDoc] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [cityState, setCityState] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [vehiclePlate, setVehiclePlate] = useState('');
  const [notes, setNotes] = useState('');
  const [touched, setTouched] = useState<Partial<Record<GuestFieldKey, boolean>>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (isFormOpen) {
          setIsFormOpen(false);
          setEditingGuest(null);
          setFormError('');
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, isFormOpen]);

  const activeStayByGuest = useMemo(() => {
    const map = new Map<string, Chalet>();
    for (const chalet of chalets) {
      if (chalet.status === ChaletStatus.OCUPADO) {
        if (chalet.guestId) {
          map.set(chalet.guestId, chalet);
        }
        if (chalet.guestName) {
          map.set(chalet.guestName.trim().toLowerCase(), chalet);
        }
      }
    }
    return map;
  }, [chalets]);

  const filteredGuests = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const sorted = [...guests].sort((a, b) =>
      a.fullName.localeCompare(b.fullName, 'pt-BR'),
    );
    if (!query) return sorted;

    return sorted.filter((guest) => {
      const haystack = [
        guest.fullName,
        guest.document ?? '',
        guest.phone ?? '',
        guest.email ?? '',
        guest.cityState ?? '',
        guest.vehiclePlate ?? '',
        guest.notes ?? '',
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [guests, searchQuery]);

  const validations = useMemo(
    () => ({
      fullName: validateFullName(fullName),
      document: validateCpfOrDocument(guestDoc, false),
      phone: validatePhoneBR(phone, false),
      email: validateEmail(email),
      cityState: validateCityState(cityState),
      birthDate: validateBirthDate(birthDate),
      vehiclePlate: validateVehiclePlate(vehiclePlate),
    }),
    [fullName, guestDoc, phone, email, cityState, birthDate, vehiclePlate],
  );

  const markTouched = (field: GuestFieldKey) => {
    setTouched((prev) => ({ ...prev, [field]: true }));
  };

  const shouldShow = (field: GuestFieldKey) => Boolean(touched[field] || submitAttempted);

  const openNewForm = () => {
    setEditingGuest(null);
    setFullName('');
    setGuestDoc('');
    setPhone('');
    setEmail('');
    setCityState('');
    setBirthDate('');
    setVehiclePlate('');
    setNotes('');
    setTouched({});
    setSubmitAttempted(false);
    setFormError('');
    setIsFormOpen(true);
  };

  const openEditForm = (guest: Guest) => {
    setEditingGuest(guest);
    setFullName(guest.fullName);
    setGuestDoc(guest.document ?? '');
    setPhone(guest.phone ?? '');
    setEmail(guest.email ?? '');
    setCityState(guest.cityState ?? '');
    setBirthDate(guest.birthDate ?? '');
    setVehiclePlate(guest.vehiclePlate ?? '');
    setNotes(guest.notes ?? '');
    setTouched({
      fullName: Boolean(guest.fullName),
      document: Boolean(guest.document),
      phone: Boolean(guest.phone),
      email: Boolean(guest.email),
      cityState: Boolean(guest.cityState),
      birthDate: Boolean(guest.birthDate),
      vehiclePlate: Boolean(guest.vehiclePlate),
    });
    setSubmitAttempted(false);
    setFormError('');
    setIsFormOpen(true);
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    setSubmitAttempted(true);

    const hasErrors = Object.values(validations).some((res) => !res.valid);
    if (hasErrors) {
      setFormError('Corrija os campos destacados antes de salvar o cadastro.');
      return;
    }

    const now = new Date().toISOString();
    const saved: Guest = {
      id: editingGuest?.id ?? `guest-${Date.now()}`,
      fullName: fullName.trim().replace(/\s+/g, ' '),
      document: guestDoc.trim() || undefined,
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      cityState: cityState.trim() ? formatCityState(cityState) : undefined,
      birthDate: birthDate || undefined,
      vehiclePlate: vehiclePlate.trim() ? formatVehiclePlate(vehiclePlate) : undefined,
      notes: notes.trim() || undefined,
      createdAt: editingGuest?.createdAt ?? now,
      updatedAt: now,
    };

    onSaveGuest(saved);
    setIsFormOpen(false);
    setEditingGuest(null);
  };

  const baseInputClass =
    'w-full h-10 rounded-lg border bg-white dark:bg-slate-950 px-3 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:outline-none transition-colors';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 dark:bg-slate-950/75 p-2 sm:p-4"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="guests-modal-title"
    >
      <div className="flex flex-col w-full max-w-5xl max-h-[90vh] rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 dark:border-slate-800 px-6 py-4">
          <div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 tabular-nums">
              Pousada Vale do Ermitão · {guests.length}{' '}
              {guests.length === 1 ? 'hóspede cadastrado' : 'hóspedes cadastrados'}
            </p>
            <h2
              id="guests-modal-title"
              className="font-display text-xl font-bold text-slate-900 dark:text-slate-100 mt-0.5"
            >
              {isFormOpen
                ? editingGuest
                  ? `Editar Hóspede — ${editingGuest.fullName}`
                  : 'Cadastrar Novo Hóspede'
                : 'Cadastro de Hóspedes'}
            </h2>
          </div>

          <div className="flex items-center gap-2">
            {!isFormOpen && (
              <button
                type="button"
                onClick={openNewForm}
                className="inline-flex items-center gap-1.5 h-9 px-3.5 text-xs font-medium text-white dark:text-slate-950 bg-slate-900 dark:bg-slate-100 hover:bg-slate-800 dark:hover:bg-white rounded-lg transition-colors whitespace-nowrap"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Novo Hóspede</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar cadastro de hóspedes"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {isFormOpen ? (
          <form onSubmit={handleSubmit} noValidate className="flex-1 overflow-y-auto p-6 space-y-4">
            <div className="flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setIsFormOpen(false);
                  setEditingGuest(null);
                  setFormError('');
                }}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-100"
              >
                <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Voltar para a lista</span>
              </button>
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                Validação automática ativa nos campos
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label
                  htmlFor="guest-full-name"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Nome completo *
                </label>
                <input
                  id="guest-full-name"
                  type="text"
                  value={fullName}
                  onChange={(e) => {
                    setFullName(e.target.value);
                    if (formError) setFormError('');
                  }}
                  onBlur={() => {
                    setFullName((prev) => prev.trim().replace(/\s+/g, ' '));
                    markTouched('fullName');
                  }}
                  placeholder="Ex.: Maria Clara Ferreira"
                  autoFocus
                  className={`${baseInputClass} ${getFieldBorderClass(
                    validations.fullName,
                    shouldShow('fullName'),
                    fullName.trim().length > 0,
                  )}`}
                />
                <FieldFeedback
                  result={validations.fullName}
                  showFeedback={shouldShow('fullName')}
                  hasValue={fullName.trim().length > 0}
                />
              </div>

              <div>
                <label
                  htmlFor="guest-document"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  CPF / RG / Passaporte
                </label>
                <input
                  id="guest-document"
                  type="text"
                  value={guestDoc}
                  onChange={(e) => {
                    setGuestDoc(formatCpfOrDocument(e.target.value));
                    if (formError) setFormError('');
                  }}
                  onBlur={() => markTouched('document')}
                  placeholder="000.000.000-00 ou Passaporte"
                  className={`${baseInputClass} font-mono tabular-nums ${getFieldBorderClass(
                    validations.document,
                    shouldShow('document') || guestDoc.trim().length > 0,
                    guestDoc.trim().length > 0,
                  )}`}
                />
                <FieldFeedback
                  result={validations.document}
                  showFeedback={shouldShow('document') || guestDoc.trim().length > 0}
                  hasValue={guestDoc.trim().length > 0}
                />
              </div>

              <div>
                <label
                  htmlFor="guest-phone"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Telefone / WhatsApp
                </label>
                <input
                  id="guest-phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => {
                    setPhone(formatPhoneBR(e.target.value));
                    if (formError) setFormError('');
                  }}
                  onBlur={() => markTouched('phone')}
                  placeholder="(24) 99999-9999"
                  className={`${baseInputClass} font-mono tabular-nums ${getFieldBorderClass(
                    validations.phone,
                    shouldShow('phone') || phone.trim().length > 0,
                    phone.trim().length > 0,
                  )}`}
                />
                <FieldFeedback
                  result={validations.phone}
                  showFeedback={shouldShow('phone') || phone.trim().length > 0}
                  hasValue={phone.trim().length > 0}
                />
              </div>

              <div>
                <label
                  htmlFor="guest-email"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  E-mail
                </label>
                <input
                  id="guest-email"
                  type="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value.trim());
                    if (formError) setFormError('');
                  }}
                  onBlur={() => markTouched('email')}
                  placeholder="hospede@email.com"
                  className={`${baseInputClass} ${getFieldBorderClass(
                    validations.email,
                    shouldShow('email'),
                    email.trim().length > 0,
                  )}`}
                />
                <FieldFeedback
                  result={validations.email}
                  showFeedback={shouldShow('email')}
                  hasValue={email.trim().length > 0}
                />
              </div>

              <div>
                <label
                  htmlFor="guest-city"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Cidade / UF
                </label>
                <input
                  id="guest-city"
                  type="text"
                  value={cityState}
                  onChange={(e) => {
                    setCityState(e.target.value);
                    if (formError) setFormError('');
                  }}
                  onBlur={() => {
                    setCityState((prev) => (prev.trim() ? formatCityState(prev) : ''));
                    markTouched('cityState');
                  }}
                  placeholder="Ex.: Rio de Janeiro - RJ"
                  className={`${baseInputClass} ${getFieldBorderClass(
                    validations.cityState,
                    shouldShow('cityState'),
                    cityState.trim().length > 0,
                  )}`}
                />
                <FieldFeedback
                  result={validations.cityState}
                  showFeedback={shouldShow('cityState')}
                  hasValue={cityState.trim().length > 0}
                />
              </div>

              <div>
                <label
                  htmlFor="guest-birthdate"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Data de nascimento
                </label>
                <input
                  id="guest-birthdate"
                  type="date"
                  value={birthDate}
                  onChange={(e) => {
                    setBirthDate(e.target.value);
                    markTouched('birthDate');
                    if (formError) setFormError('');
                  }}
                  onBlur={() => markTouched('birthDate')}
                  className={`${baseInputClass} tabular-nums ${getFieldBorderClass(
                    validations.birthDate,
                    shouldShow('birthDate') || birthDate.length > 0,
                    birthDate.length > 0,
                  )}`}
                />
                <FieldFeedback
                  result={validations.birthDate}
                  showFeedback={shouldShow('birthDate') || birthDate.length > 0}
                  hasValue={birthDate.length > 0}
                />
              </div>

              <div>
                <label
                  htmlFor="guest-plate"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Placa do veículo
                </label>
                <input
                  id="guest-plate"
                  type="text"
                  value={vehiclePlate}
                  onChange={(e) => {
                    setVehiclePlate(formatVehiclePlate(e.target.value));
                    if (formError) setFormError('');
                  }}
                  onBlur={() => markTouched('vehiclePlate')}
                  placeholder="ABC1D23 ou ABC-1234"
                  className={`${baseInputClass} font-mono uppercase ${getFieldBorderClass(
                    validations.vehiclePlate,
                    shouldShow('vehiclePlate') || vehiclePlate.trim().length > 0,
                    vehiclePlate.trim().length > 0,
                  )}`}
                />
                <FieldFeedback
                  result={validations.vehiclePlate}
                  showFeedback={shouldShow('vehiclePlate') || vehiclePlate.trim().length > 0}
                  hasValue={vehiclePlate.trim().length > 0}
                />
              </div>

              <div className="sm:col-span-2">
                <label
                  htmlFor="guest-notes"
                  className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1.5"
                >
                  Observações / Preferências
                </label>
                <input
                  id="guest-notes"
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Ex.: Restrição alimentar, preferência por andar térreo..."
                  className={`${baseInputClass} border-slate-200 dark:border-slate-700 focus:border-slate-900 dark:focus:border-slate-300`}
                />
              </div>
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
                  setEditingGuest(null);
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
                Salvar hóspede
              </button>
            </div>
          </form>
        ) : (
          <div className="flex-1 overflow-y-auto p-6 space-y-4">
            <div className="relative">
              <Search
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 dark:text-slate-500"
                aria-hidden="true"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar por nome, CPF, telefone, cidade ou placa..."
                aria-label="Buscar hóspede cadastrado"
                className="w-full h-10 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-950 pl-9 pr-3 text-sm text-slate-900 dark:text-slate-100 placeholder:text-slate-400 dark:placeholder:text-slate-500 focus:border-slate-900 dark:focus:border-slate-300 focus:bg-white dark:focus:bg-slate-950 focus:outline-none"
              />
            </div>

            {filteredGuests.length > 0 ? (
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
                <table className="w-full border-collapse text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 text-slate-600 dark:text-slate-300">
                      <th className="py-2.5 px-3 font-semibold whitespace-nowrap">Hóspede</th>
                      <th className="py-2.5 px-3 font-semibold whitespace-nowrap">Documento</th>
                      <th className="py-2.5 px-3 font-semibold whitespace-nowrap">Telefone / WhatsApp</th>
                      <th className="py-2.5 px-3 font-semibold whitespace-nowrap">Origem / Veículo</th>
                      <th className="py-2.5 px-3 font-semibold whitespace-nowrap">Situação</th>
                      <th className="py-2.5 px-3 font-semibold text-right whitespace-nowrap">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {filteredGuests.map((guest) => {
                      const activeChalet =
                        activeStayByGuest.get(guest.id) ??
                        activeStayByGuest.get(guest.fullName.trim().toLowerCase());

                      return (
                        <tr
                          key={guest.id}
                          className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 transition-colors"
                        >
                          <td className="py-3 px-3 align-top">
                            <div className="font-semibold text-slate-900 dark:text-slate-100">
                              {guest.fullName}
                            </div>
                            {guest.email && (
                              <div className="text-slate-500 dark:text-slate-400">
                                {guest.email}
                              </div>
                            )}
                            {guest.notes && (
                              <div className="text-slate-500 dark:text-slate-400 mt-0.5">
                                Obs.: {guest.notes}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-3 font-mono text-slate-700 dark:text-slate-300 tabular-nums whitespace-nowrap align-top">
                            {guest.document || '—'}
                          </td>
                          <td className="py-3 px-3 font-mono text-slate-700 dark:text-slate-300 tabular-nums whitespace-nowrap align-top">
                            {guest.phone || '—'}
                          </td>
                          <td className="py-3 px-3 align-top">
                            <div className="text-slate-700 dark:text-slate-300">
                              {guest.cityState || '—'}
                            </div>
                            {guest.vehiclePlate && (
                              <div className="font-mono text-slate-500 dark:text-slate-400">
                                Placa {guest.vehiclePlate}
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-3 whitespace-nowrap align-top">
                            {activeChalet ? (
                              <span className="font-medium text-rose-800 dark:text-rose-300">
                                Hospedado · {activeChalet.label}
                              </span>
                            ) : (
                              <span className="text-slate-500 dark:text-slate-400">
                                Cadastrado
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-3 text-right whitespace-nowrap align-top">
                            <div className="inline-flex items-center justify-end gap-1">
                              <button
                                type="button"
                                onClick={() => openEditForm(guest)}
                                title="Editar hóspede"
                                aria-label={`Editar ${guest.fullName}`}
                                className="inline-flex items-center gap-1 px-2 py-1 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
                              >
                                <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                                <span>Editar</span>
                              </button>

                              {confirmDeleteId === guest.id ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    onDeleteGuest(guest.id);
                                    setConfirmDeleteId(null);
                                  }}
                                  className="px-2 py-1 text-rose-700 dark:text-rose-200 bg-rose-50 dark:bg-rose-950 hover:bg-rose-100 dark:hover:bg-rose-900 font-medium rounded transition-colors"
                                >
                                  Confirmar
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteId(guest.id)}
                                  title="Excluir hóspede"
                                  aria-label={`Excluir ${guest.fullName}`}
                                  className="p-1 text-slate-400 dark:text-slate-500 hover:text-rose-700 dark:hover:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/60 rounded transition-colors"
                                >
                                  <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
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
                  Nenhum hóspede encontrado
                </p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                  {guests.length === 0
                    ? 'Cadastre o primeiro hóspede para agilizar futuros check-ins.'
                    : 'Nenhum registro corresponde à busca digitada.'}
                </p>
                {guests.length === 0 && (
                  <button
                    type="button"
                    onClick={openNewForm}
                    className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white dark:text-slate-950 bg-slate-900 dark:bg-slate-100 rounded-lg hover:bg-slate-800 dark:hover:bg-white transition-colors"
                  >
                    <Plus className="h-4 w-4" aria-hidden="true" />
                    <span>Cadastrar primeiro hóspede</span>
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
