import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ChevronRight,
  Crosshair,
  Expand,
  Flag,
  Home,
  Maximize2,
  Pause,
  Play,
  RotateCcw,
  Rocket,
  Focus,
  Shield,
  Sparkles,
  Swords,
  Trophy,
  Zap,
} from "lucide-react";
import {
  Engine,
  KEY_BINDINGS,
  type Action,
  type FighterHUD,
  type MatchResult,
  type Snapshot,
} from "../game/engine";
import { ARCHETYPES, FIGHTERS, getStage, type Settings } from "../game/data";
import { audio } from "../game/audio";
import { Key, Portrait, WeaponIcon } from "./UI";

interface GameViewProps {
  fighterId: string;
  settings: Settings;
  modalOpen: boolean;
  onBack: () => void;
  onHelp: () => void;
  onLeaderboard: () => void;
  onResult: (result: MatchResult) => void;
}

function formatTime(seconds: number) {
  return `${Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0")}:${Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0")}`;
}

function PlayerHUD({
  data,
  player,
  mode,
  stockCount,
}: {
  data: FighterHUD;
  player: number;
  mode: Settings["mode"];
  stockCount: number;
}) {
  const fighter = FIGHTERS.find((f) => f.id === data.id)!;
  const ready = data.charge >= 75;
  // Health pools now vary by character, so the bar tracks a ratio.
  const ratio = data.damage / data.maxHealth;
  return (
    <div
      className={`player-hud player-hud-${player + 1}`}
      style={{ "--fighter-color": fighter.color } as React.CSSProperties}
    >
      <div className="player-hud-main">
        <div className="hud-portrait">
          <Portrait id={data.id} />
          <span>{player === 0 ? "P1" : mode === "cpu" ? "CPU" : "P2"}</span>
        </div>
        <div className="hud-identity">
          <strong>{fighter.name}</strong>
          <span className="hud-archetype">
            {ARCHETYPES[fighter.archetype].name}
            <i>
              <WeaponIcon weapon={data.weapon} size={11} />
              {data.weapon}
            </i>
          </span>
          <span className={data.move ? "hud-move" : "hud-move hud-move-idle"}>
            {data.move || `${fighter.weapons[0]} ready`}
          </span>
          <div
            className="stock-lives"
            aria-label={`${data.stocks} lives remaining`}
          >
            {Array.from({ length: stockCount }, (_, i) => (
              <span className={i < data.stocks ? "stock-alive" : ""} key={i} />
            ))}
          </div>
        </div>
        <div
          className={`damage-readout ${ratio >= 0.7 ? "damage-danger" : ""}`}
        >
          <strong>
            {data.damage}
            <small>/{data.maxHealth}</small>
          </strong>
          <span>DAMAGE TAKEN</span>
        </div>
      </div>
      <div className="damage-track">
        <span style={{ width: `${Math.min(ratio, 1) * 100}%` }} />
      </div>
      <div
        className={`special-charge ${ready ? "special-ready" : ""} ${data.channeling ? "special-channeling" : ""}`}
      >
        <span style={{ width: `${(data.charge / 75) * 100}%` }} />
        <div>
          <Zap size={10} />
          <b>
            {data.signatureDodge > 0
              ? "SIGNATURE DODGE"
              : ready
                ? "SPECIAL READY"
                : data.channeling
                  ? "CHANNELING - EXPOSED"
                  : fighter.special.name}
          </b>
          <em>
            {data.signatureDodge > 0
              ? `${data.signatureDodge.toFixed(1)}s`
              : ready
                ? player === 0
                  ? "[L]"
                  : "[3]"
                : `${data.charge} / 75`}
          </em>
        </div>
      </div>
      <div className="hud-subline">
        <span>
          <Shield size={11} />
          {data.dodgeCD > 0
            ? `DODGE ${data.dodgeCD.toFixed(1)}s`
            : "DODGE READY"}
        </span>
        <span>{data.score.toLocaleString().padStart(5, "0")} PTS</span>
      </div>
      <div className="hud-air-status">
        <span aria-label={`${data.jumpsRemaining} jumps available`}>
          JUMPS{" "}
          <i>
            {Array.from({ length: 3 }, (_, i) => (
              <b key={i} className={i < data.jumpsRemaining ? "ready" : ""} />
            ))}
          </i>
        </span>
        <span className={data.recoveryReady ? "recovery-ready" : ""}>
          <Rocket size={10} />{" "}
          {data.recoveryReady ? "RECOVERY READY" : "RECOVERY USED"}
        </span>
      </div>
      {data.combo >= 2 && (
        <div className="combo-readout" key={data.combo}>
          <strong>{data.combo}</strong>
          <span>
            HIT
            <br />
            COMBO
          </span>
        </div>
      )}
    </div>
  );
}

