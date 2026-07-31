import { useEffect, useState, type FormEvent } from 'react';
import { Camera, KeyRound, LockKeyhole, Mail, Save, ShieldCheck, UserRound } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { apiRequest, readableError } from '../../lib/api';

function Avatar({ name, avatarUrl }: { name: string; avatarUrl?: string | null }) {
  if (avatarUrl) {
    return (
      <img className="ht-settings-avatar" src={avatarUrl} alt="" referrerPolicy="no-referrer" />
    );
  }
  return (
    <span className="ht-settings-avatar ht-settings-avatar-fallback">
      {name.slice(0, 1).toUpperCase()}
    </span>
  );
}

export function AccountSettingsPage() {
  const { user, updateUser } = useAuth();
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl ?? '');
  const [email, setEmail] = useState('');
  const [emailPassword, setEmailPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState<'profile' | 'email' | 'password' | null>(null);

  useEffect(() => {
    if (!user) return;
    setDisplayName(user.displayName);
    setAvatarUrl(user.avatarUrl ?? '');
  }, [user]);

  function startSave(kind: typeof saving) {
    setSaving(kind);
    setNotice('');
    setError('');
  }

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startSave('profile');
    try {
      const response = await apiRequest<{ user: typeof user }>('/v1/me/profile', {
        method: 'PATCH',
        body: JSON.stringify({ displayName, avatarUrl: avatarUrl.trim() || null }),
      });
      if (response.user) updateUser(response.user);
      setNotice('Profile updated.');
    } catch (cause) {
      setError(readableError(cause));
    } finally {
      setSaving(null);
    }
  }

  async function requestEmailChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startSave('email');
    try {
      const response = await apiRequest<{ user: typeof user }>('/v1/me/email', {
        method: 'POST',
        body: JSON.stringify({ email, currentPassword: emailPassword }),
      });
      if (response.user) updateUser(response.user);
      setEmail('');
      setEmailPassword('');
      setNotice('Check the new inbox to confirm the email change.');
    } catch (cause) {
      setError(readableError(cause));
    } finally {
      setSaving(null);
    }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      setError('The new passwords do not match.');
      return;
    }
    startSave('password');
    try {
      await apiRequest('/v1/me/password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setNotice('Password updated. Other sessions were signed out.');
    } catch (cause) {
      setError(readableError(cause));
    } finally {
      setSaving(null);
    }
  }

  if (!user) return null;

  return (
    <section className="ht-page ht-settings" data-product-area="resources">
      <header className="ht-page-head ht-shared-page-head">
        <div>
          <p className="ht-kicker">ACCOUNT</p>
          <h1>Account settings</h1>
          <p className="ht-muted-line">
            Keep your profile, sign-in and automation access under control.
          </p>
        </div>
        <UserRound aria-hidden="true" />
      </header>

      {notice ? (
        <p className="ht-form-success" role="status">
          {notice}
        </p>
      ) : null}
      {error ? (
        <p className="ht-form-error" role="alert">
          {error}
        </p>
      ) : null}

      <div className="ht-settings-grid">
        <form className="ht-settings-section" onSubmit={(event) => void saveProfile(event)}>
          <header>
            <div className="ht-settings-title">
              <Camera aria-hidden="true" />
              <div>
                <p className="ht-kicker">PROFILE</p>
                <h2>How you appear in HookTrials</h2>
              </div>
            </div>
            <Avatar name={displayName} avatarUrl={avatarUrl} />
          </header>
          <label className="ht-field">
            Display name
            <input
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              minLength={2}
              maxLength={80}
              required
            />
          </label>
          <label className="ht-field">
            Profile photo URL
            <input
              value={avatarUrl}
              onChange={(event) => setAvatarUrl(event.target.value)}
              placeholder="https://…"
              inputMode="url"
            />
            <small>Use a secure image URL. Leave it empty to use your initials.</small>
          </label>
          <button className="button primary" type="submit" disabled={saving !== null}>
            <Save aria-hidden="true" /> {saving === 'profile' ? 'Saving…' : 'Save profile'}
          </button>
        </form>

        <section className="ht-settings-section">
          <header>
            <div className="ht-settings-title">
              <ShieldCheck aria-hidden="true" />
              <div>
                <p className="ht-kicker">ACCOUNT SECURITY</p>
                <h2>Email verification</h2>
              </div>
            </div>
            <span className={`ht-settings-status ${user.emailVerified ? 'verified' : 'pending'}`}>
              {user.emailVerified ? 'Verified' : 'Unverified'}
            </span>
          </header>
          <p className="ht-settings-copy">
            {user.emailVerified
              ? 'Your current email is verified and can receive account security messages.'
              : 'Verify your email to protect recovery and account changes.'}
          </p>
          {user.pendingEmail ? (
            <p className="ht-settings-note">
              Waiting for confirmation at <strong>{user.pendingEmail}</strong>.
            </p>
          ) : null}
          <form className="ht-settings-form" onSubmit={(event) => void requestEmailChange(event)}>
            <label className="ht-field">
              Current email
              <input value={user.email} readOnly />
            </label>
            <label className="ht-field">
              New email
              <input
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                type="email"
                autoComplete="email"
                required
              />
            </label>
            <label className="ht-field">
              Current password
              <input
                value={emailPassword}
                onChange={(event) => setEmailPassword(event.target.value)}
                type="password"
                autoComplete="current-password"
                required
              />
            </label>
            <button className="button secondary" type="submit" disabled={saving !== null}>
              <Mail aria-hidden="true" /> {saving === 'email' ? 'Sending…' : 'Request email change'}
            </button>
          </form>
        </section>

        <form className="ht-settings-section" onSubmit={(event) => void changePassword(event)}>
          <header>
            <div className="ht-settings-title">
              <LockKeyhole aria-hidden="true" />
              <div>
                <p className="ht-kicker">PASSWORD</p>
                <h2>Change your password</h2>
              </div>
            </div>
          </header>
          <label className="ht-field">
            Current password
            <input
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              type="password"
              autoComplete="current-password"
              required
            />
          </label>
          <label className="ht-field">
            New password
            <input
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              type="password"
              minLength={12}
              autoComplete="new-password"
              required
            />
            <small>At least 12 characters. Other active sessions will be signed out.</small>
          </label>
          <label className="ht-field">
            Confirm new password
            <input
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              type="password"
              minLength={12}
              autoComplete="new-password"
              required
            />
          </label>
          <button className="button primary" type="submit" disabled={saving !== null}>
            <LockKeyhole aria-hidden="true" />{' '}
            {saving === 'password' ? 'Updating…' : 'Update password'}
          </button>
        </form>

        <section className="ht-settings-section ht-settings-api">
          <header>
            <div className="ht-settings-title">
              <KeyRound aria-hidden="true" />
              <div>
                <p className="ht-kicker">AUTOMATION</p>
                <h2>API access</h2>
              </div>
            </div>
          </header>
          <p className="ht-settings-copy">
            Create scoped keys for CI, monitoring and safe automation. Secrets are shown once and
            stored as hashes.
          </p>
          <Link className="button secondary" to="/app/api-keys">
            <KeyRound aria-hidden="true" /> Manage API keys
          </Link>
        </section>
      </div>
    </section>
  );
}
