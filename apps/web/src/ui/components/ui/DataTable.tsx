import React from 'react';
import { cn } from '../../lib/cn';
import { EmptyState, SkeletonRows } from './primitives';

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => React.ReactNode;
  className?: string;
}

/** Sortable-feel data table that collapses to stacked cards below 640px (doc 05 §9). */
export function DataTable<T>({
  columns,
  rows,
  getKey,
  loading,
  empty,
  onRowClick,
}: {
  columns: Column<T>[];
  rows: T[];
  getKey: (row: T) => string;
  loading?: boolean;
  empty?: React.ReactNode;
  onRowClick?: (row: T) => void;
}) {
  if (loading) return <SkeletonRows rows={5} />;
  if (!rows.length) return <>{empty ?? <EmptyState message="Nothing here yet." />}</>;

  return (
    <>
      {/* Desktop */}
      <div className="hidden overflow-x-auto md:block">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-line text-left">
              {columns.map((c) => (
                <th key={c.key} className="mono px-3 py-2 text-[11px] font-medium uppercase tracking-wide text-ink-dim">
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={getKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn('border-b border-line/60 last:border-0', onRowClick && 'cursor-pointer hover:bg-surface2')}
              >
                {columns.map((c) => (
                  <td key={c.key} className={cn('px-3 py-3 align-middle text-ink', c.className)}>
                    {c.render(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mobile */}
      <div className="space-y-2 md:hidden">
        {rows.map((row) => (
          <div
            key={getKey(row)}
            onClick={onRowClick ? () => onRowClick(row) : undefined}
            className={cn('rounded-sm border border-line bg-surface2 p-3', onRowClick && 'cursor-pointer active:opacity-80')}
          >
            {columns.map((c) => (
              <div key={c.key} className="flex items-center justify-between gap-3 py-1">
                <span className="mono text-[11px] uppercase tracking-wide text-ink-dim">{c.header}</span>
                <span className="text-right text-ink">{c.render(row)}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
    </>
  );
}
