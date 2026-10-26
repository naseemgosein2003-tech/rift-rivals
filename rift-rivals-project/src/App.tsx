import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowDownLeft,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock3,
  Cpu,
  Gamepad2,
  Keyboard,
  Medal,
  RotateCcw,
  Settings2,
  Shield,
  Shuffle,
  Swords,
  Flame,
  Heart,
  Trash2,
  Trophy,
  Users,
  Volume2,
  VolumeX,
  Wind,
  Zap,
} from "lucide-react";
import GameView from "./components/GameView";
import { Brand, Dialog, Key, Portrait, WeaponIcon } from "./components/UI";
import {
  AI_PROFILES,
  ARCHETYPES,
  DEFAULT_SETTINGS,
  DIFFICULTIES,
  FIGHTERS,
  STAGES,
  STAT_KEYS,
  STAT_LABELS,
  STOCK_OPTIONS,
  TIME_OPTIONS,
  WEAPONS,
  deriveStats,
  getStage,
  loadScores,
  loadSettings,
  readStorage,
  writeStorage,
  type HighScore,
  type Settings,
} from "./game/data";
import { signatureStun, type MatchResult } from "./game/engine";
import { MOVES, STANCES, STANCE_LABELS } from "./game/moves";
import { audio } from "./game/audio";

type DialogName =
  | "help"
  | "settings"
  | "leaderboard"
  | "fighter"
  | "leave"
  | "stage-vote"
  | null;

type MapBallot = string; // stage id or "random"

