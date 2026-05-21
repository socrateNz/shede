export const BUSINESS_TRIAL_MONTHS = 2;

export function getBusinessTrialEndDate(from = new Date()): Date {
  const end = new Date(from);
  end.setMonth(end.getMonth() + BUSINESS_TRIAL_MONTHS);
  return end;
}

export function formatTrialDateFr(date: Date): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}
