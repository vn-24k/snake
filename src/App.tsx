import { useState, useEffect, useRef, useCallback } from "react";

// ── Constants ──────────────────────────────────────────────
const GRID_SIZE = 20;
const CELL_SIZE = 18;
const INITIAL_SPEED = 200; // ms per tick
const MIN_SPEED = 60;
const SPEED_DECREASE = 8; // ms faster per food eaten
const POINTS_PER_FOOD = 10;

type Direction = "UP" | "DOWN" | "LEFT" | "RIGHT";
type Cell = { x: number; y: number };
type GameState = "idle" | "playing" | "paused" | "gameover";

const OPPOSITES: Record<Direction, Direction> = {
  UP: "DOWN",
  DOWN: "UP",
  LEFT: "RIGHT",
  RIGHT: "LEFT",
};

const DIRECTION_VECTORS: Record<Direction, Cell> = {
  UP: { x: 0, y: -1 },
  DOWN: { x: 0, y: 1 },
  LEFT: { x: -1, y: 0 },
  RIGHT: { x: 1, y: 0 },
};

// ── Helpers ────────────────────────────────────────────────
function randomFood(snake: Cell[], gridSize: number): Cell {
  const occupied = new Set(snake.map((c) => `${c.x},${c.y}`));
  const free: Cell[] = [];
  for (let x = 0; x < gridSize; x++) {
    for (let y = 0; y < gridSize; y++) {
      if (!occupied.has(`${x},${y}`)) free.push({ x, y });
    }
  }
  if (free.length === 0) return { x: 0, y: 0 };
  return free[Math.floor(Math.random() * free.length)];
}

function initialSnake(gridSize: number): Cell[] {
  const mid = Math.floor(gridSize / 2);
  return [
    { x: mid, y: mid },
    { x: mid - 1, y: mid },
    { x: mid - 2, y: mid },
  ];
}