function MatchRules({
  settings,
  onChange,
  compact = false,
}: {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
  compact?: boolean;
}) {
  return (
    <div className={`match-rules ${compact ? "match-rules-compact" : ""}`}>
      <div className="match-rule-heading">
        <span className="eyebrow">MATCH RULES</span>
        <span>Same rules for both fighters</span>
      </div>
      <div className="match-rule-fields">
        <div className="match-rule-field">
          <div className="match-rule-label">
            <Heart size={15} />
            <span>
              <strong>Stocks per fighter</strong>
              <small>Lives before elimination</small>
            </span>
          </div>
          <div
            className="match-rule-options"
            role="group"
            aria-label="Stocks per fighter"
          >
            {STOCK_OPTIONS.map((count) => (
              <button
                type="button"
                key={count}
                className={settings.stocks === count ? "active" : ""}
                aria-pressed={settings.stocks === count}
                onClick={() => onChange({ stocks: count })}
              >
                {count}
              </button>
            ))}
          </div>
        </div>
        <div className="match-rule-field">
          <div className="match-rule-label">
            <Clock3 size={15} />
            <span>
              <strong>Match length</strong>
              <small>
                {settings.timeLimit
                  ? "Most stocks left wins at time"
                  : "Fight until the final stock"}
              </small>
            </span>
          </div>
          <div
            className="match-rule-options"
            role="group"
            aria-label="Match length"
          >
            {TIME_OPTIONS.map((seconds) => (
              <button
                type="button"
                key={seconds}
                className={settings.timeLimit === seconds ? "active" : ""}
                aria-pressed={settings.timeLimit === seconds}
                onClick={() => onChange({ timeLimit: seconds })}
              >
                {seconds === 0 ? "NO LIMIT" : `${seconds / 60}M`}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StageVoteDialog({
  playerFighterId,
  settings,
  setSelected,
  setSettings,
  onLaunch,
  onClose,
}: {
  playerFighterId: string;
  settings: Settings;
  setSelected: (id: string) => void;
  setSettings: (settings: Settings) => void;
  onLaunch: (stageId: string) => void;
  onClose: () => void;
}) {
  const [voter, setVoter] = useState<0 | 1>(0);
  const [p1Vote, setP1Vote] = useState<MapBallot>(settings.stage);
  const [p2Vote, setP2Vote] = useState<MapBallot>(() =>
    settings.mode === "cpu"
      ? STAGES[
          (STAGES.findIndex((s) => s.id === settings.stage) + 1) % STAGES.length
        ].id
      : settings.stage,
  );

  const p1 = FIGHTERS.find((f) => f.id === playerFighterId) ?? FIGHTERS[0];
  const p2 = FIGHTERS.find((f) => f.id === settings.opponent) ?? FIGHTERS[1];
  const p2Tag = settings.mode === "cpu" ? "CPU" : "P2";

  const labelFor = (ballot: MapBallot) =>
    ballot === "random" ? "RANDOM MAP" : getStage(ballot).name.toUpperCase();

  function castVote(ballot: MapBallot) {
    audio.unlock();
    audio.click();
    if (voter === 0) {
      setP1Vote(ballot);
      if (settings.mode === "local") setVoter(1);
    } else {
      setP2Vote(ballot);
      if (settings.mode === "local") setVoter(0);
    }
  }

  function resolveAndLaunch() {
    const pick =
      p1Vote === p2Vote ? p1Vote : Math.random() < 0.5 ? p1Vote : p2Vote;
    const finalStageId =
      pick === "random"
        ? STAGES[Math.floor(Math.random() * STAGES.length)].id
        : pick;
    onLaunch(finalStageId);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        e.key === "Enter" &&
        !(
          e.target instanceof HTMLElement &&
          ["SELECT", "BUTTON"].includes(e.target.tagName)
        )
      ) {
        e.preventDefault();
        resolveAndLaunch();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const unanimous = p1Vote === p2Vote;

  return (
    <Dialog
      title="CHOOSE YOUR BATTLEGROUND."
      eyebrow="PRE-MATCH ARENA VOTE"
      onClose={onClose}
      className="stage-vote-dialog"
    >
      <div className="vote-matchup" aria-label="Selected fighters and weapons">
        <div
          className="vote-fighter-card"
          style={{ "--fighter-accent": p1.color } as React.CSSProperties}
        >
          <Portrait id={p1.id} className="vote-fighter-portrait" />
          <div className="vote-fighter-meta">
            <span className="vote-slot-tag">PLAYER 1</span>
            <select
              aria-label="Player 1 fighter"
              value={p1.id}
              onChange={(e) => setSelected(e.target.value)}
            >
              {FIGHTERS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name.toUpperCase()} ({f.weapons[0]} + {f.weapons[1]})
                </option>
              ))}
            </select>
            <div className="vote-weapons">
              <span>
                <WeaponIcon weapon={p1.weapons[0]} size={13} />
                {p1.weapons[0]}
              </span>
              <i>+</i>
              <span>
                <WeaponIcon weapon={p1.weapons[1]} size={13} />
                {p1.weapons[1]}
              </span>
            </div>
          </div>
        </div>

        <span className="vote-vs">VS</span>

        <div
          className="vote-fighter-card vote-fighter-card-right"
          style={{ "--fighter-accent": p2.color } as React.CSSProperties}
        >
          <Portrait id={p2.id} className="vote-fighter-portrait" />
          <div className="vote-fighter-meta">
            <span className="vote-slot-tag">
              {settings.mode === "cpu" ? "CPU RIVAL" : "PLAYER 2"}
            </span>
            <select
              aria-label="Player 2 or CPU fighter"
              value={p2.id}
              onChange={(e) =>
                setSettings({ ...settings, opponent: e.target.value })
              }
            >
              {FIGHTERS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name.toUpperCase()} ({f.weapons[0]} + {f.weapons[1]})
                </option>
              ))}
            </select>
            <div className="vote-weapons">
              <span>
                <WeaponIcon weapon={p2.weapons[0]} size={13} />
                {p2.weapons[0]}
              </span>
              <i>+</i>
              <span>
                <WeaponIcon weapon={p2.weapons[1]} size={13} />
                {p2.weapons[1]}
              </span>
            </div>
          </div>
        </div>
      </div>

      <MatchRules
        settings={settings}
        onChange={(patch) => setSettings({ ...settings, ...patch })}
        compact
      />

      <div className="vote-toolbar">
        <div className="mini-toggle" role="group" aria-label="Active voter">
          <button
            type="button"
            className={voter === 0 ? "active" : ""}
            onClick={() => setVoter(0)}
          >
            P1 VOTE: {labelFor(p1Vote)}
          </button>
          <button
            type="button"
            className={voter === 1 ? "active" : ""}
            onClick={() => setVoter(1)}
          >
            {p2Tag} VOTE: {labelFor(p2Vote)}
          </button>
        </div>
        <button
          type="button"
          className="random-button vote-random-both"
          onClick={() => {
            audio.unlock();
            audio.click();
            setP1Vote("random");
            setP2Vote("random");
          }}
        >
          <Shuffle size={13} />
          <span>BOTH VOTE RANDOM</span>
        </button>
      </div>

      <div className="vote-stage-grid" role="group" aria-label="Vote for map">
        {STAGES.map((stage) => {
          const hasP1 = p1Vote === stage.id;
          const hasP2 = p2Vote === stage.id;
          return (
            <button
              type="button"
              key={stage.id}
              className={`vote-stage-card ${hasP1 || hasP2 ? "is-voted" : ""}`}
              aria-pressed={voter === 0 ? hasP1 : hasP2}
              onClick={() => castVote(stage.id)}
              style={{ "--stage-accent": stage.accent } as React.CSSProperties}
            >
              <span className="vote-stage-thumb">
                <img src={stage.art} alt={stage.name} />
                {stage.hazard !== "none" && (
                  <span className="stage-hazard-flag">
                    {stage.hazard.toUpperCase()}
                  </span>
                )}
                <span className="vote-pills">
                  {hasP1 && <b className="vote-pill vote-pill-p1">P1</b>}
                  {hasP2 && <b className="vote-pill vote-pill-p2">{p2Tag}</b>}
                </span>
              </span>
              <strong>{stage.name}</strong>
              <small>{stage.tagline}</small>
            </button>
          );
        })}

        <button
          type="button"
          className={`vote-stage-card vote-stage-random ${p1Vote === "random" || p2Vote === "random" ? "is-voted" : ""}`}
          aria-pressed={voter === 0 ? p1Vote === "random" : p2Vote === "random"}
          onClick={() => castVote("random")}
        >
          <span className="vote-stage-thumb vote-random-art">
            <Shuffle size={28} />
            <span className="vote-pills">
              {p1Vote === "random" && (
                <b className="vote-pill vote-pill-p1">P1</b>
              )}
              {p2Vote === "random" && (
                <b className="vote-pill vote-pill-p2">{p2Tag}</b>
              )}
            </span>
          </span>
          <strong>Random Map</strong>
          <small>Surprise arena chosen at match start.</small>
        </button>
      </div>

      <div className="vote-tally">
        <span>
          {unanimous
            ? `UNANIMOUS PICK: ${labelFor(p1Vote)}`
            : `TIED 1–1 (${labelFor(p1Vote)} VS ${labelFor(p2Vote)}) — WINNER DRAWN AT LAUNCH`}
        </span>
      </div>

      <div className="vote-actions">
        <button type="button" className="secondary-button" onClick={onClose}>
          BACK TO ROSTER
        </button>
        <button
          type="button"
          className="primary-button vote-launch-button"
          onClick={resolveAndLaunch}
        >
          <Swords size={18} />
          START MATCH
          <ArrowUpRight size={20} />
        </button>
      </div>
    </Dialog>
  );
}

