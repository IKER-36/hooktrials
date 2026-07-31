import { useEffect, useMemo, useRef, useState } from 'react';
import { Command, CornerDownLeft, Search, type LucideIcon } from 'lucide-react';
import { useFocusTrap } from '../../hooks/useFocusTrap';

export interface PaletteCommand {
  id: string;
  label: string;
  description?: string;
  group: string;
  icon: LucideIcon;
  keywords?: string[];
  onSelect(): void;
}

interface CommandPaletteProps {
  open: boolean;
  commands: PaletteCommand[];
  title: string;
  placeholder: string;
  emptyLabel: string;
  hintLabel: string;
  navigateLabel: string;
  selectLabel: string;
  onClose(): void;
}

export function CommandPalette({
  open,
  commands,
  title,
  placeholder,
  emptyLabel,
  hintLabel,
  navigateLabel,
  selectLabel,
  onClose,
}: CommandPaletteProps) {
  const [query, setQuery] = useState('');
  const [activeIndex, setActiveIndex] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  useFocusTrap(dialogRef, open);

  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return commands;
    return commands.filter((command) =>
      [command.label, command.description, command.group, ...(command.keywords ?? [])]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase()
        .includes(normalized),
    );
  }, [commands, query]);

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActiveIndex(0);
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [open]);

  useEffect(() => {
    setActiveIndex((current) => Math.min(current, Math.max(filtered.length - 1, 0)));
  }, [filtered.length]);

  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, open]);

  if (!open) return null;

  function runActive() {
    const command = filtered[activeIndex];
    if (!command) return;
    command.onSelect();
  }

  return (
    <div className="ht-command-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        ref={dialogRef}
        className="ht-command-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="ht-command-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="ht-command-search-row">
          <Search aria-hidden="true" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                if (filtered.length > 0) {
                  setActiveIndex((current) => Math.min(current + 1, filtered.length - 1));
                }
              } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                if (filtered.length > 0) {
                  setActiveIndex((current) => Math.max(current - 1, 0));
                }
              } else if (event.key === 'Home') {
                event.preventDefault();
                setActiveIndex(0);
              } else if (event.key === 'End') {
                event.preventDefault();
                setActiveIndex(Math.max(filtered.length - 1, 0));
              } else if (event.key === 'Enter') {
                event.preventDefault();
                runActive();
              }
            }}
            placeholder={placeholder}
            aria-label={title}
            aria-controls="ht-command-results"
            aria-activedescendant={
              filtered[activeIndex] ? `ht-command-${filtered[activeIndex].id}` : undefined
            }
            autoComplete="off"
          />
          <kbd>Esc</kbd>
        </div>

        <div className="ht-command-heading">
          <span id="ht-command-title">{title}</span>
          <small>{hintLabel}</small>
        </div>

        <div
          className="ht-command-results"
          id="ht-command-results"
          role="listbox"
          aria-label={title}
        >
          {filtered.length === 0 ? (
            <p className="ht-command-empty">{emptyLabel}</p>
          ) : (
            filtered.map((command, index) => {
              const Icon = command.icon;
              return (
                <button
                  key={command.id}
                  id={`ht-command-${command.id}`}
                  type="button"
                  role="option"
                  aria-selected={index === activeIndex}
                  className={index === activeIndex ? 'active' : undefined}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={command.onSelect}
                >
                  <span className="ht-command-icon" aria-hidden="true">
                    <Icon />
                  </span>
                  <span className="ht-command-copy">
                    <b>{command.label}</b>
                    {command.description ? <small>{command.description}</small> : null}
                  </span>
                  <span className="ht-command-group">{command.group}</span>
                  {index === activeIndex ? <CornerDownLeft aria-hidden="true" /> : null}
                </button>
              );
            })
          )}
        </div>

        <footer className="ht-command-footer">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd> {navigateLabel}
          </span>
          <span>
            <kbd>↵</kbd> {selectLabel}
          </span>
          <span className="ht-command-brand">
            <Command aria-hidden="true" /> HookTrials
          </span>
        </footer>
      </div>
    </div>
  );
}