function TouchButton({
  action,
  player,
  label,
  children,
  engine,
  className = "",
  disabled = false,
}: {
  action: Action;
  player: number;
  label: string;
  children: React.ReactNode;
  engine: React.RefObject<Engine | null>;
  className?: string;
  disabled?: boolean;
}) {
  return (
    <button
      className={`touch-button ${className}`}
      aria-label={`${player === 0 ? "Player 1" : "Player 2"} ${label}`}
      disabled={disabled}
      onContextMenu={(e) => e.preventDefault()}
      onPointerDown={(e) => {
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        engine.current?.input(player, action, true);
      }}
      onPointerUp={(e) => {
        e.preventDefault();
        engine.current?.input(player, action, false);
      }}
      onPointerCancel={() => engine.current?.input(player, action, false)}
      onLostPointerCapture={() => engine.current?.input(player, action, false)}
    >
      {children}
      <small>{label}</small>
    </button>
  );
}

function TouchControls({
  engine,
  player,
  charge,
  recoveryReady,
  dodgeCD,
}: {
  engine: React.RefObject<Engine | null>;
  player: number;
  charge: number;
  recoveryReady: boolean;
  dodgeCD: number;
}) {
  return (
    <div className={`touch-controls touch-player-${player + 1}`}>
      <div className="touch-movement">
        <TouchButton action="left" player={player} label="Left" engine={engine}>
          <ArrowLeft size={24} />
        </TouchButton>
        <TouchButton
          action="right"
          player={player}
          label="Right"
          engine={engine}
        >
          <ArrowRight size={24} />
        </TouchButton>
        <TouchButton action="jump" player={player} label="Jump" engine={engine}>
          <ArrowUp size={23} />
        </TouchButton>
        <TouchButton action="down" player={player} label="Down" engine={engine}>
          <ArrowDown size={23} />
        </TouchButton>
      </div>
      <div className="touch-actions">
        <TouchButton
          action="swap"
          player={player}
          label="Swap"
          engine={engine}
          className="touch-small"
        >
          <RotateCcw size={18} />
        </TouchButton>
        <TouchButton
          action="dodge"
          player={player}
          label="Dodge"
          engine={engine}
          disabled={dodgeCD > 0}
        >
          <Shield size={20} />
        </TouchButton>
        <TouchButton
          action="heavy"
          player={player}
          label="Heavy"
          engine={engine}
        >
          <Crosshair size={22} />
        </TouchButton>
        <TouchButton
          action="special"
          player={player}
          label="Special"
          engine={engine}
          className={`touch-special ${charge >= 75 ? "charged" : ""}`}
          disabled={charge < 75}
        >
          <Zap size={22} />
        </TouchButton>
        <TouchButton
          action="light"
          player={player}
          label="Attack"
          engine={engine}
          className="touch-attack"
        >
          <Swords size={26} />
        </TouchButton>
        <TouchButton
          action="recovery"
          player={player}
          label="Recover"
          engine={engine}
          className="touch-recovery"
          disabled={!recoveryReady}
        >
          <Rocket size={21} />
        </TouchButton>
        <TouchButton
          action="charge"
          player={player}
          label="Charge"
          engine={engine}
          className="touch-charge"
          disabled={charge >= 75}
        >
          <Focus size={20} />
        </TouchButton>
      </div>
    </div>
  );
}