/** 1-10 stat bars, shared by the roster and the fighter dossier. */
function StatBars({
  fighter,
  compact = false,
}: {
  fighter: (typeof FIGHTERS)[number];
  compact?: boolean;
}) {
  const derived = deriveStats(fighter.stats);
  const info = ARCHETYPES[fighter.archetype];
  return (
    <div
      className={`stat-panel ${compact ? "stat-panel-compact" : ""}`}
      style={{ "--archetype-accent": info.accent } as React.CSSProperties}
    >
      <div className="stat-archetype">
        <span className="stat-archetype-name">{info.name}</span>
        <span className="stat-archetype-blurb">{info.blurb}</span>
      </div>
      <div className="stat-grid">
        {STAT_KEYS.map((key) => (
          <div className="stat-row" key={key}>
            <span className="stat-label">{STAT_LABELS[key]}</span>
            <span
              className="stat-pips"
              role="img"
              aria-label={`${STAT_LABELS[key]} ${fighter.stats[key]} out of 10`}
            >
              {Array.from({ length: 10 }, (_, i) => (
                <i key={i} className={i < fighter.stats[key] ? "on" : ""} />
              ))}
            </span>
            <b className="stat-value">{fighter.stats[key]}</b>
          </div>
        ))}
      </div>
      {!compact && (
        <div className="stat-derived">
          <span>
            <Heart size={12} />
            HEALTH <b>{derived.maxHealth}</b>
          </span>
          <span>
            <Swords size={12} />
            DAMAGE <b>x{derived.damageScale.toFixed(2)}</b>
          </span>
          <span>
            <Shield size={12} />
            TAKEN <b>x{derived.damageTaken.toFixed(2)}</b>
          </span>
          <span>
            <Wind size={12} />
            KNOCKBACK <b>x{derived.knockbackTaken.toFixed(2)}</b>
          </span>
        </div>
      )}
    </div>
  );
}

