'use client';

import { useEffect, useState } from 'react';
import { useUser } from '@/lib/user-context';
import {
  listBranches,
  createBranch,
  updateBranch,
  deleteBranch,
  type Branch,
} from '@/lib/branches';
import { ApiError } from '@/lib/api';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

// Catálogo de sucursales — solo super admin (§7). CRUD con manejo de 409.
export default function BranchesPage() {
  const me = useUser();

  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState<string | null>(null);

  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createErr, setCreateErr] = useState<string | null>(null);

  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [rowErr, setRowErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function refresh() {
    try {
      setBranches(await listBranches());
      setLoadErr(null);
    } catch (e) {
      setLoadErr(e instanceof ApiError ? e.message : 'Error al cargar sucursales');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (me.isSuperAdmin) void refresh();
    else setLoading(false);
  }, [me.isSuperAdmin]);

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setCreating(true);
    setCreateErr(null);
    try {
      await createBranch({ name: newName.trim() });
      setNewName('');
      await refresh();
    } catch (e) {
      if (e instanceof ApiError && e.code === 'name_taken') {
        setCreateErr('Ya existe una sucursal con ese nombre.');
      } else {
        setCreateErr(e instanceof ApiError ? e.message : 'No se pudo crear la sucursal');
      }
    } finally {
      setCreating(false);
    }
  }

  function startEdit(b: Branch) {
    setEditId(b.id);
    setEditName(b.name);
    setRowErr(null);
  }

  async function saveEdit(id: string) {
    if (!editName.trim()) return;
    setBusyId(id);
    setRowErr(null);
    try {
      await updateBranch(id, { name: editName.trim() });
      setEditId(null);
      await refresh();
    } catch (e) {
      if (e instanceof ApiError && e.code === 'name_taken') {
        setRowErr('Ya existe una sucursal con ese nombre.');
      } else {
        setRowErr(e instanceof ApiError ? e.message : 'No se pudo renombrar');
      }
    } finally {
      setBusyId(null);
    }
  }

  async function toggleStatus(b: Branch) {
    setBusyId(b.id);
    setRowErr(null);
    try {
      await updateBranch(b.id, { status: b.status === 'active' ? 'inactive' : 'active' });
      await refresh();
    } catch (e) {
      setRowErr(e instanceof ApiError ? e.message : 'No se pudo cambiar el estado');
    } finally {
      setBusyId(null);
    }
  }

  async function onDelete(b: Branch) {
    if (!confirm(`¿Eliminar la sucursal "${b.name}"? Esta acción no se puede deshacer.`)) return;
    setBusyId(b.id);
    setRowErr(null);
    try {
      await deleteBranch(b.id);
      await refresh();
    } catch (e) {
      if (e instanceof ApiError && e.code === 'branch_in_use') {
        setRowErr(
          'No se puede eliminar: hay usuarios o ventas en esta sucursal. Desactívala en su lugar.',
        );
      } else {
        setRowErr(e instanceof ApiError ? e.message : 'No se pudo eliminar');
      }
    } finally {
      setBusyId(null);
    }
  }

  if (!me.isSuperAdmin) {
    return (
      <Card>
        <p className="text-muted">Solo el administrador del negocio gestiona las sucursales.</p>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-ink">Sucursales</h1>
      <Card>
        <p className="mb-4 text-sm text-muted">
          Administra tus locales y asígnalos a tus usuarios desde la pantalla de Usuarios.
        </p>

        <form onSubmit={onCreate} className="mb-4 flex flex-wrap items-start gap-2">
          <div className="min-w-[200px] flex-1">
            <Input
              aria-label="Nombre de la nueva sucursal"
              placeholder="Nombre (ej. Local Centro)"
              value={newName}
              maxLength={60}
              onChange={(e) => setNewName(e.target.value)}
            />
            {createErr && <p className="mt-1 text-sm text-danger">{createErr}</p>}
          </div>
          <Button type="submit" loading={creating} disabled={!newName.trim()}>
            Agregar
          </Button>
        </form>

        {rowErr && <p className="mb-2 text-sm text-danger">{rowErr}</p>}

        {loading ? (
          <p className="text-sm text-muted">Cargando…</p>
        ) : loadErr ? (
          <p className="text-sm text-danger">{loadErr}</p>
        ) : branches.length === 0 ? (
          <p className="text-sm text-muted">
            Aún no tienes sucursales. Crea la primera (ej. tu local principal) para asignarla a tus
            usuarios.
          </p>
        ) : (
          <ul className="divide-y divide-line">
            {branches.map((b) => {
              const inactive = b.status === 'inactive';
              const busy = busyId === b.id;
              return (
                <li key={b.id} className="flex flex-wrap items-center gap-2 py-3">
                  {editId === b.id ? (
                    <>
                      <Input
                        aria-label="Nuevo nombre"
                        value={editName}
                        maxLength={60}
                        onChange={(e) => setEditName(e.target.value)}
                        className="max-w-xs"
                      />
                      <Button onClick={() => saveEdit(b.id)} loading={busy} disabled={!editName.trim()}>
                        Guardar
                      </Button>
                      <Button variant="ghost" onClick={() => setEditId(null)}>
                        Cancelar
                      </Button>
                    </>
                  ) : (
                    <>
                      <span className={`flex-1 text-sm ${inactive ? 'text-muted line-through' : 'text-ink'}`}>
                        {b.name}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          inactive ? 'bg-bg text-muted' : 'bg-accent text-ink'
                        }`}
                      >
                        {inactive ? 'Inactiva' : 'Activa'}
                      </span>
                      <Button variant="outline" onClick={() => startEdit(b)} disabled={busy}>
                        Renombrar
                      </Button>
                      <Button variant="secondary" onClick={() => toggleStatus(b)} disabled={busy}>
                        {inactive ? 'Activar' : 'Desactivar'}
                      </Button>
                      <Button variant="ghost" onClick={() => onDelete(b)} disabled={busy}>
                        Eliminar
                      </Button>
                    </>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
