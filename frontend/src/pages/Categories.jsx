import { useCallback, useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Trash2, Tags, Info, Search } from "lucide-react";
import { api } from "../api";
import { useToast } from "../components/Toast";
import { useUI } from "../context/UIContext";
import Modal from "../components/Modal";
import ConfirmDialog from "../components/ConfirmDialog";
import CategoryForm from "../components/CategoryForm";
import EmptyState from "../components/EmptyState";
import { CategoryIcon } from "../components/icons";
import { formatDateShort } from "../utils/format";

export default function Categories() {
  const toast = useToast();
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [details, setDetails] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [q, setQ] = useState("");

  const query = q.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      query
        ? categories.filter((c) => c.name.toLowerCase().includes(query))
        : categories,
    [categories, query],
  );

  const { t } = useUI();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setCategories(await api.getCategories());
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  const confirmDelete = async () => {
    if (!deleting) return;
    setDeleteBusy(true);
    try {
      await api.deleteCategory(deleting.id);
      toast.success(t("categoryDeleted"));
      setDeleting(null);
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setDeleteBusy(false);
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t("categories")}</h1>
          <p className="page-subtitle">
            {categories.length} {categories.length === 1 ? t("category") : t("categoriesLabel")} — {t("organizeLabel")}
          </p>
        </div>
        <div className="page-header-tools">
          {categories.length > 0 && (
            <div className="input-wrap">
              <Search size={15} className="input-icon" />
              <input
                className="input"
                type="search"
                placeholder={t("searchCategories")}
                value={q}
                onChange={(e) => setQ(e.target.value)}
                aria-label={t("searchCategories")}
              />
            </div>
          )}
          <button
            className="btn btn-primary"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus size={17} />
            {t("addCategory")}
          </button>
        </div>
      </div>

      {loading ? (
        <div className="panel-skeleton">
          <div className="skeleton-block" style={{ height: 110 }} />
          <div className="skeleton-block" style={{ height: 110 }} />
          <div className="skeleton-block" style={{ height: 110 }} />
        </div>
      ) : categories.length === 0 ? (
          <EmptyState
            icon={Tags}
            title={t("noCategoriesYet")}
            text={t("createCategoriesText")}
            action={
              <button
                className="btn btn-primary btn-sm"
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
              >
                <Plus size={15} />
                {t("addCategory")}
              </button>
            }
          />
        ) : filtered.length === 0 ? (
          <div className="search-empty">{t("noMatches")}</div>
        ) : (
          <div className="cat-grid">
            {filtered.map((c) => (
              <div key={c.id} className="cat-card">
                <div className="cat-card-head">
                  <div
                    className="cat-card-icon"
                    style={{ background: c.color || "#1f7a54" }}
                  >
                    <CategoryIcon name={c.icon} size={20} />
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div className="cat-card-name">{c.name}</div>
                    <div className="cat-card-meta">{t("createdOnDate", { date: formatDateShort(c.created_at) })}</div>
                  </div>
                </div>
                <div className="cat-card-actions">
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ flex: 1 }}
                    onClick={() => setDetails(c)}
                  >
                    <Info size={14} />
                    {t("details")}
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ flex: 1 }}
                    onClick={() => {
                      setEditing(c);
                      setFormOpen(true);
                    }}
                    aria-label={t("editName", { name: c.name })}
                  >
                    <Pencil size={14} />
                    {t("edit")}
                  </button>
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ flex: 1, color: "var(--danger)" }}
                    onClick={() => setDeleting(c)}
                    aria-label={t("deleteName", { name: c.name })}
                  >
                    <Trash2 size={14} />
                    {t("delete")}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

      <Modal
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? t("editCategory") : t("addCategory")}
      >
        <CategoryForm
          initial={editing}
          onClose={() => setFormOpen(false)}
          onSaved={() => {
            setFormOpen(false);
            load();
          }}
        />
      </Modal>

      <Modal
        open={Boolean(details)}
        onClose={() => setDetails(null)}
        title={t("categoryDetails")}
      >
        {details && (
          <>
            <div className="detail-head">
              <div
                className="cat-card-icon"
                style={{ background: details.color || "#1f7a54" }}
              >
                <CategoryIcon name={details.icon} size={20} />
              </div>
              <div style={{ minWidth: 0 }}>
                <div className="detail-name">{details.name}</div>
                <div className="detail-meta">
                  {t("createdOnDate", { date: formatDateShort(details.created_at) })}
                </div>
              </div>
            </div>
            <div className="detail-rows">
              <div className="detail-row">
                <span>{t("icon")}</span>
                <strong>{details.icon || "—"}</strong>
              </div>
              <div className="detail-row">
                <span>{t("color")}</span>
                <strong>
                  <span
                    className="color-swatch"
                    style={{ background: details.color || "#1f7a54" }}
                  />
                  {details.color || "—"}
                </strong>
              </div>
            </div>
          </>
        )}
      </Modal>

      <ConfirmDialog
        open={Boolean(deleting)}
        onClose={() => setDeleting(null)}
        onConfirm={confirmDelete}
        busy={deleteBusy}
        title={t("deleteCategory")}
        confirmLabel={t("delete")}
        message={t("deleteCategoryWarning", { name: deleting?.name || t("untitled") })}
      />
    </>
  );
}
