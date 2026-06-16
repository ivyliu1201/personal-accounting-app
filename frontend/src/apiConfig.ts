export function resolveConfiguredApiBaseUrl(value: unknown, isProduction: boolean) {
  if (!isProduction || typeof value !== 'string') {
    return '';
  }
  return value.trim().replace(/\/$/, '');
}