// ── Component ──────────────────────────────────────────────
export default function App() {
  const [gameState, setGameState] = useState<GameState>("idle");
  const [score, setScore] = useState(0);
  const [highScore, setHighScore] = useState(0);
  const [snake, setSnake] = useState<Cell[]>(() => initialSnake(GRID_SIZE));
  const [food, setFood] = useState<Cell>(() => randomFood(initialSnake(GRID_SIZE), GRID_SIZE));
  const [speed, setSpeed] = useState(INITIAL_SPEED);

  const directionRef = useRef<Direction>("RIGHT");
  const nextDirectionRef = useRef<Direction | null>(null);
  const gameStateRef = useRef<GameState>("idle");
  const snakeRef = useRef<Cell[]>(initialSnake(GRID_SIZE));
  const foodRef = useRef<Cell>(food);
  const scoreRef = useRef(0);
  const speedRef = useRef(INITIAL_SPEED);
  const tickTimerRef = useRef<number | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);

  // Keep refs in sync
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);

  // ── Direction input ──────────────────────────────────────
  const changeDirection = useCallback((newDir: Direction) => {
    if (gameStateRef.current !== "playing") return;
    if (OPPOSITES[newDir] !== directionRef.current) {
      nextDirectionRef.current = newDir;
    }
  }, []);

  // ── Game tick ──────────────────────────────────────────────
  const tick = useCallback(() => {
    if (gameStateRef.current !== "playing") return;

    // Apply queued direction
    if (nextDirectionRef.current) {
      const nd = nextDirectionRef.current;
      if (OPPOSITES[nd] !== directionRef.current) {
        directionRef.current = nd;
      }
      nextDirectionRef.current = null;
    }

    const dir = directionRef.current;
    const vec = DIRECTION_VECTORS[dir];
    const currentSnake = snakeRef.current;
    const head = currentSnake[0];

    // Always wrap through walls
    let newHead: Cell = {
      x: ((head.x + vec.x) % GRID_SIZE + GRID_SIZE) % GRID_SIZE,
      y: ((head.y + vec.y) % GRID_SIZE + GRID_SIZE) % GRID_SIZE,
    };

    // Self-collision (exclude tail if not eating, since it moves away)
    const ate = newHead.x === foodRef.current.x && newHead.y === foodRef.current.y;
    const bodyToCheck = ate ? currentSnake : currentSnake.slice(0, -1);
    if (bodyToCheck.some((c) => c.x === newHead.x && c.y === newHead.y)) {
      setGameState("gameover");
      gameStateRef.current = "gameover";
      setHighScore((prev) => Math.max(prev, scoreRef.current));
      return;
    }

    // Move snake
    const newSnake = [newHead, ...currentSnake];
    if (!ate) {
      newSnake.pop();
    }

    snakeRef.current = newSnake;
    setSnake(newSnake);

    if (ate) {
      const newScore = scoreRef.current + POINTS_PER_FOOD;
      scoreRef.current = newScore;
      setScore(newScore);

      const newSpeed = Math.max(MIN_SPEED, speedRef.current - SPEED_DECREASE);
      speedRef.current = newSpeed;
      setSpeed(newSpeed);

      const newFood = randomFood(newSnake, GRID_SIZE);
      foodRef.current = newFood;
      setFood(newFood);
    }
  }, []);

  // ── Game loop ────────────────────────────────────────────
  useEffect(() => {
    if (gameState !== "playing") {
      if (tickTimerRef.current) {
        clearInterval(tickTimerRef.current);
        tickTimerRef.current = null;
      }
      return;
    }

    tickTimerRef.current = window.setInterval(tick, speed);
    return () => {
      if (tickTimerRef.current) {
        clearInterval(tickTimerRef.current);
        tickTimerRef.current = null;
      }
    };
  }, [gameState, speed, tick]);

  // ── Keyboard handler ─────────────────────────────────────
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const keyMap: Record<string, Direction> = {
        ArrowUp: "UP",
        ArrowDown: "DOWN",
        ArrowLeft: "LEFT",
        ArrowRight: "RIGHT",
        w: "UP",
        W: "UP",
        s: "DOWN",
        S: "DOWN",
        a: "LEFT",
        A: "LEFT",
        d: "RIGHT",
        D: "RIGHT",
      };

      if (keyMap[e.key]) {
        e.preventDefault();
        changeDirection(keyMap[e.key]);
      }

      if (e.key === " " || e.key === "Escape") {
        e.preventDefault();
        if (gameStateRef.current === "playing") {
          setGameState("paused");
          gameStateRef.current = "paused";
        } else if (gameStateRef.current === "paused") {
          setGameState("playing");
          gameStateRef.current = "playing";
        }
      }

      if ((e.key === "Enter" || e.key === "r" || e.key === "R") && gameStateRef.current === "gameover") {
        restart();
      }
    };

    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [changeDirection]);

  // ── Touch / Swipe handler ─────────────────────────────────
  useEffect(() => {
    const board = boardRef.current;
    if (!board) return;

    let startX = 0;
    let startY = 0;
    const MIN_SWIPE = 20;

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
    };

    const handleTouchEnd = (e: TouchEvent) => {
      if (gameStateRef.current === "playing") {
        const touch = e.changedTouches[0];
        const dx = touch.clientX - startX;
        const dy = touch.clientY - startY;

        if (Math.abs(dx) < MIN_SWIPE && Math.abs(dy) < MIN_SWIPE) return;

        if (Math.abs(dx) > Math.abs(dy)) {
          changeDirection(dx > 0 ? "RIGHT" : "LEFT");
        } else {
          changeDirection(dy > 0 ? "DOWN" : "UP");
        }
      }

      // Tap to start / pause
      if (gameStateRef.current === "idle") {
        start();
      } else if (gameStateRef.current === "paused") {
        setGameState("playing");
        gameStateRef.current = "playing";
      } else if (gameStateRef.current === "gameover") {
        restart();
      }
    };

    // Prevent scrolling while playing
    const preventScroll = (e: TouchEvent) => {
      if (gameStateRef.current === "playing" || gameStateRef.current === "paused") {
        e.preventDefault();
      }
    };

    board.addEventListener("touchstart", handleTouchStart, { passive: true });
    board.addEventListener("touchend", handleTouchEnd, { passive: true });
    board.addEventListener("touchmove", preventScroll, { passive: false });

    return () => {
      board.removeEventListener("touchstart", handleTouchStart);
      board.removeEventListener("touchend", handleTouchEnd);
      board.removeEventListener("touchmove", preventScroll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [changeDirection]);

  // ── Restart ──────────────────────────────────────────────
  const restart = useCallback(() => {
    const newSnake = initialSnake(GRID_SIZE);
    snakeRef.current = newSnake;
    setSnake(newSnake);
    directionRef.current = "RIGHT";
    nextDirectionRef.current = null;
    const newFood = randomFood(newSnake, GRID_SIZE);
    foodRef.current = newFood;
    setFood(newFood);
    scoreRef.current = 0;
    setScore(0);
    speedRef.current = INITIAL_SPEED;
    setSpeed(INITIAL_SPEED);
    setGameState("playing");
    gameStateRef.current = "playing";
  }, []);

  // ── Start ────────────────────────────────────────────────
  const start = useCallback(() => {
    restart();
  }, [restart]);

  // ── Direction buttons for mobile ─────────────────────────
  const DirButton = ({ dir, label }: { dir: Direction; label: string }) => (
    <button
      onPointerDown={(e) => {
        e.preventDefault();
        changeDirection(dir);
      }}
      onTouchStart={(e) => {
        e.preventDefault();
        changeDirection(dir);
      }}
      className="flex h-14 w-14 items-center justify-center rounded-xl bg-gray-800 text-2xl text-emerald-300 shadow-lg shadow-black/30 active:bg-emerald-900 active:scale-90 transition-all select-none touch-none"
    >
      {label}
    </button>
  );

  // ── Render helpers ───────────────────────────────────────
  const renderCell = (x: number, y: number) => {
    const isSnake = snake.some((c) => c.x === x && c.y === y);
    const isHead = snake.length > 0 && snake[0].x === x && snake[0].y === y;
    const isFood = food.x === x && food.y === y;

    let className = "absolute transition-all duration-75 rounded-sm";

    if (isHead) {
      className += " bg-emerald-300 shadow-inner shadow-emerald-200 scale-[0.85] rounded-full";
    } else if (isSnake) {
      const idx = snake.findIndex((c) => c.x === x && c.y === y);
      if (idx === snake.length - 1) {
        className += " bg-emerald-600 scale-[0.80] rounded-full";
      } else {
        className += " bg-emerald-500 scale-[0.85] rounded-sm";
      }
    } else if (isFood) {
      className += " bg-red-400 scale-[0.75] rounded-full animate-pulse shadow-lg shadow-red-300/50";
    } else {
      className += " bg-transparent";
    }

    if (!isSnake && !isFood) {
      className += " border-[0.5px] border-white/5";
    }

    return (
      <div
        key={`${x}-${y}`}
        className={className}
        style={{
          left: x * CELL_SIZE,
          top: y * CELL_SIZE,
          width: CELL_SIZE,
          height: CELL_SIZE,
        }}
      />
    );
  };

  const boardSize = GRID_SIZE * CELL_SIZE;

  // ── JSX ──────────────────────────────────────────────────
  return (
    <div className="flex min-h-dvh items-center justify-center bg-gray-950 font-mono select-none touch-none">
      <div className="flex flex-col items-center gap-3 p-2 max-w-full">
        {/* Title */}
        <h1 className="text-2xl font-bold tracking-widest text-emerald-400 uppercase drop-shadow-[0_0_12px_rgba(52,211,153,0.3)]">
          🐍 Snake
        </h1>

        {/* Status bar */}
        <div className="flex w-full items-center justify-between text-sm text-gray-400">
          <span>
            Score: <span className="font-bold text-emerald-300">{score}</span>
          </span>
          <span>
            Best: <span className="font-bold text-amber-400">{highScore}</span>
          </span>
          <span className="text-xs">
            Speed:{" "}
            <span className="font-bold text-cyan-400">
              {Math.round((INITIAL_SPEED - speed) / SPEED_DECREASE)}
            </span>
          </span>
        </div>

        {/* Game board */}
        <div
          ref={boardRef}
          className="relative overflow-hidden rounded-xl border-2 border-emerald-800/60 bg-gray-900 shadow-[0_0_40px_rgba(52,211,153,0.08)]"
          style={{ width: boardSize, height: boardSize }}
        >
          {/* Grid cells */}
          {Array.from({ length: GRID_SIZE * GRID_SIZE }).map((_, i) => {
            const x = i % GRID_SIZE;
            const y = Math.floor(i / GRID_SIZE);
            return renderCell(x, y);
          })}

          {/* Overlays */}
          {gameState === "idle" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm">
              <p className="mb-2 text-2xl font-bold text-emerald-400">🐍 Snake</p>
              <p className="mb-6 max-w-56 text-center text-sm leading-relaxed text-gray-400">
                Swipe or use the buttons to move.
                <br />
                The snake wraps through walls!
                <br />
                Don't hit yourself!
              </p>
              <button
                onClick={start}
                className="rounded-lg bg-emerald-600 px-10 py-3 text-lg font-bold text-white shadow-lg shadow-emerald-900/50 transition-all hover:bg-emerald-500 active:scale-95"
              >
                Play
              </button>
            </div>
          )}

          {gameState === "paused" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-[2px]">
              <p className="mb-2 text-2xl font-bold text-amber-400">⏸ Paused</p>
              <p className="text-sm text-gray-400">Tap or press Space to resume</p>
            </div>
          )}

          {gameState === "gameover" && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 backdrop-blur-sm">
              <p className="mb-1 text-3xl">💀</p>
              <p className="mb-1 text-xl font-bold text-red-400">Game Over</p>
              <p className="mb-4 text-gray-400">
                Score: <span className="font-bold text-emerald-300">{score}</span>
              </p>
              <button
                onClick={restart}
                className="rounded-lg bg-emerald-600 px-10 py-3 text-lg font-bold text-white shadow-lg shadow-emerald-900/50 transition-all hover:bg-emerald-500 active:scale-95"
              >
                Play Again
              </button>
            </div>
          )}
        </div>

        {/* D-Pad for mobile */}
        <div className="mt-2 grid grid-cols-3 grid-rows-3 gap-1.5">
          <div /> {/* empty top-left */}
          <DirButton dir="UP" label="▲" />
          <div /> {/* empty top-right */}
          <DirButton dir="LEFT" label="◀" />
          <div className="flex items-center justify-center rounded-xl bg-gray-800/50 text-gray-500 text-xs">
            ⏺
          </div>
          <DirButton dir="RIGHT" label="▶" />
          <div /> {/* empty bottom-left */}
          <DirButton dir="DOWN" label="▼" />
          <div /> {/* empty bottom-right */}
        </div>

        {/* Controls hint */}
        <div className="flex flex-wrap items-center justify-center gap-2 text-[10px] text-gray-500">
          <span>Swipe or D-Pad</span>
          <span className="text-gray-700">|</span>
          <span>Tap to pause</span>
        </div>
      </div>
    </div>
  );
}
