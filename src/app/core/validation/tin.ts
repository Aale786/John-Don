/** Keep only digits, cap at the 9-digit SSN/EIN length used in filing. */
export function normalizeTin(value: string): string {
  return (value ?? '').replace(/\D/g, '').slice(0, 9);
}

export function isCompleteTin(value: string): boolean {
  return normalizeTin(value).length === 9;
}
