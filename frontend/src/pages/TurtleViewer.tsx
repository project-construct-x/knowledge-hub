import { useMemo, useState, type ChangeEvent, type ReactNode } from "react";
import { parseTurtle, type ObjectValue, type TtlModel } from "../components/ttlModel";

const border = "1px solid rgba(128,128,128,.35)";

function Collapsible({
  header,
  defaultOpen = false,
  children,
}: {
  header: ReactNode;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        style={{
          display: "flex",
          gap: 6,
          alignItems: "baseline",
          background: "none",
          border: "none",
          color: "inherit",
          font: "inherit",
          textAlign: "left",
          cursor: "pointer",
          padding: "2px 0",
        }}
      >
        <span style={{ width: 12, flexShrink: 0 }}>{open ? "▾" : "▸"}</span>
        {header}
      </button>
      {open && (
        <div style={{ marginLeft: 6, paddingLeft: 12, borderLeft: border }}>{children}</div>
      )}
    </div>
  );
}

function Badge({ children }: { children: ReactNode }) {
  return (
    <span
      style={{
        fontSize: 11,
        padding: "0 6px",
        border,
        borderRadius: 10,
        opacity: 0.85,
      }}
    >
      {children}
    </span>
  );
}

function ObjectRow({
  o,
  model,
  path,
}: {
  o: ObjectValue;
  model: TtlModel;
  path: ReadonlySet<string>;
}) {
  if (o.kind === "literal") {
    return (
      <div style={{ whiteSpace: "pre-wrap", padding: "2px 0" }}>
        {o.value}
        {o.lang && <span style={{ opacity: 0.6, fontSize: 11 }}> @{o.lang}</span>}
        {o.datatype && (
          <span style={{ opacity: 0.6, fontSize: 11 }}> ^^{model.shorten(o.datatype)}</span>
        )}
      </div>
    );
  }
  const target = model.entities.get(o.value);
  const name = target?.label ?? model.shorten(o.value);
  if (!target) return <div style={{ padding: "2px 0" }}>{name}</div>;
  if (path.has(o.value)) {
    return (
      <div style={{ padding: "2px 0", opacity: 0.7 }}>
        ↺ {name} <span style={{ fontSize: 11 }}>(Zyklus)</span>
      </div>
    );
  }
  return <EntityNode id={o.value} model={model} ancestors={path} />;
}

function EntityNode({
  id,
  model,
  ancestors,
  defaultOpen = false,
}: {
  id: string;
  model: TtlModel;
  ancestors: ReadonlySet<string>;
  defaultOpen?: boolean;
}) {
  const entity = model.entities.get(id)!;
  const path = useMemo(() => new Set(ancestors).add(id), [ancestors, id]);

  return (
    <Collapsible
      defaultOpen={defaultOpen}
      header={
        <>
          <strong>{entity.label ?? model.shorten(id)}</strong>
          {entity.label && (
            <span style={{ opacity: 0.6, fontSize: 12 }}>{model.shorten(id)}</span>
          )}
          {entity.types.map((t) => (
            <Badge key={t}>{model.shorten(t)}</Badge>
          ))}
        </>
      }
    >
      {entity.predicates.length === 0 && (
        <div style={{ opacity: 0.6, padding: "2px 0" }}>(keine weiteren Eigenschaften)</div>
      )}
      {entity.predicates.map((p) => (
        <div
          key={p.predicate}
          style={{
            display: "grid",
            gridTemplateColumns: "minmax(120px, 220px) 1fr",
            gap: 12,
            padding: "2px 0",
          }}
        >
          <div style={{ opacity: 0.7, fontSize: 12, paddingTop: 3 }}>
            {model.shorten(p.predicate)}
          </div>
          <div>
            {p.objects.map((o, i) => (
              <ObjectRow key={i} o={o} model={model} path={path} />
            ))}
          </div>
        </div>
      ))}
    </Collapsible>
  );
}

const EMPTY: ReadonlySet<string> = new Set();

export default function TurtleViewer() {
  const [model, setModel] = useState<TtlModel | null>(null);
  const [fileName, setFileName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [grouped, setGrouped] = useState(true);

  const onFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setModel(await parseTurtle(await file.text()));
      setFileName(file.name);
      setQuery("");
      setError(null);
    } catch (err) {
      setModel(null);
      setError(err instanceof Error ? err.message : "Parsing fehlgeschlagen");
    }
    e.target.value = ""; // gleiche Datei erneut wählbar
  };

  const searching = query.trim() !== "";

  const ids = useMemo(() => {
    if (!model) return [];
    if (!searching) return model.roots;
    const q = query.trim().toLowerCase();
    return [...model.entities.values()]
      .filter((e) => e.search.includes(q))
      .slice(0, 200)
      .map((e) => e.id);
  }, [model, query, searching]);

  const groups = useMemo(() => {
    if (!model) return [];
    if (!grouped || searching) return [{ key: "", ids }];
    const map = new Map<string, string[]>();
    for (const id of ids) {
      const key = model.entities.get(id)!.types[0] ?? "";
      map.set(key, [...(map.get(key) ?? []), id]);
    }
    return [...map.entries()]
      .sort(([a], [b]) => (a === "" ? 1 : b === "" ? -1 : a.localeCompare(b)))
      .map(([key, ids]) => ({ key, ids }));
  }, [model, ids, grouped, searching]);

  const renderIds = (list: string[]) =>
    list.map((id) => <EntityNode key={id} id={id} model={model!} ancestors={EMPTY} />);

  return (
    <div style={{ padding: 16 }}>
      <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}>
        <input type="file" accept=".ttl,text/turtle" onChange={onFile} />
        {model && (
          <>
            <input
              type="search"
              placeholder="Suchen …"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <label style={{ fontSize: 13 }}>
              <input
                type="checkbox"
                checked={grouped}
                onChange={(e) => setGrouped(e.target.checked)}
              />{" "}
              Nach Typ gruppieren
            </label>
          </>
        )}
      </div>

      {error && <p style={{ color: "crimson", whiteSpace: "pre-wrap" }}>{error}</p>}

      {model && (
        <>
          <p style={{ opacity: 0.7, fontSize: 13 }}>
            {fileName} · {model.tripleCount} Tripel · {model.entities.size} Ressourcen
            {searching && ` · ${ids.length} Treffer`}
          </p>

          {groups.map((g) =>
            g.key === "" && groups.length === 1 ? (
              <div key="flat">{renderIds(g.ids)}</div>
            ) : (
              <Collapsible
                key={g.key || "__none"}
                defaultOpen={g.ids.length <= 50}
                header={
                  <strong>
                    {g.key ? model.shorten(g.key) : "Ohne Typ"}{" "}
                    <span style={{ opacity: 0.6, fontWeight: 400 }}>({g.ids.length})</span>
                  </strong>
                }
              >
                {renderIds(g.ids)}
              </Collapsible>
            )
          )}
        </>
      )}
    </div>
  );
}
