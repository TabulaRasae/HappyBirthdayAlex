"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import styles from "./page.module.css";

const GAME_SECONDS = 15;
const MAX_CANDLES = 12;
const SPAWN_MS = 420;
const CANDLE_LIFE_MS = 2600;
const INITIAL_CANDLES = 5;
const BOMB_CHANCE = 0.12;
const TARGET_CANDLES = 29;
const NAME_STORAGE_KEY = "alexbd-player-name";
const NAME_CONFIRMED_KEY = "alexbd-name-confirmed";
const EMAIL_STORAGE_KEY = "alexbd-player-email";

type Candle = {
  id: string;
  x: number;
  y: number;
  isGolden: boolean;
  isBomb: boolean;
  bornAt: number;
  delay: number;
  state: "alive" | "blown" | "boom";
};

type ScoreEntry = {
  id: number;
  name: string;
  candles: number;
  timeMs: number;
  createdAt: string;
};

const randomBetween = (min: number, max: number) =>
  Math.random() * (max - min) + min;

const newId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const makeCandle = (): Candle => {
  const roll = Math.random();
  const isBomb = roll < BOMB_CHANCE;
  return {
    id: newId(),
    x: randomBetween(12, 88),
    y: randomBetween(8, 62),
    isGolden: !isBomb && roll < 0.3,
    isBomb,
    bornAt: Date.now(),
    delay: randomBetween(0, 1.2),
    state: "alive",
  };
};

const CAKE_COLUMNS = 10;
const CAKE_CANDLE_SPOTS = Array.from({ length: TARGET_CANDLES }, (_, index) => {
  const row = Math.floor(index / CAKE_COLUMNS);
  const col = index % CAKE_COLUMNS;
  const x = 8 + col * 9;
  const y = 24 + row * 20;
  const tilt = (col % 2 === 0 ? -7 : 6) + row * 2;
  return { x, y, tilt };
});

const formatTimeMs = (value: number) => `${(value / 1000).toFixed(1)}s`;
const cleanDisplayName = (value: string) =>
  value.trim().replace(/\s+/g, " ").slice(0, 40);
