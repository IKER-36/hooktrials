import { useState, type FormEvent } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { Brand } from '../components/Brand';
import { useAuth } from '../context/AuthContext';
import { readableError } from '../lib/api';

const SEQUENCE = ['500', '503', '429', '200'] as const;

export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const registerMode = mode === 'register';
  const { user, loading, setup, login, register } = useAuth();
  const navigate = useNavigate();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!loading && user) return <Navigate to="/app" replace />;
  if (!loading && registerMode && setup && !setup.registrationOpen) {
    return <Navigate to="/login" replace />;
  }

  const ownerSetup = registerMode && setup?.setupRequired;

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError('');
    const data = new FormData(event.currentTarget);
    try {
      if (registerMode) {
        await register(
          String(data.get('displayName')),
          String(data.get('email')),
          String(data.get('password')),
        );
      } else {
        await login(String(data.get('email')), String(data.get('password')));
      }
      navigate('/app', { replace: true });
    } catch (requestError) {
      setError(readableError(requestError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="ht-auth">
      <section className="ht-auth-aside">
        <Brand />
        <div className="ht-auth-pitch">
          <p className="ht-kicker">Webhook reliability, measured</p>
          <h1>
            Break it here.
            <span> Not in production.</span>
          </h1>
          <p className="ht-muted-line">
            Create private endpoints, run deterministic failure scenarios and understand every
            retry.
          </p>
          <div className="ht-auth-sequence" aria-hidden="true">
            {SEQUENCE.map((code, index) => (
              <span key={code}>
                {index > 0 ? <i>──</i> : null}
                <code className={code === '200' ? 'ok' : code === '429' ? 'warn' : 'err'}>
                  {code}
                </code>
              </span>
            ))}
          </div>
        </div>
        <a
          className="ht-cubepath-mini"
          href="https://cubepath.com/"
          target="_blank"
          rel="noreferrer"
        >
          Hosted on CubePath
        </a>
      </section>

      <section className="ht-auth-panel">
        <div className="ht-auth-card">
          <p className="ht-kicker">
            {ownerSetup ? 'Initial setup' : registerMode ? 'Create account' : 'Log in'}
          </p>
          <h2>
            {ownerSetup
              ? 'Create owner account'
              : registerMode
                ? 'Start your first trial'
                : 'Welcome back'}
          </h2>
          <p className="ht-muted-line">
            {ownerSetup
              ? 'This first account controls your self-hosted installation.'
              : registerMode
                ? setup?.deploymentMode === 'cloud'
                  ? 'Free hosted sandbox. No credit card.'
                  : 'Create an account on this installation.'
                : 'Continue to your webhook labs.'}
          </p>
          <form onSubmit={submit}>
            {registerMode ? (
              <label className="ht-field">
                Display name
                <input name="displayName" autoComplete="name" minLength={2} required />
              </label>
            ) : null}
            <label className="ht-field">
              Email
              <input name="email" type="email" autoComplete="email" required />
            </label>
            <label className="ht-field">
              Password
              <input
                name="password"
                type="password"
                minLength={registerMode ? 12 : 1}
                autoComplete={registerMode ? 'new-password' : 'current-password'}
                required
              />
              {registerMode ? <small>At least 12 characters.</small> : null}
            </label>
            {error ? (
              <p className="ht-form-error" role="alert">
                {error}
              </p>
            ) : null}
            <button className="button primary" type="submit" disabled={submitting}>
              {submitting ? 'Please wait…' : registerMode ? 'Create account' : 'Log in'}
            </button>
          </form>
          {!ownerSetup && (registerMode || setup?.registrationOpen) ? (
            <p className="ht-auth-switch">
              {registerMode ? 'Already have an account?' : 'New to HookTrials?'}{' '}
              <Link to={registerMode ? '/login' : '/register'}>
                {registerMode ? 'Log in' : 'Create account'}
              </Link>
            </p>
          ) : !registerMode && setup?.deploymentMode === 'selfhost' ? (
            <p className="ht-auth-switch">Owner access · registration closed</p>
          ) : null}
          <p className="ht-auth-switch">
            <a href="https://github.com/IKER-36/hooktrials" target="_blank" rel="noreferrer">
              Source code · AGPL-3.0
            </a>
          </p>
        </div>
      </section>
    </main>
  );
}
