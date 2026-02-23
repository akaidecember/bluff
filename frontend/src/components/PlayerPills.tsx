import { AnimatePresence, motion } from "framer-motion";

export type PlayerPill = {
  id: string;
  name: string;
  isHost?: boolean;
};

type PlayerPillsProps = {
  players: PlayerPill[];
};

export function PlayerPills({ players }: PlayerPillsProps) {
  return (
    <div className="players-wrap" aria-live="polite">
      <AnimatePresence>
        {players.map((player) => (
          <motion.div
            key={player.id}
            className="player-pill"
            initial={{ opacity: 0, y: 10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.96 }}
            transition={{ type: "spring", stiffness: 180, damping: 16 }}
            layout
          >
            <span className="dot-online" />
            <span className="player-name">{player.name}</span>
            {player.isHost && <span className="host-badge">Host</span>}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
