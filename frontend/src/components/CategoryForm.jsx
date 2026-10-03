import { useState } from "react";
import { api } from "../api";
import { useUI } from "../context/UIContext";
import { useToast } from "./Toast";
import { ICON_OPTIONS, COLOR_OPTIONS, ICON_LABEL_MAP } from "./icons";

/* Friendly names for the color palette */
const COLOR_NAMES = {
  "#1e9e50": "Green",
  "#2ebd59": "Light Green",
  "#f0b429": "Yellow",
  "#e8a33d": "Gold",
  "#d99a26": "Dark Gold",
  "#e2483d": "Red",
  "#f2554c": "Coral",
  "#f97316": "Orange",
  "#0ea5e9": "Sky Blue",
  "#3b82f6": "Blue",
  "#8b5cf6": "Purple",
  "#64748b": "Gray",
};

export default function CategoryForm({ initial, onClose, onSaved }) {
  const { t } = useUI();
  const toast = useToast();
  const [form, setForm] = useState({
    name: initial?.name || "",
    icon: initial?.icon || ICON_OPTIONS[0].name,
    color: initial?.color || COLOR_OPTIONS[0],
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!form.name.trim()) {
      setError(t("categoryNameRequired"));
      return;
    }
    const body = { name: form.name.trim(), icon: form.icon, color: form.color };
    setBusy(true);
    try {
      if (initial?.id) {
        await api.updateCategory(initial.id, body);
        toast.success(t("categoryUpdated"));
      } else {
        await api.createCategory(body);
        toast.success(t("categoryCreated"));
      }
      onSaved();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit}>
      {error && <div className="form-error">{error}</div>}

      <div className="field">
        <label htmlFor="cat-name">{t("name")}</label>
        <input
          id="cat-name"
          className="input"
          type="text"
          placeholder={t("exampleCategoryName")}
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
        />
      </div>

      <div className="field">
        <label>{t("icon")}</label>
        <div className="icon-picker">
          {ICON_OPTIONS.map(({ name, icon: Icon }) => (
            <button
              key={name}
              type="button"
              className={`icon-option ${form.icon === name ? "selected" : ""}`}
              onClick={() => setForm((f) => ({ ...f, icon: name }))}
              aria-label={name}
              data-tooltip={ICON_LABEL_MAP[name] || name}
            >
              <Icon size={17} />
            </button>
          ))}
        </div>
      </div>

      <div className="field" style={{ marginBottom: 0 }}>
        <label>{t("color")}</label>
        <div className="color-picker">
          {COLOR_OPTIONS.map((c) => (
            <button
              key={c}
              type="button"
              className={`color-option ${form.color === c ? "selected" : ""}`}
              style={{ background: c }}
              onClick={() => setForm((f) => ({ ...f, color: c }))}
              aria-label={c}
              data-tooltip={`${COLOR_NAMES[c] || "Color"} (${c})`}
            />
          ))}
        </div>
      </div>

      <div className="modal-footer" style={{ padding: "18px 0 0", border: "none" }}>
        <button type="button" className="btn btn-ghost" onClick={onClose} disabled={busy}>
          {t("cancel")}
        </button>
        <button type="submit" className="btn btn-primary" disabled={busy}>
          {busy ? (
            <span className="spinner" style={{ borderColor: "rgba(255,255,255,.35)", borderTopColor: "#fff" }} />
          ) : initial?.id ? (
            t("saveChanges")
          ) : (
            t("createCategory")
          )}
        </button>
      </div>
    </form>
  );
}
