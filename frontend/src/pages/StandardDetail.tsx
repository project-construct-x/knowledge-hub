import { useEffect, useState } from "react";
import { useAuth } from "../auth/useAuth.ts";
import { useParams, useNavigate } from "react-router-dom";
import {api, ApiError} from "../api/api.ts";
import {type Standard, StandardCategory, type UseCase, type VersionConflictDetail} from "../types.ts";
import {AlertCircle, BookOpen, FileText, Search, Tags} from "lucide-react";
import TagInput from "../components/TagInput.tsx";
import {useStaleCheck} from "../hooks/useStaleCheck.ts";
import VersionConflictAlert from "../components/VersionConflictAlert.tsx";
import StaleDataAlert from "../components/StaleDataAlert.tsx";

const emptyStandard: Partial<Standard> = {
  number: "",
  version: 1,
  category: StandardCategory.TECHNICAL_STANDARD,
  title: "",
  subTitle: "",
  date: "",
  reference_URL: "",
  keywords: [],
  description: "",
  useCase_ids: [],
};

export default function StandardDetail() {
  const { hasWriteAccess } = useAuth();
  const { id } = useParams();
  const navigate = useNavigate();
  const [item, setItem] = useState<Partial<Standard>>(emptyStandard);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("basic");
  const [useCases, setUseCases] = useState<UseCase[]>([])
  const [filteredUseCases, setFilteredUseCases] = useState<UseCase[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [conflict, setConflict] = useState<VersionConflictDetail | null>(null);
  const [staleWarning, setStaleWarning] = useStaleCheck(
    item?.version,
    () => api.getStandardVersion(Number(id)),
    id !== "new" && !!item,
  );
  const categories = Object.values(StandardCategory).map((value) => ({
    value,
    label: value,
  }));

  useEffect(() => {
    loadUseCases()
    if (id !== "new") {
      loadStandard();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    filterUseCases();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchTerm, useCases]);

  useEffect(() => {
    if (item.useCases && !item.useCase_ids) {
      setItem(prev => ({
        ...prev,
        useCase_ids: prev.useCases?.map(uc => uc.id) ?? [],
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.useCases]);

  async function loadUseCases() {
    try {
      const useCases = await api.listUseCases();
      setUseCases(useCases);
    } catch (error) {
      console.error("Fehler beim Laden der UseCases:", error);
    }
  }

  async function loadStandard() {
    setLoading(true);
    try {
      const data = await api.getStandard(Number(id));
      setItem({
        ...data,
        useCase_ids: data.useCase_ids ?? data.useCases?.map((uc: UseCase) => uc.id) ?? [],
      });
      setConflict(null);
      setStaleWarning(null);
    } catch (error) {
      console.error("Fehler beim Laden: ", error);
      alert("Standard konnte nicht geladen werden.");
    } finally {
      setLoading(false);
    }
  }

  function filterUseCases() {
    let filtered = useCases;

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(uc =>
        uc.name.toLowerCase().includes(term) ||
        String(uc.conx_id ?? "").toLowerCase().includes(term)
      );
    }
    setFilteredUseCases(filtered)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    const payload = {
      number: item.number,
      version: item.version,
      category: item.category,
      title: item.title,
      subTitle: item.subTitle ?? "",
      date: item.date ?? "",
      reference_URL: item.reference_URL ?? "",
      keywords: item.keywords ?? [],
      description: item.description ?? "",
      useCase_ids: item.useCase_ids ?? [],
    };

    try {
      if (id === "new") {
        const created = await api.createStandard(payload);
        navigate(`/standards/${created.id}`);
      } else {
        const updated = await api.updateStandard(Number(id)!, payload);
        setItem(updated);
        setConflict(null);
        alert("Standard erfolgreich aktualisiert");
      }
    } catch (error) {
      if (error instanceof ApiError && error.status === 409) {
        setConflict(error.detail as VersionConflictDetail);
        return;
      }
      console.error("Fehler beim Speichern:", error);
      alert("Fehler beim Speichern des Standards");
    } finally {
      setLoading(false);
    }
  }

  function updateField(field: keyof Standard, value: Standard[keyof Standard]) {
    setItem(prev => ({ ...prev, [field]: value }));
  }

  function toggleUseCase(useCase: UseCase) {
    const currentIds = item.useCase_ids ?? [];
    const isSelected = currentIds.includes(useCase.id);

    setItem(prev => ({
      ...prev,
      useCase_ids: isSelected
        ? currentIds.filter(id => id !== useCase.id)
        : [...currentIds, useCase.id],
    }));
  }

  if (loading && id !== "new") {
    return (
      <div style={{ display: "flex", justifyContent: "center", padding: "64px 24px" }}>
        <div className="spinner" style={{ width: 36, height: 36 }} />
      </div>
    )
  }

  const selectedUseCaseIds = item.useCase_ids ?? [];

  const tabs = [
    { id: "basic", label: "Grunddaten", icon: Tags},
    { id: "usecases", label: "Use Cases", icon: FileText, badge: selectedUseCaseIds.length}
  ]

  return (
    <div className="page-container animate-fade-in">

      <div className="page-header">
        <div className="page-header-icon">
          <BookOpen size={22} />
        </div>
        <div>
          <div className="page-header-title">
            {id === "new" ? "Neuer Standard" : item.title}
          </div>
          <div className="page-header-sub">Standard</div>
        </div>
      </div>

      <VersionConflictAlert
        conflict={conflict}
        onReload={loadStandard}
        onForceOverwrite={() => setConflict(null)}
      />

      <StaleDataAlert
        staleInfo={staleWarning}
        onReload={loadStandard}
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
                onClick={() => setActiveTab(tab.id)}
                className={`tab ${activeTab === tab.id ? "tab-active": "tab-inactive"}`}
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

        <div className="card">
          <div className="card-body form-section custom-scrollbar">

            {/* Grunddaten */}
            {activeTab === "basic" && (
              <>
                <div>
                  <label className="form-label form-label-required">Kategorie</label>
                  <select
                    required
                    value={item.category || ""}
                    onChange={(e) => updateField("category", e.target.value)}
                    className="form-input form-select"
                  >
                    {categories.map(cat => (
                      <option key={cat.label} value={cat.value}>{cat.label}</option>
                    ))}
                  </select>
                </div>

                <div className="form-grid-2">
                  <div>
                    <label className="form-label form-label-required">Nummer</label>
                    <input
                      type="text"
                      required
                      value={item.number || ""}
                      onChange={(e) => updateField("number", e.target.value)}
                      className="form-input"
                    />
                  </div>
                  <div>
                    <label className="form-label form-label-required">Titel</label>
                    <input
                      type="text"
                      required
                      value={item.title || ""}
                      onChange={(e) => updateField("title", e.target.value)}
                      className="form-input"
                    />
                  </div>
                </div>
                <div className="form-grid-2">
                  <div>
                    <label className="form-label form-label">Untertitel</label>
                    <input
                      type="text"
                      value={item.subTitle || ""}
                      onChange={(e) => updateField("subTitle", e.target.value)}
                      className="form-input"
                    />
                  </div>
                  <div>
                    <label className="form-label form-label">Stand</label>
                    <input
                      type="text"
                      value={item.date || ""}
                      onChange={(e) => updateField("date", e.target.value)}
                      className="form-input"
                    />
                  </div>
                </div>
                <div>
                  <label className="form-label form-label">Schlagwörter</label>
                  <TagInput
                    value={item.keywords ?? []}
                    onChange={(tags) => {
                      setItem({ ...item, keywords: tags });
                    }}
                    placeholder="Schlagwort eingeben..."
                  />
                  <span className="form-hint">Enter oder &quot;Hinzufügen&quot; drücken zum Hinzufügen</span>
                                  </div>
                                  <div>
                                    <label className="form-label form-label">Beschreibung</label>
                  <textarea
                    rows={3}
                    value={item.description || ""}
                    onChange={(e) => updateField("description", e.target.value)}
                    className="form-input form-textarea custom-scrollbar"
                  />
                </div>
                <div>
                  <label className="form-label form-label">URL für weitere Informationen</label>
                  <input
                    type="url"
                    value={item.reference_URL || ""}
                    onChange={(e) => updateField("reference_URL", e.target.value)}
                    className="form-input"
                  />
                </div>
              </>
            )}

            {/* Use Cases */}
            {activeTab === "usecases" && (
              <>
                {selectedUseCaseIds.length === 0 && (
                  <div className="alert alert-info">
                    <AlertCircle size={18} />
                    <span>Keine Use Case verknüpft.</span>
                  </div>
                )}

                {/* Filter-Zeile */}
                <div className="search-wrapper" style={{ maxWidth: "none" }}>
                  <Search className="search-icon" size={16} />
                  <input
                    type="text"
                    placeholder="Name oder Construct-X ID suchen…"
                    value={searchTerm}
                    onChange={e => setSearchTerm(e.target.value)}
                    className="search-input"
                    style={{ width: "100%" }}
                  />
                </div>

                {/* Ausgewählte Chips */}
                {selectedUseCaseIds.length > 0 && (
                  <div className="selected-groups-box">
                    <div className="selected-groups-label">
                      Verknüpft: {selectedUseCaseIds.length} Use Cases
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {selectedUseCaseIds.map((ucId) => {
                        const uc = useCases.find((u) => u.id === ucId);
                        if (!uc) return null;
                        return (
                          <button
                            key={uc.id}
                            type="button"
                            onClick={() => toggleUseCase(uc)}
                            className="badge badge-primary badge-removable"
                          >
                            {uc.name}
                            <span style={{ marginLeft: 3, opacity: 0.7 }}>×</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* UseCase-Liste */}
                <div className="group-list custom-scrollbar">
                  {filteredUseCases.length === 0 ? (
                    <div className="group-list-empty">
                      <span style={{ fontWeight: 600 }}>Keine Use Cases gefunden</span>
                      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
                                                Versuchen Sie einen anderen Suchbegriff
                                            </span>
                    </div>
                  ) : (
                    filteredUseCases.map((uc) => {
                      const isSelected = selectedUseCaseIds.includes(uc.id);
                      return (
                        <label
                          key={uc.id}
                          className={`group-list-item ${isSelected ? "group-list-item-selected" : ""}`}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleUseCase(uc)}
                            className="form-checkbox"
                            style={{ marginTop: 2, flexShrink: 0 }}
                          />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap", marginBottom: 3 }}>
                              <span style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: 13 }}>
                                {uc.name}
                              </span>
                              {uc.conx_id != null && <span className="badge badge-gray">UC_{uc.conx_id}</span>}
                            </div>
                            {uc.description && (
                              <p style={{ fontSize: 12, color: "var(--text-muted)", margin: 0, lineHeight: 1.5 }}>
                                {uc.description}
                              </p>
                            )}
                          </div>
                        </label>
                      );
                    })
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Aktionen */}
        <div className="form-actions">
          <button type="submit" disabled={loading || !hasWriteAccess} title={!hasWriteAccess ? "Nur Schreibrechte können speichern" : undefined} className="btn btn-primary">
            {loading ? "Speichern…" : (hasWriteAccess ? "Speichern" : "Speichern (keine Schreibrechte)") }
          </button>
          <button type="button" onClick={() => navigate(-1)} className="btn btn-secondary">
            Zurück
          </button>
        </div>
      </form>
    </div>
  );
}
