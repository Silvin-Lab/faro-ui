'use client';

import { useEffect, useMemo, useState } from 'react';
import { useUser } from '@/lib/user-context';
import { listUsers, createUser, updateUser, type User, type Role, type BranchRole } from '@/lib/auth';
import { listBranches, type Branch } from '@/lib/branches';
import { ApiError } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PasswordInput } from '@/components/ui/PasswordInput';
import { FormField } from '@/components/ui/FormField';

// M8: etiquetas de rol en español para el listado y los selectores.
const ROLE_LABEL: Record<Role, string> = {
  super_admin: 'Súper admin',
  branch_admin: 'Admin de sucursal',
  cashier: 'Cajero',
  barista: 'Barista',
};

// Roles de sucursal (asignables a usuarios que operan una sucursal).
const BRANCH_ROLES: BranchRole[] = ['branch_admin', 'cashier', 'barista'];

const selectClass =
  'rounded-md border border-line bg-surface px-3 py-1.5 text-sm text-ink outline-none focus:border-accent-strong';

// Lista de sucursales (checkboxes) para asignar membresías M:N.
function BranchChecklist({
  branches,
  selected,
  onToggle,
}: {
  branches: Branch[];
  selected: Set<string>;
  onToggle: (id: string) => void;
}) {
  if (branches.length === 0) {
    return <p className="text-xs text-muted">No hay sucursales activas. Crea una en “Sucursales”.</p>;
  }
  return (
    <div className="flex flex-wrap gap-2">
      {branches.map((b) => {
        const on = selected.has(b.id);
        return (
          <label
            key={b.id}
            className={`flex cursor-pointer items-center gap-2 rounded-md border px-3 py-1.5 text-sm ${
              on ? 'border-accent-strong bg-accent-soft text-ink' : 'border-line bg-surface text-ink'
            }`}
          >
            <input type="checkbox" checked={on} onChange={() => onToggle(b.id)} className="accent-current" />
            {b.name}
          </label>
        );
      })}
    </div>
  );
}

