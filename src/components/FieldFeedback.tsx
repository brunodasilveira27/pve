import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { ValidationResult } from '../utils/validation';

interface FieldFeedbackProps {
  result: ValidationResult;
  showFeedback: boolean;
  hasValue: boolean;
}

export function FieldFeedback({ result, showFeedback, hasValue }: FieldFeedbackProps) {
  if (!showFeedback) return null;

  if (!result.valid && result.message) {
    return (
      <p
        role="alert"
        className="mt-1 flex items-center gap-1 text-[11px] font-medium text-rose-700 dark:text-rose-400"
      >
        <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>{result.message}</span>
      </p>
    );
  }

  if (result.valid && hasValue && result.message) {
    return (
      <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
        <span>{result.message}</span>
      </p>
    );
  }

  return null;
}

export function getFieldBorderClass(
  result: ValidationResult,
  showFeedback: boolean,
  hasValue: boolean,
): string {
  if (showFeedback && !result.valid) {
    return 'border-rose-500 dark:border-rose-500 focus:border-rose-600 dark:focus:border-rose-400';
  }
  if (showFeedback && result.valid && hasValue) {
    return 'border-emerald-500/80 dark:border-emerald-500/70 focus:border-emerald-600 dark:focus:border-emerald-400';
  }
  return 'border-slate-200 dark:border-slate-700 focus:border-slate-900 dark:focus:border-slate-300';
}
