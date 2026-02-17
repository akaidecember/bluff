import type { CSSProperties } from "react";

export type PlayingCardProps = {
  code?: string;
  faceDown?: boolean;
  selected?: boolean;
  disabled?: boolean;
  className?: string;
  title?: string;
  style?: CSSProperties;
  onClick?: () => void;
  onMouseEnter?: () => void;
};

export default function PlayingCard({
  code,
  faceDown = false,
  selected = false,
  disabled = false,
  className = "",
  title,
  style,
  onClick,
  onMouseEnter,
}: PlayingCardProps) {
  const safeCode = code ?? "";
  const src = faceDown ? "/cards/BACK.svg" : `/cards/${safeCode}.svg`;
  const label = faceDown ? "Face down card" : `Card ${safeCode}`;
  return (
    <button
      type="button"
      className={`playing-card${selected ? " selected" : ""} ${className}`.trim()}
      disabled={disabled}
      onClick={onClick}
      onMouseEnter={onMouseEnter}
      aria-pressed={selected}
      aria-label={label}
      title={title}
      style={style}
    >
      <img src={src} alt={faceDown ? "Card back" : safeCode} loading="lazy" draggable={false} />
    </button>
  );
}
