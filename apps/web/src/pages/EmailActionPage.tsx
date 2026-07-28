import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowRight, CheckCircle2, ShieldCheck } from 'lucide-react';
import { Brand } from '../components/Brand';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { apiRequest, readableError } from '../lib/api';

function ActionShell({ children }: { children: ReactNode }) {
  return (
    <main className="ht-auth">
      <section className="ht-auth-aside">
        <Brand />
        <div className="ht-auth-pitch">
          <p className="ht-auth-eyebrow">
            <ShieldCheck aria-hidden="true" /> Account security
          </p>
          <h1>
            Keep your workspace <span>safe and yours.</span>
          </h1>
          <p className="ht-muted-line">
            HookTrials uses secure, single-use links for account verification and password recovery.
          </p>
          <div className="ht-auth-proof">
            <span>
              <CheckCircle2 aria-hidden="true" /> Single-use links
            </span>
            <span>
              <CheckCircle2 aria-hidden="true" /> Short expiry
            </span>
            <span>
              <CheckCircle2 aria-hidden="true" /> No secrets in email
            </span>
          </div>
        </div>
      </section>
      <section className="ht-auth-panel">
        <LanguageSwitcher />
        {children}
      </section>
    </main>
  );
}

export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [state, setState] = useState<'loading' | 'success' | 'error'>('loading');
  useEffect(() => {
    const token = params.get('token');
    if (!token) {
      setState('error');
      return;
    }
    apiRequest('/v1/auth/verify-email', { method: 'POST', body: JSON.stringify({ token }) })
      .then(() => setState('success'))
      .catch(() => setState('error'));
  }, [params]);
  return (
    <ActionShell>
      <div className="ht-auth-card">
        <p className="ht-kicker">Email verification</p>
        <h2>
          {state === 'loading'
            ? 'Checking your link…'
            : state === 'success'
              ? 'Email verified'
              : 'Link unavailable'}
        </h2>
        <p className="ht-muted-line">
          {state === 'loading'
            ? 'One moment while we secure your account.'
            : state === 'success'
              ? 'Your account is ready. Log in to continue.'
              : 'This link may have expired or already been used.'}
        </p>
        {state === 'success' ? (
          <button className="button primary" type="button" onClick={() => navigate('/login')}>
            Log in <ArrowRight aria-hidden="true" />
          </button>
        ) : state === 'error' ? (
          <Link className="button primary" to="/register">
            Create a new account
          </Link>
        ) : null}
      </div>
    </ActionShell>
  );
}

export function ForgotPasswordPage() {
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    const email = String(new FormData(event.currentTarget).get('email'));
    try {
      await apiRequest('/v1/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      });
      setSent(true);
    } catch (requestError) {
      setError(readableError(requestError));
    } finally {
      setSubmitting(false);
    }
  }
  return (
    <ActionShell>
      <div className="ht-auth-card">
        <p className="ht-kicker">Password recovery</p>
        <h2>{sent ? 'Check your inbox' : 'Forgot your password?'}</h2>
        <p className="ht-muted-line">
          {sent
            ? 'If an account matches that address, we sent a secure reset link.'
            : 'Enter your account email and we’ll send a single-use reset link.'}
        </p>
        {!sent ? (
          <form onSubmit={submit}>
            <label className="ht-field">
              Email
              <input name="email" type="email" autoComplete="email" required />
            </label>
            {error ? (
              <p className="ht-form-error" role="alert">
                {error}
              </p>
            ) : null}
            <button className="button primary" type="submit" disabled={submitting}>
              {submitting ? 'Please wait…' : 'Send reset link'}{' '}
              {!submitting ? <ArrowRight aria-hidden="true" /> : null}
            </button>
          </form>
        ) : null}
        <p className="ht-auth-switch">
          <Link to="/login">Back to log in</Link>
        </p>
      </div>
    </ActionShell>
  );
}

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    const data = new FormData(event.currentTarget);
    try {
      await apiRequest('/v1/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({
          token: params.get('token'),
          password: String(data.get('password')),
        }),
      });
      setDone(true);
    } catch (requestError) {
      setError(readableError(requestError));
    } finally {
      setSubmitting(false);
    }
  }
  return (
    <ActionShell>
      <div className="ht-auth-card">
        <p className="ht-kicker">Password recovery</p>
        <h2>{done ? 'Password updated' : 'Choose a new password'}</h2>
        <p className="ht-muted-line">
          {done
            ? 'Your password has been changed. Log in with the new one.'
            : 'Use at least 12 characters. This link can only be used once.'}
        </p>
        {!done ? (
          <form onSubmit={submit}>
            <label className="ht-field">
              New password
              <input
                name="password"
                type="password"
                minLength={12}
                autoComplete="new-password"
                required
              />
            </label>
            {error ? (
              <p className="ht-form-error" role="alert">
                {error}
              </p>
            ) : null}
            <button className="button primary" type="submit" disabled={submitting}>
              {submitting ? 'Please wait…' : 'Update password'}{' '}
              {!submitting ? <ArrowRight aria-hidden="true" /> : null}
            </button>
          </form>
        ) : (
          <button className="button primary" type="button" onClick={() => navigate('/login')}>
            Log in <ArrowRight aria-hidden="true" />
          </button>
        )}
      </div>
    </ActionShell>
  );
}
