'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowDown, ArrowUp, CornerDownRight, Eye, EyeOff, Layers, Loader2, MoreVertical, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { createCategory, deleteCategory, reorderCategories, updateCategory, type CategoryRow } from '@/app/actions/categories';
import { childrenByParent, sortCategoryTree } from '@/lib/category-tree';
import { useT } from '@/lib/i18n/client';

const SELECT_CLASS = 'h-10 w-full rounded-md border border-slate-600 bg-slate-900/50 px-3 text-sm text-slate-50';

/** Dialogue ouvert : création (avec parent éventuel) ou modification d'une catégorie. */
type DialogState = { mode: 'create'; parentId: string } | { mode: 'edit'; category: CategoryRow } | null;

/**
 * Gestion des catégories du point : la page liste les catégories et leurs
 * sous-catégories (un niveau) ; création et modification se font dans un dialogue.
 */
export function CategoriesManager({ initialCategories }: { initialCategories: CategoryRow[] | null }) {
  const { t } = useT();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [categories, setCategories] = useState<CategoryRow[]>(initialCategories ?? []);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [formName, setFormName] = useState('');
  const [formParent, setFormParent] = useState('');

  const roots = useMemo(() => sortCategoryTree(categories).filter((c) => !c.parent_id), [categories]);
  const children = useMemo(() => childrenByParent(categories), [categories]);

  function run(action: () => Promise<{ success: boolean; error: string }>, success?: string, after?: () => void) {
    startTransition(async () => {
      const result = await action();
      if (!result.success) {
        toast.error(result.error);
        return;
      }
      if (success) toast.success(success);
      after?.();
      router.refresh();
    });
  }

  function openCreate(parentId = '') {
    setFormName('');
    setFormParent(parentId);
    setDialog({ mode: 'create', parentId });
  }

  function openEdit(category: CategoryRow) {
    setFormName(category.name);
    setFormParent(category.parent_id ?? '');
    setDialog({ mode: 'edit', category });
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!dialog) return;
    const name = formName.trim();
    if (!name) return;
    const parentId = formParent || null;

    if (dialog.mode === 'create') {
      run(
        async () => {
          const result = await createCategory(name, parentId);
          if (result.success && result.id) {
            setCategories((prev) => [
              ...prev,
              {
                id: result.id!,
                name,
                parent_id: parentId,
                position: prev.filter((c) => c.parent_id === parentId).length + 1,
                is_active: true,
                product_count: 0,
              },
            ]);
          }
          return result;
        },
        t('categories.created'),
        () => setDialog(null)
      );
      return;
    }

    const { category } = dialog;
    run(
      () => updateCategory(category.id, { name, parentId }),
      t('categories.saved'),
      () => {
        setCategories((prev) =>
          prev.map((c) =>
            c.id === category.id
              ? {
                  ...c,
                  name,
                  parent_id: parentId,
                  // Déplacée : placée en fin de son nouveau groupe
                  position: parentId === c.parent_id ? c.position : Number.MAX_SAFE_INTEGER,
                }
              : c
          )
        );
        setDialog(null);
      }
    );
  }

  function toggle(category: CategoryRow) {
    run(
      () => updateCategory(category.id, { isActive: !category.is_active }),
      undefined,
      () => setCategories((prev) => prev.map((c) => (c.id === category.id ? { ...c, is_active: !c.is_active } : c)))
    );
  }

  function remove(category: CategoryRow) {
    if (!confirm(t('categories.confirmDelete', { name: category.name }))) return;
    run(
      () => deleteCategory(category.id),
      t('categories.deleted'),
      () => setCategories((prev) => prev.filter((c) => c.id !== category.id))
    );
  }

  /** Monte ou descend une catégorie parmi celles de même niveau. */
  function move(siblings: CategoryRow[], index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= siblings.length) return;
    const next = [...siblings];
    [next[index], next[target]] = [next[target], next[index]];
    const positions = new Map(next.map((c, i) => [c.id, i + 1]));
    setCategories((prev) => prev.map((c) => (positions.has(c.id) ? { ...c, position: positions.get(c.id)! } : c)));
    run(() => reorderCategories(next.map((c) => c.id)));
  }

  // Parent possible : catégories principales (sauf elle-même) ; aucun si elle a des sous-catégories.
  const editedId = dialog?.mode === 'edit' ? dialog.category.id : null;
  const editedHasChildren = editedId ? (children.get(editedId)?.length ?? 0) > 0 : false;
  const parentChoices = roots.filter((r) => r.id !== editedId);
  const dialogTitle =
    dialog?.mode === 'edit' ? t('categories.editTitle') : dialog?.parentId ? t('categories.newSubTitle') : t('categories.newTitle');

  function renderRow(category: CategoryRow, siblings: CategoryRow[], index: number) {
    const isChild = Boolean(category.parent_id);
    const subCount = children.get(category.id)?.length ?? 0;
    const parentName = isChild ? categories.find((c) => c.id === category.parent_id)?.name ?? '—' : null;

    return (
      <TableRow key={category.id} className={`border-slate-700 hover:bg-slate-800/50 ${isChild ? 'bg-slate-900/20' : ''}`}>
        <TableCell className="w-16">
          <div className={`flex items-center gap-0.5 ${isChild ? 'pl-4' : ''}`}>
            <button
              type="button"
              onClick={() => move(siblings, index, -1)}
              disabled={pending || index === 0}
              className="rounded p-1 text-slate-400 hover:bg-slate-700 hover:text-white disabled:opacity-30"
              aria-label={t('categories.moveUp')}
            >
              <ArrowUp className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => move(siblings, index, 1)}
              disabled={pending || index === siblings.length - 1}
              className="rounded p-1 text-slate-400 hover:bg-slate-700 hover:text-white disabled:opacity-30"
              aria-label={t('categories.moveDown')}
            >
              <ArrowDown className="h-3.5 w-3.5" />
            </button>
          </div>
        </TableCell>
        <TableCell>
          <div className={`flex items-center gap-2 ${isChild ? 'pl-6' : ''}`}>
            {isChild ? (
              <CornerDownRight className="h-4 w-4 shrink-0 text-slate-600" />
            ) : (
              <Layers className="h-4 w-4 shrink-0 text-blue-400" />
            )}
            <span className={`${isChild ? 'text-sm text-slate-200' : 'font-medium text-slate-50'} ${category.is_active ? '' : 'text-slate-500 line-through'}`}>
              {category.name}
            </span>
          </div>
        </TableCell>
        <TableCell>
          {isChild ? (
            <span className="text-sm text-slate-300">{parentName}</span>
          ) : (
            <span className="inline-flex rounded-lg border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 text-xs font-medium text-blue-300">
              {t('categories.mainCategory')}
            </span>
          )}
        </TableCell>
        <TableCell className="text-right tabular-nums text-slate-200">{category.product_count}</TableCell>
        <TableCell className="text-right tabular-nums text-slate-200">{isChild ? <span className="text-slate-600">—</span> : subCount}</TableCell>
        <TableCell>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
              category.is_active ? 'bg-green-500/10 text-green-400' : 'bg-slate-700/40 text-slate-400'
            }`}
          >
            {category.is_active ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
            {category.is_active ? t('categories.active') : t('categories.inactive')}
          </span>
        </TableCell>
        <TableCell className="text-right">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-slate-400 hover:bg-slate-700 hover:text-white" aria-label={t('categories.colActions')}>
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52 border-slate-700 bg-slate-800 text-slate-200">
              <DropdownMenuItem onClick={() => openEdit(category)} className="cursor-pointer gap-2 hover:bg-slate-700 focus:bg-slate-700">
                <Pencil className="h-4 w-4 text-blue-400" />
                {t('categories.editTitle')}
              </DropdownMenuItem>
              {!isChild && (
                <DropdownMenuItem onClick={() => openCreate(category.id)} className="cursor-pointer gap-2 hover:bg-slate-700 focus:bg-slate-700">
                  <Plus className="h-4 w-4 text-green-400" />
                  {t('categories.addSub')}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => toggle(category)} disabled={pending} className="cursor-pointer gap-2 hover:bg-slate-700 focus:bg-slate-700">
                {category.is_active ? <EyeOff className="h-4 w-4 text-slate-400" /> : <Eye className="h-4 w-4 text-slate-400" />}
                {category.is_active ? t('categories.hide') : t('categories.show')}
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-slate-700" />
              <DropdownMenuItem onClick={() => remove(category)} disabled={pending} className="cursor-pointer gap-2 text-red-400 hover:bg-slate-700 focus:bg-slate-700">
                <Trash2 className="h-4 w-4" />
                {t('categories.delete')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </TableCell>
      </TableRow>
    );
  }

  return (
    <div className="flex-1 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4 md:p-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-gradient-to-r from-blue-500/10 to-purple-500/10 px-4 py-2">
            <Layers className="h-4 w-4 text-blue-400" />
            <span className="text-sm font-medium text-blue-400">{t('categories.badge')}</span>
          </div>
          <h1 className="mb-2 bg-gradient-to-r from-white to-slate-400 bg-clip-text text-3xl font-bold text-transparent md:text-4xl">
            {t('categories.title')}
          </h1>
          <p className="max-w-2xl text-slate-400">{t('categories.subtitle')}</p>
        </div>
        {initialCategories !== null && (
          <Button
            type="button"
            onClick={() => openCreate()}
            className="border-none bg-gradient-to-r from-blue-600 to-indigo-600 text-white shadow-lg shadow-blue-500/20 transition-all duration-300 hover:scale-105 hover:from-blue-700 hover:to-indigo-700"
          >
            <Plus className="mr-2 h-4 w-4" />
            {t('categories.newButton')}
          </Button>
        )}
      </div>

      {initialCategories === null ? (
        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-300">{t('categories.notInstalled')}</p>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-700/50 bg-slate-800/40">
          <div className="border-b border-slate-700/50 px-4 py-3">
            <p className="font-semibold text-slate-100">{t('categories.listTitle')}</p>
            <p className="text-xs text-slate-500">{t('categories.listHint')}</p>
          </div>
          {roots.length === 0 ? (
            <div className="py-16 text-center">
              <Layers className="mx-auto mb-3 h-10 w-10 text-slate-600" />
              <p className="mb-4 text-sm text-slate-400">{t('categories.empty')}</p>
              <Button type="button" variant="outline" onClick={() => openCreate()} className="border-slate-700 text-blue-400 hover:bg-slate-800">
                <Plus className="mr-2 h-4 w-4" />
                {t('categories.newButton')}
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-slate-700 bg-slate-800/50 hover:bg-transparent">
                  <TableHead className="w-16 font-semibold text-slate-300">{t('categories.colOrder')}</TableHead>
                  <TableHead className="font-semibold text-slate-300">{t('categories.colName')}</TableHead>
                  <TableHead className="font-semibold text-slate-300">{t('categories.colParent')}</TableHead>
                  <TableHead className="text-right font-semibold text-slate-300">{t('categories.colProducts')}</TableHead>
                  <TableHead className="text-right font-semibold text-slate-300">{t('categories.colSubcategories')}</TableHead>
                  <TableHead className="font-semibold text-slate-300">{t('categories.colStatus')}</TableHead>
                  <TableHead className="text-right font-semibold text-slate-300">{t('categories.colActions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {roots.flatMap((root, index) => {
                  const subs = children.get(root.id) ?? [];
                  return [renderRow(root, roots, index), ...subs.map((sub, i) => renderRow(sub, subs, i))];
                })}
              </TableBody>
            </Table>
          )}
        </div>
      )}

      <Dialog open={dialog !== null} onOpenChange={(open) => !open && !pending && setDialog(null)}>
        <DialogContent className="border-slate-700 bg-slate-800 text-slate-100 sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{dialogTitle}</DialogTitle>
          </DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <label htmlFor="category-name" className="text-sm text-slate-300">{t('categories.name')}</label>
              <Input
                id="category-name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder={t('categories.namePlaceholder')}
                maxLength={80}
                autoFocus
                className="border-slate-600 bg-slate-900/50 text-slate-50 placeholder:text-slate-500"
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="category-parent" className="text-sm text-slate-300">{t('categories.parent')}</label>
              <select
                id="category-parent"
                value={formParent}
                onChange={(e) => setFormParent(e.target.value)}
                disabled={editedHasChildren}
                className={SELECT_CLASS}
              >
                <option value="">{t('categories.parentNone')}</option>
                {parentChoices.map((r) => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
              <p className="text-xs text-slate-500">
                {editedHasChildren ? t('categories.errors.hasChildren') : t('categories.parentHint')}
              </p>
            </div>
            <DialogFooter className="gap-2">
              <Button type="button" variant="ghost" onClick={() => setDialog(null)} disabled={pending} className="text-slate-300 hover:bg-slate-700">
                {t('categories.cancel')}
              </Button>
              <Button type="submit" disabled={pending || !formName.trim()} className="bg-blue-600 text-white hover:bg-blue-700">
                {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {dialog?.mode === 'edit' ? t('categories.save') : t('categories.create')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
