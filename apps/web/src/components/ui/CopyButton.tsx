import { useEffect, useRef, useState } from 'react';

interface CopyButtonProps {
  value: string;
  label?: string;
  copiedLabel?: string;
  className?: string;
  disabled?: boolean;
}

export function CopyButton({
  value,
  label = 'Copy',
  copiedLabel = 'Copied',
  className = '',
  disabled = false,
}: CopyButtonProps) {
  const [state, setState] = useState<'idle' | 'copied' | 'failed'>('idle');
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setState('copied');
    } catch {
      setState('failed');
    }
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setState('idle'), 2000);
  }

  return (
    <button
      type="button"
      className={`ht-copy ${state} ${className}`.trim()}
      onClick={() => void copy()}
      disabled={disabled}
    >
      {state === 'copied' ? copiedLabel : state === 'failed' ? 'Copy failed' : label}
      <span className="sr-only" role="status">
        {state === 'copied' ? 'Copied to clipboard' : ''}
      </span>
    </button>
  );
}
