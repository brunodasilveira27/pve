export interface ValidationResult {
  valid: boolean;
  message?: string;
}

export function onlyDigits(value: string): string {
  return value.replace(/\D/g, '');
}

export function formatCpfOrDocument(value: string): string {
  const trimmed = value.trimStart();
  // If user enters letters (e.g. Passport or alphanumeric RG), preserve alphanumeric uppercase
  if (/[a-zA-Z]/.test(trimmed)) {
    return trimmed.toUpperCase().slice(0, 20);
  }
  const digits = onlyDigits(trimmed).slice(0, 11);
  if (digits.length <= 3) return digits;
  if (digits.length <= 6) return `${digits.slice(0, 3)}.${digits.slice(3)}`;
  if (digits.length <= 9) {
    return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6)}`;
  }
  return `${digits.slice(0, 3)}.${digits.slice(3, 6)}.${digits.slice(6, 9)}-${digits.slice(9, 11)}`;
}

export function isValidCpfDigits(cpfDigits: string): boolean {
  if (cpfDigits.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cpfDigits)) return false;

  let sum1 = 0;
  for (let i = 0; i < 9; i += 1) {
    sum1 += Number(cpfDigits[i]) * (10 - i);
  }
  const rem1 = sum1 % 11;
  const check1 = rem1 < 2 ? 0 : 11 - rem1;
  if (check1 !== Number(cpfDigits[9])) return false;

  let sum2 = 0;
  for (let i = 0; i < 10; i += 1) {
    sum2 += Number(cpfDigits[i]) * (11 - i);
  }
  const rem2 = sum2 % 11;
  const check2 = rem2 < 2 ? 0 : 11 - rem2;
  return check2 === Number(cpfDigits[10]);
}

export function validateCpfOrDocument(value: string, required = false): ValidationResult {
  const trimmed = value.trim();
  if (!trimmed) {
    return required
      ? { valid: false, message: 'Informe o CPF ou documento.' }
      : { valid: true };
  }

  if (/[a-zA-Z]/.test(trimmed)) {
    const cleanAlpha = trimmed.replace(/[^a-zA-Z0-9-]/g, '');
    if (cleanAlpha.length < 5) {
      return {
        valid: false,
        message: 'Documento deve ter ao menos 5 caracteres.',
      };
    }
    return { valid: true, message: 'Documento alfanumérico válido' };
  }

  const digits = onlyDigits(trimmed);
  if (digits.length < 11) {
    return {
      valid: false,
      message: `CPF incompleto (${digits.length}/11 dígitos).`,
    };
  }
  if (!isValidCpfDigits(digits)) {
    return {
      valid: false,
      message: 'CPF inválido (verifique os números informados).',
    };
  }
  return { valid: true, message: 'CPF válido' };
}

export function formatPhoneBR(value: string): string {
  const digits = onlyDigits(value).slice(0, 11);
  if (digits.length === 0) return '';
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7, 11)}`;
}

export function validatePhoneBR(value: string, required = false): ValidationResult {
  const trimmed = value.trim();
  if (!trimmed) {
    return required
      ? { valid: false, message: 'Informe o telefone ou WhatsApp.' }
      : { valid: true };
  }

  const digits = onlyDigits(trimmed);
  if (digits.length < 10) {
    return {
      valid: false,
      message: 'Informe DDD + 8 ou 9 dígitos (ex.: (24) 99999-9999).',
    };
  }

  const ddd = Number(digits.slice(0, 2));
  if (ddd < 11 || ddd > 99) {
    return { valid: false, message: 'DDD inválido (deve estar entre 11 e 99).' };
  }

  if (digits.length === 11 && digits[2] !== '9') {
    return {
      valid: false,
      message: 'Celular com 11 dígitos deve iniciar com 9 após o DDD.',
    };
  }

  return {
    valid: true,
    message: digits.length === 11 ? 'Celular / WhatsApp válido' : 'Telefone fixo válido',
  };
}

export function validateFullName(value: string): ValidationResult {
  const trimmed = value.trim();
  if (!trimmed) {
    return { valid: false, message: 'Informe o nome completo do hóspede.' };
  }
  if (trimmed.length < 3) {
    return { valid: false, message: 'Nome muito curto (mínimo 3 caracteres).' };
  }
  if (!/[a-zA-ZÀ-ÿ]/.test(trimmed)) {
    return { valid: false, message: 'O nome deve conter letras.' };
  }
  return { valid: true, message: 'Nome válido' };
}

export function validateEmail(value: string): ValidationResult {
  const trimmed = value.trim();
  if (!trimmed) return { valid: true };

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  if (!emailRegex.test(trimmed)) {
    return {
      valid: false,
      message: 'E-mail inválido (ex.: nome@dominio.com).',
    };
  }
  return { valid: true, message: 'E-mail válido' };
}

export function formatCityState(value: string): string {
  const trimmed = value.trim().replace(/\s+/g, ' ');
  return trimmed.replace(/(?:\s*-\s*|\s+)([a-zA-Z]{2})$/, (_, uf: string) => ` - ${uf.toUpperCase()}`);
}

export function validateCityState(value: string): ValidationResult {
  const trimmed = value.trim();
  if (!trimmed) return { valid: true };
  if (trimmed.length < 3 || !/[a-zA-ZÀ-ÿ]/.test(trimmed)) {
    return { valid: false, message: 'Informe a cidade (ex.: Petrópolis - RJ).' };
  }
  return { valid: true, message: 'Cidade / UF válida' };
}

export function validateBirthDate(value: string): ValidationResult {
  if (!value) return { valid: true };
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) {
    return { valid: false, message: 'Data de nascimento inválida.' };
  }
  const today = new Date();
  if (date > today) {
    return { valid: false, message: 'Data de nascimento não pode ser futura.' };
  }

  let age = today.getFullYear() - date.getFullYear();
  const monthDiff = today.getMonth() - date.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < date.getDate())) {
    age -= 1;
  }

  if (age > 120) {
    return { valid: false, message: 'Ano de nascimento inválido.' };
  }
  return { valid: true, message: `${age} ${age === 1 ? 'ano' : 'anos'}` };
}

export function formatVehiclePlate(value: string): string {
  const raw = value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
  const clean = raw.replace(/-/g, '').slice(0, 7);
  if (clean.length === 7 && /^[A-Z]{3}\d{4}$/.test(clean)) {
    return `${clean.slice(0, 3)}-${clean.slice(3)}`;
  }
  return clean;
}

export function validateVehiclePlate(value: string): ValidationResult {
  const trimmed = value.trim().toUpperCase();
  if (!trimmed) return { valid: true };

  const clean = trimmed.replace(/[^A-Z0-9]/g, '');
  if (/^[A-Z]{3}\d[A-Z]\d{2}$/.test(clean)) {
    return { valid: true, message: 'Placa válida (Mercosul)' };
  }
  if (/^[A-Z]{3}\d{4}$/.test(clean)) {
    return { valid: true, message: 'Placa válida (padrão antigo)' };
  }
  return {
    valid: false,
    message: 'Formato esperado: ABC1D23 (Mercosul) ou ABC-1234.',
  };
}

export function validateStayDates(checkIn?: string, checkOut?: string): ValidationResult {
  if (!checkIn || !checkOut) return { valid: true };
  if (checkOut < checkIn) {
    return {
      valid: false,
      message: 'Check-out previsto não pode ser anterior ao check-in.',
    };
  }
  return { valid: true };
}