const cleanEmail = (value: string) => value.trim().toLowerCase();
const isValidEmail = (value: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

export default function Home() {
  const [candles, setCandles] = useState<Candle[]>([]);
  const [timeLeft, setTimeLeft] = useState(GAME_SECONDS);
  const [candlesPlaced, setCandlesPlaced] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [combo, setCombo] = useState(0);
  const [status, setStatus] = useState<"idle" | "running" | "ended">("idle");
  const [endReason, setEndReason] = useState<"time" | "bomb" | "candles" | null>(
    null,
  );
  const [isRunning, setIsRunning] = useState(false);
  const [lastPopAt, setLastPopAt] = useState<number | null>(null);
  const [playerName, setPlayerName] = useState("");
  const [hasConfirmedName, setHasConfirmedName] = useState(false);
  const [isNameModalOpen, setIsNameModalOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [nameModalError, setNameModalError] = useState("");
  const [playerEmail, setPlayerEmail] = useState("");
  const [hasConfirmedEmail, setHasConfirmedEmail] = useState(false);
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false);
  const [emailDraft, setEmailDraft] = useState("");
  const [emailModalError, setEmailModalError] = useState("");
  const [highScores, setHighScores] = useState<ScoreEntry[]>([]);
  const [isLoadingScores, setIsLoadingScores] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const startTimeRef = useRef<number | null>(null);
  const endGuardRef = useRef(false);
  const [goldFlash, setGoldFlash] = useState(false);
  const goldFlashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [hasSubmittedRound, setHasSubmittedRound] = useState(false);
  const [autoSubmitAttempted, setAutoSubmitAttempted] = useState(false);

  const topScores = useMemo(() => highScores.slice(0, 10), [highScores]);
  const bestEntry = useMemo(
    () => (topScores.length > 0 ? topScores[0] : null),
    [topScores],
  );

  const fetchScores = useCallback(async () => {
    setIsLoadingScores(true);
    try {
      const response = await fetch("/api/scores", { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Scores unavailable");
      }
      const data = (await response.json()) as { scores?: ScoreEntry[] };
      setHighScores(Array.isArray(data.scores) ? data.scores : []);
    } catch {
      setHighScores([]);
    } finally {
      setIsLoadingScores(false);
    }
  }, []);

  useEffect(() => {
    fetchScores();
  }, [fetchScores]);

  useEffect(() => {
    return () => {
      if (goldFlashTimerRef.current) {
        clearTimeout(goldFlashTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const savedName = window.localStorage.getItem(NAME_STORAGE_KEY);
    const confirmed = window.localStorage.getItem(NAME_CONFIRMED_KEY) === "true";
    const savedEmail = window.localStorage.getItem(EMAIL_STORAGE_KEY);
    if (savedName) {
      setPlayerName(savedName);
      setNameDraft(savedName);
    } else {
      setPlayerName("");
      setNameDraft("");
    }
    setHasConfirmedName(Boolean(savedName) && confirmed);
    if (savedEmail) {
      setPlayerEmail(savedEmail);
      setEmailDraft(savedEmail);
      setHasConfirmedEmail(true);
    } else {
      setPlayerEmail("");
      setEmailDraft("");
      setHasConfirmedEmail(false);
    }
  }, []);

  useEffect(() => {
    if (status === "ended" && !hasConfirmedName) {
      setNameDraft(playerName || "");
      setNameModalError("");
      setIsNameModalOpen(true);
    }
  }, [hasConfirmedName, playerName, status]);

  const finalTimeMs = useMemo(() => {
    const fallbackTime = Math.max(0, (GAME_SECONDS - timeLeft) * 1000);
    return Math.min(elapsedMs || fallbackTime, GAME_SECONDS * 1000);
  }, [elapsedMs, timeLeft]);

  const qualifiesForTopTen = useMemo(() => {
    if (candlesPlaced <= 0) return false;
    if (topScores.length < 10) return true;
    const lastEntry = topScores[topScores.length - 1];
    if (!lastEntry) return true;
    if (candlesPlaced > lastEntry.candles) return true;
    if (candlesPlaced === lastEntry.candles && finalTimeMs < lastEntry.timeMs) {
      return true;
    }
    return false;
  }, [candlesPlaced, finalTimeMs, topScores]);

  const needsEmail =
    status === "ended" &&
    hasConfirmedName &&
    qualifiesForTopTen &&
    !hasConfirmedEmail &&
    !hasSubmittedRound;

  useEffect(() => {
    if (!needsEmail || isEmailModalOpen) return;
    setEmailDraft(playerEmail || "");
    setEmailModalError("");
    setIsEmailModalOpen(true);
  }, [isEmailModalOpen, needsEmail, playerEmail]);

  const endGame = useCallback((reason: "time" | "bomb" | "candles") => {
    if (endGuardRef.current) return;
    endGuardRef.current = true;
    setIsRunning(false);
    setStatus("ended");
    setEndReason(reason);
    const startedAt = startTimeRef.current;
    const elapsed = startedAt
      ? Math.min(Date.now() - startedAt, GAME_SECONDS * 1000)
      : GAME_SECONDS * 1000;
    setElapsedMs(elapsed);
    if (reason === "time") {
      setTimeLeft(0);
    }
    if (reason === "bomb") {
      setTimeout(() => setCandles([]), 420);
      return;
    }
    setCandles([]);
  }, []);

  useEffect(() => {
    if (!isRunning) return;
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          endGame("time");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [endGame, isRunning]);

  useEffect(() => {
    if (!isRunning) return;
    const spawner = setInterval(() => {
      const now = Date.now();
      setCandles((prev) => {
        const alive = prev.filter((candle) => now - candle.bornAt < CANDLE_LIFE_MS);
        if (alive.length >= MAX_CANDLES) return alive;
        return [...alive, makeCandle()];
      });
    }, SPAWN_MS);
    return () => clearInterval(spawner);
  }, [isRunning]);

  useEffect(() => {
    if (!isRunning) return;
    const resetCombo = setInterval(() => {
      if (!lastPopAt) return;
      if (Date.now() - lastPopAt > 1800) {
        setCombo(0);
      }
    }, 300);
    return () => clearInterval(resetCombo);
  }, [isRunning, lastPopAt]);

  const openNameModal = useCallback(() => {
    setNameDraft(playerName || "");
    setNameModalError("");
    setIsNameModalOpen(true);
  }, [playerName]);

  const openEmailModal = useCallback(() => {
    setEmailDraft(playerEmail || "");
    setEmailModalError("");
    setIsEmailModalOpen(true);
  }, [playerEmail]);

  const triggerGoldFlash = useCallback(() => {
    setGoldFlash(true);
    if (goldFlashTimerRef.current) {
      clearTimeout(goldFlashTimerRef.current);
    }
    goldFlashTimerRef.current = setTimeout(() => {
      setGoldFlash(false);
    }, 450);
  }, []);

  const closeNameModal = () => {
    if (!hasConfirmedName) return;
    setIsNameModalOpen(false);
    setNameModalError("");
  };

  const closeEmailModal = () => {
    if (!hasConfirmedEmail) return;
    setIsEmailModalOpen(false);
    setEmailModalError("");
  };

  const confirmName = () => {
    const cleaned = cleanDisplayName(nameDraft);
    if (!cleaned) {
      setNameModalError("Please enter a name.");
      return;
    }
    setPlayerName(cleaned);
    setNameDraft(cleaned);
    setHasConfirmedName(true);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(NAME_STORAGE_KEY, cleaned);
      window.localStorage.setItem(NAME_CONFIRMED_KEY, "true");
    }
    setIsNameModalOpen(false);
    setNameModalError("");
  };

  const confirmEmail = () => {
    const cleaned = cleanEmail(emailDraft);
    if (!cleaned || !isValidEmail(cleaned)) {
      setEmailModalError("Please enter a valid email.");
      return;
    }
    setPlayerEmail(cleaned);
    setEmailDraft(cleaned);
    setHasConfirmedEmail(true);
    if (typeof window !== "undefined") {
      window.localStorage.setItem(EMAIL_STORAGE_KEY, cleaned);
    }
    setIsEmailModalOpen(false);
    setEmailModalError("");
  };

  const startGame = () => {
    setCandles(Array.from({ length: INITIAL_CANDLES }, () => makeCandle()));
    setCandlesPlaced(0);
    setElapsedMs(0);
    setCombo(0);
    setGoldFlash(false);
    setHasSubmittedRound(false);
    setAutoSubmitAttempted(false);
    setTimeLeft(GAME_SECONDS);
    setStatus("running");
    setEndReason(null);
    setIsRunning(true);
    startTimeRef.current = Date.now();
    endGuardRef.current = false;
    setLastPopAt(Date.now());
    setMessage("");
    setError("");
  };

  const resetGame = () => {
    setIsRunning(false);
    setStatus("idle");
    setEndReason(null);
    setCandles([]);
    setTimeLeft(GAME_SECONDS);
    setCandlesPlaced(0);
    setElapsedMs(0);
    setCombo(0);
    setGoldFlash(false);
    setHasSubmittedRound(false);
    setAutoSubmitAttempted(false);
    startTimeRef.current = null;
    endGuardRef.current = false;
    setMessage("");
    setError("");
  };

  const popCandle = (candle: Candle) => {
    if (!isRunning || candle.state !== "alive") return;

    if (candle.isBomb) {
      setCandles((prev) =>
        prev.map((item) =>
          item.id === candle.id ? { ...item, state: "boom" } : item,
        ),
      );
      setCombo(0);
      endGame("bomb");
      return;
    }

    if (candle.isGolden) {
      triggerGoldFlash();
    }

    setCandles((prev) =>
      prev.map((item) =>
        item.id === candle.id ? { ...item, state: "blown" } : item,
      ),
    );

    setTimeout(() => {
      setCandles((prev) => prev.filter((item) => item.id !== candle.id));
    }, 320);

    setCandlesPlaced((prev) => {
      const next = Math.min(prev + 1, TARGET_CANDLES);
      if (next >= TARGET_CANDLES) {
        endGame("candles");
      }
      return next;
    });
    setLastPopAt(Date.now());
    setCombo((prev) => Math.min(prev + 1, 8));
  };

  const submitScore = useCallback(
    async (source: "auto" | "manual" = "manual") => {
      if (!hasConfirmedName || !playerName.trim() || candlesPlaced <= 0) return;
      if (qualifiesForTopTen && !hasConfirmedEmail) {
        openEmailModal();
        return;
      }
      setIsSubmitting(true);
      setError("");
      setMessage("");
      try {
        const response = await fetch("/api/scores", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: cleanDisplayName(playerName),
            candles: candlesPlaced,
            timeMs: finalTimeMs,
            email: hasConfirmedEmail ? cleanEmail(playerEmail) : undefined,
          }),
        });
        const data = (await response.json()) as {
          scores?: ScoreEntry[];
          error?: string;
        };
        if (!response.ok) {
          throw new Error(data.error ?? "Unable to submit score.");
        }
        setHighScores(Array.isArray(data.scores) ? data.scores : []);
        setHasSubmittedRound(true);
        setMessage(
          source === "auto"
            ? "Score saved automatically!"
            : "Score saved! The cake is officially legendary.",
        );
      } catch (submitError) {
        setError(
          submitError instanceof Error
            ? submitError.message
            : "Unable to submit score.",
        );
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      candlesPlaced,
      finalTimeMs,
      hasConfirmedEmail,
      hasConfirmedName,
      openEmailModal,
      playerEmail,
      playerName,
      qualifiesForTopTen,
    ],
  );

  useEffect(() => {
    if (
      status !== "ended" ||
      !hasConfirmedName ||
      candlesPlaced <= 0 ||
      hasSubmittedRound ||
      autoSubmitAttempted ||
      isSubmitting ||
      needsEmail
    ) {
      return;
    }
    setAutoSubmitAttempted(true);
    void submitScore("auto");
  }, [
    autoSubmitAttempted,
    candlesPlaced,
    hasConfirmedName,
    hasSubmittedRound,
    isSubmitting,
    needsEmail,
    status,
    submitScore,
  ]);

  const statusLabel =
    status === "running"
      ? "GO!"
      : status === "ended"
        ? endReason === "bomb"
          ? "Boom!"
          : endReason === "candles"
            ? "Sweet!"
            : "Done"
        : "Ready";
  const canSubmit =
    status === "ended" &&
    candlesPlaced > 0 &&
    hasConfirmedName &&
    playerName.trim().length > 0 &&
    !hasSubmittedRound &&
    !needsEmail;

  return (
    <div
      className={`${styles.page} ${isRunning ? styles.pagePlaying : ""}`}
    >
      {!isRunning ? (
        <header className={styles.hero}>
          <p className={styles.kicker}>Happy Birthday Alexander</p>
          <h1 className={styles.title}>Candle Dash Celebration</h1>
          <p className={styles.subtitle}>
            Click the dancing candles to place them on Alexander&apos;s cake.
            Reach 29 candles before the timer runs out. Golden candles just
            sparkle extra bright.
          </p>
          <div className={styles.stats}>
            <div className={styles.stat}>
              <div className={styles.statLabel}>Time Left</div>
              <div className={styles.statValue}>{timeLeft}s</div>
            </div>
            <div className={styles.stat}>
              <div className={styles.statLabel}>Candles</div>
              <div className={styles.statValue}>
                {candlesPlaced}/{TARGET_CANDLES}
              </div>
            </div>
            <div className={styles.stat}>
              <div className={styles.statLabel}>Streak</div>
              <div className={styles.statValue}>{combo}x</div>
            </div>
            <div className={styles.stat}>
              <div className={styles.statLabel}>Best Candles</div>
              <div className={styles.statValue}>{bestEntry?.candles ?? 0}</div>
            </div>
          </div>
          <div className={styles.controls}>
            <button
              className={styles.primaryButton}
              type="button"
              onClick={startGame}
              disabled={isRunning}
            >
              {status === "ended" ? "Play Again" : "Start the Party"}
            </button>
            <button
              className={styles.secondaryButton}
              type="button"
              onClick={resetGame}
            >
              Reset
            </button>
            <span
              className={`${styles.statusPill} ${
                status === "running" ? styles.statusPillRunning : ""
              }`}
            >
              {statusLabel}
            </span>
          </div>
        </header>
      ) : null}

      <main className={`${styles.main} ${isRunning ? styles.mainPlaying : ""}`}>
        <section
          className={`${styles.gameCard} ${
            isRunning ? styles.gameCardPlaying : ""
          }`}
        >
          <div
            className={`${styles.stage} ${isRunning ? styles.stagePlaying : ""}`}
          >
            {goldFlash ? <div className={styles.goldFlash} /> : null}
            {isRunning ? (
              <div className={styles.stageHud}>
                <div className={styles.stageStat}>
                  <span className={styles.stageLabel}>Time</span>
                  <strong className={styles.stageValue}>{timeLeft}s</strong>
                </div>
                <div className={styles.stageStat}>
                  <span className={styles.stageLabel}>Candles</span>
                  <strong className={styles.stageValue}>
                    {candlesPlaced}/{TARGET_CANDLES}
                  </strong>
                </div>
                <div className={styles.stageStat}>
                  <span className={styles.stageLabel}>Streak</span>
                  <strong className={styles.stageValue}>{combo}x</strong>
                </div>
              </div>
            ) : null}
            <div className={styles.cake}>
              <div className={styles.cakeCandles}>
                {CAKE_CANDLE_SPOTS.slice(0, candlesPlaced).map((spot, index) => (
                  <span
                    key={index}
                    className={styles.cakeCandle}
                    style={{
                      left: `${spot.x}%`,
                      top: `${spot.y}%`,
                      "--tilt": `${spot.tilt}deg`,
                    } as CSSProperties}
                  />
                ))}
              </div>
            </div>
            <div className={styles.candleField}>
              {candles.map((candle) => (
                <button
                  key={candle.id}
                  type="button"
                  className={`${styles.candle} ${
                    candle.isGolden ? styles.golden : ""
                  } ${candle.isBomb ? styles.bomb : ""} ${
                    candle.state === "blown" ? styles.candleBlown : ""
                  } ${candle.state === "boom" ? styles.bombBoom : ""}`}
                  style={{
                    left: `${candle.x}%`,
                    top: `${candle.y}%`,
                    "--delay": `${candle.delay}s`,
                  } as CSSProperties}
                  aria-label={
                    candle.isBomb
                      ? "Bomb, ends the round"
                      : candle.isGolden
                        ? "Golden candle, extra sparkle"
                        : "Birthday candle"
                  }
                  onClick={() => popCandle(candle)}
                >
                  {candle.isGolden && candle.state === "alive" ? (
                    <span className={styles.sparkle} />
                  ) : null}
                  {candle.state === "blown" ? (
                    <span className={styles.tapPop} />
                  ) : null}
                  {candle.state === "blown" ? (
                    <span className={styles.blow} />
                  ) : null}
                  {candle.state === "boom" ? (
                    <span className={styles.boom} />
                  ) : null}
                </button>
              ))}
            </div>
          </div>
          {!isRunning ? (
            <div className={styles.rules}>
              <div className={styles.rule}>
                <span className={styles.ruleDot} />
                Every pop places a candle on the cake. Hit 29 to finish early.
              </div>
              <div className={styles.rule}>
                <span className={`${styles.ruleDot} ${styles.ruleDotGold}`} />
                Golden candles are bonus sparkle, not bonus points.
              </div>
              <div className={styles.rule}>
                <span className={`${styles.ruleDot} ${styles.ruleDotBomb}`} />
                Bombs end the round early, so dodge them.
              </div>
              <div className={styles.rule}>
                <span className={styles.ruleDot} />
                Keep a streak going to stay in the groove.
              </div>
            </div>
          ) : null}
        </section>

        {!isRunning ? (
          <aside className={styles.scoreCard}>
            <div className={styles.scoreHeader}>
              <h2>Top 10 Scores</h2>
              <span>
                {candlesPlaced}/{TARGET_CANDLES} placed
              </span>
            </div>
            {isLoadingScores ? (
              <div className={styles.scoreEmpty}>Loading scoreboard...</div>
            ) : topScores.length === 0 ? (
              <div className={styles.scoreEmpty}>Be the first to light up the board.</div>
            ) : (
              <ol className={styles.scoreList}>
                {topScores.map((entry, index) => (
                  <li key={entry.id} className={styles.scoreRow}>
                    <div className={styles.scoreMeta}>
                      <span className={styles.scoreRank}>#{index + 1}</span>
                      <span className={styles.scoreName}>{entry.name}</span>
                    </div>
                    <div className={styles.scoreMeta}>
                      <span className={styles.scoreValue}>
                        {entry.candles ?? 0} candles
                      </span>
                      <span className={styles.scoreTime}>
                        {formatTimeMs(entry.timeMs ?? 0)}
                      </span>
                    </div>
                  </li>
                ))}
              </ol>
            )}

            <div className={styles.form}>
              <div className={styles.nameRow}>
                <div>
                  <div className={styles.nameLabel}>Submitting as</div>
                  <div className={styles.nameValue}>
                    {hasConfirmedName ? playerName : "No name yet"}
                  </div>
                </div>
                <button
                  className={styles.nameButton}
                  type="button"
                  onClick={openNameModal}
                >
                  {hasConfirmedName ? "Change name" : "Set name"}
                </button>
              </div>
              <button
                className={styles.submitButton}
                type="button"
                onClick={() => submitScore("manual")}
                disabled={!canSubmit || isSubmitting}
              >
                {isSubmitting ? "Saving..." : "Save Score"}
              </button>
              <div className={styles.helper}>
                {!hasConfirmedName
                  ? "Set your name to save a score."
                  : needsEmail
                    ? "Top 10 scores need an email to submit."
                    : status === "ended"
                      ? "Save your candles and time to celebrate Alexander."
                      : "Finish a round to unlock score saving."}
              </div>
              {message ? (
                <div className={`${styles.message} ${styles.messageSuccess}`}>
                  {message}
                </div>
              ) : null}
              {error ? (
                <div className={`${styles.message} ${styles.messageError}`}>
                  {error}
                </div>
              ) : null}
            </div>
          </aside>
        ) : null}
      </main>

      {!isRunning ? (
        <footer className={styles.footer}>
          Built with confetti, cake, and birthday wishes for Alexander.
        </footer>
      ) : null}

      {isNameModalOpen ? (
        <div
          className={styles.modalBackdrop}
          role="dialog"
          aria-modal="true"
          aria-labelledby="name-modal-title"
        >
          <div className={styles.modalCard}>
            <h3 id="name-modal-title" className={styles.modalTitle}>
              Add your name
            </h3>
            <p className={styles.modalText}>
              We&apos;ll save your candle count and time under this name.
            </p>
            <input
              className={styles.modalInput}
              type="text"
              maxLength={40}
              value={nameDraft}
              onChange={(event) => {
                setNameDraft(event.target.value);
                setNameModalError("");
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  confirmName();
                }
              }}
              placeholder="Your name"
              autoFocus
            />
            {nameModalError ? (
              <div className={styles.modalError}>{nameModalError}</div>
            ) : null}
            <div className={styles.modalActions}>
              <button
                className={styles.modalPrimary}
                type="button"
                onClick={confirmName}
              >
                Save name
              </button>
              {hasConfirmedName ? (
                <button
                  className={styles.modalSecondary}
                  type="button"
                  onClick={closeNameModal}
                >
                  Cancel
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {isEmailModalOpen ? (
        <div
          className={styles.modalBackdrop}
          role="dialog"
          aria-modal="true"
          aria-labelledby="email-modal-title"
        >
          <div className={styles.modalCard}>
            <h3 id="email-modal-title" className={styles.modalTitle}>
              Top 10 email
            </h3>
            <p className={styles.modalText}>
              This score is Top 10 worthy. Add an email so we can reach you if
              needed.
            </p>
            <input
              className={styles.modalInput}
              type="email"
              maxLength={254}
              value={emailDraft}
              onChange={(event) => {
                setEmailDraft(event.target.value);
                setEmailModalError("");
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  confirmEmail();
                }
              }}
              placeholder="you@example.com"
              autoFocus
            />
            {emailModalError ? (
              <div className={styles.modalError}>{emailModalError}</div>
            ) : null}
            <div className={styles.modalActions}>
              <button
                className={styles.modalPrimary}
                type="button"
                onClick={confirmEmail}
              >
                Save email
              </button>
              {hasConfirmedEmail ? (
                <button
                  className={styles.modalSecondary}
                  type="button"
                  onClick={closeEmailModal}
                >
                  Cancel
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
