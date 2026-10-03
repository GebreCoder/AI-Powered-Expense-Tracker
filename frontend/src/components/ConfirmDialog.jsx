import { useUI } from "../context/UIContext";
import Modal from "./Modal";
import { Trash2 } from "lucide-react";

export default function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel,
  busy = false,
}) {
  const { t } = useUI();

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      maxWidth={420}
      footer={
        <>
          <button className="btn btn-ghost" onClick={onClose} disabled={busy}>
            {t("cancel")}
          </button>
          <button className="btn btn-danger" onClick={onConfirm} disabled={busy}>
            <Trash2 size={15} />
            {confirmLabel || t("delete")}
          </button>
        </>
      }
    >
      <p style={{ fontSize: 14, color: "var(--text-secondary)", lineHeight: 1.6 }}>
        {message}
      </p>
    </Modal>
  );
}