function Help({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<"controls" | "combat">("controls");
  const [player, setPlayer] = useState(0);
  const rows = [
    {
      label: "Move",
      keys:
        player === 0
          ? [<Key key="a">A</Key>, <Key key="d">D</Key>]
          : [
              <Key key="left">
                <ArrowLeft size={12} />
              </Key>,
              <Key key="right">
                <ArrowRight size={12} />
              </Key>,
            ],
      detail: "Stay light on your feet.",
    },
    {
      label: "Jump / triple jump",
      keys:
        player === 0
          ? [
              <Key key="w">W</Key>,
              <span key="or" className="key-or">
                or
              </span>,
              <Key key="space" wide>
                SPACE
              </Key>,
            ]
          : [
              <Key key="up">
                <ArrowUp size={12} />
              </Key>,
            ],
      detail: "One ground jump and two air jumps. Landing restores all three.",
    },
    {
      label: "Air recovery",
      keys: [<Key key="recovery">{player === 0 ? "I" : "4"}</Key>],
      detail: "One upward recovery per airtime, separate from your jumps.",
    },
    {
      label: "Light attack",
      keys: [<Key key="light">{player === 0 ? "J" : "1"}</Key>],
      detail: "Chain three lights in the same direction for a finisher.",
    },
    {
      label: "Heavy attack",
      keys: [<Key key="heavy">{player === 0 ? "K" : "2"}</Key>],
      detail: "More power. More knockback.",
    },
    {
      label: "Side attack",
      keys:
        player === 0
          ? [
              <Key key="a2">A</Key>,
              <span key="plus" className="key-or">
                +
              </span>,
              <Key key="j2">J</Key>,
            ]
          : [
              <Key key="l2">
                <ArrowLeft size={12} />
              </Key>,
              <span key="plus2" className="key-or">
                +
              </span>,
              <Key key="12">1</Key>,
            ],
      detail: "Hold a direction while attacking to lunge forward.",
    },
    {
      label: "Down attack",
      keys:
        player === 0
          ? [
              <Key key="s2">S</Key>,
              <span key="plus3" className="key-or">
                +
              </span>,
              <Key key="j3">J</Key>,
            ]
          : [
              <Key key="d2">
                <ArrowDown size={12} />
              </Key>,
              <span key="plus4" className="key-or">
                +
              </span>,
              <Key key="13">1</Key>,
            ],
      detail: "Low sweeps on the ground. Spikes in the air.",
    },
    {
      label: "Signature move",
      keys: [<Key key="special">{player === 0 ? "L" : "3"}</Key>],
      detail: "Ready after 75 regular damage, or manual charging.",
    },
    {
      label: "Charge signature",
      keys: [<Key key="charge">{player === 0 ? "U" : "5"}</Key>],
      detail:
        "Hold while grounded. You cannot move or dodge and take 35% more damage.",
    },
    {
      label: "Dodge",
      keys: [
        <Key key="dodge" wide>
          {player === 0 ? "LEFT SHIFT" : "RIGHT SHIFT"}
        </Key>,
      ],
      detail:
        "Dodge on the ground or in the air. Invincible for 0.3s; 2s cooldown.",
    },
    {
      label: "Swap weapon",
      keys: [<Key key="swap">{player === 0 ? "Q" : "0"}</Key>],
      detail: "Two weapons. Twice the possibilities.",
    },
    {
      label: "Drop through platform",
      keys: [
        <Key key="drop">{player === 0 ? "S" : <ArrowDown size={12} />}</Key>,
      ],
      detail: "Get the drop on your opponent.",
    },
  ];
  return (
    <Dialog
      title="KNOW YOUR EDGE."
      eyebrow="THE FIELD MANUAL"
      onClose={onClose}
      className="help-dialog"
    >
      <div className="dialog-tabs">
        <button
          className={tab === "controls" ? "active" : ""}
          onClick={() => setTab("controls")}
        >
          <Keyboard size={15} />
          THE CONTROLS
        </button>
        <button
          className={tab === "combat" ? "active" : ""}
          onClick={() => setTab("combat")}
        >
          <Swords size={15} />
          THE COMBAT
        </button>
      </div>
      {tab === "controls" ? (
        <>
          <div className="controls-heading">
            <p>Simple inputs. Serious possibilities.</p>
            <div className="mini-toggle">
              <button
                onClick={() => setPlayer(0)}
                className={player === 0 ? "active" : ""}
              >
                PLAYER 1
              </button>
              <button
                onClick={() => setPlayer(1)}
                className={player === 1 ? "active" : ""}
              >
                PLAYER 2
              </button>
            </div>
          </div>
          <div className="controls-table">
            {rows.map((row) => (
              <div className="control-row" key={row.label}>
                <strong>{row.label}</strong>
                <div>{row.keys}</div>
                <span>{row.detail}</span>
              </div>
            ))}
          </div>
          <div className="help-note">
            <Gamepad2 size={18} />
            <p>
              <strong>Playing on touch?</strong> On-screen controls appear
              automatically. Use landscape for the best view. Local duels also
              include a second set of touch controls.
            </p>
          </div>
          <div className="help-shortcuts">
            <span>
              <Key wide>ESC</Key> or <Key>P</Key> Pause
            </span>
            <span>
              <Key>R</Key> Restart while paused or after a match
            </span>
          </div>
        </>
      ) : (
        <>
          <div className="combat-rules">
            {[
              [
                "01",
                "YOUR STOCKS. YOUR RULES.",
                "Choose 1, 2, 3, 5, or 7 stocks per fighter and optionally set a time limit. Every character has a different health pool. A ring-out or full damage meter costs a stock. At time, most stocks wins; ties go to the fighter with more remaining health, then score.",
                Shield,
              ],
              [
                "02",
                "SIX ATTACKS PER WEAPON.",
                "Neutral, side, and down attacks each have their own grounded and aerial version. Neutral launches, side covers distance, and air down spikes your rival toward the blast zone.",
                Swords,
              ],
              [
                "03",
                "FIND YOUR FLOW.",
                "Light attacks chain into a three-hit combo while you keep the same direction. Mix in a heavy finisher for extra knockback, swap weapons, or follow your rival into the air.",
                Swords,
              ],
              [
                "04",
                "MAKE IT SPECIAL.",
                "Deal 75 damage with regular attacks, or hold U (P2: 5) on the ground to charge manually. Every signature has its own animation, stuns on hit, and opens with a 0.5s dodge window. Channeling roots you in place, disables dodge and attacks, and makes incoming hits deal 35% extra damage.",
                Zap,
              ],
              [
                "05",
                "FIGHT BACK FROM THE EDGE.",
                "You have three jumps total: one from the ground and two in the air. After they run out, use your separate upward recovery to climb back. Landing restores both jumps and recovery.",
                ArrowUp,
              ],
              [
                "06",
                "THE BEST DEFENSE IS TIMING.",
                "Dodge on the ground or in the air to escape an attack. Hold up or down for a vertical air dodge. You are invulnerable for 0.3 seconds, with a shared two-second cooldown.",
                Shield,
              ],
            ].map(([number, title, description, Icon]) => {
              const RuleIcon = Icon as typeof Shield;
              return (
                <div className="combat-rule" key={number as string}>
                  <span>{number as string}</span>
                  <div>
                    <h3>{title as string}</h3>
                    <p>{description as string}</p>
                  </div>
                  <RuleIcon size={22} />
                </div>
              );
            })}
          </div>
          <div className="combo-guide">
            <span className="eyebrow">YOUR FIRST COMBO</span>
            <div>
              <Key>J</Key>
              <ChevronRight size={14} />
              <Key>J</Key>
              <ChevronRight size={14} />
              <Key>K</Key>
              <span>LIGHT. LIGHT. LIGHTS OUT.</span>
            </div>
          </div>
          <p className="score-explanation">
            <Trophy size={15} />
            Every damage point earns 10 points. Combos add bonuses, each
            knockout earns 500, and a win earns 1,000.
          </p>
        </>
      )}
      <button className="primary-button dialog-done" onClick={onClose}>
        I'M READY
        <ArrowUpRight size={19} />
      </button>
    </Dialog>
  );
}

function MatchSettings({
  settings,
  setSettings,
  onClose,
  inGame,
}: {
  settings: Settings;
  setSettings: (settings: Settings) => void;
  onClose: () => void;
  inGame: boolean;
}) {
  const update = (patch: Partial<Settings>) =>
    setSettings({ ...settings, ...patch });
  return (
    <Dialog
      title="YOUR RULES. YOUR RIFT."
      eyebrow="MATCH SETTINGS"
      onClose={onClose}
      className="settings-dialog"
    >
      {inGame && (
        <div className="settings-notice">
          Finish or leave your current match to change fighters and difficulty.
        </div>
      )}
      <fieldset disabled={inGame} className="match-fieldset">
        <legend>MATCH TYPE</legend>
        <div className="mode-options">
          <button
            className={settings.mode === "cpu" ? "active" : ""}
            onClick={() => update({ mode: "cpu" })}
            aria-pressed={settings.mode === "cpu"}
          >
            <Cpu size={23} />
            <span>
              <strong>SOLO SHOWDOWN</strong>
              <small>You vs. CPU</small>
            </span>
            <span className="radio-indicator" />
          </button>
          <button
            className={settings.mode === "local" ? "active" : ""}
            onClick={() => update({ mode: "local" })}
            aria-pressed={settings.mode === "local"}
          >
            <Users size={23} />
            <span>
              <strong>LOCAL DUEL</strong>
              <small>Two players. One screen.</small>
            </span>
            <span className="radio-indicator" />
          </button>
        </div>
        <div className="setting-row setting-opponent">
          <div>
            <strong>
              {settings.mode === "cpu" ? "YOUR RIVAL" : "PLAYER 2 FIGHTER"}
            </strong>
            <p>Pick who stands on the other side.</p>
          </div>
          <div className="opponent-select">
            <Portrait id={settings.opponent} />
            <select
              aria-label="Opponent fighter"
              value={settings.opponent}
              onChange={(e) => update({ opponent: e.target.value })}
            >
              {FIGHTERS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name.toUpperCase()}
                </option>
              ))}
            </select>
            <ChevronDown size={14} />
          </div>
        </div>
        {settings.mode === "cpu" && (
          <div className="setting-row difficulty-setting">
            <div>
              <strong>CPU DIFFICULTY</strong>
              <p>{AI_PROFILES[settings.difficulty].blurb}</p>
            </div>
            <div
              className="difficulty-control"
              role="radiogroup"
              aria-label="CPU difficulty"
            >
              {DIFFICULTIES.map((level, index) => (
                <button
                  key={level}
                  role="radio"
                  aria-checked={settings.difficulty === level}
                  onClick={() => update({ difficulty: level })}
                  className={settings.difficulty === level ? "active" : ""}
                >
                  <span className="difficulty-bars" aria-hidden="true">
                    {DIFFICULTIES.map((_, bar) => (
                      <i key={bar} className={bar <= index ? "on" : ""} />
                    ))}
                  </span>
                  {AI_PROFILES[level].label}
                </button>
              ))}
            </div>
          </div>
        )}
        <MatchRules settings={settings} onChange={update} />
        <div className="setting-row stage-setting">
          <div>
            <strong>ARENA</strong>
            <p>{getStage(settings.stage).tagline}</p>
          </div>
          <div
            className="stage-picker"
            role="radiogroup"
            aria-label="Choose an arena"
          >
            {STAGES.map((stage) => (
              <button
                key={stage.id}
                role="radio"
                aria-checked={settings.stage === stage.id}
                onClick={() => update({ stage: stage.id })}
                className={settings.stage === stage.id ? "active" : ""}
                style={
                  { "--stage-accent": stage.accent } as React.CSSProperties
                }
              >
                <span className="stage-thumb">
                  <img src={stage.art} alt="" loading="lazy" />
                  {stage.hazard !== "none" && (
                    <span className="stage-hazard-flag">
                      {stage.hazard === "wind" ? (
                        <Wind size={11} />
                      ) : (
                        <Flame size={11} />
                      )}
                    </span>
                  )}
                </span>
                <strong>{stage.name}</strong>
              </button>
            ))}
          </div>
        </div>
      </fieldset>
      <div className="settings-label">THE FEEL OF THE FIGHT</div>
      <div className="setting-row">
        <div>
          <strong>SOUND EFFECTS</strong>
          <p>Hear every hit, dodge, and knockout.</p>
        </div>
        <button
          className={`toggle-switch ${settings.sound ? "on" : ""}`}
          role="switch"
          aria-checked={settings.sound}
          aria-label="Sound effects"
          onClick={() => {
            audio.enabled = !settings.sound;
            audio.unlock();
            update({ sound: !settings.sound });
          }}
        >
          <span />
        </button>
      </div>
      <div className="setting-row">
        <div>
          <strong>SCREEN SHAKE</strong>
          <p>A little impact goes a long way.</p>
        </div>
        <button
          className={`toggle-switch ${settings.shake ? "on" : ""}`}
          role="switch"
          aria-checked={settings.shake}
          aria-label="Screen shake"
          onClick={() => update({ shake: !settings.shake })}
        >
          <span />
        </button>
      </div>
      <div className="settings-footer">
        <span>
          <Check size={13} />
          Preferences saved automatically
        </span>
        <button
          className="text-button"
          onClick={() =>
            setSettings(
              inGame
                ? { ...settings, sound: true, shake: true }
                : DEFAULT_SETTINGS,
            )
          }
        >
          <RotateCcw size={13} />
          RESET
        </button>
      </div>
      <button className="primary-button dialog-done" onClick={onClose}>
        LOOKS GOOD
        <Check size={18} />
      </button>
    </Dialog>
  );
}

