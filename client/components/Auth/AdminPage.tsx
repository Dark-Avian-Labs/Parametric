import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

import { useApi } from '../../hooks/useApi';
import { apiFetch } from '../../utils/api';

interface User {
  id: number;
  username: string;
  is_admin: number;
  created_at: string;
  games: string[];
}

interface ShardBuff {
  id: number;
  shard_type_id: string;
  description: string;
  base_value: number;
  tauforged_value: number;
  value_format: string;
}

interface ShardType {
  id: string;
  name: string;
  icon_path: string;
  tauforged_icon_path: string;
  buffs: ShardBuff[];
}

const GAME_IDS = ['parametric', 'warframe', 'epic7'];
const AUTH_ADMIN_URL_RAW = import.meta.env.VITE_AUTH_ADMIN_URL as
  | string
  | undefined;
const AUTH_ADMIN_URL =
  typeof AUTH_ADMIN_URL_RAW === 'string' && AUTH_ADMIN_URL_RAW.trim().length > 0
    ? AUTH_ADMIN_URL_RAW.trim()
    : 'http://localhost:3010/admin';

export function AdminPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userManagementMoved, setUserManagementMoved] = useState(false);

  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newConfirmPassword, setNewConfirmPassword] = useState('');
  const [newIsAdmin, setNewIsAdmin] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSuccess, setCreateSuccess] = useState<string | null>(null);

  const loadUsers = async () => {
    try {
      const res = await apiFetch('/api/auth/users');
      const data = await res.json();
      if (!res.ok) {
        const serverError =
          typeof data?.error === 'string' ? data.error : 'Failed to load users';
        if (
          serverError.includes('User management moved to the Auth application')
        ) {
          setUserManagementMoved(true);
          setError(null);
          setUsers([]);
          return;
        }
        setError(serverError);
        return;
      }
      const rawUsers: {
        id: number;
        username: string;
        is_admin: number;
        created_at: string;
      }[] = data.users;

      const usersWithGames = await Promise.all(
        rawUsers.map(async (u) => {
          try {
            const gRes = await apiFetch(`/api/auth/users/${u.id}/games`);
            const gData = await gRes.json();
            return { ...u, games: gRes.ok ? (gData.games as string[]) : [] };
          } catch {
            return { ...u, games: [] };
          }
        }),
      );
      setUsers(usersWithGames);
    } catch {
      setError('Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreateError(null);
    setCreateSuccess(null);

    try {
      const res = await apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          username: newUsername,
          password: newPassword,
          confirm_password: newConfirmPassword,
          is_admin: newIsAdmin,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setCreateError(data.error);
      } else {
        setCreateSuccess(`User "${newUsername}" created`);
        setNewUsername('');
        setNewPassword('');
        setNewConfirmPassword('');
        setNewIsAdmin(false);
        loadUsers();
      }
    } catch {
      setCreateError('Failed to create user');
    }
  };

  const handleDeleteUser = async (userId: number, username: string) => {
    if (!confirm(`Delete user "${username}"?`)) return;

    try {
      const res = await apiFetch(`/api/auth/users/${userId}`, {
        method: 'DELETE',
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || 'Failed to delete user');
      } else {
        loadUsers();
      }
    } catch {
      alert('Failed to delete user');
    }
  };

  const handleToggleGameAccess = async (
    userId: number,
    gameId: string,
    currentlyGranted: boolean,
  ) => {
    try {
      const res = await apiFetch('/api/auth/game-access', {
        method: 'POST',
        body: JSON.stringify({
          user_id: userId,
          game_id: gameId,
          enabled: !currentlyGranted,
        }),
      });
      if (res.ok) {
        setUsers((prev) =>
          prev.map((u) => {
            if (u.id !== userId) return u;
            const games = currentlyGranted
              ? u.games.filter((g) => g !== gameId)
              : [...u.games, gameId];
            return { ...u, games };
          }),
        );
      }
    } catch {
      // ignore
    }
  };

  if (loading) {
    return (
      <div className="glass-shell flex h-64 items-center justify-center">
        <p className="text-muted">Loading...</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-foreground">Admin Panel</h1>
        <div className="flex gap-2">
          <Link to="/builder" className="btn btn-secondary">
            Back to App
          </Link>
          <a
            href={AUTH_ADMIN_URL}
            target="_blank"
            rel="noreferrer"
            className="btn btn-secondary"
          >
            User Management
          </a>
        </div>
      </div>
      {userManagementMoved && (
        <div className="glass-surface p-5">
          <p className="text-sm text-muted">
            User management moved to the shared Auth application.
          </p>
          <a
            href={AUTH_ADMIN_URL}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-block text-sm text-accent hover:underline"
          >
            Open Auth Admin
          </a>
        </div>
      )}
      {error && !userManagementMoved && (
        <div className="glass-shell p-6">
          <div className="error-msg">{error}</div>
          <p className="mt-3 text-sm text-muted">
            You may need to be logged in as an admin to access this page.
          </p>
        </div>
      )}

      {!userManagementMoved && (
        <>
          <div className="glass-surface p-6">
            <h2 className="mb-4 text-lg font-semibold text-foreground">
              Create User
            </h2>

            {createError && <div className="error-msg mb-4">{createError}</div>}
            {createSuccess && (
              <div className="success-msg mb-4">{createSuccess}</div>
            )}

            <form
              onSubmit={handleCreateUser}
              className="flex flex-wrap items-end gap-3"
            >
              <div className="flex-1" style={{ minWidth: 120 }}>
                <label className="mb-1 block text-sm text-muted">
                  Username
                </label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className="form-input"
                  required
                />
              </div>
              <div className="flex-1" style={{ minWidth: 120 }}>
                <label className="mb-1 block text-sm text-muted">
                  Password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="form-input"
                  required
                />
              </div>
              <div className="flex-1" style={{ minWidth: 120 }}>
                <label className="mb-1 block text-sm text-muted">Confirm</label>
                <input
                  type="password"
                  value={newConfirmPassword}
                  onChange={(e) => setNewConfirmPassword(e.target.value)}
                  className="form-input"
                  required
                />
              </div>
              <label className="flex items-center gap-2 pb-2.5 text-sm text-muted">
                <input
                  type="checkbox"
                  checked={newIsAdmin}
                  onChange={(e) => setNewIsAdmin(e.target.checked)}
                  className="accent-accent"
                />
                Admin
              </label>
              <button type="submit" className="btn btn-accent">
                Create
              </button>
            </form>
          </div>

          <div className="glass-shell overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-glass-border">
                  <th className="bg-surface-thead px-4 py-3 text-left text-sm font-semibold text-muted">
                    ID
                  </th>
                  <th className="bg-surface-thead px-4 py-3 text-left text-sm font-semibold text-muted">
                    Username
                  </th>
                  <th className="bg-surface-thead px-4 py-3 text-left text-sm font-semibold text-muted">
                    Role
                  </th>
                  {GAME_IDS.map((g) => (
                    <th
                      key={g}
                      className="bg-surface-thead px-3 py-3 text-center text-sm font-semibold text-muted"
                    >
                      {g}
                    </th>
                  ))}
                  <th className="bg-surface-thead px-4 py-3 text-left text-sm font-semibold text-muted">
                    Created
                  </th>
                  <th className="bg-surface-thead px-4 py-3 text-right text-sm font-semibold text-muted">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className="border-b border-glass-divider">
                    <td className="px-4 py-3 text-sm text-muted">{user.id}</td>
                    <td className="px-4 py-3 text-sm font-medium text-foreground">
                      {user.username}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {user.is_admin ? (
                        <span className="rounded bg-warning/15 px-2 py-0.5 text-xs font-semibold text-warning">
                          Admin
                        </span>
                      ) : (
                        <span className="text-muted">User</span>
                      )}
                    </td>
                    {GAME_IDS.map((g) => {
                      const granted = user.games.includes(g);
                      return (
                        <td key={g} className="px-3 py-3 text-center">
                          <button
                            onClick={() =>
                              handleToggleGameAccess(user.id, g, granted)
                            }
                            className={`inline-flex h-5 w-5 items-center justify-center rounded text-xs font-bold transition-colors ${
                              granted
                                ? 'bg-success/20 text-success hover:bg-success/30'
                                : 'bg-muted/10 text-muted/40 hover:bg-muted/20'
                            }`}
                            title={granted ? `Revoke ${g}` : `Grant ${g}`}
                          >
                            {granted ? '\u2713' : '\u2715'}
                          </button>
                        </td>
                      );
                    })}
                    <td className="px-4 py-3 text-sm text-muted">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => handleDeleteUser(user.id, user.username)}
                        className="btn btn-sm btn-danger"
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <ArchonShardAdmin />
    </div>
  );
}

function ArchonShardAdmin() {
  const { data, refetch } = useApi<{ shards: ShardType[] }>(
    '/api/archon-shards',
  );
  const shards = data?.shards || [];
  const [editingBuff, setEditingBuff] = useState<ShardBuff | null>(null);

  const handleSaveBuff = async () => {
    if (!editingBuff) return;
    await apiFetch(`/api/archon-shards/buffs/${editingBuff.id}`, {
      method: 'PUT',
      body: JSON.stringify(editingBuff),
    });
    setEditingBuff(null);
    refetch();
  };

  const handleDeleteBuff = async (id: number) => {
    if (!confirm('Delete this buff?')) return;
    await apiFetch(`/api/archon-shards/buffs/${id}`, { method: 'DELETE' });
    refetch();
  };

  const handleAddBuff = async (shardTypeId: string) => {
    await apiFetch('/api/archon-shards/buffs', {
      method: 'POST',
      body: JSON.stringify({
        shard_type_id: shardTypeId,
        description: 'New Buff',
        base_value: 0,
        tauforged_value: 0,
        value_format: '%',
        sort_order: 99,
      }),
    });
    refetch();
  };

  return (
    <div className="glass-surface p-6">
      <h2 className="mb-4 text-lg font-semibold text-foreground">
        Archon Shards
      </h2>
      <p className="mb-3 text-xs text-muted">
        Edit shard types and their buff values.
      </p>

      <div className="space-y-4">
        {shards.map((shard) => (
          <div key={shard.id} className="glass-surface rounded-lg p-3">
            <div className="mb-2 flex items-center gap-2">
              <img
                src={shard.icon_path}
                alt=""
                className="h-5 w-5 object-contain"
              />
              <span className="text-sm font-semibold text-foreground">
                {shard.name}
              </span>
            </div>
            <div className="space-y-1">
              {shard.buffs.map((buff) => (
                <div key={buff.id} className="flex items-center gap-2 text-xs">
                  {editingBuff?.id === buff.id ? (
                    <>
                      <input
                        type="text"
                        value={editingBuff.description}
                        onChange={(e) =>
                          setEditingBuff({
                            ...editingBuff,
                            description: e.target.value,
                          })
                        }
                        className="form-input flex-1 text-xs"
                      />
                      <input
                        type="number"
                        value={editingBuff.base_value}
                        onChange={(e) =>
                          setEditingBuff({
                            ...editingBuff,
                            base_value: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="form-input w-16 text-xs"
                        step="0.1"
                      />
                      <input
                        type="number"
                        value={editingBuff.tauforged_value}
                        onChange={(e) =>
                          setEditingBuff({
                            ...editingBuff,
                            tauforged_value: parseFloat(e.target.value) || 0,
                          })
                        }
                        className="form-input w-16 text-xs"
                        step="0.1"
                      />
                      <select
                        value={editingBuff.value_format}
                        onChange={(e) =>
                          setEditingBuff({
                            ...editingBuff,
                            value_format: e.target.value,
                          })
                        }
                        className="form-input w-16 text-xs"
                      >
                        <option value="%">%</option>
                        <option value="+flat">+flat</option>
                        <option value="/s">/s</option>
                        <option value="proc">proc</option>
                      </select>
                      <button
                        onClick={handleSaveBuff}
                        className="text-success hover:text-success/80"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => setEditingBuff(null)}
                        className="text-muted hover:text-foreground"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-muted">
                        {buff.description}
                      </span>
                      <span className="w-16 text-center text-foreground">
                        {buff.base_value}
                      </span>
                      <span className="w-16 text-center text-warning">
                        {buff.tauforged_value}
                      </span>
                      <span className="w-10 text-center text-muted/50">
                        {buff.value_format}
                      </span>
                      <button
                        onClick={() => setEditingBuff({ ...buff })}
                        className="text-accent hover:text-accent/80"
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => handleDeleteBuff(buff.id)}
                        className="text-danger hover:text-danger/80"
                      >
                        &times;
                      </button>
                    </>
                  )}
                </div>
              ))}
              <button
                onClick={() => handleAddBuff(shard.id)}
                className="mt-1 text-xs text-accent hover:text-accent/80"
              >
                + Add buff
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