export default function GameView({
  fighterId,
  settings,
  modalOpen,
  onBack,
  onHelp,
  onLeaderboard,
  onResult,
}: GameViewProps) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const engine = useRef<Engine | null>(null);
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [result, setResult] = useState<MatchResult | null>(null);
  const [session, setSession] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const resultCallback = useRef(onResult);
  resultCallback.current = onResult;
  const modalRef = useRef(modalOpen);
  modalRef.current = modalOpen;
  const externallyPaused = useRef(false);
  const [matchSettings, setMatchSettings] = useState(settings);
  const restart = useCallback(() => {
    audio.unlock();
    audio.click();
    setResult(null);
    setSnapshot(null);
    setSession((s) => s + 1);
  }, []);

  useEffect(() => {
    if (!canvas.current) return;
    const config = { ...settingsRef.current };
    setMatchSettings(config);
    const game = new Engine(
      canvas.current,
      fighterId,
      config,
      setSnapshot,
      (finished) => {
        setResult(finished);
        resultCallback.current(finished);
      },
    );
    engine.current = game;
    canvas.current.focus({ preventScroll: true });
    const handleKeyDown = (e: KeyboardEvent) => {
      if (modalRef.current) return;
      if (e.code === "Escape" || e.code === "KeyP") {
        e.preventDefault();
        if (e.repeat) return;
        if (game.phase === "paused") game.resume();
        else game.pause();
        return;
      }
      if (
        e.code === "KeyR" &&
        (game.phase === "over" || game.phase === "paused")
      ) {
        if (!e.repeat) restart();
        return;
      }
      const binding = KEY_BINDINGS[e.code];
      if (binding && (binding[0] === 0 || config.mode === "local")) {
        e.preventDefault();
        game.input(binding[0], binding[1], true);
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      const binding = KEY_BINDINGS[e.code];
      if (binding) {
        if (!modalRef.current) e.preventDefault();
        game.input(binding[0], binding[1], false);
      }
    };
    const pauseIfHidden = () => {
      if (document.hidden) game.pause();
    };
    const pauseOnBlur = () => game.pause();
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", pauseOnBlur);
    document.addEventListener("visibilitychange", pauseIfHidden);
    return () => {
      game.destroy();
      engine.current = null;
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", pauseOnBlur);
      document.removeEventListener("visibilitychange", pauseIfHidden);
    };
  }, [fighterId, session, restart]);

  useEffect(() => {
    if (!engine.current) return;
    if (modalOpen) {
      externallyPaused.current =
        engine.current.phase !== "paused" && engine.current.phase !== "over";
      engine.current.pause();
    } else if (externallyPaused.current) {
      externallyPaused.current = false;
      engine.current.resume();
    }
  }, [modalOpen]);

  useEffect(() => {
    if (engine.current) {
      engine.current.settings.shake = settings.shake;
      engine.current.settings.sound = settings.sound;
    }
  }, [settings.shake, settings.sound]);
  useEffect(() => {
    const changed = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", changed);
    return () => document.removeEventListener("fullscreenchange", changed);
  }, []);

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (fullscreen) setFullscreen(false);
      else if (stage.current?.requestFullscreen)
        await stage.current.requestFullscreen();
      else setFullscreen((f) => !f);
    } catch {
      setFullscreen((f) => !f);
    }
  }

  const player = FIGHTERS.find((f) => f.id === fighterId)!;
  const opponent = FIGHTERS.find((f) => f.id === matchSettings.opponent)!;
  const matchStage = getStage(matchSettings.stage);
  const winner = result?.winner === 0 ? player : opponent;
  const resultPlayer =
    matchSettings.mode === "local" ? (result?.winner ?? 0) : 0;
  const paused = snapshot?.phase === "paused";

  return (
    <main className="game-shell">
      <div className="game-topline">
        <span className="eyebrow">
          <span className="live-dot" />
          {matchSettings.mode === "cpu" ? "SOLO SHOWDOWN" : "LOCAL DUEL"}
          <span className="meta-divider">/</span>
          {matchStage.name.toUpperCase()}
        </span>
        <div>
          <button className="text-button" onClick={onHelp}>
            CONTROLS <Key>?</Key>
          </button>
          <button
            className="icon-button"
            aria-label="Toggle fullscreen"
            onClick={toggleFullscreen}
          >
            <Maximize2 size={16} />
          </button>
          <button
            className="icon-button"
            aria-label={paused ? "Resume game" : "Pause game"}
            onClick={() =>
              paused ? engine.current?.resume() : engine.current?.pause()
            }
          >
            {paused ? <Play size={17} /> : <Pause size={17} />}
          </button>
        </div>
      </div>
      <div
        className={`game-stage ${fullscreen ? "stage-fullscreen" : ""}`}
        ref={stage}
      >
        <canvas
          className="game-canvas"
          ref={canvas}
          tabIndex={0}
          aria-label={`Rift Rivals arena. ${player.name} versus ${opponent.name}. Move with A and D, jump with W, attack with J and K, special with L, dodge with left Shift, swap weapons with Q. Press Escape to pause.`}
        />
        {snapshot && (
          <div className="game-hud">
            <PlayerHUD
              data={snapshot.fighters[0]}
              player={0}
              mode={matchSettings.mode}
              stockCount={matchSettings.stocks}
            />
            <div
              className={`match-clock ${matchSettings.timeLimit && snapshot.timeRemaining <= 30 && snapshot.phase === "running" ? "match-clock-warning" : ""}`}
            >
              <span>
                {matchSettings.stocks} STOCK
                {matchSettings.stocks === 1 ? "" : "S"} EACH
              </span>
              <strong>
                {formatTime(
                  matchSettings.timeLimit
                    ? Math.ceil(snapshot.timeRemaining)
                    : snapshot.elapsed,
                )}
              </strong>
              <span className="match-clock-mode">
                {matchSettings.timeLimit ? "TIME LEFT" : "ELAPSED"}
              </span>
              <span className="match-vs">
                1 <i>VS</i> 1
              </span>
            </div>
            <PlayerHUD
              data={snapshot.fighters[1]}
              player={1}
              mode={matchSettings.mode}
              stockCount={matchSettings.stocks}
            />
          </div>
        )}
        {snapshot?.phase === "countdown" && (
          <div
            className="battle-announcement countdown-number"
            key={Math.ceil(snapshot.countdown)}
          >
            <span>
              {getStage(matchSettings.stage).name.toUpperCase()} · GET READY
            </span>
            <strong>{Math.max(1, Math.ceil(snapshot.countdown))}</strong>
            <div className="countdown-pips" aria-hidden="true">
              {[3, 2, 1].map((step) => (
                <i
                  key={step}
                  className={
                    Math.max(1, Math.ceil(snapshot.countdown)) >= step
                      ? "active"
                      : ""
                  }
                />
              ))}
            </div>
          </div>
        )}
        {snapshot?.phase === "running" && snapshot.announcement && (
          <div
            className={`battle-announcement ${snapshot.announcement === "FIGHT" ? "fight-announcement" : ""}`}
            key={snapshot.announcement}
          >
            <strong>{snapshot.announcement}</strong>
          </div>
        )}
        {snapshot?.phase === "running" && snapshot.elapsed < 8 && (
          <div className="first-match-tip">
            <Key>J</Key> LIGHT <span>+</span>
            <Key>K</Key> HEAVY <span>=</span> MAKE IT A COMBO.
          </div>
        )}
        {paused && !modalOpen && (
          <div className="game-overlay pause-overlay">
            <div className="pause-content">
              <span className="eyebrow">TAKE A BREATHER</span>
              <h2>
                PAUSED<span>.</span>
              </h2>
              <p>The rift can wait. Your rival will too.</p>
              <button
                className="primary-button"
                onClick={() => engine.current?.resume()}
              >
                <Play size={18} fill="currentColor" />
                BACK TO THE FIGHT
                <ChevronRight size={19} />
              </button>
              <div className="pause-secondary">
                <button onClick={restart}>
                  <RotateCcw size={15} />
                  Restart <Key>R</Key>
                </button>
                <button onClick={onBack}>
                  <Home size={15} />
                  Leave match
                </button>
              </div>
              <button className="text-button pause-help" onClick={onHelp}>
                NEED A REFRESHER? VIEW CONTROLS <ArrowRight size={13} />
              </button>
            </div>
          </div>
        )}
        {result && !modalOpen && (
          <div className="game-overlay result-overlay">
            <div className="result-content">
              <div className="result-eyebrow">
                <Flag size={15} />
                <span>
                  {result.reason === "timeout"
                    ? "TIME IS UP - DECIDED BY STOCKS AND HEALTH"
                    : matchSettings.mode === "local"
                      ? `PLAYER ${result.winner + 1} TAKES THE RIFT`
                      : result.winner === 0
                        ? "THE RIFT IS YOURS"
                        : "A RIVAL WORTH REMEMBERING"}
                </span>
              </div>
              <h2
                className={
                  result.winner === 0 || matchSettings.mode === "local"
                    ? ""
                    : "defeat-title"
                }
              >
                {matchSettings.mode === "local"
                  ? `${winner.name.toUpperCase()} WINS`
                  : result.winner === 0
                    ? "VICTORY"
                    : "DEFEAT"}
                <span>.</span>
              </h2>
              <p>
                {result.reason === "timeout"
                  ? "The bell rang. More stocks, then more remaining health wins."
                  : result.winner === 0 || matchSettings.mode === "local"
                    ? "Well fought. Now give them a rematch."
                    : "Every legend starts with a rivalry. Run it back."}
              </p>
              <div className="result-stats">
                <div>
                  <span>
                    {matchSettings.mode === "local"
                      ? "WINNING SCORE"
                      : "YOUR SCORE"}
                  </span>
                  <strong>
                    {result.scores[resultPlayer].toLocaleString()}
                  </strong>
                </div>
                <div>
                  <span>BEST COMBO</span>
                  <strong>
                    {result.combos[resultPlayer]}
                    <small> HITS</small>
                  </strong>
                </div>
                <div>
                  <span>MATCH TIME</span>
                  <strong>{formatTime(result.duration)}</strong>
                </div>
              </div>
              <div className="score-saved">
                <Trophy size={13} />
                {matchSettings.mode === "local"
                  ? "Both scores added to your local leaderboard"
                  : "Score added to your local leaderboard"}
              </div>
              <button className="primary-button" onClick={restart}>
                <RotateCcw size={18} />
                RUN IT BACK
                <ChevronRight size={19} />
              </button>
              <div className="result-links">
                <button onClick={onBack}>
                  <Home size={14} />
                  Choose fighter
                </button>
                <button onClick={onLeaderboard}>
                  <Trophy size={14} />
                  Leaderboard
                </button>
              </div>
              <span className="restart-hint">
                PRESS <Key>R</Key> FOR AN INSTANT REMATCH
              </span>
            </div>
          </div>
        )}
        <div className="arena-caption">
          <span>{matchStage.name.toUpperCase()}</span>
          <i />
          <span>{matchStage.hazardText.toUpperCase()}</span>
        </div>
        {fullscreen && (
          <button
            className="fullscreen-exit icon-button"
            onClick={toggleFullscreen}
            aria-label="Exit fullscreen"
          >
            <Expand size={18} />
          </button>
        )}
        {fullscreen && (
          <div
            className={`touch-panel fullscreen-touch-panel ${matchSettings.mode === "local" ? "touch-panel-local" : ""}`}
          >
            <TouchControls
              engine={engine}
              player={0}
              charge={snapshot?.fighters[0].charge ?? 0}
              recoveryReady={snapshot?.fighters[0].recoveryReady ?? true}
              dodgeCD={snapshot?.fighters[0].dodgeCD ?? 0}
            />
            {matchSettings.mode === "local" && (
              <TouchControls
                engine={engine}
                player={1}
                charge={snapshot?.fighters[1].charge ?? 0}
                recoveryReady={snapshot?.fighters[1].recoveryReady ?? true}
                dodgeCD={snapshot?.fighters[1].dodgeCD ?? 0}
              />
            )}
          </div>
        )}
      </div>
      {!fullscreen && (
        <div
          className={`touch-panel ${matchSettings.mode === "local" ? "touch-panel-local" : ""}`}
        >
          <div className="touch-orientation">
            <Sparkles size={13} />
            Turn your phone sideways for the full arena.
          </div>
          <TouchControls
            engine={engine}
            player={0}
            charge={snapshot?.fighters[0].charge ?? 0}
            recoveryReady={snapshot?.fighters[0].recoveryReady ?? true}
            dodgeCD={snapshot?.fighters[0].dodgeCD ?? 0}
          />
          {matchSettings.mode === "local" && (
            <>
              <span className="touch-player-label">PLAYER 2</span>
              <TouchControls
                engine={engine}
                player={1}
                charge={snapshot?.fighters[1].charge ?? 0}
                recoveryReady={snapshot?.fighters[1].recoveryReady ?? true}
                dodgeCD={snapshot?.fighters[1].dodgeCD ?? 0}
              />
            </>
          )}
        </div>
      )}
      <div className="game-control-bar">
        <div>
          <span>
            <Key>A</Key>
            <Key>D</Key> MOVE
          </span>
          <span>
            <Key>W</Key> JUMP <i>x3</i>
          </span>
          <span>
            <Key>I</Key> RECOVER
          </span>
          <span>
            <Key>J</Key> LIGHT
          </span>
          <span>
            <Key>K</Key> HEAVY
          </span>
          <span>
            <Key>L</Key> SPECIAL
          </span>
          <span>
            <Key>U</Key> CHARGE
          </span>
          <span>
            <Key wide>SHIFT</Key> DODGE
          </span>
          <span>
            <Key>Q</Key> SWAP
          </span>
        </div>
        <button className="text-button" onClick={() => engine.current?.pause()}>
          <Key wide>ESC</Key> PAUSE
        </button>
      </div>
      <div className="game-bottom-note">
        <Shield size={12} />
        Dodge breaks combos. Timing wins fights.
        <span>
          {matchSettings.stocks} STOCK{matchSettings.stocks === 1 ? "" : "S"}{" "}
          EACH <i />
          {matchSettings.timeLimit
            ? `${matchSettings.timeLimit / 60} MIN LIMIT`
            : "NO TIME LIMIT"}{" "}
          <i />
          HEALTH VARIES BY FIGHTER <i />
          2s DODGE COOLDOWN
        </span>
      </div>
    </main>
  );
}
