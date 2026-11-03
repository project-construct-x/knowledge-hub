import { useEffect, useState, useRef } from "react";
import { useAuth } from "../auth/useAuth.ts";
import { useParams, useNavigate, useSearchParams, useBlocker } from "react-router-dom";
import {api, ApiError} from "../api/api.ts";
import type {SubUseCase, Role, UseCase, Transaction, VersionConflictDetail} from "../types.ts";
import BpmnModelerComponent from "../components/Bpmn/BpmnModelerComponent.tsx";
import type BpmnModeler from "bpmn-js/lib/Modeler";
import {Tags, Layers, AlertCircle, FileText, Users, Search, ArrowLeftRight} from "lucide-react";
import CrudTable from "../components/CrudTable.tsx";
import {useStaleCheck} from "../hooks/useStaleCheck.ts";
import VersionConflictAlert from "../components/VersionConflictAlert.tsx";
import StaleDataAlert from "../components/StaleDataAlert.tsx";

const emptyDiagram = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                  id="Definitions_1"
                  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_1" isExecutable="false">
    <bpmn:startEvent id="StartEvent_1"/>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Process_1">
      <bpmndi:BPMNShape id="_BPMNShape_StartEvent_2" bpmnElement="StartEvent_1">
        <dc:Bounds x="173" y="102" width="36" height="36"/>
      </bpmndi:BPMNShape>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

const emptySubUseCase: Partial<SubUseCase> = {
  name: "",
  version: 1,
  description: "",
  conx_id: "",
  subUseCase_roles: [],
  useCase_id: 0,
  objective: "",
  inputs: "",
  outputs: "",
  potential_risks: "",
  distinction_from_other_sucs: "",
  dependency_of_other_sucs: "",
  assumptions: "",
};

