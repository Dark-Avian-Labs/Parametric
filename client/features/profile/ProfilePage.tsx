import clsx from 'clsx';
import { useEffect, useState } from 'react';

import { Modal } from '../../components/ui/Modal';
import { useTheme, type ThemeMode, type UiStyle } from '../../context/ThemeContext';
import { apiFetch } from '../../utils/api';
import { useAuth } from '../auth/AuthContext';

function ModePillToggle({ mode, setMode }: { mode: ThemeMode; setMode: (m: ThemeMode) => void }) {
  return (
    <div
      className="border-glass-border bg-glass/40 inline-flex rounded-full border p-0.5"
      role="group"
      aria-label="Color mode"
    >
      <button
        type="button"
        className={clsx(
          'rounded-full px-4 py-1.5 text-xs font-medium transition-all outline-none',
          mode === 'light'
            ? 'bg-glass-active text-foreground shadow-sm'
            : 'text-muted hover:text-foreground',
        )}
        aria-pressed={mode === 'light'}
        onClick={() => setMode('light')}
      >
        Light
      </button>
      <button
        type="button"
        className={clsx(
          'rounded-full px-4 py-1.5 text-xs font-medium transition-all outline-none',
          mode === 'dark'
            ? 'bg-glass-active text-foreground shadow-sm'
            : 'text-muted hover:text-foreground',
        )}
        aria-pressed={mode === 'dark'}
        onClick={() => setMode('dark')}
      >
        Dark
      </button>
    </div>
  );
}

