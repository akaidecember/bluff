import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

import "../styles/wip.css";

export default function WorkInProgress() {
  const navigate = useNavigate();

  return (
    <motion.div
      className="wip"
      initial={{ opacity: 0, filter: "blur(6px)" }}
      animate={{ opacity: 1, filter: "blur(0px)" }}
      exit={{ opacity: 0, filter: "blur(6px)" }}
      transition={{ duration: 0.25 }}
    >
      <div className="wip-bg" aria-hidden="true" />
      <div className="wip-cards" aria-hidden="true" />
      <div className="wip-vignette" aria-hidden="true" />

      <main className="wip-main">
        <div className="wip-badge">Work in progress</div>
        <h1 className="wip-title">We're still shuffling the deck.</h1>
        <p className="wip-subtitle">This page is on its way. For now, head back to the table.</p>
        <motion.button
          type="button"
          className="wip-btn"
          onClick={() => navigate("/")}
          whileHover={{ y: -2 }}
          whileTap={{ scale: 0.98 }}
          aria-label="Back to home"
        >
          Back to home
        </motion.button>
      </main>
    </motion.div>
  );
}
