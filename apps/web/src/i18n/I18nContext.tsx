import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { es, phrasePatterns, type Locale } from './catalog';

const textSources = new WeakMap<Text, string>();
const attributeSources = new WeakMap<Element, Map<string, string>>();
const translatedAttributes = ['aria-label', 'title', 'placeholder'];
const englishBySpanish = new Map(
  Object.entries(es).map(([english, spanish]) => [spanish, english]),
);

function canonicalSource(value: string): string {
  const phrase = value.trim();
  const english = englishBySpanish.get(phrase);
  if (!english) return value;
  return `${value.match(/^\s*/)?.[0] ?? ''}${english}${value.match(/\s*$/)?.[0] ?? ''}`;
}

export function getStoredLocale(): Locale {
  const requested = new URLSearchParams(window.location.search).get('lang');
  if (requested === 'en' || requested === 'es') {
    localStorage.setItem('ht.locale', requested);
    return requested;
  }
  const stored = localStorage.getItem('ht.locale');
  if (stored === 'en' || stored === 'es') return stored;
  return navigator.language.toLowerCase().startsWith('es') ? 'es' : 'en';
}

export function translatePhrase(source: string, locale: Locale = getStoredLocale()): string {
  const canonical = canonicalSource(source);
  if (locale === 'en' || !canonical.trim()) return canonical;
  const leading = canonical.match(/^\s*/)?.[0] ?? '';
  const trailing = canonical.match(/\s*$/)?.[0] ?? '';
  const phrase = canonical.trim();
  const exact = es[phrase];
  if (exact) return `${leading}${exact}${trailing}`;
  for (const [pattern, replacement] of phrasePatterns) {
    const match = phrase.match(pattern);
    if (match) return `${leading}${replacement(match)}${trailing}`;
  }
  return canonical;
}

function localizeText(node: Text, locale: Locale) {
  const previousSource = textSources.get(node);
  const knownSpanish = previousSource ? translatePhrase(previousSource, 'es') : null;
  if (!previousSource || (node.data !== previousSource && node.data !== knownSpanish)) {
    textSources.set(node, canonicalSource(node.data));
  }
  const source = textSources.get(node) ?? node.data;
  const translated = translatePhrase(source, locale);
  if (node.data !== translated) node.data = translated;
}

function localizeElement(element: Element, locale: Locale) {
  let sources = attributeSources.get(element);
  if (!sources) {
    sources = new Map();
    attributeSources.set(element, sources);
  }
  for (const attribute of translatedAttributes) {
    const current = element.getAttribute(attribute);
    if (!current) continue;
    const source = sources.get(attribute);
    const knownSpanish = source ? translatePhrase(source, 'es') : null;
    if (!source || (current !== source && current !== knownSpanish))
      sources.set(attribute, canonicalSource(current));
    const translated = translatePhrase(sources.get(attribute) ?? current, locale);
    if (current !== translated) element.setAttribute(attribute, translated);
  }
}

function localizeTree(root: Node, locale: Locale) {
  if (root instanceof Text) localizeText(root, locale);
  if (root instanceof Element) localizeElement(root, locale);
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT);
  let node = walker.nextNode();
  while (node) {
    if (node instanceof Text) localizeText(node, locale);
    else if (node instanceof Element) localizeElement(node, locale);
    node = walker.nextNode();
  }
}

interface I18nValue {
  locale: Locale;
  setLocale(locale: Locale): void;
  t(source: string): string;
}

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(getStoredLocale);
  const setLocale = useCallback((next: Locale) => {
    localStorage.setItem('ht.locale', next);
    setLocaleState(next);
  }, []);

  useEffect(() => {
    document.documentElement.lang = locale;
    localizeTree(document.body, locale);
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.type === 'characterData') localizeText(mutation.target as Text, locale);
        if (mutation.type === 'attributes') localizeElement(mutation.target as Element, locale);
        mutation.addedNodes.forEach((node) => localizeTree(node, locale));
      }
    });
    observer.observe(document.body, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: translatedAttributes,
    });
    return () => observer.disconnect();
  }, [locale]);

  const value = useMemo<I18nValue>(
    () => ({ locale, setLocale, t: (source) => translatePhrase(source, locale) }),
    [locale, setLocale],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) throw new Error('useI18n must be used inside I18nProvider');
  return context;
}
