import Icon from "./Icon";
import "./EmptyState.css";

// What a screen shows when it has nothing to show yet — always with the way
// forward, never a blank area or a table of zeros.
export default function EmptyState({ icon = "games", title, body, actionLabel, onAction }) {
  return (
    <div className="empty-state card">
      <div className="empty-icon">
        <Icon name={icon} size={28} />
      </div>
      <h2>{title}</h2>
      {body && <p className="muted">{body}</p>}
      {actionLabel && (
        <button className="btn-primary" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  );
}