function Leaderboard({
  scores,
  onClose,
  onPlay,
  onClear,
}: {
  scores: HighScore[];
  onClose: () => void;
  onPlay: () => void;
  onClear: () => void;
}) {
  const [onlyWins, setOnlyWins] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const filtered = onlyWins ? scores.filter((s) => s.won) : scores;
  return (
    <Dialog
      title="LOCAL LEGENDS."
      eyebrow="THE LEADERBOARD"
      onClose={onClose}
      className="leaderboard-dialog"
    >
      <div className="leaderboard-intro">
        <p>
          Big scores. Bigger rivalries. Your best 10 runs, saved on this device.
        </p>
        <Trophy size={25} />
      </div>
      <div className="dialog-tabs">
        <button
          onClick={() => setOnlyWins(false)}
          className={!onlyWins ? "active" : ""}
        >
          ALL RUNS
        </button>
        <button
          onClick={() => setOnlyWins(true)}
          className={onlyWins ? "active" : ""}
        >
          VICTORIES
        </button>
        <span>{filtered.length} RECORDS</span>
      </div>
      {filtered.length > 0 ? (
        <div className="leaderboard-table">
          <div className="leaderboard-table-head">
            <span>RANK</span>
            <span>FIGHTER</span>
            <span>RESULT</span>
            <span>BEST COMBO</span>
            <span>SCORE</span>
          </div>
          {filtered.map((entry, index) => {
            const f =
              FIGHTERS.find((f) => f.id === entry.fighter) ?? FIGHTERS[0];
            return (
              <div
                className={`leaderboard-row ${index === 0 ? "first-place" : ""}`}
                key={entry.id}
              >
                <span className="score-rank">
                  {index === 0 ? (
                    <Medal size={21} />
                  ) : (
                    (index + 1).toString().padStart(2, "0")
                  )}
                </span>
                <span className="score-fighter">
                  <Portrait id={f.id} />
                  <span>
                    <strong>{f.name}</strong>
                    <small>
                      {new Date(entry.date).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                      })}{" "}
                      /{" "}
                      {entry.mode === "cpu"
                        ? "SOLO"
                        : `P${(entry.player ?? 0) + 1} DUEL`}
                    </small>
                  </span>
                </span>
                <span className={`score-result ${entry.won ? "won" : ""}`}>
                  {entry.won ? "VICTORY" : "DEFEAT"}
                </span>
                <span className="score-combo">
                  {entry.combo}
                  <small> HITS</small>
                </span>
                <strong className="score-points">
                  {entry.score.toLocaleString()}
                </strong>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="leaderboard-empty">
          <div className="empty-trophy">
            <Trophy size={39} strokeWidth={1.15} />
            <span />
            <span />
          </div>
          <h3>
            {onlyWins
              ? "YOUR FIRST WIN IS WAITING."
              : "EVERY LEGEND STARTS AT ZERO."}
          </h3>
          <p>
            {onlyWins
              ? "Step back into the rift and make your next match count."
              : "Finish a match. Make your mark. Give your next rival something to chase."}
          </p>
          <button className="primary-button" onClick={onPlay}>
            ENTER THE ARENA
            <ArrowUpRight size={19} />
          </button>
        </div>
      )}
      <div className="leaderboard-footer">
        <span>
          <Shield size={13} />
          LOCAL SCORES. REAL BRAGGING RIGHTS.
        </span>
        {scores.length > 0 &&
          (confirmClear ? (
            <div className="clear-confirm">
              <span>Clear all records?</span>
              <button
                onClick={() => {
                  onClear();
                  setConfirmClear(false);
                }}
              >
                YES, CLEAR
              </button>
              <button onClick={() => setConfirmClear(false)}>CANCEL</button>
            </div>
          ) : (
            <button
              className="text-button"
              onClick={() => setConfirmClear(true)}
            >
              <Trash2 size={13} />
              CLEAR RECORDS
            </button>
          ))}
      </div>
    </Dialog>
  );
}

export default function App() {
  const [screen, setScreen] = useState<"lobby" | "game">("lobby");
  const [selected, setSelected] = useState(() => {
    const id = readStorage("rift-rivals-fighter", "ronin");
    return FIGHTERS.some((f) => f.id === id) ? id : "ronin";
  });
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [dialog, setDialog] = useState<DialogName>(null);
  const [scores, setScores] = useState<HighScore[]>(loadScores);
  const rosterRef = useRef<HTMLElement>(null);
  const selectedFighter = FIGHTERS.find((f) => f.id === selected)!;
  const selectedIndex = FIGHTERS.indexOf(selectedFighter);
  const [matchNumber, setMatchNumber] = useState(0);

  useEffect(() => {
    writeStorage("rift-rivals-settings", settings);
    audio.enabled = settings.sound;
  }, [settings]);
  useEffect(() => {
    writeStorage("rift-rivals-fighter", selected);
  }, [selected]);
  useEffect(() => {
    const handleKeys = (e: KeyboardEvent) => {
      if (
        screen !== "lobby" ||
        dialog ||
        (e.target instanceof HTMLElement &&
          ["INPUT", "SELECT", "BUTTON"].includes(e.target.tagName))
      )
        return;
      if (e.key === "Enter") {
        e.preventDefault();
        startMatch();
      }
      if (e.key === "?") setDialog("help");
    };
    window.addEventListener("keydown", handleKeys);
    return () => window.removeEventListener("keydown", handleKeys);
  });

  function startMatch() {
    audio.unlock();
    audio.click();
    setDialog("stage-vote");
  }

  function launchWithStage(stageId: string) {
    audio.unlock();
    audio.click();
    setSettings((prev) => ({ ...prev, stage: stageId }));
    setDialog(null);
    setMatchNumber((n) => n + 1);
    setScreen("game");
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  function chooseFighter(id: string) {
    audio.unlock();
    audio.click();
    setSelected(id);
  }
  function randomFighter() {
    const choices = FIGHTERS.filter((f) => f.id !== selected);
    chooseFighter(choices[Math.floor(Math.random() * choices.length)].id);
  }
  function goHome() {
    if (screen === "game") setDialog("leave");
    else window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function returnToLobby() {
    setDialog(null);
    setScreen("lobby");
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  function toggleSound() {
    const enabled = !settings.sound;
    audio.enabled = enabled;
    if (enabled) {
      audio.unlock();
      audio.click();
    }
    setSettings((s) => ({ ...s, sound: enabled }));
  }
  const saveResult = useCallback(
    (result: MatchResult) => {
      const players = settings.mode === "local" ? [0, 1] : [0];
      const records: HighScore[] = players.map((player) => ({
        id: `${Date.now()}-${player}-${Math.random().toString(36).slice(2, 7)}`,
        fighter: player === 0 ? selected : settings.opponent,
        score: result.scores[player],
        combo: result.combos[player],
        won: result.winner === player,
        date: new Date().toISOString(),
        mode: settings.mode,
        player,
      }));
      setScores((previous) => {
        const next = [...previous, ...records]
          .sort((a, b) => b.score - a.score)
          .slice(0, 10);
        writeStorage("rift-rivals-scores", next);
        return next;
      });
    },
    [selected, settings.mode, settings.opponent],
  );

  return (
    <div className={`app ${screen === "game" ? "app-ingame" : ""}`}>
      <header className="site-header">
        <div className="header-inner">
          <button
            className="brand-button"
            onClick={goHome}
            aria-label="Rift Rivals home"
          >
            <Brand />
          </button>
          <nav aria-label="Main navigation">
            <button
              className={dialog === null ? "active" : ""}
              onClick={goHome}
            >
              PLAY
              <span />
            </button>
            <button
              onClick={() => {
                if (screen === "game") setDialog("leave");
                else {
                  setDialog(null);
                  rosterRef.current?.scrollIntoView({
                    behavior: "smooth",
                    block: "center",
                  });
                }
              }}
            >
              ROSTER
            </button>
            <button
              className={dialog === "help" ? "active" : ""}
              onClick={() => setDialog("help")}
            >
              HOW TO PLAY
            </button>
            <button
              className={dialog === "leaderboard" ? "active" : ""}
              onClick={() => setDialog("leaderboard")}
            >
              LEADERBOARD
            </button>
          </nav>
          <div className="header-tools">
            <span className="local-status">
              <span className="live-dot" />
              LOCAL PLAY
            </span>
            <span className="header-tool-divider" />
            <button
              className="icon-button sound-top"
              aria-label={settings.sound ? "Mute sound" : "Enable sound"}
              onClick={toggleSound}
            >
              {settings.sound ? <Volume2 size={17} /> : <VolumeX size={17} />}
            </button>
            <button
              className="icon-button settings-top"
              onClick={() => setDialog("settings")}
              aria-label="Open match settings"
            >
              <Settings2 size={18} />
            </button>
          </div>
        </div>
      </header>

      {screen === "lobby" ? (
        <main className="lobby">
          <section
            className="hero"
            aria-label="Rift Rivals. Choose your fighter and enter the arena."
            style={
              {
                "--fighter-color": selectedFighter.color,
              } as React.CSSProperties
            }
          >
            <div
              className={`hero-art ${selected !== "ronin" ? "hero-art-alternate" : ""}`}
              key={selected}
            >
              {selected === "ronin" ? (
                <img
                  src="/images/ronin-hero.jpg"
                  alt="Ronin, a masked warrior with an ember-lit sword, stands in the ruins of the rift."
                />
              ) : (
                <>
                  <img
                    src="/images/arena.jpg"
                    alt="The atmospheric ruins of the Fracture arena"
                  />
                  <Portrait id={selected} className="hero-portrait" />
                </>
              )}
            </div>
            <div className="hero-vignette" />
            <div className="hero-embers" aria-hidden="true">
              {Array.from({ length: 8 }, (_, i) => (
                <i
                  key={i}
                  style={{
                    left: `${47 + i * 6}%`,
                    animationDelay: `${i * -1.7}s`,
                    animationDuration: `${8 + (i % 3) * 2}s`,
                  }}
                />
              ))}
            </div>
            <div className="hero-inner">
              <div className="hero-copy">
                <div className="hero-kicker">
                  <span>
                    <Swords size={14} />
                  </span>
                  1V1 PLATFORM FIGHTER
                  <i />
                </div>
                <h1 className="hero-title">
                  RIFT
                  <br />
                  <span>
                    RIVALS<span className="title-period">.</span>
                  </span>
                  <sup>TM</sup>
                </h1>
                <p className="hero-tagline">Outplay. Outlast. Own the arena.</p>
                <p className="hero-description">
                  Two weapons.{" "}
                  {settings.stocks === 3
                    ? "Three lives"
                    : `${settings.stocks} stocks`}
                  . One rivalry.
                </p>
                <div className="hero-actions">
                  <button
                    className="primary-button enter-arena"
                    onClick={startMatch}
                  >
                    <Swords size={18} />
                    ENTER THE ARENA
                    <ArrowUpRight size={22} />
                  </button>
                  <button
                    className="how-to-button"
                    onClick={() => setDialog("help")}
                    aria-label="Learn how to play"
                  >
                    <CircleHelp size={17} />
                    <span>HOW TO PLAY</span>
                  </button>
                </div>
                <button
                  className="match-config"
                  onClick={() => setDialog("settings")}
                >
                  {settings.mode === "cpu" ? (
                    <Cpu size={13} />
                  ) : (
                    <Users size={13} />
                  )}
                  <strong>
                    {settings.mode === "cpu" ? "YOU VS. CPU" : "LOCAL 1V1"}
                  </strong>
                  <i />
                  <span>
                    {settings.mode === "cpu"
                      ? AI_PROFILES[settings.difficulty].label.toUpperCase()
                      : "TWO PLAYERS"}
                  </span>
                  <ChevronDown size={12} />
                </button>
              </div>
              <button
                className="fighter-signature"
                key={selected}
                onClick={() => setDialog("fighter")}
                aria-label={`View ${selectedFighter.name}'s weapons and special move`}
              >
                <span className="fighter-index">
                  <i />
                  {(selectedIndex + 1).toString().padStart(2, "0")}{" "}
                  <em>/ {FIGHTERS.length}</em>
                </span>
                <span className="fighter-epithet">
                  {selectedFighter.title.toUpperCase()}
                </span>
                <span className="fighter-signature-name">
                  {selectedFighter.name}
                  <ArrowUpRight size={22} />
                </span>
                <span className="signature-weapons">
                  <span>
                    <WeaponIcon weapon={selectedFighter.weapons[0]} />
                    {selectedFighter.weapons[0]}
                  </span>
                  <i>+</i>
                  <span>
                    <WeaponIcon weapon={selectedFighter.weapons[1]} />
                    {selectedFighter.weapons[1]}
                  </span>
                </span>
              </button>
            </div>
            <span className="hero-edge-label" aria-hidden="true">
              NO GLORY WITHOUT A RIVAL.
            </span>
          </section>

          <section
            className="roster-section"
            ref={rosterRef}
            aria-labelledby="roster-title"
          >
            <div className="roster-heading">
              <div>
                <span className="section-marker" />
                <h2 id="roster-title">CHOOSE YOUR FIGHTER</h2>
                <span className="roster-subtitle">Find your edge.</span>
              </div>
              <div>
                <span className="roster-count">
                  {FIGHTERS.length} FIGHTERS. UNIQUE LOADOUTS.
                </span>
                <button className="random-button" onClick={randomFighter}>
                  <Shuffle size={13} />
                  <span>RANDOM</span>
                </button>
              </div>
            </div>
            <div
              className="fighter-roster"
              role="group"
              aria-label="Choose your fighter"
            >
              {FIGHTERS.map((fighter, index) => (
                <button
                  className={`fighter-pick ${fighter.id === selected ? "is-selected" : ""}`}
                  onClick={() => chooseFighter(fighter.id)}
                  aria-pressed={fighter.id === selected}
                  aria-label={`${fighter.name}, ${fighter.weapons.join(" and ")}`}
                  key={fighter.id}
                  style={
                    { "--portrait-color": fighter.color } as React.CSSProperties
                  }
                >
                  <span className="portrait-frame">
                    <Portrait id={fighter.id} />
                    <span className="portrait-number">
                      {(index + 1).toString().padStart(2, "0")}
                    </span>
                    {fighter.id === selected && (
                      <span className="selected-check">
                        <Check size={10} strokeWidth={3} />
                      </span>
                    )}
                    <span className="portrait-shade" />
                  </span>
                  <span className="fighter-pick-name">
                    {fighter.name}
                    {fighter.id === selected && <ChevronRight size={13} />}
                  </span>
                  <span className="fighter-pick-weapons">
                    <span>
                      <WeaponIcon weapon={fighter.weapons[0]} size={11} />
                      {fighter.weapons[0]}
                    </span>
                    <i>+</i>
                    <span>
                      <WeaponIcon weapon={fighter.weapons[1]} size={11} />
                      {fighter.weapons[1]}
                    </span>
                  </span>
                </button>
              ))}
            </div>
            <StatBars fighter={selectedFighter} compact />
            <div className="selected-special" key={selected}>
              <div className="special-symbol">
                <Zap size={20} strokeWidth={1.6} />
              </div>
              <div className="selected-special-copy">
                <span>SIGNATURE MOVE</span>
                <strong>{selectedFighter.special.name}</strong>
                <p>{selectedFighter.special.description}</p>
              </div>
              <div className="special-charge-note">
                <span className="mini-charge-meter">
                  <i />
                  <i />
                  <i />
                  <i />
                  <i />
                </span>
                <span>
                  DEAL <strong>75 DAMAGE</strong> TO CHARGE
                </span>
              </div>
            </div>
          </section>

          <footer className="lobby-footer">
            <button
              className="arena-preview"
              onClick={() => setDialog("settings")}
              aria-label={`Change arena. Currently ${getStage(settings.stage).name}.`}
            >
              <img
                src={getStage(settings.stage).art}
                alt={`${getStage(settings.stage).name} stage`}
              />
              <span>
                <small>YOUR BATTLEGROUND</small>
                <strong>
                  {getStage(settings.stage).name.toUpperCase()}
                  <ArrowUpRight size={12} />
                </strong>
              </span>
            </button>
            <p>
              <Shield size={15} />
              {settings.stocks} stock{settings.stocks === 1 ? "" : "s"}.
              {settings.timeLimit
                ? ` ${settings.timeLimit / 60} min limit.`
                : " No time limit."}{" "}
              <span>
                {deriveStats(selectedFighter.stats).maxHealth} damage to break{" "}
                {selectedFighter.name}.
              </span>
            </p>
            <button
              className="footer-controls"
              onClick={() => setDialog("help")}
            >
              <Keyboard size={18} />
              <span>KEYBOARD + TOUCH</span>
              <ArrowUpRight size={13} />
            </button>
          </footer>
          <div className="bottom-bar">
            <span>NO DOWNLOADS. NO EXCUSES.</span>
            <span className="bottom-center">ALL SKILL. ALL LOCAL.</span>
            <span>
              <i />
              READY FOR THE REMATCH<span className="version">V.1.0</span>
            </span>
          </div>
        </main>
      ) : (
        <GameView
          key={matchNumber}
          fighterId={selected}
          settings={settings}
          modalOpen={dialog !== null}
          onBack={returnToLobby}
          onHelp={() => setDialog("help")}
          onLeaderboard={() => setDialog("leaderboard")}
          onResult={saveResult}
        />
      )}

      {dialog === "help" && <Help onClose={() => setDialog(null)} />}
      {dialog === "settings" && (
        <MatchSettings
          settings={settings}
          setSettings={setSettings}
          inGame={screen === "game"}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === "leaderboard" && (
        <Leaderboard
          scores={scores}
          onClose={() => setDialog(null)}
          onPlay={startMatch}
          onClear={() => {
            setScores([]);
            writeStorage("rift-rivals-scores", []);
          }}
        />
      )}
      {dialog === "fighter" && (
        <Dialog
          title={selectedFighter.name.toUpperCase()}
          eyebrow={selectedFighter.title.toUpperCase()}
          onClose={() => setDialog(null)}
          className="fighter-dialog"
        >
          <div className="fighter-detail-body">
            <Portrait id={selected} />
            <div>
              <span className="eyebrow">THE LOADOUT</span>
              {selectedFighter.weapons.map((weapon) => (
                <div className="weapon-detail" key={weapon}>
                  <WeaponIcon weapon={weapon} size={24} />
                  <div>
                    <h3>{weapon}</h3>
                    <p>
                      {WEAPONS[weapon].damage} light /{" "}
                      {WEAPONS[weapon].heavyDamage} heavy damage
                    </p>
                    <ul className="move-list">
                      {STANCES.map((stance) => (
                        <li key={stance}>
                          <b>{STANCE_LABELS[stance]}</b>
                          <span>{MOVES[weapon][stance].name}</span>
                          <em>{MOVES[weapon][stance].damage}</em>
                        </li>
                      ))}
                    </ul>
                  </div>
                  <span>{WEAPONS[weapon].ranged ? "RANGED" : "MELEE"}</span>
                </div>
              ))}
              <div className="fighter-special-detail">
                <Zap size={20} />
                <h3>{selectedFighter.special.name}</h3>
                <p>{selectedFighter.special.description}</p>
                <span>
                  {signatureStun(selectedFighter.special.type).toFixed(2)}s
                  SIGNATURE STUN · 0.50s DODGE WINDOW · CHARGE BY DAMAGE OR
                  CHANNELING.
                </span>
              </div>
              <StatBars fighter={selectedFighter} />
              <div className="archetype-playstyle">
                <span>HOW TO PLAY THEM</span>
                <p>{ARCHETYPES[selectedFighter.archetype].playstyle}</p>
              </div>
            </div>
          </div>
          <button className="primary-button dialog-done" onClick={startMatch}>
            FIGHT AS {selectedFighter.name.toUpperCase()}
            <ArrowUpRight size={20} />
          </button>
        </Dialog>
      )}
      {dialog === "stage-vote" && (
        <StageVoteDialog
          playerFighterId={selected}
          settings={settings}
          setSelected={setSelected}
          setSettings={setSettings}
          onLaunch={launchWithStage}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === "leave" && (
        <Dialog
          title="LEAVING SO SOON?"
          eyebrow="YOUR RIVAL WILL MISS YOU"
          onClose={() => setDialog(null)}
          className="leave-dialog"
        >
          <p>
            Your current match will end without saving a score. Your previous
            records are safe.
          </p>
          <div className="leave-actions">
            <button className="secondary-button" onClick={returnToLobby}>
              <ArrowDownLeft size={17} />
              BACK TO LOBBY
            </button>
            <button className="primary-button" onClick={() => setDialog(null)}>
              KEEP FIGHTING
              <ArrowRight size={17} />
            </button>
          </div>
        </Dialog>
      )}
    </div>
  );
}
