import React, {useState, useMemo} from "react";
import { useAuth } from "../auth/useAuth.ts";
import { Link } from "react-router-dom";
import { ChevronUp, ChevronDown, Search, Trash2, Edit2, Plus, Inbox } from "lucide-react";
import type {MultiLangString} from "../types.ts";

export interface Column<T> {
  key: keyof T | string;
  title: string;
  render?: (row: T) => React.ReactNode;
  sortable?: boolean;
  filterable?: boolean;
}

interface Props<T extends { id: number | string }> {
  columns: Column<T>[];
  rows: T[];
  basePath: string;
  onDelete: (id: T["id"]) => void;
  title?: string;
  createLabel?: string;
  onCreateClick?: () => void;
  createDisabled?: boolean;
  isLoading?: boolean;
  maxHeight?: number | string;
}

type SortDirection = "asc" | "desc" | null;

function resolveValue(value: unknown): string | number {
  if (value === null || value === undefined) return "";
  if (typeof value === "number") return value;
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.join(' ');
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;

    if (isMultiLangString(obj)) {
      const de = obj.de?.trim() ?? "";
      const en = obj.en?.trim() ?? "";
      return `${de}${en}`
    }
    if ("name" in value) return String((value as Record<string, unknown>).name);
    if ("label" in value) return String((value as Record<string, unknown>).label);
    return "";
  }
  return String(value);
}

function isMultiLangString(value: unknown): value is MultiLangString {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const obj = value as Record<string, unknown>;
  return "de" in obj || "en" in obj;
}

