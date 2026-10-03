import { useEffect, useRef, useState } from "react";
import { Camera, User, X } from "lucide-react";
import { useUI } from "../context/UIContext";
import { useAuth } from "../context/AuthContext";
import { api } from "../api";
import { useToast } from "../components/Toast";
import { formatDate } from "../utils/format";

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export default function SettingsProfile() {
  const { t } = useUI();
  const { user, updateUser } = useAuth();
  const toast = useToast();
  const fileRef = useRef(null);

  const [pfName, setPfName] = useState(user?.full_name || "");
  const [pfUsername, setPfUsername] = useState(user?.username || "");
  const [pfEmail, setPfEmail] = useState(user?.email || "");
  const [pfPassword, setPfPassword] = useState("");
  const [pfImage, setPfImage] = useState(user?.avatar_image || null);
  const [imgError, setImgError] = useState("");
  const [pfBusy, setPfBusy] = useState(false);
  const [pfError, setPfError] = useState("");

  useEffect(() => {
    setPfName(user?.full_name || "");
    setPfUsername(user?.username || "");
    setPfEmail(user?.email || "");
    setPfImage(user?.avatar_image || null);
  }, [user]);

  const emailChanged =
    pfEmail.trim().toLowerCase() !== (user?.email || "").toLowerCase();
  const usernameChanged =
    pfUsername.trim().toLowerCase() !== (user?.username || "").toLowerCase();

  // ---- Avatar upload ----
  const pickImage = () => {
    setImgError("");
    fileRef.current?.click();
  };

  const onFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file
    if (!file) return;
    if (!ACCEPTED.includes(file.type)) {
      setImgError(t("avatarTypeError"));
      return;
    }
    if (file.size > MAX_BYTES) {
      setImgError(t("avatarSizeError"));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setImgError("");
      setPfImage(String(reader.result));
    };
    reader.readAsDataURL(file);
  };

  const removeImage = () => {
    setImgError("");
    setPfImage(null);
  };

  const saveProfile = async (e) => {
    e.preventDefault();
    setPfBusy(true);
    setPfError("");
    try {
      const body = { fullName: pfName.trim() };
      if (emailChanged || usernameChanged) {
        body.currentPassword = pfPassword;
      }
      if (emailChanged) {
        body.email = pfEmail.trim();
      }
      if (usernameChanged) {
        body.username = pfUsername.trim();
      }
      // Only send the avatar when it changed from what's stored, so a
      // name-only save never touches the photo.
      if (pfImage !== (user?.avatar_image || null)) {
        body.avatarImage = pfImage;
      }
      const { user: updated } = await api.updateProfile(body);
      updateUser(updated);
      setPfPassword("");
      toast.success(t("profileUpdated"));
    } catch (err) {
      setPfError(err.message || t("profileUpdateError"));
    } finally {
      setPfBusy(false);
    }
  };

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">{t("myProfile")}</h1>
          <p className="page-subtitle">{t("accountHint")}</p>
        </div>
      </div>

      <div className="settings-stack">
        <div className="card settings-page-card">
          <div className="settings-body">
            <div className="settings-user">
              <div className="avatar-upload">
                <button
                  type="button"
                  className="avatar-upload-circle"
                  onClick={pickImage}
                  style={{ background: pfImage ? "transparent" : user?.avatar_color || "#10b981" }}
                  aria-label={t("uploadPhoto")}
                  title={t("changePhoto")}
                >
                  {pfImage ? (
                    <img src={pfImage} alt={t("profilePhoto")} className="avatar-upload-img" />
                  ) : (
                    <User size={28} className="avatar-upload-placeholder" />
                  )}
                  <span className="avatar-upload-overlay">
                    <Camera size={18} />
                    <span>{t("changePhoto")}</span>
                  </span>
                </button>

                <button
                  type="button"
                  className="avatar-upload-camera"
                  onClick={pickImage}
                  aria-label={t("uploadPhoto")}
                  title={t("changePhoto")}
                >
                  <Camera size={14} />
                </button>

                {pfImage && (
                  <button
                    type="button"
                    className="avatar-upload-remove"
                    onClick={removeImage}
                    aria-label={t("removePhoto")}
                    title={t("removePhoto")}
                  >
                    <X size={12} />
                  </button>
                )}

                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="avatar-upload-input"
                  onChange={onFile}
                  aria-hidden="true"
                  tabIndex={-1}
                />
              </div>

              <div style={{ minWidth: 0 }}>
                <div className="settings-name">{user?.full_name}</div>
                <div className="settings-email">{user?.email}</div>
                {user?.created_at && (
                  <div className="settings-member">
                    {t("memberSince", { date: formatDate(user.created_at) })}
                  </div>
                )}
              </div>
            </div>

            {imgError && <div className="form-error">{imgError}</div>}

            <form className="settings-form" onSubmit={saveProfile}>
              <div className="field">
                <label htmlFor="pf-name">{t("fullName")}</label>
                <input
                  id="pf-name"
                  className="input"
                  value={pfName}
                  onChange={(e) => setPfName(e.target.value)}
                />
              </div>

              <div className="field">
                <label htmlFor="pf-username">{t("username")}</label>
                <input
                  id="pf-username"
                  className="input"
                  value={pfUsername}
                  onChange={(e) => setPfUsername(e.target.value)}
                />
              </div>

              <div className="field">
                <label htmlFor="pf-email">{t("email")}</label>
                <input
                  id="pf-email"
                  className="input"
                  type="email"
                  value={pfEmail}
                  onChange={(e) => setPfEmail(e.target.value)}
                />
              </div>

              {emailChanged && (
                <div className="field">
                  <label htmlFor="pf-password">{t("currentPassword")}</label>
                  <input
                    id="pf-password"
                    className="input"
                    type="password"
                    autoComplete="current-password"
                    value={pfPassword}
                    onChange={(e) => setPfPassword(e.target.value)}
                    placeholder={t("emailChangeRequiresPassword")}
                  />
                </div>
              )}

              {pfError && <div className="form-error">{pfError}</div>}

              <div className="settings-form-actions">
                <button
                  className="btn btn-primary"
                  type="submit"
                  disabled={pfBusy || !pfName.trim()}
                >
                  {pfBusy ? <span className="spinner spinner-sm" /> : null}
                  {t("saveChanges")}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}
