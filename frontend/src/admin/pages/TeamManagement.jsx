import React, { useState, useEffect } from 'react';
import { XCircle, X, UserPlus, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { getAdminUsers, createAdminUser, disableAdminUser } from '../../api';

// ── Role Badge ────────────────────────────────────────────────────────────────
const RoleBadge = ({ role }) => (
  <span className={`px-3 py-1 text-xs font-semibold rounded-md ${
    role === 'Admin' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700'
  }`}>
    {role}
  </span>
);

// ── Status Badge ──────────────────────────────────────────────────────────────
const StatusBadge = ({ status, enabled }) => {
  if (!enabled) return <span className="px-2 py-0.5 text-xs font-semibold rounded bg-red-100 text-red-700">Disabled</span>;
  if (status === 'CONFIRMED') return <span className="px-2 py-0.5 text-xs font-semibold rounded bg-green-100 text-green-700">Active</span>;
  if (status === 'FORCE_CHANGE_PASSWORD') return <span className="px-2 py-0.5 text-xs font-semibold rounded bg-yellow-100 text-yellow-700">Pending Setup</span>;
  return <span className="px-2 py-0.5 text-xs font-semibold rounded bg-gray-100 text-gray-600">{status}</span>;
};

// ── Add User Modal ────────────────────────────────────────────────────────────
const AddUserModal = ({ onClose, onUserCreated }) => {
  const [form, setForm] = useState({ name: '', email: '', role: 'vendor' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.email || !form.name) { setError('Name and email are required.'); return; }
    setLoading(true);
    setError('');
    try {
      const result = await createAdminUser(form.email, form.name, form.role);
      if (result?.detail) { setError(result.detail); return; }
      setSuccess(`✓ ${form.email} created! A temporary password was sent to their email.`);
      setTimeout(() => { onUserCreated(); onClose(); }, 2500);
    } catch (err) {
      setError(err.message || 'Failed to create user. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-gray-900/40 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl border border-gray-200 w-full max-w-lg overflow-hidden">
        <div className="flex justify-between items-center p-6 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-900">Create User Account</h2>
          <button onClick={onClose} disabled={loading} className="p-1 hover:bg-gray-100 rounded text-gray-400 hover:text-gray-600 transition-colors">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-6 space-y-5">
            {error && (
              <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                <AlertCircle size={16} className="shrink-0" /> {error}
              </div>
            )}
            {success && (
              <div className="flex items-center gap-2 bg-green-50 border border-green-200 text-green-700 text-sm rounded-lg px-4 py-3">
                <CheckCircle size={16} className="shrink-0" /> {success}
              </div>
            )}

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Full Name</label>
              <input
                type="text"
                placeholder="Enter full name"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email Address</label>
              <input
                type="email"
                placeholder="user@example.com"
                value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                className="w-full px-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
                disabled={loading}
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Role</label>
              <select
                value={form.role}
                onChange={e => setForm(f => ({ ...f, role: e.target.value }))}
                className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                disabled={loading}
              >
                <option value="vendor">Vendor (Dashboard access)</option>
                <option value="admin">Admin (Full access)</option>
              </select>
            </div>

            <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 text-sm text-blue-700">
              A temporary password will be emailed to the user. They will be prompted to set a new password on first login.
            </div>
          </div>

          <div className="p-6 border-t border-gray-100 bg-gray-50 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-5 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-gray-900 text-white rounded-lg text-sm font-semibold hover:bg-gray-700 transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
              {loading ? 'Creating...' : 'Create Account'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// ── Main Component ────────────────────────────────────────────────────────────
const TeamManagement = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revoking, setRevoking] = useState(null);

  const fetchUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getAdminUsers();
      setUsers(data);
    } catch (err) {
      setError('Failed to load users. ' + (err.message || ''));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchUsers(); }, []);

  const handleRevoke = async (user) => {
    if (!window.confirm(`Disable account for ${user.email}?`)) return;
    setRevoking(user.username);
    try {
      await disableAdminUser(user.username);
      await fetchUsers();
    } catch (err) {
      alert('Failed to disable user: ' + err.message);
    } finally {
      setRevoking(null);
    }
  };

  const getInitials = (name, email) => {
    if (name) return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    return (email || '??')[0].toUpperCase();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="text-sm text-gray-500 mt-1">Manage Cognito user accounts and access roles</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-gray-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors flex items-center gap-2"
        >
          <UserPlus size={16} /> Create Account
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
          <AlertCircle size={16} className="shrink-0" /> {error}
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-16 gap-3 text-gray-400">
              <Loader2 size={20} className="animate-spin" />
              <span className="text-sm">Loading users...</span>
            </div>
          ) : users.length === 0 ? (
            <div className="text-center py-16 text-gray-400 text-sm">No users found.</div>
          ) : (
            <table>
              <thead>
                <tr className="bg-white">
                  <th className="w-1/3">Name</th>
                  <th className="w-1/4">Email</th>
                  <th className="w-1/6">Status</th>
                  <th className="w-1/6">Created</th>
                  <th className="w-1/6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((member) => (
                  <tr key={member.username} className="group">
                    <td>
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gray-200 text-gray-700 flex items-center justify-center text-xs font-bold shrink-0">
                          {getInitials(member.name, member.email)}
                        </div>
                        <div>
                          <span className="font-semibold text-gray-900 block">{member.name || '—'}</span>
                          <span className="text-xs text-gray-400">{member.username.slice(0, 8)}…</span>
                        </div>
                      </div>
                    </td>
                    <td className="text-sm">{member.email}</td>
                    <td><StatusBadge status={member.status} enabled={member.enabled} /></td>
                    <td className="text-gray-500 text-sm">
                      {new Date(member.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </td>
                    <td className="text-right">
                      {member.enabled && (
                        <button
                          onClick={() => handleRevoke(member)}
                          disabled={revoking === member.username}
                          className="flex items-center justify-end gap-1.5 text-xs font-semibold text-rose-600 hover:text-rose-700 ml-auto opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50"
                        >
                          {revoking === member.username
                            ? <Loader2 size={12} className="animate-spin" />
                            : <XCircle size={14} />
                          }
                          Revoke Access
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Info */}
      <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 flex items-start gap-3">
        <div className="mt-0.5 text-gray-500 text-xs text-center border border-gray-400 w-[18px] h-[18px] rounded-full flex items-center justify-center font-serif shrink-0">i</div>
        <div>
          <h4 className="text-sm font-bold text-gray-900 mb-1">Access Roles</h4>
          <p className="text-sm text-gray-600">
            <span className="font-bold text-gray-900">Admin:</span> Full access to all features including user management and system settings.
            {' '}
            <span className="font-bold text-gray-900">Vendor:</span> Dashboard access for managing clinic appointments and call logs.
          </p>
          <p className="text-xs text-gray-400 mt-2">User accounts are managed via AWS Cognito. Disabled users cannot log in but their data is retained.</p>
        </div>
      </div>

      {isModalOpen && (
        <AddUserModal
          onClose={() => setIsModalOpen(false)}
          onUserCreated={fetchUsers}
        />
      )}
    </div>
  );
};

export default TeamManagement;
