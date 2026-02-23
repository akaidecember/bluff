import { useEffect, useMemo, useRef, useState } from "react";

type ClaimRankDialProps = {
  value: string;
  onChange: (value: string) => void;
  ranks: string[];
  ownedCounts?: Record<string, number>;
  label?: string;
  helperText?: string;
  disabled?: boolean;
};

type ScrollOptions = {
  smooth: boolean;
};

export default function ClaimRankDial({
  value,
  onChange,
  ranks,
  ownedCounts = {},
  label = "Declare Rank",
  helperText = "Make your claim.",
  disabled = false,
}: ClaimRankDialProps) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const itemRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const scrollEndTimer = useRef<number | null>(null);
  const isUserScrollingRef = useRef<boolean>(false);
  const [activeIndex, setActiveIndex] = useState(() => {
    const idx = ranks.indexOf(value);
    return idx >= 0 ? idx : 0;
  });

  const ownedSet = useMemo(() => {
    const set = new Set<string>();
    for (const rank of Object.keys(ownedCounts)) {
      if ((ownedCounts[rank] ?? 0) > 0) {
        set.add(rank);
      }
    }
    return set;
  }, [ownedCounts]);

  useEffect(() => {
    const idx = ranks.indexOf(value);
    if (idx < 0) {
      return;
    }
    if (isUserScrollingRef.current) {
      setActiveIndex(idx);
      requestAnimationFrame(() => applyDepth(idx));
      return;
    }
    setActiveIndex(idx);
    scrollToIndex(idx, { smooth: true });
    requestAnimationFrame(() => applyDepth(idx));
  }, [value, ranks]);

  useEffect(() => {
    const idx = ranks.indexOf(value);
    const start = idx >= 0 ? idx : 0;
    setActiveIndex(start);
    requestAnimationFrame(() => {
      updateDialPadding();
      scrollToIndex(start, { smooth: false });
      applyDepth(start);
    });
    return () => {
      if (scrollEndTimer.current) {
        window.clearTimeout(scrollEndTimer.current);
        scrollEndTimer.current = null;
      }
    };
  }, [ranks, value]);

  useEffect(() => {
    updateDialPadding();
    const onResize = () => updateDialPadding();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [ranks]);

  const applyDepth = (centerIdx: number) => {
    for (let i = 0; i < ranks.length; i += 1) {
      const el = itemRefs.current[i];
      if (!el) {
        continue;
      }
      const distance = Math.abs(i - centerIdx);
      let scale = 0.75;
      let opacity = 0.25;

      if (distance === 0) {
        scale = 1.3;
        opacity = 1;
      } else if (distance === 1) {
        scale = 1;
        opacity = 0.7;
      } else if (distance === 2) {
        scale = 0.85;
        opacity = 0.45;
      }

      el.style.transform = `scale(${scale})`;
      el.style.opacity = String(opacity);
    }
  };

  const updateDialPadding = () => {
    const scroller = scrollerRef.current;
    const first = itemRefs.current[0];
    if (!scroller || !first) {
      return;
    }
    const itemWidth = first.offsetWidth;
    const pad = Math.max(0, scroller.clientWidth / 2 - itemWidth / 2);
    scroller.style.paddingLeft = `${pad}px`;
    scroller.style.paddingRight = `${pad}px`;
  };

  const scrollToIndex = (idx: number, { smooth }: ScrollOptions) => {
    const scroller = scrollerRef.current;
    const el = itemRefs.current[idx];
    if (!scroller || !el) {
      return;
    }
    const target = el.offsetLeft + el.offsetWidth / 2 - scroller.clientWidth / 2;
    scroller.scrollTo({ left: target, behavior: smooth ? "smooth" : "auto" });
  };

  const findClosestIndex = () => {
    const scroller = scrollerRef.current;
    if (!scroller) {
      return activeIndex;
    }
    const scrollerRect = scroller.getBoundingClientRect();
    const centerX = scrollerRect.left + scrollerRect.width / 2;

    let bestIdx = 0;
    let bestDist = Infinity;

    for (let i = 0; i < ranks.length; i += 1) {
      const el = itemRefs.current[i];
      if (!el) {
        continue;
      }
      const rect = el.getBoundingClientRect();
      const elCenter = rect.left + rect.width / 2;
      const dist = Math.abs(elCenter - centerX);
      if (dist < bestDist) {
        bestDist = dist;
        bestIdx = i;
      }
    }

    return bestIdx;
  };

  const handleScroll = () => {
    if (disabled) {
      return;
    }
    const liveIdx = findClosestIndex();
    applyDepth(liveIdx);
    if (liveIdx !== activeIndex) {
      isUserScrollingRef.current = true;
      setActiveIndex(liveIdx);
      onChange(ranks[liveIdx]);
    }
    if (scrollEndTimer.current) {
      window.clearTimeout(scrollEndTimer.current);
    }
    scrollEndTimer.current = window.setTimeout(() => {
      const bestIdx = findClosestIndex();
      isUserScrollingRef.current = false;
      setActiveIndex(bestIdx);
      onChange(ranks[bestIdx]);
      scrollToIndex(bestIdx, { smooth: true });
      applyDepth(bestIdx);
    }, 120);
  };

  const handleClickItem = (idx: number) => {
    if (disabled) {
      return;
    }
    isUserScrollingRef.current = false;
    scrollerRef.current?.focus();
    setActiveIndex(idx);
    onChange(ranks[idx]);
    scrollToIndex(idx, { smooth: true });
    applyDepth(idx);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (disabled) {
      return;
    }
    if (!["ArrowLeft", "ArrowRight", "Enter", " "].includes(event.key)) {
      return;
    }

    event.preventDefault();
    isUserScrollingRef.current = false;

    if (event.key === "ArrowLeft") {
      const next = Math.max(0, activeIndex - 1);
      setActiveIndex(next);
      onChange(ranks[next]);
      scrollToIndex(next, { smooth: true });
      applyDepth(next);
      return;
    }

    if (event.key === "ArrowRight") {
      const next = Math.min(ranks.length - 1, activeIndex + 1);
      setActiveIndex(next);
      onChange(ranks[next]);
      scrollToIndex(next, { smooth: true });
      applyDepth(next);
      return;
    }

    scrollToIndex(activeIndex, { smooth: true });
  };

  return (
    <div className={`dial-root${disabled ? " is-disabled" : ""}`}>
      <div className="dial-header">
        <div className="dial-label">{label}</div>
        {helperText ? <div className="dial-helper">{helperText}</div> : null}
      </div>

      <div className="dial-wrap">
        <div className="dial-center-marker" aria-hidden="true" />
        <div
          ref={scrollerRef}
          className="dial-scroller"
          role="listbox"
          aria-label={label}
          tabIndex={disabled ? -1 : 0}
          onKeyDown={handleKeyDown}
          onScroll={handleScroll}
          onWheel={(event) => {
            if (disabled) {
              return;
            }
            const scroller = scrollerRef.current;
            if (!scroller) {
              return;
            }
            const isOverDial = scroller.matches(":hover");
            if (!isOverDial) {
              return;
            }

            const { deltaX, deltaY, deltaMode } = event;
            const modeScale = deltaMode === 1 ? 16 : deltaMode === 2 ? scroller.clientWidth : 1;
            const dx = deltaX * modeScale;
            const dy = deltaY * modeScale;
            const absX = Math.abs(dx);
            const absY = Math.abs(dy);
            const looksLikeMouseWheel = deltaMode === 1 || deltaMode === 2 || (absX === 0 && absY >= 12);
            const looksLikeTrackpad = !looksLikeMouseWheel;

            if (looksLikeTrackpad) {
              if (absX < 3) {
                const scrollingElement = document.scrollingElement;
                const canScrollPage = scrollingElement
                  ? scrollingElement.scrollHeight > scrollingElement.clientHeight
                  : false;
                if (!canScrollPage) {
                  event.preventDefault();
                }
                return;
              }
              event.preventDefault();
              const maxScroll = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
              const next = scroller.scrollLeft + dx;
              scroller.scrollLeft = Math.min(Math.max(0, next), maxScroll);
            } else {
              event.preventDefault();
              const maxScroll = Math.max(0, scroller.scrollWidth - scroller.clientWidth);
              const delta = absY >= absX ? dy : dx;
              const next = scroller.scrollLeft + delta;
              scroller.scrollLeft = Math.min(Math.max(0, next), maxScroll);
            }

          }}
          onMouseDown={() => scrollerRef.current?.focus()}
          onPointerEnter={() => {
            if (!disabled) {
              scrollerRef.current?.focus();
            }
          }}
        >
          {ranks.map((rank, idx) => {
            const isActive = idx === activeIndex;
            const owned = ownedSet.has(rank);
            const count = ownedCounts[rank] ?? 0;

            return (
              <button
                key={rank}
                ref={(el) => {
                  itemRefs.current[idx] = el;
                }}
                type="button"
                className={["dial-item", isActive ? "is-active" : "", owned ? "is-owned" : ""]
                  .join(" ")
                  .trim()}
                role="option"
                aria-selected={isActive}
                onClick={() => handleClickItem(idx)}
                title={owned ? `You have ${count} of ${rank}` : `Claim ${rank}`}
                disabled={disabled}
              >
                <span className="dial-rank">{rank}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
