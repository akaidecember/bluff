import { useEffect, useMemo, useRef, useState } from "react";

import type { PrivateState, PublicState } from "../types/messages";
import { loadPhaser } from "./loadPhaser";

type PhaserTableProps = {
  publicState: PublicState | null;
  privateState: PrivateState | null;
  playerId: string;
};

type PhaserGameRef = {
  destroy: (removeCanvas?: boolean) => void;
  scale: {
    resize: (width: number, height: number) => void;
  };
};

export default function PhaserTable({ publicState, privateState, playerId }: PhaserTableProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<PhaserGameRef | null>(null);
  const sceneDataRef = useRef<{
    claimText?: { setText: (text: string) => void };
    centerText?: { setText: (text: string) => void };
    handText?: { setText: (text: string) => void };
    turnText?: { setText: (text: string) => void };
  }>({});
  const [bootError, setBootError] = useState<string | null>(null);

  const claimText = useMemo(() => {
    if (!publicState?.last_claim) {
      return "No claim yet";
    }
    const claimer = publicState.players.find((p) => p.player_id === publicState.last_claim?.player_id)?.display_name
      ?? publicState.last_claim.player_id;
    return `${claimer} claimed ${publicState.last_claim.count} ${publicState.last_claim.rank}`;
  }, [publicState]);

  const centerText = useMemo(() => {
    const rank = publicState?.round_rank ?? "OPEN";
    const pile = publicState?.pile_count ?? 0;
    return `Table ${rank} • Pile ${pile}`;
  }, [publicState]);

  const handCount = privateState?.hand.length ?? 0;
  const isMyTurn = publicState?.current_player_id === playerId;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) {
      return;
    }

    let cancelled = false;

    const boot = async () => {
      try {
        await loadPhaser();
        if (cancelled || !hostRef.current) {
          return;
        }

        const Phaser = (window as { Phaser?: any }).Phaser;
        if (!Phaser) {
          throw new Error("Phaser did not initialize");
        }

        const width = Math.max(640, host.clientWidth || 1280);
        const height = Math.max(360, host.clientHeight || 720);

        gameRef.current = new Phaser.Game({
          type: Phaser.AUTO,
          parent: host,
          width,
          height,
          backgroundColor: "#0a2a1d",
          scene: {
            create: function create() {
              const scene = this as any;
              const w = scene.scale.width;
              const h = scene.scale.height;

              const bg = scene.add.graphics();
              bg.fillGradientStyle(0x0a2a1d, 0x0f5132, 0x0a2a1d, 0x0f5132, 1);
              bg.fillRect(0, 0, w, h);

              const oval = scene.add.graphics();
              oval.lineStyle(4, 0xffffff, 0.18);
              oval.strokeEllipse(w / 2, h / 2, Math.min(w * 0.62, 900), Math.min(h * 0.56, 560));

              const deck = scene.add.rectangle(w / 2, h / 2, 90, 132, 0x102038, 0.95).setStrokeStyle(2, 0xf59e0b, 0.5);
              deck.setOrigin(0.5);

              sceneDataRef.current.turnText = scene.add
                .text(w / 2, 28, "Your Turn", {
                  fontFamily: "Inter, system-ui, sans-serif",
                  fontSize: "26px",
                  fontStyle: "700",
                  color: "#f5c04f",
                })
                .setOrigin(0.5, 0);

              sceneDataRef.current.claimText = scene.add
                .text(w / 2, 64, "No claim yet", {
                  fontFamily: "Inter, system-ui, sans-serif",
                  fontSize: "18px",
                  color: "#f3f7ff",
                  align: "center",
                })
                .setOrigin(0.5, 0);

              sceneDataRef.current.centerText = scene.add
                .text(w / 2, h / 2 + 84, "Table OPEN", {
                  fontFamily: "Inter, system-ui, sans-serif",
                  fontSize: "18px",
                  color: "#d8e2f0",
                  align: "center",
                })
                .setOrigin(0.5, 0);

              sceneDataRef.current.handText = scene.add
                .text(w / 2, h - 40, "Hand: 0 cards", {
                  fontFamily: "Inter, system-ui, sans-serif",
                  fontSize: "18px",
                  color: "#f3f7ff",
                })
                .setOrigin(0.5, 1);

              scene.add
                .text(14, h - 14, "Phaser foundation mode (task #5 start)", {
                  fontFamily: "Inter, system-ui, sans-serif",
                  fontSize: "12px",
                  color: "#9fb3c8",
                })
                .setOrigin(0, 1);
            },
          },
        });

        const onResize = () => {
          const el = hostRef.current;
          if (!el || !gameRef.current) {
            return;
          }
          gameRef.current.scale.resize(Math.max(640, el.clientWidth), Math.max(360, el.clientHeight));
        };

        window.addEventListener("resize", onResize);
        const detach = () => window.removeEventListener("resize", onResize);
        (gameRef.current as any).__detachResize = detach;
        setBootError(null);
      } catch (error) {
        setBootError(error instanceof Error ? error.message : "Unable to load Phaser");
      }
    };

    boot();

    return () => {
      cancelled = true;
      const current = gameRef.current as any;
      if (current?.__detachResize) {
        current.__detachResize();
      }
      gameRef.current?.destroy(true);
      gameRef.current = null;
      sceneDataRef.current = {};
    };
  }, []);

  useEffect(() => {
    sceneDataRef.current.claimText?.setText(claimText);
    sceneDataRef.current.centerText?.setText(centerText);
    sceneDataRef.current.handText?.setText(`Hand: ${handCount} cards`);
    sceneDataRef.current.turnText?.setText(isMyTurn ? "Your Turn" : "Opponent Turn");
  }, [centerText, claimText, handCount, isMyTurn]);

  if (bootError) {
    return <div className="phaser-error">Unable to initialize Phaser: {bootError}</div>;
  }

  return <div ref={hostRef} className="phaser-root" />;
}
