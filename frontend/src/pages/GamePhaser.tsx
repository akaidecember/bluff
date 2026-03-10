import { motion } from "framer-motion";

import type { GameProps } from "./Game";
import PhaserTable from "../phaser/PhaserTable";

export default function GamePhaserPage(props: GameProps) {
  return (
    <motion.div
      className="game-page phaser-game-page"
      initial={{ opacity: 0, filter: "blur(6px)" }}
      animate={{ opacity: 1, filter: "blur(0px)" }}
      exit={{ opacity: 0, filter: "blur(6px)" }}
      transition={{ duration: 0.25 }}
    >
      <PhaserTable publicState={props.publicState} privateState={props.privateState} playerId={props.playerId} />
    </motion.div>
  );
}
