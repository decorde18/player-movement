/**
 * GenericTable Component - Uses Global Theme Variables
 *
 * @example
 * <GenericTable
 *   data={items}
 *   columns={[
 *     { key: 'name', label: 'Name', type: 'text', sortable: true },
 *     { key: 'status', label: 'Status', type: 'badge', options: { active: 'success', inactive: 'muted' } }
 *   ]}
 *   userRole="admin"
 *   canEdit={true}
 *   canDelete={true}
 *   onEdit={(row) => handleEdit(row)}
 *   onDelete={(row) => handleDelete(row)}
 * />
 */

"use client";

import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
} from "@tanstack/react-table";
import { useState, useMemo } from "react";
import { type TableColumn } from "@/components/entities/types";
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Pencil,
  Trash2,
} from "lucide-react";

const BADGE_STYLES: Record<string, string> = {
  green: "bg-success/10 text-success border border-success/30",
  amber: "bg-warning-bg text-warning-text border border-warning-border",
  red: "bg-danger/10 text-danger border border-danger/30",
  gray: "bg-muted/10 text-muted border border-muted/30",
  blue: "bg-primary/10 text-primary border border-primary/30",
};

interface GenericTableProps<T extends Record<string, unknown>> {
  data: T[];
  columns: TableColumn[];
  canEdit: boolean;
  canDelete: boolean;
  onEdit: (row: T) => void;
  onDelete: (row: T) => void;
  globalFilter?: string;
}

export function GenericTable<T extends Record<string, unknown>>({
  data,
  columns,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
  globalFilter = "",
}: GenericTableProps<T>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [pagination, setPagination] = useState({ pageIndex: 0, pageSize: 10 });

  const tanstackColumns = useMemo<ColumnDef<T>[]>(() => {
    const cols: ColumnDef<T>[] = columns.map((col) => ({
      id: col.key,
      accessorKey: col.key,
      header: col.label,
      enableSorting: col.sortable ?? false,
      cell: ({ getValue }) => {
        const val = getValue() as string;

        if (col.type === "badge" && col.options) {
          const style = BADGE_STYLES[col.options[val] ?? "gray"];
          return (
            <span
              className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${style}`}
            >
              {val}
            </span>
          );
        }

        if (col.type === "date") {
          return val
            ? new Date(val).toLocaleDateString("en-US", { dateStyle: "medium" })
            : "—";
        }
        if (col.type === "boolean") {
          return val == 1 || val === true || val === "true" ? (
            <span className='text-xs font-medium text-success'>Yes</span>
          ) : (
            <span className='text-xs text-muted'>No</span>
          );
        }

        return <span className='text-sm'>{val ?? "—"}</span>;
      },
    }));

    if (canEdit || canDelete) {
      cols.push({
        id: "_actions",
        header: "",
        enableSorting: false,
        cell: ({ row }) => (
          <div className='flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity justify-end'>
            {canEdit && (
              <button
                onClick={() => onEdit(row.original)}
                className='p-1.5 rounded-md text-muted hover:text-text hover:bg-muted/10 transition-colors'
                title='Edit'
              >
                <Pencil size={14} />
              </button>
            )}
            {canDelete && (
              <button
                onClick={() => onDelete(row.original)}
                className='p-1.5 rounded-md text-muted hover:text-danger hover:bg-danger/10 transition-colors'
                title='Delete'
              >
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ),
      });
    }

    return cols;
  }, [columns, canEdit, canDelete, onEdit, onDelete]);

  const table = useReactTable({
    data,
    columns: tanstackColumns,
    state: { sorting, columnFilters, globalFilter, pagination },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onPaginationChange: setPagination,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    globalFilterFn: "includesString",
  });

  return (
    <div>
      <div className='overflow-x-auto'>
        <table className='w-full text-sm border-collapse'>
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className='border-b border-border'>
                {hg.headers.map((header) => {
                  const col = columns.find((c) => c.key === header.id);
                  return (
                    <th
                      key={header.id}
                      className={`
                        px-3 py-2 text-left text-xs font-semibold text-muted uppercase tracking-wide whitespace-nowrap
                        ${col?.hiddenOnMobile ? "hidden md:table-cell" : ""}
                        ${header.id === "_actions" ? "w-16" : ""}
                      `}
                    >
                      {header.isPlaceholder ? null : (
                        <div
                          className={`flex items-center gap-1 ${header.column.getCanSort() ? "cursor-pointer select-none hover:text-text-label" : ""}`}
                          onClick={header.column.getToggleSortingHandler()}
                        >
                          {flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                          {header.column.getCanSort() && (
                            <span className='text-muted/40'>
                              {header.column.getIsSorted() === "asc" ? (
                                <ChevronUp size={12} />
                              ) : header.column.getIsSorted() === "desc" ? (
                                <ChevronDown size={12} />
                              ) : (
                                <ChevronsUpDown size={12} />
                              )}
                            </span>
                          )}
                        </div>
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td
                  colSpan={tanstackColumns.length}
                  className='px-4 py-6 text-center text-sm text-muted'
                >
                  No results found.
                </td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className='group border-b border-border last:border-0 hover:bg-muted/5 transition-colors'
                >
                  {row.getVisibleCells().map((cell) => {
                    const col = columns.find((c) => c.key === cell.column.id);
                    return (
                      <td
                        key={cell.id}
                        className={`
                          px-3 py-2 text-text
                          ${cell.column.id === "name" ? "font-semibold text-text" : ""}
                          ${col?.hiddenOnMobile ? "hidden md:table-cell" : ""}
                        `}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className='flex items-center justify-between px-4 py-2 border-t border-border'>
        <span className='text-xs text-muted'>
          {table.getFilteredRowModel().rows.length === 0
            ? "No results"
            : `Showing ${pagination.pageIndex * pagination.pageSize + 1}–${Math.min(
                (pagination.pageIndex + 1) * pagination.pageSize,
                table.getFilteredRowModel().rows.length,
              )} of ${table.getFilteredRowModel().rows.length}`}
        </span>
        <div className='flex items-center gap-1'>
          <button
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
            className='px-2.5 py-1 text-xs border border-border rounded-md text-text-label hover:bg-background disabled:opacity-30 disabled:cursor-not-allowed transition-colors'
          >
            ‹
          </button>
          {Array.from({ length: table.getPageCount() }, (_, i) => (
            <button
              key={i}
              onClick={() => table.setPageIndex(i)}
              className={`w-7 h-7 text-xs rounded-md border transition-colors ${
                i === pagination.pageIndex
                  ? "bg-primary text-white border-primary"
                  : "border-border text-text-label hover:bg-background"
              }`}
            >
              {i + 1}
            </button>
          ))}
          <button
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
            className='px-2.5 py-1 text-xs border border-border rounded-md text-text-label hover:bg-background disabled:opacity-30 disabled:cursor-not-allowed transition-colors'
          >
            ›
          </button>
        </div>
      </div>
    </div>
  );
}
