export type PlayingCardProps = {
  code: string;
  selected?: boolean;
  disabled?: boolean;
  onClick?: () => void;
};

export default function PlayingCard({
  code,
  selected = false,
  disabled = false,
  onClick,
}: PlayingCardProps) {
  return (
    <button
      type="button"
      className={`playing-card${selected ? " selected" : ""}`}
      disabled={disabled}
      onClick={onClick}
      aria-pressed={selected}
      aria-label={`Card ${code}`}
    >
      <img src={`/cards/${code}.svg`} alt={code} loading="lazy" draggable={false} />
    </button>
  );
}
