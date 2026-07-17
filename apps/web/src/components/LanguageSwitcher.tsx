import { Languages } from 'lucide-react';
import { useI18n } from '../i18n/I18nContext';

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale } = useI18n();
  return (
    <label className={`ht-language-switcher ${compact ? 'compact' : ''}`}>
      <Languages aria-hidden="true" />
      <span className="sr-only">Language</span>
      <select
        value={locale}
        onChange={(event) => setLocale(event.target.value as 'en' | 'es')}
        aria-label="Language"
      >
        <option value="en">EN</option>
        <option value="es">ES</option>
      </select>
    </label>
  );
}
