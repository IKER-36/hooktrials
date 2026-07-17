import { getStoredLocale } from '../i18n/I18nContext';

function languageTag() {
  return getStoredLocale() === 'es' ? 'es-ES' : 'en-US';
}

export function shortDate(value: string): string {
  return new Intl.DateTimeFormat(languageTag(), {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

export function clockTime(value: string): string {
  return new Intl.DateTimeFormat(languageTag(), {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(value));
}

export function timeAgo(value: string): string {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  const es = getStoredLocale() === 'es';
  if (seconds < 60) return es ? `hace ${seconds} s` : `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return es ? `hace ${minutes} min` : `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return es ? `hace ${hours} h` : `${hours}h ago`;
  return shortDate(value);
}

export function shortHash(value: string, length = 12): string {
  return value.length > length ? `${value.slice(0, length)}…` : value;
}
