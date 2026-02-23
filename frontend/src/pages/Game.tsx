import { motion } from "framer-motion";

import Game, { type GameProps } from "../screens/Game";

export default function GamePage(props: GameProps) {
  return (
    <motion.div
      className="game-page"
      initial={{ opacity: 0, filter: "blur(6px)" }}
      animate={{ opacity: 1, filter: "blur(0px)" }}
      exit={{ opacity: 0, filter: "blur(6px)" }}
      transition={{ duration: 0.25 }}
    >
      <Game {...props} />
    </motion.div>
  );
}
