'use client';
import { useCallback, useEffect, useState } from 'react';
import { Copy, Check, FileDown, ShieldCheck } from 'lucide-react';

/**
 * The one-paste script is ~65 KB / 1,200+ lines. Pasting that much into a
 * chat window is unreliable (chat clients truncate long messages), so this
 * button copies the EXACT served bytes and prints a SHA-256 fingerprint,
 * line count and byte count so the owner can prove they pasted the right
 * file into the Supabase SQL Editor.
 */
const URL_SQL = '/sql/showcase-setup.sql';

async function fingerprint(text: string): Promise<string> {
  try {
    const bytes = new TextEncoder().encode(text);
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest)).slice(0, 8)
      .map(b => b.toString(16).padStart(2, '0')).join('');
  } catch { return 'unavailable'; }
}

export function SqlCopyBar() {
  const [text, setText] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ hash: string; lines: number; bytes: number } | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    fetch(URL_SQL, { cache: 'no-store' })
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.text(); })
      .then(async t => {
        if (!alive) return;
        setText(t);
        setMeta({ hash: await fingerprint(t), lines: t.split('\n').length, bytes: new TextEncoder().encode(t).length });
      })
      .catch(e => { if (alive) setError(e instanceof Error ? e.message : 'Could not load SQL'); });
    return () => { alive = false; };
  }, []);

  const copy = useCallback(async () => {
    try {
      const value = text ?? await (await fetch(URL_SQL, { cache: 'no-store' })).text();
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2600);
    } catch { setError('Clipboard blocked — use Download .sql instead.'); }
  }, [text]);

  return (
    <div className="sql-copy-bar">
      <div className="sql-copy-bar-main">
        <div>
          <p className="eyebrow no-line">Exact source · supabase/showcase-setup.sql</p>
          <h2 className="h3 mt-8">Copy the one-paste setup script</h2>
          <p className="small muted mt-8" style={{ lineHeight: 1.8, maxWidth: 720 }}>
            This is the <strong style={{ color: 'var(--ivory)' }}>only</strong> script for this website.
            It is too large to paste reliably into a chat message, so copy it here in one click —
            no transcription, no truncation, no substitutions.
          </p>
          {meta && (
            <p className="tiny muted mt-16" style={{ lineHeight: 1.9 }}>
              <ShieldCheck size={12} style={{ verticalAlign: 'middle', color: 'var(--gold)' }} />{' '}
              Fingerprint: <code>{meta.lines.toLocaleString()} lines</code> ·{' '}
              <code>{meta.bytes.toLocaleString()} bytes</code> ·{' '}
              <code>SHA-256 {meta.hash}</code>
            </p>
          )}
          {error && <p className="tiny" style={{ color: 'var(--danger)' }}>{error}</p>}
        </div>
        <div className="flex gap-12 wrap">
          <button className="btn btn-gold" onClick={() => void copy()} disabled={!text && !error}>
            {copied ? <><Check size={15} /> Copied — paste in SQL Editor</> : <><Copy size={15} /> Copy exact SQL</>}
          </button>
          <a className="btn btn-outline" href={URL_SQL} download="showcase-setup.sql">
            <FileDown size={15} /> Download .sql
          </a>
        </div>
      </div>
      {meta && (
        <div className="sql-copy-bar-foot tiny muted">
          Verify: the first line is <code>-- IMPERIAL ROYAL — SHOWCASE SETUP</code> and the last statement is
          <code> end $$;</code>. If your editor shows fewer than {meta.lines.toLocaleString()} lines, the copy was truncated.
        </div>
      )}
    </div>
  );
}