export default function CrudTable<T extends { id: number | string }>({
                                                                       columns,
                                                                       rows,
                                                                       basePath,
                                                                       onDelete,
                                                                       title,
                                                                       createLabel = "Neu",
                                                                       onCreateClick,
                                                                       createDisabled,
                                                                       isLoading = false,
                                                                     }: Props<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const { hasWriteAccess } = useAuth();
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [filterText, setFilterText] = useState("");

  // Default sort: first column ascending when no sort is active
  const effectiveSortKey = sortKey ?? (columns.length > 0 ? String(columns[0].key) : null);
  const effectiveSortDirection = sortKey ? sortDirection : (columns.length > 0 ? "asc" as const : null);

  // Sortierung und Filterung
  const processedRows = useMemo(() => {
    let filtered = [...rows];

    // Filtern
    if (filterText) {
      filtered = filtered.filter((row) =>
        columns.some((col) => {
          if (col.filterable === false) return false;
          const value = row[col.key as keyof T];
          return String(resolveValue(value))
            .toLowerCase()
            .includes(filterText.toLowerCase());
        })
      );
    }

    // Sortieren
    if (effectiveSortKey && effectiveSortDirection) {
      filtered.sort((a, b) => {
        const aVal = resolveValue(a[effectiveSortKey as keyof T]);
        const bVal = resolveValue(b[effectiveSortKey as keyof T]);

        if (aVal === bVal) return 0;

        if (typeof aVal === "number" && typeof bVal === "number") {
          return effectiveSortDirection === "asc" ? aVal - bVal : bVal - aVal;
        }

        return effectiveSortDirection === "asc"
          ? String(aVal).localeCompare(String(bVal))
          : String(bVal).localeCompare(String(aVal));
      });
    }

    return filtered;
  }, [rows, columns, filterText, effectiveSortKey, effectiveSortDirection]);

  const handleSort = (key: string, sortable?: boolean) => {
    if (sortable === false) return;
    if (sortKey === key) {
      if (sortDirection === "asc") setSortDirection("desc");
      else { setSortKey(null); setSortDirection(null); }
    } else {
      setSortKey(key);
      setSortDirection("asc");
    }
  };

  const handleDelete = async (id: T["id"]) => {
    onDelete(id);
  };

  return (
    <div className="table-container animate-fade-in">
      {/* Toolbar */}
      <div className="table-header">
        {title && <h2 className="table-title">{title}</h2>}

        <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto"}}>
          {/* Suchfeld */}
          <div className="search-wrapper">
            <Search className="search-icon" size={16} />
            <input
              type="text"
              placeholder="Suchen..."
              value={filterText}
              onChange={(e) => setFilterText(e.target.value)}
              className="search-input"
            />
          </div>

          {/* Create Button */}
          {onCreateClick && (
            <button
              onClick={onCreateClick}
              className="btn btn-primary btn-m"
              disabled={!!createDisabled || !hasWriteAccess}
              title={createDisabled ?? !hasWriteAccess ? "Nur Schreibrechte können neue Einträge erstellen" : undefined}
            >
              <Plus size={15} />
              {createLabel}
            </button>
          )}
        </div>
      </div>

      {/* Tabelle */}
      <div
        style={{ overflowX: "auto", flex: 1, minHeight: 0, overflowY: "auto"}}
        className="custom-scrollbar"
      >
        {isLoading ? (
          <div style={{ display: "flex", justifyContent: "center", padding: "56px 24px" }}>
            <div className="spinner" style={{ width: 36, height: 36 }}></div>
          </div>
        ) : (
          <table className="table">
            <thead className="table-thead">
            <tr>
              {columns.map((col) => {
                const isSorted = effectiveSortKey === String(col.key);
                return (
                  <th
                    key={String(col.key)}
                    className={`table-th ${col.sortable !== false ? "table-th-sortable" : ""}`}
                    onClick={() => handleSort(String(col.key), col.sortable)}
                  >
                    <div className="table-th-content">
                      <span>{col.title}</span>
                      {col.sortable !== false && (
                        <div className={`sort-icons ${isSorted ? "sort-icons-active" : ""}`}>
                          <ChevronUp
                            size={12}
                            style={{
                              color: isSorted && effectiveSortDirection === "asc"
                                ? "var(--accent)"
                                : undefined,
                            }}
                          />
                          <ChevronDown
                            size={12}
                            style={{
                              color: isSorted && effectiveSortDirection === "desc"
                                ? "var(--accent)"
                                : undefined,
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </th>
                );
              })}
              <th className="table-th" style={{ width: 72 }}>Aktionen</th>
            </tr>
            </thead>

            <tbody className="table-tbody">
            {processedRows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 1} className="table-empty">
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8}}>
                    <Inbox
                      size={40}
                      style={{ color: "var(--text-muted)", opacity: 0.5 }}
                      strokeWidth={1.25}
                    />
                    <span style={{ fontWeight: 600, color: "var(--text-secondary)" }}>
                                                Keine Einträge gefunden
                                            </span>
                    {filterText && (
                      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                                                    Kein Ergebnis für &quot;{filterText}&quot;
                                                </span>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              processedRows.map((row) => (
                <tr key={row.id} className="table-row">
                  {columns.map((col) => (
                    <td key={String(col.key)} className="table-td">
                      {col.render
                        ? col.render(row)
                        : String(row[col.key as keyof T])}
                    </td>
                  ))}
                  <td className="table-td">
                    <div className="table-actions">
                      <Link
                        to={`${basePath}/${row.id}`}
                        className="action-btn action-edit"
                        title="Bearbeiten"
                      >
                        <Edit2 size={15} />
                      </Link>
                      <button
                        onClick={() => handleDelete(row.id)}
                        className="action-btn action-delete"
                        disabled={!hasWriteAccess}
                        title={!hasWriteAccess ? "Nur Schreibrechte können Einträge löschen" : "Löschen"}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer */}
      {!isLoading && processedRows.length > 0 && (
        <div className="table-footer">
          {filterText ? (
            <>
              <strong style={{ color: "var(--text-primary)" }}>{processedRows.length}</strong>
              &nbsp;von&nbsp;
              <strong style={{ color: "var(--text-primary)" }}>{rows.length}</strong>
              &nbsp;Einträgen&nbsp;
            </>
          ) : (
            <>
              <strong style={{ color: "var(--text-primary)" }}>{rows.length}</strong>
              &nbsp;{rows.length === 1 ? "Eintrag" : "Einträge"}
            </>
          )}
        </div>
      )}
    </div>
  );
}