import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

import "../styles/landing.css";

export default function Landing() {
  const navigate = useNavigate();

  return (
    <motion.div
      className="landing"
      initial={{ opacity: 0, filter: "blur(6px)" }}
      animate={{ opacity: 1, filter: "blur(0px)" }}
      exit={{ opacity: 0, filter: "blur(6px)" }}
      transition={{ duration: 0.25 }}
    >
      <div className="landing-bg" aria-hidden="true" />
      <div className="landing-cards" aria-hidden="true">
        <img className="landing-joker left" src="/cards/JKR.svg" alt="" />
        <img className="landing-joker right" src="/cards/JKB.svg" alt="" />
      </div>
      <div className="landing-vignette" aria-hidden="true" />

      <header className="landing-top">
        <div />
        <nav className="top-actions">
          <button type="button" className="ghost" onClick={() => navigate("/how")} aria-label="How to play">
            How to play
          </button>
          <button
            type="button"
            className="ghost"
            onClick={() => window.open("https://github.com/akaidecember/bluff", "_blank", "noopener,noreferrer")}
            aria-label="Open GitHub repository"
          >
            GitHub
          </button>
        </nav>
      </header>

      <main className="landing-main">
        <motion.h1
          initial={{ y: -12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 120, damping: 14 }}
          className="landing-title"
        >
          BLUFF
        </motion.h1>

        <motion.p
          initial={{ y: -6, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.08 }}
          className="landing-subtitle"
        >
          Can you get away with it?
        </motion.p>

        <motion.div
          initial={{ y: 14, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.12 }}
          className="landing-cta"
        >
          <motion.button
            className="cta primary"
            onClick={() => navigate("/lobby")}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.98 }}
            aria-label="Play"
          >
            Play
          </motion.button>
        </motion.div>

        <div className="landing-note">2-6 players. Catch their lies, destroy friendships.</div>
      </main>

    </motion.div>
  );
}
