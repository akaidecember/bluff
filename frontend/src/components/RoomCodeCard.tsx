import { motion } from "framer-motion";

type RoomCodeCardProps = {
  code: string;
  onCopyCode: () => void;
};

export function RoomCodeCard({ code, onCopyCode }: RoomCodeCardProps) {
  const hasCode = code.trim().length > 0;

  return (
    <motion.div className="card room-code-card" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
      <div className="room-code-line">
        <span className="room-label">Room</span>
        <span className="room-code">{hasCode ? code : "-----"}</span>
      </div>
      <div className="room-actions">
        <button
          type="button"
          className="btn subtle"
          onClick={onCopyCode}
          disabled={!hasCode}
          aria-label="Copy room code"
        >
          Copy code
        </button>
      </div>
    </motion.div>
  );
}