export default function UsersPage() {
  const me = useUser();
  const [users, setUsers] = useState<User[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const [form, setForm] = useState<{ name: string; email: string; password: string; role: Role }>({
    name: '',
    email: '',
    password: '',
    role: 'cashier',
  });
  const [formBranchIds, setFormBranchIds] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);
  const [formErr, setFormErr] = useState<string | null>(null);

  // Edición de rol y membresías por fila.
  const [editId, setEditId] = useState<string | null>(null);
  const [editRole, setEditRole] = useState<BranchRole>('cashier');
  const [editBranchIds, setEditBranchIds] = useState<Set<string>>(new Set());
  const [rowBusy, setRowBusy] = useState(false);
  const [rowErr, setRowErr] = useState<string | null>(null);

  const activeBranches = useMemo(() => branches.filter((b) => b.status === 'active'), [branches]);

  async function refresh() {
    try {
      const [us, bs] = await Promise.all([listUsers(), listBranches()]);
      setUsers(us);
      setBranches(bs);
      setLoadErr(null);
    } catch (e) {
      setLoadErr(e instanceof ApiError ? e.message : 'Error al cargar usuarios');
    }
  }

  useEffect(() => {
    if (me.isSuperAdmin) void refresh();
  }, [me.isSuperAdmin]);

  function toggleForm(id: string) {
    setFormBranchIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  function toggleEdit(id: string) {
    setEditBranchIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const isSuper = form.role === 'super_admin';
    // El súper admin es global; los demás roles requieren al menos una sucursal.
    if (!isSuper && formBranchIds.size === 0) {
      setFormErr('Asigna al menos una sucursal.');
      return;
    }
    setSubmitting(true);
    setFormErr(null);
    try {
      await createUser({
        name: form.name,
        email: form.email,
        password: form.password,
        role: form.role,
        branchIds: [...formBranchIds],
      });
      setForm({ name: '', email: '', password: '', role: 'cashier' });
      setFormBranchIds(new Set());
      await refresh();
    } catch (err) {
      setFormErr(err instanceof ApiError ? err.message : 'Error al crear usuario');
    } finally {
      setSubmitting(false);
    }
  }

  function startEdit(u: User) {
    setEditId(u.id);
    // El rol de sucursal por defecto es el actual (o cajero si viniera un valor global).
    setEditRole(BRANCH_ROLES.includes(u.role as BranchRole) ? (u.role as BranchRole) : 'cashier');
    setEditBranchIds(new Set((u.branches ?? []).map((b) => b.id)));
    setRowErr(null);
  }

  async function saveRow(id: string) {
    if (editBranchIds.size === 0) {
      setRowErr('El usuario debe tener al menos una sucursal.');
      return;
    }
    setRowBusy(true);
    setRowErr(null);
    try {
      await updateUser(id, { role: editRole, branchIds: [...editBranchIds] });
      setEditId(null);
      await refresh();
    } catch (err) {
      setRowErr(err instanceof ApiError ? err.message : 'No se pudo actualizar el usuario');
    } finally {
      setRowBusy(false);
    }
  }

  if (!me.isSuperAdmin) {
    return (
      <Card>
        <p className="text-muted">Solo el administrador del negocio gestiona los usuarios.</p>
      </Card>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card>
        <h2 className="mb-4 text-lg font-semibold text-ink">Usuarios</h2>
        {loadErr && <p className="text-sm text-danger">{loadErr}</p>}
        {rowErr && <p className="text-sm text-danger">{rowErr}</p>}
        <ul className="divide-y divide-line">
          {users.map((u) => (
            <li key={u.id} className="py-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm text-ink">{u.name}</span>
                <span className="text-xs text-muted">{u.email}</span>
              </div>
              <div className="mt-0.5 text-xs text-muted">
                Rol: <span className="text-ink">{ROLE_LABEL[u.role]}</span>
              </div>
              {editId === u.id ? (
                <div className="mt-2 space-y-2">
                  <label className="block text-xs text-muted">
                    Rol
                    <select
                      className={`mt-1 block ${selectClass}`}
                      value={editRole}
                      onChange={(e) => setEditRole(e.target.value as BranchRole)}
                    >
                      {BRANCH_ROLES.map((r) => (
                        <option key={r} value={r}>
                          {ROLE_LABEL[r]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <BranchChecklist
                    branches={activeBranches}
                    selected={editBranchIds}
                    onToggle={toggleEdit}
                  />
                  <div className="flex items-center gap-2">
                    <Button onClick={() => saveRow(u.id)} loading={rowBusy}>
                      Guardar
                    </Button>
                    <Button variant="ghost" onClick={() => setEditId(null)}>
                      Cancelar
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <span className="text-xs text-muted">
                    Sucursales:{' '}
                    <span className="text-ink">
                      {u.role === 'super_admin'
                        ? '—'
                        : u.branches && u.branches.length > 0
                          ? u.branches.map((b) => b.name).join(', ')
                          : 'Sin sucursal'}
                    </span>
                  </span>
                  {u.role !== 'super_admin' && (
                    <button
                      type="button"
                      onClick={() => startEdit(u)}
                      className="text-xs font-medium text-accent-strong hover:underline"
                    >
                      Cambiar
                    </button>
                  )}
                </div>
              )}
            </li>
          ))}
          {users.length === 0 && !loadErr && (
            <li className="py-2 text-sm text-muted">Sin usuarios todavía.</li>
          )}
        </ul>
      </Card>

      <Card>
        <h2 className="mb-4 text-lg font-semibold text-ink">Nuevo usuario</h2>
        <form onSubmit={onSubmit} className="space-y-3">
          <FormField label="Nombre" htmlFor="name">
            <Input
              id="name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </FormField>
          <FormField label="Email" htmlFor="email">
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
            />
          </FormField>
          <FormField label="Contraseña (mín. 8)" htmlFor="password">
            <PasswordInput
              id="password"
              minLength={8}
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
            />
          </FormField>
          <FormField label="Rol" htmlFor="role">
            <select
              id="role"
              className={`w-full ${selectClass}`}
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
            >
              <option value="super_admin">{ROLE_LABEL.super_admin}</option>
              <option value="branch_admin">{ROLE_LABEL.branch_admin}</option>
              <option value="cashier">{ROLE_LABEL.cashier}</option>
              <option value="barista">{ROLE_LABEL.barista}</option>
            </select>
          </FormField>
          {form.role !== 'super_admin' && (
            <FormField label="Sucursales (elige al menos una)">
              <BranchChecklist branches={activeBranches} selected={formBranchIds} onToggle={toggleForm} />
            </FormField>
          )}
          {formErr && <p className="text-sm text-danger">{formErr}</p>}
          <Button type="submit" loading={submitting} className="w-full">
            Crear usuario
          </Button>
        </form>
      </Card>
    </div>
  );
}
