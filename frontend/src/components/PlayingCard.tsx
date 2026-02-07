export type PlayingCardProps = {
  code?: string;
  faceDown?: boolean;
  selected?: boolean;
  disabled?: boolean;
  className?: string;
  title?: string;
  onClick?: () => void;
};

export default function PlayingCard({
  code,
  faceDown = false,
  selected = false,
  disabled = false,
  className = "",
  title,
  onClick,
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
      aria-pressed={selected}
      aria-label={label}
      title={title}
    >
      <img src={src} alt={faceDown ? "Card back" : safeCode} loading="lazy" draggable={false} />
    </button>
  );
}
