import { Parser, type Quad, type Term } from "n3";

const RDF_TYPE = "http://www.w3.org/1999/02/22-rdf-syntax-ns#type";
const XSD_STRING = "http://www.w3.org/2001/XMLSchema#string";
const LABEL_PREDICATES = new Set([
  "http://www.w3.org/2000/01/rdf-schema#label",
  "http://www.w3.org/2004/02/skos/core#prefLabel",
  "http://purl.org/dc/terms/title",
]);

export interface ObjectValue {
  kind: "resource" | "literal";
  value: string;
  lang?: string;
  datatype?: string;
}
export interface PredicateEntry {
  predicate: string;
  objects: ObjectValue[];
}
export interface Entity {
  id: string;
  types: string[];
  label?: string;
  predicates: PredicateEntry[];
  search: string;
}
export interface TtlModel {
  entities: Map<string, Entity>;
  roots: string[];
  tripleCount: number;
  shorten: (iri: string) => string;
}

const idOf = (t: Term) => (t.termType === "BlankNode" ? `_:${t.value}` : t.value);
const isResource = (t: Term) => t.termType === "NamedNode" || t.termType === "BlankNode";

export function parseTurtle(text: string): TtlModel {
    const prefixes: Record<string, unknown> = {};
    const parser = new Parser({ format: "text/turtle" });
    const quads: Quad[] = parser.parse(text, null, (prefix: string, node) => {
        prefixes[prefix] = node.value;
    });
    return buildModel(quads, prefixes);
}


function buildModel(quads: Quad[], prefixes: Record<string, unknown>): TtlModel {
  // Präfixe: längster Namespace zuerst
  const namespaces = Object.entries(prefixes)
    .map(([p, v]) => [p, typeof v === "string" ? v : (v as { value: string }).value] as const)
    .sort((a, b) => b[1].length - a[1].length);
  const shorten = (iri: string) => {
    for (const [p, ns] of namespaces) {
      if (ns && iri.startsWith(ns)) return `${p}:${iri.slice(ns.length)}`;
    }
    return iri;
  };

  const entities = new Map<string, Entity>();
  const labels = new Map<string, { value: string; lang: string }[]>();
  const referenced = new Set<string>();

  const ensure = (id: string) => {
    let e = entities.get(id);
    if (!e) {
      e = { id, types: [], predicates: [], search: "" };
      entities.set(id, e);
    }
    return e;
  };

  for (const q of quads) {
    if (!isResource(q.subject)) continue;
    const s = ensure(idOf(q.subject));
    const p = q.predicate.value;
    const o = q.object;

    if (p === RDF_TYPE && isResource(o)) {
      s.types.push(idOf(o));
      continue;
    }

    let value: ObjectValue;
    if (o.termType === "Literal") {
      value = {
        kind: "literal",
        value: o.value,
        lang: o.language || undefined,
        datatype: !o.language && o.datatype.value !== XSD_STRING ? o.datatype.value : undefined,
      };
      if (LABEL_PREDICATES.has(p)) {
        const list = labels.get(s.id) ?? [];
        list.push({ value: o.value, lang: o.language });
        labels.set(s.id, list);
      }
    } else if (isResource(o)) {
      value = { kind: "resource", value: idOf(o) };
      referenced.add(value.value);
    } else {
      continue;
    }

    let entry = s.predicates.find((x) => x.predicate === p);
    if (!entry) {
      entry = { predicate: p, objects: [] };
      s.predicates.push(entry);
    }
    entry.objects.push(value);
  }

  // Label wählen (de > en > ohne Sprache > andere) und Suchtext bauen
  const rank = (lang: string) => (lang === "de" ? 0 : lang === "en" ? 1 : lang === "" ? 2 : 3);
  for (const e of entities.values()) {
    const cand = labels.get(e.id);
    if (cand?.length) e.label = [...cand].sort((a, b) => rank(a.lang) - rank(b.lang))[0].value;
    const lits = e.predicates.flatMap((p) =>
      p.objects.filter((o) => o.kind === "literal").map((o) => o.value)
    );
    e.search = [e.id, e.label ?? "", ...e.types, ...lits].join(" ").toLowerCase();
  }

  // Wurzeln: Subjekte, auf die nichts verweist. Rest (reine Zyklen) wird ergänzt.
  const roots = [...entities.keys()].filter((id) => !referenced.has(id));
    // Ensure that class definitions (owl:Class) are included as roots even if they are referenced elsewhere
    // This guarantees that ontology class entities are displayed in the viewer.
    for (const [id, entity] of entities.entries()) {
      if (entity.types.includes('http://www.w3.org/2002/07/owl#Class') && !roots.includes(id)) {
        roots.push(id);
      }
    }
  const reachable = new Set<string>();
  const visit = (start: string) => {
    const stack = [start];
    while (stack.length) {
      const id = stack.pop()!;
      if (reachable.has(id)) continue;
      reachable.add(id);
      for (const p of entities.get(id)?.predicates ?? [])
        for (const o of p.objects) if (o.kind === "resource") stack.push(o.value);
    }
  };
  roots.forEach(visit);
  for (const id of entities.keys()) {
    if (!reachable.has(id)) {
      roots.push(id);
      visit(id);
    }
  }

  return { entities, roots, tripleCount: quads.length, shorten };

}
