import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Users, UserPlus, ShieldCheck, Trash2 } from 'lucide-react';
import { CopyButton } from '../../components/ui/CopyButton';
import { ProductState } from '../../components/ui/ProductState';
import { apiRequest, readableError } from '../../lib/api';
import type { WorkspaceMember, WorkspaceResponse, WorkspaceRole } from '../../lib/types';

const assignableRoles: Array<Exclude<WorkspaceRole, 'owner'>> = ['admin', 'operator', 'viewer'];

export function WorkspacePage() {
  const [data, setData] = useState<WorkspaceResponse | null>(null);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<Exclude<WorkspaceRole, 'owner'>>('operator');
  const [inviteToken, setInviteToken] = useState('');
  const [acceptToken, setAcceptToken] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setData(await apiRequest<WorkspaceResponse>('/v1/workspace'));
  }, []);

  useEffect(() => {
    void load().catch((requestError) => setError(readableError(requestError)));
  }, [load]);

  const canManage = data ? data.currentRole === 'owner' || data.currentRole === 'admin' : false;

  async function invite(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const response = await apiRequest<{
        invite: WorkspaceResponse['invites'][number];
        token: string;
      }>('/v1/workspace/invites', { method: 'POST', body: JSON.stringify({ email, role }) });
      setInviteToken(response.token);
      setEmail('');
      setMessage('Invitation created. Share the one-time token with the invited user.');
      await load();
    } catch (requestError) {
      setError(readableError(requestError));
    } finally {
      setBusy(false);
    }
  }

  async function updateMember(member: WorkspaceMember, nextRole: Exclude<WorkspaceRole, 'owner'>) {
    setBusy(true);
    setError('');
    try {
      await apiRequest(`/v1/workspace/members/${member.userId}`, {
        method: 'PATCH',
        body: JSON.stringify({ role: nextRole }),
      });
      await load();
    } catch (requestError) {
      setError(readableError(requestError));
    } finally {
      setBusy(false);
    }
  }

  async function removeMember(member: WorkspaceMember) {
    setBusy(true);
    setError('');
    try {
      await apiRequest(`/v1/workspace/members/${member.userId}`, { method: 'DELETE' });
      await load();
    } catch (requestError) {
      setError(readableError(requestError));
    } finally {
      setBusy(false);
    }
  }

  async function acceptInvite(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await apiRequest('/v1/workspace/invites/accept', {
        method: 'POST',
        body: JSON.stringify({ token: acceptToken.trim() }),
      });
      setAcceptToken('');
      setMessage('Invitation accepted. Your active workspace has been refreshed.');
      await load();
    } catch (requestError) {
      setError(readableError(requestError));
    } finally {
      setBusy(false);
    }
  }

  if (!data && error) {
    return (
      <section className="ht-page">
        <ProductState
          tone="danger"
          eyebrow="Workspace"
          title="Workspace could not load."
          description={error}
        />
      </section>
    );
  }
  if (!data)
    return (
      <section className="ht-page">
        <div className="ht-skeleton tall" />
      </section>
    );

  return (
    <section className="ht-page" data-product-area="resources">
      <header className="ht-page-head">
        <div>
          <div className="ht-eyebrow">
            <Users aria-hidden="true" /> Team workspace
          </div>
          <h1>{data.workspace?.name ?? 'Workspace'}</h1>
          <p className="ht-muted-line">
            Share reliability evidence without sharing credentials or personal accounts.
          </p>
        </div>
        <span className="ht-status-chip healthy">
          <ShieldCheck aria-hidden="true" /> {data.currentRole}
        </span>
      </header>

      {error ? (
        <div className="ht-form-error" role="alert">
          {error}
        </div>
      ) : null}
      {message ? (
        <div className="ht-form-success" role="status">
          {message}
        </div>
      ) : null}

      <div className="ht-grid-2">
        <section className="ht-panel">
          <div className="ht-section-heading">
            <div>
              <span className="ht-eyebrow">Members</span>
              <h2>People with access</h2>
            </div>
            <strong>{data.members.length}</strong>
          </div>
          <div className="ht-stack">
            {data.members.map((member) => (
              <div className="ht-list-row" key={member.userId}>
                <div>
                  <strong>{member.displayName}</strong>
                  <small>{member.email}</small>
                </div>
                <div className="ht-inline-actions">
                  {member.role === 'owner' ? (
                    <span className="ht-status-chip">owner</span>
                  ) : canManage ? (
                    <select
                      aria-label={`Role for ${member.email}`}
                      value={member.role}
                      disabled={busy}
                      onChange={(event) =>
                        void updateMember(
                          member,
                          event.target.value as Exclude<WorkspaceRole, 'owner'>,
                        )
                      }
                    >
                      {assignableRoles.map((value) => (
                        <option key={value} value={value}>
                          {value}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <span className="ht-status-chip">{member.role}</span>
                  )}
                  {canManage && member.role !== 'owner' ? (
                    <button
                      className="button danger compact"
                      type="button"
                      disabled={busy}
                      onClick={() => void removeMember(member)}
                      aria-label={`Remove ${member.email}`}
                    >
                      <Trash2 aria-hidden="true" />
                    </button>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="ht-panel">
          <div className="ht-section-heading">
            <div>
              <span className="ht-eyebrow">Invite</span>
              <h2>Add a teammate</h2>
            </div>
            <UserPlus aria-hidden="true" />
          </div>
          {canManage ? (
            <form className="ht-stack" onSubmit={invite}>
              <label>
                Email
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="teammate@example.com"
                />
              </label>
              <label>
                Role
                <select
                  value={role}
                  onChange={(event) =>
                    setRole(event.target.value as Exclude<WorkspaceRole, 'owner'>)
                  }
                >
                  {assignableRoles.map((value) => (
                    <option key={value} value={value}>
                      {value}
                    </option>
                  ))}
                </select>
              </label>
              <button className="button primary" type="submit" disabled={busy}>
                <UserPlus aria-hidden="true" /> Create invite
              </button>
              {inviteToken ? (
                <div className="ht-copy-block">
                  <code>{inviteToken}</code>
                  <CopyButton value={inviteToken} label="Copy invite token" />
                </div>
              ) : null}
              <p className="ht-form-note">
                Invites expire after seven days. The invited user must sign in with the invited
                email before accepting the token.
              </p>
            </form>
          ) : (
            <p className="ht-muted-line">Only owners and admins can invite or manage members.</p>
          )}
        </section>
      </div>

      {canManage && data.invites.length > 0 ? (
        <section className="ht-panel">
          <span className="ht-eyebrow">Pending</span>
          <h2>Open invitations</h2>
          <div className="ht-stack">
            {data.invites.map((invite) => (
              <div className="ht-list-row" key={invite.id}>
                <div>
                  <strong>{invite.email}</strong>
                  <small>
                    {invite.role} · expires {new Date(invite.expiresAt).toLocaleDateString()}
                  </small>
                </div>
                <span className="ht-status-chip">pending</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}
      <section className="ht-panel">
        <span className="ht-eyebrow">Join</span>
        <h2>Accept an invitation</h2>
        <p className="ht-muted-line">
          Already received a token? Accept it while signed in with the invited email.
        </p>
        <form className="ht-inline-actions" onSubmit={acceptInvite}>
          <input
            aria-label="Workspace invitation token"
            value={acceptToken}
            onChange={(event) => setAcceptToken(event.target.value)}
            placeholder="Paste invite token"
            required
          />
          <button className="button secondary" type="submit" disabled={busy}>
            Join workspace
          </button>
        </form>
      </section>
    </section>
  );
}
