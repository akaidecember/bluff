import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";

import PlayingCard from "../components/PlayingCard";
import { useSound } from "../lib/sound";
import type { ClientMessage, PrivateState, PublicState, ServerMessage } from "../types/messages";

const CLAIM_RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"];

export type GameProps = {
  playerId: string;
  roomCode: string;
  publicState: PublicState | null;
  privateState: PrivateState | null;
  lastChallenge: Extract<ServerMessage, { type: "challenge_resolved" }> | null;
  onSend: (message: ClientMessage) => void;
};

type Seat = {
  player_id: string;
  display_name: string;
  hand_count: number;
  x: number;
  y: number;
  angle: number;
  isCurrent: boolean;
  isFinished: boolean;
};

type PileStackProps = {
  count: number;
  label: string;
  className?: string;
  metaText?: string;
};

type PlayAnimation = {
  id: string;
  code: string;
  offset: number;
  rotation: number;
  delay: number;
};

type BluffReveal = {
  id: string;
  pickedCard: string;
  pickedMatchesClaim: boolean;
  claimantId: string;
  challengerId: string;
};

type ResponsiveLayout = {
  stageWidth: number;
  myCardWidth: number;
  myCardOverlap: number;
  seatCardWidth: number;
  seatFanStep: number;
  seatFanWidth: number;
  seatFanHeight: number;
  tableHandWidth: number;
  handSlabHeight: number;
  cardsViewportHeight: number;
  tableBottomPadding: number;
};

const PLAY_ANIMATION_MS = 520;
const PLAY_ANIMATION_STAGGER_MS = 70;

function computeResponsiveLayout(rawWidth: number): ResponsiveLayout {
  const stageWidth = Math.max(320, rawWidth);
  const myCardWidth = Math.round(Math.min(80, Math.max(48, stageWidth * 0.06)));
  const myCardOverlap = -Math.round(Math.min(56, Math.max(28, myCardWidth * 0.62)));
  const seatCardWidth = Math.round(Math.min(54, Math.max(34, stageWidth * 0.043)));
  const seatFanStep = Math.round(Math.min(15, Math.max(8, seatCardWidth * 0.28)));
  const seatFanWidth = Math.round(Math.min(220, Math.max(130, seatCardWidth * 3.8)));
  const seatFanHeight = Math.round(Math.min(108, Math.max(64, seatCardWidth * 1.7)));
  const tableHandWidth = Math.round(Math.min(1120, Math.max(360, stageWidth * 0.92)));
  const handSlabHeight = Math.round(Math.min(276, Math.max(224, stageWidth * 0.215)));
  const cardsViewportHeight = Math.round(Math.max(108, handSlabHeight - 78));
  const tableBottomPadding = handSlabHeight + 24;

  return {
    stageWidth,
    myCardWidth,
    myCardOverlap,
    seatCardWidth,
    seatFanStep,
    seatFanWidth,
    seatFanHeight,
    tableHandWidth,
    handSlabHeight,
    cardsViewportHeight,
    tableBottomPadding,
  };
}

function PileStack({ count, label, className = "", metaText }: PileStackProps) {
  const visible = Math.min(Math.max(count, 1), 8);
  return (
    <div className={`pile-stack ${className}`.trim()}>
      <div className={`pile-cards${count === 0 ? " empty" : ""}`}>
        {Array.from({ length: visible }, (_, index) => (
          <img
            key={`${label}-${index}`}
            src="/cards/BACK.svg"
            alt={`${label} card`}
            className="pile-card"
            style={{
              transform: `translate(${index * 1.8}px, ${-index * 1.6}px) rotate(${(index % 2 === 0 ? -1 : 1) * index * 1.5}deg)`,
            }}
            draggable={false}
          />
        ))}
      </div>
      <p>{metaText ?? `${label}: ${count}`}</p>
    </div>
  );
}

function tableNameFromRank(rank: string | null): string {
  if (!rank) {
    return "Open Table";
  }

  const names: Record<string, string> = {
    A: "Ace",
    K: "King",
    Q: "Queen",
    J: "Jack",
    "10": "Ten",
    "9": "Nine",
    "8": "Eight",
    "7": "Seven",
    "6": "Six",
    "5": "Five",
    "4": "Four",
    "3": "Three",
    "2": "Two",
  };

  const base = names[rank] ?? rank;
  return `${base}'s Table`;
}