export default function SubUseCaseDetail() {
  const { hasWriteAccess } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [item, setItem] = useState<Partial<SubUseCase>>(emptySubUseCase);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("basic");
  const [roles, setRoles] = useState<Role[]>([]);
  const [useCases, setUseCases] = useState<UseCase[]>([]);
  const [filteredRoles, setFilteredRoles] = useState<Role[]>([])
  const [searchTerm, setSearchTerm] = useState("");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [conflict, setConflict] = useState<VersionConflictDetail | null>(null);
  const [staleWarning, setStaleWarning] = useStaleCheck(
    item?.version,
    () => api.getSubUseCaseVersion(Number(id)),
    id !== "new" && !!item,
  );

  // BPMN state
  const modelerRef = useRef<BpmnModeler | null>(null);
  const [bpmnXml, setBpmnXml] = useState<string | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const bpmnFileInputRef = useRef<HTMLInputElement>(null);
  const [loadedBpmnXml, setLoadedBpmnXml] = useState<string | null>(null);

  // React Router Blocker für Navigation innerhalb der App
  const blocker = useBlocker(
    ({ currentLocation, nextLocation }) =>
      hasUnsavedChanges &&
      currentLocation.pathname !== nextLocation.pathname
  );

  useEffect(() => {
    api.listRoles().then(setRoles);
    api.listUseCases().then(setUseCases);

    if (id !== "new") {
      loadSubUseCase();
    } else {
      const useCase_id = searchParams.get("useCaseId");
      if (useCase_id) {
        setItem(prev => ({ ...prev, useCase_id: Number(useCase_id) }));
      }
      setBpmnXml(emptyDiagram);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, searchParams]);

  // Warnung bei ungespeicherten Änderungen im BPMN
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  useEffect(() => {
    if (blocker.state === "blocked") {
      const shouldLeave = window.confirm(
        "Sie haben ungespeicherte Änderungen am BPMN-Modell. Möchten Sie diese Seite wirklich verlassen?"
      );
      if (shouldLeave) {
        blocker.proceed();
      } else {
        blocker.reset();
      }
    }
  }, [blocker]);

  useEffect(() => {
    filterRoles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, roles]);

  async function loadSubUseCase() {
    setLoading(true);
    try {
      const data = await api.getSubUseCase(Number(id));
      setItem(data);
      setConflict(null);
      setStaleWarning(null);
      api.listTransactionsBySubUseCase(Number(data.id!)).then(setTransactions);
      setBpmnXml(data.bpmn_xml || emptyDiagram);
      setLoadedBpmnXml(data.bpmn_xml || emptyDiagram);
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error("Fehler beim Laden:", error);
      alert("SubUseCase konnte nicht geladen werden");
    } finally {
      setLoading(false);
    }
  }

  // ---- BPMN-Datei aus Dateisystem laden ----
  async function handleBpmnFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Erlaubte Endungen
    const allowedExtensions = [".bpmn", ".xml"];
    const fileName = file.name.toLowerCase();
    const hasValidExtension = allowedExtensions.some(ext => fileName.endsWith(ext));

    if (!hasValidExtension) {
      alert("Nur .bpmn- oder .xml-Dateien sind erlaubt.");
      // Input zurücksetzen, damit dieselbe Datei erneut gewählt werden kann
      e.target.value = "";
      return;
    }

    // Größenlimit: 500 KB
    if (file.size > 500 * 1024) {
      alert("Datei ist zu groß! Maximal 500 KB erlaubt.");
      e.target.value = "";
      return;
    }

    // Datei einlesen
    let xmlContent: string;
    try {
      xmlContent = await file.text();
    } catch (err) {
      alert("Datei konnte nicht gelesen werden.");
      console.log(err)
      e.target.value = "";
      return;
    }

    // Grundlegende XML-Validierung: Enthält es einen BPMN-Definitions-Block?
    if (!xmlContent.includes("definitions")) {
      alert("Die Datei scheint kein gültiges BPMN-XML zu sein.\n(Erwartet: <bpmn:definitions> oder <definitions>)");
      e.target.value = "";
      return;
    }

    // XML in den Modeler laden
    if (modelerRef.current) {
      try {
        setBpmnXml(xmlContent);
        setHasUnsavedChanges(true);
      } catch (err) {
        console.error("Fehler beim Importieren des BPMN-XML:", err);
        alert("Das BPMN-XML konnte nicht in den Modeler geladen werden.\nBitte prüfen Sie die Datei.");
        e.target.value = "";
        return;
      }
    } else {
      setBpmnXml(xmlContent);
      setHasUnsavedChanges(true);
    }
    e.target.value = "";
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!item.useCase_id) {
      alert("Bitte einen Use Case auswählen!");
      return;
    }

    setLoading(true);

    try {
      // Aktuelles XML aus dem Modeler holen
      let currentBpmnXml: string | null = null;
      if (modelerRef.current) {
        try {
          const result = await modelerRef.current.saveXML({ format: true });
          currentBpmnXml = result.xml || null;
        } catch (err) {
          console.error('Error saving BPMN XML:', err);
        }
      }

      const payload = {
        name: item.name!,
        version: item.version,
        description: item.description!,
        conx_id: item.conx_id,
        useCase_id: item.useCase_id,
        objective: item.objective,
        inputs: item.inputs,
        outputs: item.outputs,
        potential_risks: item.potential_risks,
        distinction_from_other_sucs: item.distinction_from_other_sucs,
        dependency_of_other_sucs: item.dependency_of_other_sucs,
        assumptions: item.assumptions,
        subUseCase_roles: (item.subUseCase_roles ?? []).map(r => ({
          role_id: r.role_id,
          motivation: r.motivation ?? undefined,
          goal: r.goal ?? undefined,
        })),
      };

      if (id === "new") {
        const created = await api.createSubUseCase(payload);

        if (currentBpmnXml) {
          await api.updateSubUseCaseBPMNXML(created.id, currentBpmnXml);
        }

        navigate(`/subusecases/${created.id}`);
      } else {
        const updated = await api.updateSubUseCase(Number(id), payload);
        setItem(updated);
        setConflict(null);

        if (currentBpmnXml) {
          await api.updateSubUseCaseBPMNXML(Number(id), currentBpmnXml);
        }

        if (currentBpmnXml) {
          setBpmnXml(currentBpmnXml);
          setLoadedBpmnXml(currentBpmnXml);
          setHasUnsavedChanges(false);
        }
        alert("SubUseCase erfolgreich aktualisiert");
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setConflict(error.detail as VersionConflictDetail);
        return;
      }
      console.error("Fehler beim Speichern:", error);
      alert("Fehler beim Speichern des SubUseCase");
    } finally {
      setLoading(false);
    }
  }

  function updateField(field: keyof SubUseCase, value: SubUseCase[keyof SubUseCase]) {
    setItem(prev => ({ ...prev, [field]: value }));
  }

  async function exportBpmnAsXml() {
    if (!modelerRef.current) return;

    try {
      const result = await modelerRef.current.saveXML({ format: true });
      const blob = new Blob([result.xml || ''], { type: 'text/xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${item.name || 'diagram'}.bpmn`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error exporting BPMN:', err);
      alert('Fehler beim Exportieren des BPMN-Modells');
    }
  }

  async function exportBpmnAsSvg() { //TODO im Darkmode wird das BPMN auch mit eingefärbten Objekten exportiert
    if (!modelerRef.current) return;

    try {
      const result = await modelerRef.current.saveSVG();
      const blob = new Blob([result.svg || ''], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${item.name || 'diagram'}.svg`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Error exporting SVG:', err);
      alert('Fehler beim Exportieren als SVG');
    }
  }

  // Hier wird unter anderem verglichen, ob ein geändertes BPMN doch wieder dem letzten Speicherstand entspricht.
  // Dadurch ist das Banner zu ungespeicherten Änderungen wirklich nur da, wenn es welche gibt.
  // Um nicht nach jeder Änderung zu vergleichen und den Load zu reduzieren, wurde ein Timer ergänzt.

  function handleModelerReady(modeler: BpmnModeler) {
    modelerRef.current = modeler;

    const eventBus = modeler.get('eventBus') as { on: (event: string, callback: () => void) => void };
    let debounceTimer: number | undefined;

    eventBus.on('commandStack.changed', () => {
      window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(async () => {
        if (!loadedBpmnXml || !modelerRef.current) return;
        const { xml } = await modelerRef.current.saveXML({ format: false });
        const isDirty = normalizeXml(xml ?? '') !== normalizeXml(loadedBpmnXml);
        setHasUnsavedChanges(isDirty);
      }, 300)
    });
  }

  function filterRoles() {
    let filtered = roles;

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(g =>
        g.name.toLowerCase().includes(term) ||
        g.definition.toLowerCase().includes(term)
      );
    }

    setFilteredRoles(filtered);
  }

  function toggleRole(role: Role) {
    const currentLinks = item.subUseCase_roles ?? [];
    const isSelected = currentLinks.some(r => r.role_id === role.id);

    if (isSelected) {
      setItem(prev => ({
        ...prev,
        subUseCase_roles: prev.subUseCase_roles?.filter(r => r.role_id !== role.id),
      }));
    } else {
      setItem(prev => ({
        ...prev,
        subUseCase_roles: [
          ...(prev.subUseCase_roles ?? []),
          { role_id: role.id, role, motivation: "", goal: ""},
        ],
      }));
    }
  }

  function updateRoleField(role_id: number, field: "motivation" | "goal" | "monetary_benefit", value: string) {
    setItem(prev => ({
      ...prev,
      subUseCase_roles: prev.subUseCase_roles?.map(r => r.role_id === role_id ? { ...r, [field]: value } : r),
    }));
  }

  function handleTabChange(tabId : string) {
    if (hasUnsavedChanges && activeTab === "bpmn" && tabId !== "bpmn") {
      const shouldSwitch = window.confirm(
        "Sie haben ungespeicherte Änderungen am BPMN-Modell. Möchten sie den Tab wirklich wechseln?"
      );
      if (!shouldSwitch) {
        return;
      }
      setHasUnsavedChanges(false);
    }
    setActiveTab(tabId);
  }

  function normalizeXml(xml: string): string {
    return xml
      .replace(/>\s+</g, '><')   // Whitespace zwischen Tags
      .replace(/\s+/g, ' ')      // Mehrfach-Spaces
      .trim();
  }

  const selectedUseCase = useCases.find(uc => uc.id === item.useCase_id);
  const roleCount = item.subUseCase_roles?.length ?? 0;

  const tabs = [
    { id: "basic", label: "Allgemein", icon: Tags, badge: undefined},
    { id: "roles", label: "Rollen", icon: Users, badge: roleCount > 0 ? roleCount: undefined},
    { id: "bpmn", label: "BPMN"},
    { id: "transactions", label: "Transaktionen", icon: ArrowLeftRight, badge: transactions?.length}
  ]


  if (loading && id !== "new") {
    return <div className="p-6 text-center">Laden...</div>;
  }

  return (
    <div className="page-container animate-fade-in">
      <div className="page-header">
        <div className="page-header-icon">
          <FileText size={22} />
        </div>
        <div>
          <div className="page-header-title">
            {selectedUseCase?.name
              ? `${selectedUseCase.conx_id ? selectedUseCase.conx_id + " - " : ""}${selectedUseCase.name}`
              : ""}
          </div>
          <div className="page-header-sub">Use Case</div>
        </div>

        <div className="page-header-icon">
          <Layers size={22} />
        </div>
        <div>
          <div className="page-header-title">
            {id === "new" ? "Neuer Sub Use Case" : item.conx_id ? `${item.conx_id} - ${item.name}` : item.name}
          </div>
          <div className="page-header-sub">Sub Use Case</div>
        </div>
      </div>

      <VersionConflictAlert
        conflict={conflict}
        onReload={loadSubUseCase}
        onForceOverwrite={() => setConflict(null)}
      />

      <StaleDataAlert
        staleInfo={staleWarning}
        onReload={loadSubUseCase}
        onDismiss={() => setStaleWarning(null)}
      />

      <form onSubmit={handleSubmit} style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
        {/* Tabs */}
        <div className="tabs">
          {tabs.map(tab => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleTabChange(tab.id)}
                className={`tab ${activeTab === tab.id ? "tab-active" : "tab-inactive"}`}
              >
                {Icon && <Icon size={15} />}
                {tab.label}
                {tab.badge !== undefined && tab.badge > 0 && (
                  <span className="badge badge-primary">{tab.badge}</span>
                )}
              </button>
            );
          })}
        </div>

        <div className="card" style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
          <div className="card-body form-section custom-scrollbar">

            {/* Grunddaten Tab */}
            {activeTab === "basic" && (
              <>
                <div>
                  <label className="form-label form-label-required">Use Case</label>
                  <select
                    required
                    value={item.useCase_id || ""}
                    onChange={(e) => updateField("useCase_id", Number(e.target.value))}
                    className="form-input form-select"
                    disabled={id !== "new"}
                  >
                    <option value="">-- Bitte wählen --</option>
                    {useCases.map((uc) => (
                      <option key={uc.id} value={uc.id}>
                        {uc.name}
                      </option>
                    ))}
                  </select>
                  {id !== "new" && (
                    <p className="form-hint">
                      Der Use Case kann nach dem Erstellen nicht mehr geändert werden.
                    </p>
                  )}
                </div>

                <div className="form-grid-2" style={{ gridTemplateColumns: "1fr 10fr" }}>
                  <div>
                    <label className="form-label form-label">ID</label>
                    <input
                      type="text"
                      value={item.conx_id || ""}
                      onChange={(e) => updateField("conx_id", e.target.value)}
                      className="form-input"
                      placeholder="Construct-X ID"
                    />
                  </div>

                  <div>
                    <label className="form-label form-label-required">Name</label>
                    <input
                      type="text"
                      required
                      value={item.name || ""}
                      onChange={(e) => updateField("name", e.target.value)}
                      className="form-input"
                      placeholder="Präziser Name für den Sub Use Case"
                    />
                  </div>
                </div>

                <div>
                  <label className="form-label">Beschreibung</label>
                  <textarea
                    rows={7}
                    value={item.description || ""}
                    onChange={(e) => updateField("description", e.target.value)}
                    className="form-textarea custom-scrollbar"
                    placeholder="Beschreibe den Sub Use Case..."
                  />
                </div>

                <div>
                  <label className="form-label">Ziel</label>
                  <textarea
                    rows={7}
                    value={item.objective || ""}
                    onChange={(e) => updateField("objective", e.target.value)}
                    className="form-textarea custom-scrollbar"
                    placeholder="Was ist das Gesamtziel des Sub Use Case?"
                  />
                </div>

                <div>
                  <label className="form-label">Inputs</label>
                  <textarea
                    rows={7}
                    value={item.inputs || ""}
                    onChange={(e) => updateField("inputs", e.target.value)}
                    className="form-textarea custom-scrollbar"
                    placeholder="Was sind die Inputs in den Sub Use Case?"
                  />
                </div>

                <div>
                  <label className="form-label">Outputs</label>
                  <textarea
                    rows={7}
                    value={item.outputs || ""}
                    onChange={(e) => updateField("outputs", e.target.value)}
                    className="form-textarea custom-scrollbar"
                    placeholder="Was sind die Outputs aus dem Sub Use Case?"
                  />
                </div>

                <div>
                  <label className="form-label">Potenzielle Risiken bei der Umsetzung</label>
                  <textarea
                    rows={7}
                    value={item.potential_risks || ""}
                    onChange={(e) => updateField("potential_risks", e.target.value)}
                    className="form-textarea custom-scrollbar"
                    placeholder="Gibt es Risiken, die die Umsetzung des Sub Use Cases gefährden könnten?"
                  />
                </div>

                <div>
                  <label className="form-label">Abgrenzung zu anderen Sub Use Cases</label>
                  <textarea
                    rows={7}
                    value={item.distinction_from_other_sucs || ""}
                    onChange={(e) => updateField("distinction_from_other_sucs", e.target.value)}
                    className="form-textarea custom-scrollbar"
                    placeholder="Worin unterscheidet sich der Sub Use Case zu anderen (thematisch ähnlichen) Sub Use Cases?"
                  />
                </div>

                <div>
                  <label className="form-label">Abhängigkeit von anderen Sub Use Cases</label>
                  <textarea
                    rows={7}
                    value={item.dependency_of_other_sucs || ""}
                    onChange={(e) => updateField("dependency_of_other_sucs", e.target.value)}
                    className="form-textarea custom-scrollbar"
                    placeholder="Ist der Sub Use Case von anderen Sub Use Cases abhängig? Wenn ja, wie?"
                  />
                </div>

                <div>
                  <label className="form-label">Annahmen und Rahmenbedingungen</label>
                  <textarea
                    rows={7}
                    value={item.assumptions || ""}
                    onChange={(e) => updateField("assumptions", e.target.value)}
                    className="form-textarea custom-scrollbar"
                    placeholder="Welche Annahmen und Rahmenbedingungen liegen dem Sub Use Case und dessen Umsetzung zugrunde?"
                  />
                </div>

              </>
            )}

            {/* Rollen */}
            {activeTab === "roles" && (
              <>
                {roleCount === 0 && (
                  <div className="alert alert-info">
                    <AlertCircle size={18} />
                    <span>Wählen Sie mindestens eine Rolle aus.</span>
                  </div>
                )}

                {/* Filter-Zeile */}
                <div className="form-grid-2">
                  <div className="search-wrapper" style={{ maxWidth: "none" }}>
                    <Search className="search-icon" size={16} />
                    <input
                      type="text"
                      placeholder="Name oder Definition suchen…"
                      value={searchTerm}
                      onChange={e => setSearchTerm(e.target.value)}
                      className="search-input"
                      style={{ width: "100%" }}
                    />
                  </div>
                </div>

                {/* Ausgewählte Chips */}
                {roleCount > 0 && (
                  <div className="selected-gropus-box">
                    <div className="selected-groups-label">
                      Ausgewählt: {roleCount} Rolle(n)
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {item.subUseCase_roles!.map((link) => (
                        <button
                          key={link.role_id}
                          type="button"
                          onClick={() => toggleRole(link.role)}
                          className="badge badge-primary badge-removable"
                        >
                          {link.role.name}
                          <span style={{ marginLeft: 3, opacity: 0.7 }}>×</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Motivation, Ziel & monetärer Nutzen je Rolle */}
                {roleCount > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10}}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: "var(--text-primary)" }}>
                      Details je Rolle
                    </div>
                    {item.subUseCase_roles!.map((link) => (
                      <div
                        key={link.role_id}
                        style={{
                          border: "1px solid var(--border-color)",
                          borderRadius: 8,
                          padding: "12px 14px",
                          background: "var(--bg-secondary)",
                        }}
                      >
                        <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10, color: "var(--text-primary)" }}>
                          {link.role.name}
                        </div>
                        <div className="form-grid-3">
                          <div className="form-group">
                            <label className="form-label">Motivation</label>
                            <textarea
                              className="form-input"
                              rows={2}
                              placeholder={`Motivation für ${link.role.name}…`}
                              value={link.motivation ?? ""}
                              onChange={e => updateRoleField(link.role_id, "motivation", e.target.value)}
                            />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Ziel</label>
                            <textarea
                              className="form-input"
                              rows={2}
                              placeholder={`Ziel für ${link.role.name}…`}
                              value={link.goal ?? ""}
                              onChange={e => updateRoleField(link.role_id, "goal", e.target.value)}
                            />
                          </div>
                          <div className="form-group">
                            <label className="form-label">Monetärer Nutzen</label>
                            <textarea
                              className="form-input"
                              rows={2}
                              placeholder={`Monetärer Nutzen für ${link.role.name}…`}
                              value={link.monetary_benefit ?? ""}
                              onChange={e => updateRoleField(link.role_id, "monetary_benefit", e.target.value)}
                            />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Rollen-Liste */}
                <div className="group-list custom-scrollbar">
                  {filteredRoles.length === 0 ? (
                    <div className="group-list-empty">
                      <span style={{ fontWeight: 600 }}>Keine Rollen gefunden</span>
                      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                                                Versuchen Sie einen anderen Suchbegriff
                                            </span>
                    </div>
                  ) : (
                    filteredRoles.map(role => {
                      const isSelected = item.subUseCase_roles?.some(r => r.role_id === role.id) || false;
                      return (
                        <label
                          key={role.id}
                          className={`group-list-item ${isSelected ? "group-list-item-selected" : ""}`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleRole(role)}
                            className="form-checkbox"
                            style={{ marginTop: 2, flexShrink: 0 }}
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 3 }}>
                                                            <span style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: 13 }}>
                                                                {role.name}
                                                            </span>
                            </div>
                            <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0, lineHeight: 1.5 }}>
                              {role.definition}
                            </p>
                          </div>
                        </label>
                      );
                    })
                  )}
                </div>
              </>
            )}

            {/* BPMN-Modell Tab */}
            {activeTab === "bpmn" && (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: "16px"}}>
                  {/* Toolbar: Import + Export */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between"}}>
                    <div style={{ display: "flex", gap: "8px"}}>
                      {/* Versteckter File-Input für .bpmn/.xml */}
                      <input
                        ref={bpmnFileInputRef}
                        type="file"
                        accept=".bpmn,.xml"
                        onChange={handleBpmnFileUpload}
                        style={{ display: "none" }}
                      />
                      <button
                        type="button"
                        onClick={() => bpmnFileInputRef.current?.click()}
                        className="btn btn-primary btn-sm"
                      >
                        BPMN-Datei importieren
                      </button>
                    </div>

                    <div style={{ display: "flex", gap: "8px"}}>
                      <button
                        type="button"
                        onClick={exportBpmnAsXml}
                        className="btn btn-secondary btn-sm"
                      >
                        Als XML exportieren
                      </button>
                      <button
                        type="button"
                        onClick={exportBpmnAsSvg}
                        className="btn btn-secondary btn-sm"
                      >
                        Als SVG exportieren
                      </button>
                    </div>
                  </div>

                  <p className="form-hint" style={{ fontSize: "13px"}}>
                    Bearbeiten Sie hier Ihr BPMN-Prozessmodell. Das Modell wird beim Speichern gesichert.
                    Sie können auch eine bestehende .bpmn- oder .xml-Datei importieren.
                  </p>

                  {bpmnXml && activeTab === "bpmn" && (
                    <BpmnModelerComponent
                      xml={bpmnXml}
                      onModelerReady={handleModelerReady}
                    />
                  )}

                  <p className="form-hint" style={{ fontSize: "13px"}}>
                    Tipp: Nutzen Sie die Werkzeugleiste links zum Erstellen von BPMN-Elementen.
                    Mit dem Mausrad können Sie zoomen, mit gedrückter Maustaste verschieben.
                  </p>
                </div>
              </>
            )}

            {/* Transaktionen Tabelle */}
            {activeTab === "transactions" && (
              <CrudTable
                basePath="/transactions"
                onDelete={async (id) => {
                  if (!confirm("Löschen?")) return;
                  await api.deleteTransaction(id as number);
                  setTransactions(prev => prev.filter(s => s.id !== id));
                }}
                rows={transactions || []}
                title="Transaktionen"
                createLabel={item.id ? "Neue Transaktion" : "Zuerst den Sub Use Case speichern"}
                onCreateClick={item.id
                  ? () => navigate(`/transactions/new?subUseCaseId=${item.id}`)
                  : () => {}
                }
                createDisabled={!item.id}
                columns={[
                  {
                    key: "process_number",
                    title: "Nummer",
                    render: (r) => <span style={{ fontWeight: 600 }}>{r.process_number}</span>
                  },
                  {
                    key: "name",
                    title: "Name",
                    render: (r) => <span style={{ fontWeight: 600 }}>{r.name}</span>
                  },
                  {
                    key: "related_class_id",
                    title: "Klasse"
                  },
                  {
                    key: "dataformat",
                    title: "Datenformat"
                  },
                ]}
              />
            )}
          </div>
        </div>

        {/* Aktionen */}
        <div className="form-actions">
          <button type="submit" disabled={loading || !hasWriteAccess} title={!hasWriteAccess ? "Nur Schreibrechte können speichern" : undefined} className="btn btn-primary">
            {loading ? "Speichern…" : "Speichern"}
          </button>
          <button type="button" onClick={() => navigate(-1)} className="btn btn-secondary">
            Zurück
          </button>
        </div>
      </form>
    </div>
  );
}