export function ProfilePage() {
  const { account, updateProfile } = useAuth();
  const { mode, setMode, uiStyle, setUiStyle } = useTheme();
  const profile = account?.profile;
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [saveStatus, setSaveStatus] = useState<{
    message: string;
    type: 'success' | 'error';
  } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showChangePassword, setShowChangePassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordStatus, setPasswordStatus] = useState<{
    type: 'ok' | 'err';
    message: string;
  } | null>(null);
  const [passwordSaving, setPasswordSaving] = useState(false);

  useEffect(() => {
    if (!profile) return;
    setDisplayName(profile.displayName);
    setEmail(profile.email);
  }, [profile]);

  if (!profile) {
    return (
      <div className="mx-auto max-w-4xl">
        <div className="glass-shell p-6">
          <p className="text-muted text-sm">Unable to load profile data.</p>
        </div>
      </div>
    );
  }

  const handleSave = async () => {
    const trimmedEmail = email.trim();
    const isValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail);
    if (!isValidEmail) {
      setSaveStatus({
        type: 'error',
        message: 'Please enter a valid email address.',
      });
      return;
    }

    setIsSaving(true);
    setSaveStatus(null);
    try {
      await updateProfile({
        displayName: displayName.trim() || profile.username,
        email: trimmedEmail,
      });
      setSaveStatus({ type: 'success', message: 'Profile saved.' });
    } catch (e) {
      console.error('Failed to save profile', e);
      setSaveStatus({ type: 'error', message: 'Failed to save profile.' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async () => {
    const current = currentPassword;
    const next = newPassword;
    const confirm = confirmPassword;
    if (!current || !next) {
      setPasswordStatus({
        type: 'err',
        message: 'Current password and new password are required.',
      });
      return;
    }
    if (next.length < 8) {
      setPasswordStatus({
        type: 'err',
        message: 'New password must be at least 8 characters.',
      });
      return;
    }
    if (next !== confirm) {
      setPasswordStatus({ type: 'err', message: 'Passwords do not match.' });
      return;
    }

    setPasswordSaving(true);
    try {
      const response = await apiFetch('/api/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          current_password: current,
          new_password: next,
        }),
      });
      const body = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;
      if (!response.ok) {
        setPasswordStatus({
          type: 'err',
          message: body?.error || 'Failed to change password.',
        });
        return;
      }
      setPasswordStatus({ type: 'ok', message: 'Password updated.' });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      console.error('Failed to change password', err);
      setPasswordStatus({
        type: 'err',
        message: 'Failed to change password.',
      });
    } finally {
      setPasswordSaving(false);
    }
  };

  const resetPasswordModalState = () => {
    setShowChangePassword(false);
    setPasswordStatus(null);
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  const sectionHeaderClass = 'border-glass-divider bg-glass-hover/50 border-b px-4 py-2.5';

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="glass-shell p-6">
        <h1 className="text-foreground text-2xl font-semibold">Profile</h1>
      </div>

      <div className="glass-shell overflow-hidden p-0">
        <div className={sectionHeaderClass}>
          <h2 className="text-muted text-sm font-semibold tracking-wider uppercase">Details</h2>
        </div>
        <div className="p-6">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label htmlFor="profile-username" className="text-muted mb-1.5 block text-sm">
                Username
              </label>
              <input
                id="profile-username"
                className="form-input"
                type="text"
                readOnly
                value={profile.username}
              />
            </div>
            <div>
              <label htmlFor="profile-role" className="text-muted mb-1.5 block text-sm">
                Role
              </label>
              <input
                id="profile-role"
                className="form-input"
                type="text"
                readOnly
                value={profile.isAdmin ? 'Admin' : 'User'}
              />
            </div>
            <div>
              <label htmlFor="profile-display-name" className="text-muted mb-1.5 block text-sm">
                Name
              </label>
              <input
                id="profile-display-name"
                className="form-input"
                type="text"
                value={displayName}
                onChange={(event) => {
                  setDisplayName(event.target.value);
                  setSaveStatus(null);
                }}
                placeholder="Display name"
              />
            </div>
            <div>
              <label htmlFor="profile-email" className="text-muted mb-1.5 block text-sm">
                Email
              </label>
              <input
                id="profile-email"
                className="form-input"
                type="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setSaveStatus(null);
                }}
                placeholder="you@example.com"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="glass-shell overflow-hidden p-0">
        <div className={sectionHeaderClass}>
          <h2 className="text-muted text-sm font-semibold tracking-wider uppercase">Theme</h2>
        </div>
        <div className="flex flex-col gap-4 p-6 sm:flex-row sm:flex-wrap sm:items-center">
          <div className="min-w-[12rem] flex-1">
            <label htmlFor="profile-ui-style" className="text-muted mb-1.5 block text-sm">
              Interface style
            </label>
            <select
              id="profile-ui-style"
              className="form-input w-full"
              value={uiStyle}
              onChange={(e) => setUiStyle(e.target.value as UiStyle)}
            >
              <option value="prism">Prism</option>
              <option value="shadow">Shadow</option>
            </select>
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-muted text-sm">Appearance</span>
            <ModePillToggle mode={mode} setMode={setMode} />
          </div>
        </div>
      </div>

      <div className="glass-shell overflow-hidden p-0">
        <div className={sectionHeaderClass}>
          <h2 className="text-muted text-sm font-semibold tracking-wider uppercase">Security</h2>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 p-6">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              setShowChangePassword(true);
              setPasswordStatus(null);
            }}
          >
            Change Password
          </button>
          <div className="flex flex-col items-end gap-2">
            <button
              type="button"
              className="btn btn-accent"
              onClick={() => {
                void handleSave();
              }}
              disabled={isSaving}
            >
              {isSaving ? 'Saving...' : 'Save'}
            </button>
            {saveStatus ? (
              <p
                className={`text-sm ${
                  saveStatus.type === 'success' ? 'text-success' : 'text-danger'
                }`}
                role="status"
                aria-live="polite"
              >
                {saveStatus.message}
              </p>
            ) : null}
          </div>
        </div>
      </div>

      <Modal
        open={showChangePassword}
        className="max-w-md"
        ariaLabelledBy="change-password-title"
        onClose={resetPasswordModalState}
      >
        <h3 id="change-password-title" className="text-foreground mb-3 text-lg font-semibold">
          Change Password
        </h3>
        <div className="space-y-3">
          <label htmlFor="current-password" className="sr-only">
            Current password
          </label>
          <input
            id="current-password"
            className="form-input"
            type="password"
            autoComplete="current-password"
            placeholder="Current password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
          />
          <label htmlFor="new-password" className="sr-only">
            New password
          </label>
          <input
            id="new-password"
            className="form-input"
            type="password"
            autoComplete="new-password"
            placeholder="New password"
            value={newPassword}
            onChange={(event) => setNewPassword(event.target.value)}
          />
          <label htmlFor="confirm-password" className="sr-only">
            Confirm new password
          </label>
          <input
            id="confirm-password"
            className="form-input"
            type="password"
            autoComplete="new-password"
            placeholder="Confirm new password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
          />
        </div>
        {passwordStatus && (
          <p
            className={`mt-3 text-sm ${
              passwordStatus.type === 'ok' ? 'text-success' : 'text-danger'
            }`}
            role={passwordStatus.type === 'ok' ? 'status' : 'alert'}
            aria-live={passwordStatus.type === 'ok' ? 'polite' : 'assertive'}
          >
            {passwordStatus.message}
          </p>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            className="btn btn-secondary text-sm"
            onClick={resetPasswordModalState}
          >
            Close
          </button>
          <button
            type="button"
            className="btn btn-accent text-sm"
            onClick={() => {
              void handleChangePassword();
            }}
            disabled={passwordSaving}
          >
            {passwordSaving ? 'Saving...' : 'Update Password'}
          </button>
        </div>
      </Modal>
    </div>
  );
}
