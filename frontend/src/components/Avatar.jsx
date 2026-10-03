import { initials } from "../utils/format";

/**
 * Renders the user's avatar: uploaded photo when present, otherwise
 * initials on the chosen avatar color.
 */
export default function Avatar({ name, image, color, className = "" }) {
  if (image) {
    return (
      <div className={`avatar ${className}`.trim()}>
        <img src={image} alt={name || "avatar"} className="avatar-img" />
      </div>
    );
  }
  return (
    <div
      className={`avatar ${className}`.trim()}
      style={{ background: color || undefined }}
    >
      {initials(name)}
    </div>
  );
}