function getOpponentSeats(
  players: PublicState["players"],
  playerId: string,
  currentPlayerId: string | null,
  finishedOrder: string[]
): Seat[] {
  const total = players.length;
  if (total <= 1) {
    return [];
  }

  const myIndex = Math.max(
    0,
    players.findIndex((player) => player.player_id === playerId)
  );

  return players
    .filter((player) => player.player_id !== playerId)
    .map((player) => {
      const playerIndex = players.findIndex((item) => item.player_id === player.player_id);
      let offset = playerIndex - myIndex;
      if (offset <= 0) {
        offset += total;
      }

      const angle = 90 + (offset * 360) / total;
      const radians = (angle * Math.PI) / 180;
      const twoPlayerLayout = total === 2;

      return {
        player_id: player.player_id,
        display_name: player.display_name,
        hand_count: player.hand_count,
        x: twoPlayerLayout ? 50 : 50 + 37 * Math.cos(radians),
        y: twoPlayerLayout ? 26 : 50 + 31 * Math.sin(radians),
        angle: twoPlayerLayout ? 270 : angle,
        isCurrent: currentPlayerId === player.player_id,
        isFinished: finishedOrder.includes(player.player_id),
      };
    });
}

export default function Game({
  playerId,
  roomCode,
  publicState,
  privateState,
  lastChallenge,
  onSend,
}: GameProps) {
  const [selectedIndices, setSelectedIndices] = useState<number[]>([]);
  const [claimRank, setClaimRank] = useState("");
  const [pickIndex, setPickIndex] = useState(0);
  const [isBluffModalOpen, setBluffModalOpen] = useState(false);
  const [isInfoHovering, setInfoHovering] = useState(false);
  const [responsiveLayout, setResponsiveLayout] = useState<ResponsiveLayout>(() =>
    computeResponsiveLayout(1280)
  );
  const [playAnimations, setPlayAnimations] = useState<PlayAnimation[]>([]);
  const [bluffReveal, setBluffReveal] = useState<BluffReveal | null>(null);
  const [handCenterWidth, setHandCenterWidth] = useState<number | null>(null);
  const tableStageRef = useRef<HTMLElement | null>(null);
  const handCenterRef = useRef<HTMLDivElement | null>(null);
  const playAnimationTimeouts = useRef<number[]>([]);
  const bluffRevealTimeout = useRef<number | null>(null);
  const lastBluffRevealRef = useRef<string | null>(null);
  const lastHoverSoundRef = useRef<number>(0);
  const { play } = useSound();

  const phase = publicState?.phase ?? "UNKNOWN";
  const isMyTurn = publicState?.current_player_id === playerId;
  const hand = privateState?.hand ?? [];

  const activeRoundRank = publicState?.round_rank ?? null;
  const effectiveClaimRank = activeRoundRank ?? claimRank;
  const pickMax = Math.max(publicState?.last_play_count ?? 1, 1);

  const canPlay = isMyTurn && (phase === "PLAYER_TURN" || phase === "CLAIM_MADE");
  const canPass = isMyTurn && (phase === "PLAYER_TURN" || phase === "CLAIM_MADE");
  const canCallBluff =
    isMyTurn &&
    phase === "CLAIM_MADE" &&
    publicState?.last_claim !== null &&
    publicState?.last_claim?.player_id !== playerId;

  const canSubmitPlay = canPlay && selectedIndices.length > 0 && Boolean(effectiveClaimRank);

  const playerNameById = useMemo(() => {
    const mapping: Record<string, string> = {};
    for (const player of publicState?.players ?? []) {
      mapping[player.player_id] = player.display_name;
    }
    return mapping;
  }, [publicState?.players]);

  const standings = publicState?.standings ?? [];
  const placing = standings.findIndex((player) => player === playerId) + 1;
  const isLoser = publicState?.loser_id === playerId;

  const seats = useMemo(
    () =>
      getOpponentSeats(
        publicState?.players ?? [],
        playerId,
        publicState?.current_player_id ?? null,
        publicState?.finished_order ?? []
      ),
    [publicState?.players, publicState?.current_player_id, publicState?.finished_order, playerId]
  );

  const maxCardsPerRow = useMemo(() => {
    if (hand.length === 0) {
      return 1;
    }

    const effectiveStep = Math.max(
      responsiveLayout.myCardWidth - Math.abs(responsiveLayout.myCardOverlap),
      14
    );
    const fallbackWidth = Math.max(
      responsiveLayout.stageWidth * 0.76,
      responsiveLayout.myCardWidth
    );
    const availableWidth = Math.max(handCenterWidth ?? fallbackWidth, responsiveLayout.myCardWidth);
    const fittedByWidth = Math.max(
      6,
      Math.floor((availableWidth - responsiveLayout.myCardWidth) / effectiveStep) + 1
    );

    if (hand.length <= fittedByWidth) {
      return hand.length;
    }
    if (hand.length <= fittedByWidth * 2) {
      return Math.ceil(hand.length / 2);
    }
    if (hand.length <= fittedByWidth * 3) {
      return Math.ceil(hand.length / 3);
    }
    return Math.ceil(hand.length / 4);
  }, [
    hand.length,
    handCenterWidth,
    responsiveLayout.myCardOverlap,
    responsiveLayout.myCardWidth,
    responsiveLayout.stageWidth,
  ]);

  const handRows = useMemo(() => {
    const rows: Array<{ start: number; cards: string[] }> = [];
    for (let start = 0; start < hand.length; start += maxCardsPerRow) {
      rows.push({ start, cards: hand.slice(start, start + maxCardsPerRow) });
    }
    return rows;
  }, [hand, maxCardsPerRow]);

  const handRowCount = Math.max(1, handRows.length);
  const estimatedCardHeight = Math.round(responsiveLayout.myCardWidth * 1.45);

  const rowStackLift = useMemo(() => {
    if (handRowCount <= 1) {
      return 0;
    }

    // Keep slab height fixed and vary overlap while preserving visibility between rows.
    const fitStep = (responsiveLayout.cardsViewportHeight - estimatedCardHeight) / (handRowCount - 1);
    const minStep = estimatedCardHeight * 0.4;
    const maxStep = estimatedCardHeight * 0.8;
    const step = Math.min(maxStep, Math.max(minStep, fitStep));
    return Math.round(Math.max(0, estimatedCardHeight - step));
  }, [estimatedCardHeight, handRowCount, responsiveLayout.cardsViewportHeight]);

  const controlsScale = useMemo(() => {
    if (handRowCount >= 4) {
      return 0.8;
    }
    if (handRowCount === 3) {
      return 0.88;
    }
    if (handRowCount === 2) {
      return 0.94;
    }
    return 1;
  }, [handRowCount]);

  useEffect(() => {
    if (activeRoundRank) {
      setClaimRank(activeRoundRank);
    }
  }, [activeRoundRank]);

  useEffect(() => {
    if (!activeRoundRank && phase === "PLAYER_TURN") {
      setClaimRank("");
    }
  }, [activeRoundRank, phase]);

  useEffect(() => {
    setSelectedIndices((previous) => previous.filter((index) => index < hand.length));
  }, [hand.length]);

  useEffect(() => {
    if (pickIndex > pickMax - 1) {
      setPickIndex(Math.max(0, pickMax - 1));
    }
  }, [pickIndex, pickMax]);

  useEffect(() => {
    if (!canCallBluff) {
      setBluffModalOpen(false);
    }
  }, [canCallBluff]);

  useEffect(() => {
    return () => {
      playAnimationTimeouts.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
      playAnimationTimeouts.current = [];
      if (bluffRevealTimeout.current) {
        window.clearTimeout(bluffRevealTimeout.current);
        bluffRevealTimeout.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!lastChallenge) {
      return;
    }
    if (lastChallenge.room_code !== roomCode) {
      return;
    }
    const key = `${lastChallenge.room_code}-${lastChallenge.claimant_id}-${lastChallenge.challenger_id}-${lastChallenge.picked_card}-${lastChallenge.picked_matches_claim}`;
    if (key === lastBluffRevealRef.current) {
      return;
    }
    lastBluffRevealRef.current = key;
    setBluffReveal({
      id: key,
      pickedCard: lastChallenge.picked_card,
      pickedMatchesClaim: lastChallenge.picked_matches_claim,
      claimantId: lastChallenge.claimant_id,
      challengerId: lastChallenge.challenger_id,
    });
    if (bluffRevealTimeout.current) {
      window.clearTimeout(bluffRevealTimeout.current);
    }
    bluffRevealTimeout.current = window.setTimeout(() => {
      setBluffReveal(null);
      bluffRevealTimeout.current = null;
    }, 2600);
  }, [lastChallenge]);

  useEffect(() => {
    const node = tableStageRef.current;
    if (!node) {
      return;
    }

    let frameId = 0;
    const updateFromWidth = (width: number) => {
      const next = computeResponsiveLayout(width);
      setResponsiveLayout((previous) => {
        if (
          previous.stageWidth === next.stageWidth &&
          previous.myCardWidth === next.myCardWidth &&
          previous.myCardOverlap === next.myCardOverlap &&
          previous.seatCardWidth === next.seatCardWidth &&
          previous.seatFanStep === next.seatFanStep &&
          previous.seatFanWidth === next.seatFanWidth &&
          previous.seatFanHeight === next.seatFanHeight &&
          previous.tableHandWidth === next.tableHandWidth &&
          previous.handSlabHeight === next.handSlabHeight &&
          previous.cardsViewportHeight === next.cardsViewportHeight &&
          previous.tableBottomPadding === next.tableBottomPadding
        ) {
          return previous;
        }
        return next;
      });
    };

    const scheduleUpdate = (width: number) => {
      cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(() => updateFromWidth(width));
    };

    scheduleUpdate(node.clientWidth);

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }
      scheduleUpdate(entry.contentRect.width);
    });
    observer.observe(node);

    return () => {
      cancelAnimationFrame(frameId);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const node = handCenterRef.current;
    if (!node) {
      return;
    }
    let frameId = 0;
    const schedule = (width: number) => {
      cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(() => setHandCenterWidth(width));
    };
    schedule(node.clientWidth);
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) {
        return;
      }
      schedule(entry.contentRect.width);
    });
    observer.observe(node);
    return () => {
      cancelAnimationFrame(frameId);
      observer.disconnect();
    };
  }, []);

  const lastTurnRef = useRef<string | null>(null);
  const lastClaimRef = useRef<string | null>(null);
  const lastHandRef = useRef<string | null>(null);

  useEffect(() => {
    const currentTurn = publicState?.current_player_id ?? null;
    if (currentTurn && currentTurn !== lastTurnRef.current) {
      play("turn");
      lastTurnRef.current = currentTurn;
    }
  }, [play, publicState?.current_player_id]);

  useEffect(() => {
    const claim = publicState?.last_claim;
    const claimKey = claim ? `${claim.player_id}-${claim.count}-${claim.rank}` : null;
    if (claimKey && claimKey !== lastClaimRef.current) {
      play("claim");
      lastClaimRef.current = claimKey;
    }
  }, [play, publicState?.last_claim]);

  useEffect(() => {
    const handKey = hand.join(",") || null;
    if (handKey && handKey !== lastHandRef.current) {
      play("reveal");
      lastHandRef.current = handKey;
    }
  }, [play, hand]);

  const toggleSelect = (index: number) => {
    setSelectedIndices((previous) => {
      if (previous.includes(index)) {
        return previous.filter((value) => value !== index);
      }
      return [...previous, index];
    });
  };

  const handleCardHover = () => {
    if (!canPlay) {
      return;
    }
    const now = performance.now();
    if (now - lastHoverSoundRef.current < 80) {
      return;
    }
    lastHoverSoundRef.current = now;
    play("hover", { volume: 0.07 });
  };

  const queuePlayAnimation = (cards: string[]) => {
    if (cards.length === 0) {
      return;
    }
    const base = Date.now();
    const mid = (cards.length - 1) / 2;
    const nextAnimations = cards.map((code, index) => {
      const offset = (index - mid) * 18;
      const rotation = (index - mid) * 5;
      return {
        id: `${base}-${index}-${code}`,
        code,
        offset,
        rotation,
        delay: index * PLAY_ANIMATION_STAGGER_MS,
      };
    });
    setPlayAnimations((previous) => [...previous, ...nextAnimations]);
    const totalDuration = PLAY_ANIMATION_MS + PLAY_ANIMATION_STAGGER_MS * cards.length + 140;
    const timeoutId = window.setTimeout(() => {
      setPlayAnimations((previous) =>
        previous.filter((entry) => !nextAnimations.some((item) => item.id === entry.id))
      );
    }, totalDuration);
    playAnimationTimeouts.current.push(timeoutId);
  };

  const playCards = () => {
    if (!effectiveClaimRank) {
      return;
    }
    const cardIndices = [...selectedIndices].sort((a, b) => a - b);
    if (cardIndices.length === 0) {
      return;
    }
    play("shuffle", { volume: 0.08 });
    const selectedCards = cardIndices.map((index) => hand[index]).filter(Boolean);
    queuePlayAnimation(selectedCards);
    onSend({
      type: "play_cards",
      room_code: roomCode,
      player_id: playerId,
      card_indices: cardIndices,
      claim_rank: effectiveClaimRank,
    });
    setSelectedIndices([]);
  };

  const passTurn = () => {
    onSend({ type: "pass_turn", room_code: roomCode, player_id: playerId });
  };

  const submitBluffPick = (index: number) => {
    setPickIndex(index);
    onSend({
      type: "call_bluff",
      room_code: roomCode,
      player_id: playerId,
      pick_index: index,
    });
    setBluffModalOpen(false);
  };

  const currentTurnName =
    playerNameById[publicState?.current_player_id ?? ""] ?? publicState?.current_player_id ?? "TBD";

  const lastClaimText = useMemo(() => {
    const lastClaim = publicState?.last_claim;
    if (!lastClaim) {
      return "No claim yet.";
    }
    const name = playerNameById[lastClaim.player_id] ?? lastClaim.player_id;
    return `${name} claims ${lastClaim.count}x ${lastClaim.rank}.`;
  }, [publicState?.last_claim, playerNameById]);

  const lastOpponentClaimText = useMemo(() => {
    const lastClaim = publicState?.last_claim;
    if (!lastClaim || lastClaim.player_id === playerId) {
      return "No opponent claim yet.";
    }
    const name = playerNameById[lastClaim.player_id] ?? lastClaim.player_id;
    return `${name}: ${lastClaim.count}x ${lastClaim.rank}`;
  }, [playerId, playerNameById, publicState?.last_claim]);

  const roundStarterName = useMemo(() => {
    if (!publicState?.round_starter_id) {
      return null;
    }
    return playerNameById[publicState.round_starter_id] ?? publicState.round_starter_id;
  }, [publicState?.round_starter_id, playerNameById]);

  const currentTableName = useMemo(
    () => tableNameFromRank(activeRoundRank),
    [activeRoundRank]
  );

  const revealResult = useMemo(() => {
    if (!bluffReveal) {
      return null;
    }
    if (bluffReveal.pickedMatchesClaim) {
      const challengerName = playerNameById[bluffReveal.challengerId] ?? bluffReveal.challengerId;
      return {
        label: "MISS",
        detail: `${challengerName} called wrong.`,
        tone: "miss",
      };
    }
    const claimantName = playerNameById[bluffReveal.claimantId] ?? bluffReveal.claimantId;
    return {
      label: "LIAR!",
      detail: `${claimantName} got caught.`,
      tone: "liar",
    };
  }, [bluffReveal, playerNameById]);

  const tableStageStyle = useMemo(
    () =>
      ({
        "--my-card-width": `${responsiveLayout.myCardWidth}px`,
        "--seat-card-width": `${responsiveLayout.seatCardWidth}px`,
        "--seat-fan-width": `${responsiveLayout.seatFanWidth}px`,
        "--seat-fan-height": `${responsiveLayout.seatFanHeight}px`,
        "--table-hand-width": `${responsiveLayout.tableHandWidth}px`,
        "--hand-slab-height": `${responsiveLayout.handSlabHeight}px`,
        "--cards-viewport-height": `${responsiveLayout.cardsViewportHeight}px`,
        "--controls-scale": String(controlsScale),
        "--table-bottom-padding": `${responsiveLayout.tableBottomPadding}px`,
        "--play-origin-y": `${Math.round(responsiveLayout.handSlabHeight * 0.45)}px`,
        "--play-flight-y": `${Math.round(Math.max(220, responsiveLayout.stageWidth * 0.2))}px`,
        "--play-duration": `${PLAY_ANIMATION_MS}ms`,
      }) as CSSProperties,
    [
      controlsScale,
      responsiveLayout.cardsViewportHeight,
      responsiveLayout.handSlabHeight,
      responsiveLayout.myCardWidth,
      responsiveLayout.seatCardWidth,
      responsiveLayout.seatFanHeight,
      responsiveLayout.seatFanWidth,
      responsiveLayout.stageWidth,
      responsiveLayout.tableBottomPadding,
      responsiveLayout.tableHandWidth,
    ]
  );

  if (phase === "GAME_OVER") {
    return (
      <main className="screen game-table-screen">
        <section className="panel result-panel">
          <h1>{isLoser ? "You Lose" : "You Win"}</h1>
          {placing > 0 && <p>Your final place: #{placing}</p>}
          <h2>Standings</h2>
          <ol className="standings-list">
            {standings.map((playerIdInRank, index) => {
              const playerName = playerNameById[playerIdInRank] ?? playerIdInRank;
              const isLast = index === standings.length - 1;
              return (
                <li key={playerIdInRank} className={isLast ? "loser" : "winner"}>
                  #{index + 1} {playerName} {isLast ? "(Lose)" : "(Win)"}
                </li>
              );
            })}
          </ol>
        </section>
      </main>
    );
  }

  return (
    <main className={`screen game-table-screen${isMyTurn ? " my-turn" : ""}`}>
      <section ref={tableStageRef} className="panel table-stage-panel" style={tableStageStyle}>
        <div className="table-hud">
          <div className="room-chip">Room {roomCode}</div>
          <div className="last-claim-chip">
            <span>Last Claim</span>
            <strong>{lastOpponentClaimText}</strong>
          </div>
        </div>
        <div className={`turn-spotlight turn-spotlight-floating${isMyTurn ? " yours" : ""}`}>
          {isMyTurn ? "Your Turn" : `${currentTurnName}'s Turn`}
        </div>

        <div className={`info-hover-shade${isInfoHovering ? " active" : ""}`} />
        <div
          className="info-corner"
          onMouseEnter={() => setInfoHovering(true)}
          onMouseLeave={() => setInfoHovering(false)}
        >
          <div className="info-dot">i</div>
          <div className="info-popover">
            <p>
              Turn: <strong>{currentTurnName}</strong>
            </p>
            <p>
              Phase: <strong>{phase}</strong>
            </p>
            <p>
              Direction: <strong>{publicState?.direction ?? ""}</strong>
            </p>
            <p>
              Last Claim: <strong>{lastClaimText}</strong>
            </p>
            {activeRoundRank && roundStarterName && (
              <p>
                Round Rank: <strong>{activeRoundRank}</strong> ({roundStarterName})
              </p>
            )}
          </div>
        </div>

        <div className="table-surface">
          {seats.map((seat) => {
            const visibleCards = Math.min(Math.max(seat.hand_count, 1), 12);
            const spread = Math.min(10, 120 / Math.max(visibleCards, 1));
            return (
              <article
                key={seat.player_id}
                className={`seat${seat.isCurrent ? " current" : ""}${seat.isFinished ? " finished" : ""}`}
                style={{ left: `${seat.x}%`, top: `${seat.y}%` }}
              >
                <div className="seat-meta">
                  <h3>{seat.display_name}</h3>
                  <p>{seat.hand_count} cards</p>
                  {seat.isCurrent && <span className="seat-turn-flag">Turn</span>}
                </div>
                <div className="seat-fan" style={{ transform: `rotate(${seat.angle - 90}deg)` }}>
                  {Array.from({ length: visibleCards }, (_, index) => {
                    const centered = index - (visibleCards - 1) / 2;
                    return (
                      <img
                        key={`${seat.player_id}-${index}`}
                        src="/cards/BACK.svg"
                        alt="Opponent card"
                        className="seat-fan-card"
                        style={{
                          transform: `translateX(calc(${centered * responsiveLayout.seatFanStep}px - 50%)) rotate(${centered * spread}deg)`,
                        }}
                        draggable={false}
                      />
                    );
                  })}
                </div>
              </article>
            );
          })}

          <div className="play-animation-layer" aria-hidden="true">
            {playAnimations.map((animation) => (
              <div
                key={animation.id}
                className="play-card-ghost"
                style={
                  {
                    "--x-offset": `${animation.offset}px`,
                    "--rot": `${animation.rotation}deg`,
                    "--delay": `${animation.delay}ms`,
                  } as CSSProperties
                }
              >
                <img src={`/cards/${animation.code}.svg`} alt="" draggable={false} />
              </div>
            ))}
          </div>

          <div className="center-piles">
            <PileStack
              count={publicState?.pile_count ?? 0}
              label="Center"
              className="center-pile"
              metaText={currentTableName}
            />
          </div>

          <div className="table-my-hand">
            <div className="hand-layout">
              <div className="control-group claim-control hand-left">
                <select
                  id="claim-rank"
                  className="claim-select"
                  aria-label="Claim rank"
                  value={effectiveClaimRank}
                  onChange={(event) => setClaimRank(event.target.value)}
                  disabled={Boolean(activeRoundRank)}
                >
                  <option value="">Select rank</option>
                  {CLAIM_RANKS.map((rank) => (
                    <option key={rank} value={rank}>
                      {rank}
                    </option>
                  ))}
                </select>
              </div>

              <div className="hand-center" ref={handCenterRef}>
                <div className="my-hand-header">
                  <h2>Your Hand</h2>
                  <p>{hand.length} cards</p>
                </div>
                {hand.length === 0 ? (
                  <p className="muted">No cards left.</p>
                ) : (
                  <div className="my-hand-rows">
                    {handRows.map((row, rowNumber) => (
                      <div
                        className="my-hand-row"
                        key={`row-${row.start}`}
                        style={{
                          marginTop: row.start === 0 ? "0" : `${-rowStackLift}px`,
                          zIndex: rowNumber + 1,
                        }}
                      >
                        {row.cards.map((card, rowIndex) => {
                          const globalIndex = row.start + rowIndex;
                          return (
                            <PlayingCard
                              key={`${card}-${globalIndex}`}
                              code={card}
                              selected={selectedIndices.includes(globalIndex)}
                              disabled={!canPlay}
                              className="my-hand-card"
                              style={{
                                marginLeft: rowIndex === 0 ? "0" : `${responsiveLayout.myCardOverlap}px`,
                                zIndex: rowIndex + 1,
                              }}
                              onClick={() => toggleSelect(globalIndex)}
                              onMouseEnter={handleCardHover}
                            />
                          );
                        })}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="button-stack hand-right">
                <button type="button" className="primary" disabled={!canSubmitPlay} onClick={playCards}>
                  PLAY
                </button>
                <button
                  type="button"
                  className="danger"
                  onClick={() => setBluffModalOpen(true)}
                  disabled={!canCallBluff}
                >
                  CALL
                </button>
                <button type="button" className="secondary" onClick={passTurn} disabled={!canPass}>
                  PASS
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {isBluffModalOpen && canCallBluff && (
        <div className="bluff-modal-backdrop" role="dialog" aria-modal="true">
          <div className="panel bluff-modal">
            <h2>Select A Card To Reveal</h2>
            <p>Pick one face-down card from the last played set.</p>
            <div className="bluff-pick-grid">
              {Array.from({ length: pickMax }, (_, index) => (
                <PlayingCard
                  key={`pick-${index}`}
                  faceDown
                  selected={pickIndex === index}
                  className="pick-card"
                  onClick={() => submitBluffPick(index)}
                  title={`Pick card ${index + 1}`}
                />
              ))}
            </div>
            <div className="button-row">
              <button type="button" className="secondary" onClick={() => setBluffModalOpen(false)}>
                Cancel Bluff
              </button>
            </div>
          </div>
        </div>
      )}

      {bluffReveal && revealResult && (
        <div className={`bluff-reveal-overlay ${revealResult.tone}`} role="alert" aria-live="polite">
          <div className="bluff-reveal-card">
            <div className="bluff-reveal-inner">
              <img className="bluff-reveal-face back" src="/cards/BACK.svg" alt="" draggable={false} />
              <img
                className="bluff-reveal-face front"
                src={`/cards/${bluffReveal.pickedCard}.svg`}
                alt={bluffReveal.pickedCard}
                draggable={false}
              />
            </div>
          </div>
          <div className={`bluff-reveal-badge ${revealResult.tone}`}>
            <span>{revealResult.label}</span>
            <small>{revealResult.detail}</small>
          </div>
        </div>
      )}
    </main>
  );
}
