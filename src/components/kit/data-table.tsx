import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export interface Column<T> {
  key: string;
  header: ReactNode;
  align?: "left" | "right" | "center";
  className?: string;
  headerClassName?: string;
  render?: (row: T, index: number) => ReactNode;
}

const alignClass = {
  left: "text-left",
  right: "text-right tabular-nums",
  center: "text-center",
} as const;

/**
 * Lightweight dense table over the shadcn primitives. Numeric columns align
 * right with tabular figures. Display-only for Sprint 1 (sorting/filtering can
 * layer on later via @tanstack/react-table without changing call sites).
 */
export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  onRowClick,
  empty = "No records.",
  className,
}: {
  columns: Column<T>[];
  rows: T[];
  getRowKey?: (row: T, index: number) => string;
  onRowClick?: (row: T) => void;
  empty?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("overflow-x-auto", className)}>
      <Table>
        <TableHeader>
          <TableRow className="hover:bg-transparent">
            {columns.map((c) => (
              <TableHead
                key={c.key}
                className={cn("whitespace-nowrap text-xs", alignClass[c.align ?? "left"], c.headerClassName)}
              >
                {c.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow className="hover:bg-transparent">
              <TableCell colSpan={columns.length} className="py-8 text-center text-sm text-muted-foreground">
                {empty}
              </TableCell>
            </TableRow>
          ) : (
            rows.map((row, i) => (
              <TableRow
                key={getRowKey?.(row, i) ?? i}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={cn(onRowClick && "cursor-pointer")}
              >
                {columns.map((c) => (
                  <TableCell key={c.key} className={cn("text-sm", alignClass[c.align ?? "left"], c.className)}>
                    {c.render ? c.render(row, i) : String((row as Record<string, unknown>)[c.key] ?? "")}
                  </TableCell>
                ))}
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
