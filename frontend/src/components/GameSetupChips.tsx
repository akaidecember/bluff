type GameSetupChipsProps = {
  decksLabel: string;
  directionLabel: string;
};

export function GameSetupChips({ decksLabel, directionLabel }: GameSetupChipsProps) {
  return (
    <div className="setup-chips">
      <span className="chip">{decksLabel}</span>
      <span className="chip">{directionLabel}</span>
    </div>
  );
}
