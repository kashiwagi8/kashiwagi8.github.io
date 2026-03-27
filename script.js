const BOARD_SIZE = 12;
const SENTE = "sente";
const GOTE = "gote";

const PIECE_LABELS = {
  K: "王",
  L: "獅",
  R: "飛",
  B: "角",
  G: "金",
  P: "歩",
  PR: "龍",
  PB: "馬",
  T: "と",
};

const PIECE_VALUES = {
  K: 100000,
  L: 900,
  R: 700,
  B: 620,
  G: 380,
  P: 120,
  PR: 900,
  PB: 840,
  T: 300,
};

const DIRECTIONS = {
  king: [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ],
  rook: [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ],
  bishop: [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ],
};

const boardEl = document.getElementById("board");
const turnLabelEl = document.getElementById("turnLabel");
const statusMessageEl = document.getElementById("statusMessage");
const resetButtonEl = document.getElementById("resetButton");
const aiDepthEl = document.getElementById("aiDepth");

let gameState = createInitialState();
let selected = null;
let legalMoves = [];
let gameOver = false;

function createPiece(owner, type, promoted = false) {
  return { owner, type, promoted };
}

function createEmptyBoard() {
  return Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill(null));
}

function createInitialState() {
  const board = createEmptyBoard();

  // 後手陣
  board[0][5] = createPiece(GOTE, "K");
  board[0][4] = createPiece(GOTE, "L");
  board[1][2] = createPiece(GOTE, "R");
  board[1][9] = createPiece(GOTE, "B");
  board[1][5] = createPiece(GOTE, "G");
  for (let col = 2; col <= 9; col += 1) {
    board[2][col] = createPiece(GOTE, "P");
  }

  // 先手陣
  board[11][6] = createPiece(SENTE, "K");
  board[11][7] = createPiece(SENTE, "L");
  board[10][9] = createPiece(SENTE, "R");
  board[10][2] = createPiece(SENTE, "B");
  board[10][6] = createPiece(SENTE, "G");
  for (let col = 2; col <= 9; col += 1) {
    board[9][col] = createPiece(SENTE, "P");
  }

  return {
    board,
    currentPlayer: SENTE,
    winner: null,
  };
}

function pieceCode(piece) {
  if (!piece) return "";
  if (piece.type === "R" && piece.promoted) return "PR";
  if (piece.type === "B" && piece.promoted) return "PB";
  if (piece.type === "P" && piece.promoted) return "T";
  return piece.type;
}

function inBounds(row, col) {
  return row >= 0 && row < BOARD_SIZE && col >= 0 && col < BOARD_SIZE;
}

function cloneBoard(board) {
  return board.map((row) => row.map((piece) => (piece ? { ...piece } : null)));
}

function sliderMoves(board, row, col, owner, vectors) {
  const moves = [];
  for (const [dr, dc] of vectors) {
    let r = row + dr;
    let c = col + dc;
    while (inBounds(r, c)) {
      const target = board[r][c];
      if (!target) {
        moves.push({ from: [row, col], to: [r, c], capture: false });
      } else {
        if (target.owner !== owner) {
          moves.push({ from: [row, col], to: [r, c], capture: true });
        }
        break;
      }
      r += dr;
      c += dc;
    }
  }
  return moves;
}

function stepMoves(board, row, col, owner, vectors, maxStep = 1) {
  const moves = [];
  for (const [dr, dc] of vectors) {
    for (let step = 1; step <= maxStep; step += 1) {
      const r = row + dr * step;
      const c = col + dc * step;
      if (!inBounds(r, c)) {
        break;
      }
      const target = board[r][c];
      if (!target) {
        moves.push({ from: [row, col], to: [r, c], capture: false });
      } else {
        if (target.owner !== owner) {
          moves.push({ from: [row, col], to: [r, c], capture: true });
        }
        break;
      }
    }
  }
  return moves;
}

function pawnMoves(board, row, col, owner) {
  const forward = owner === SENTE ? -1 : 1;
  const r = row + forward;
  const c = col;
  if (!inBounds(r, c)) return [];
  const target = board[r][c];
  if (!target) {
    return [{ from: [row, col], to: [r, c], capture: false }];
  }
  if (target.owner !== owner) {
    return [{ from: [row, col], to: [r, c], capture: true }];
  }
  return [];
}

function goldMoves(board, row, col, owner) {
  const forward = owner === SENTE ? -1 : 1;
  const vectors = [
    [forward, 0],
    [forward, 1],
    [forward, -1],
    [0, 1],
    [0, -1],
    [-forward, 0],
  ];
  return stepMoves(board, row, col, owner, vectors, 1);
}

function lionMoves(board, row, col, owner) {
  const vectors = [];
  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      if (dr === 0 && dc === 0) continue;
      vectors.push([dr, dc]);
    }
  }
  return stepMoves(board, row, col, owner, vectors, 2);
}

function pseudoLegalMovesForPiece(board, row, col) {
  const piece = board[row][col];
  if (!piece) return [];
  const code = pieceCode(piece);

  switch (code) {
    case "K":
      return stepMoves(board, row, col, piece.owner, DIRECTIONS.king, 1);
    case "L":
      return lionMoves(board, row, col, piece.owner);
    case "R":
      return sliderMoves(board, row, col, piece.owner, DIRECTIONS.rook);
    case "B":
      return sliderMoves(board, row, col, piece.owner, DIRECTIONS.bishop);
    case "G":
    case "T":
      return goldMoves(board, row, col, piece.owner);
    case "P":
      return pawnMoves(board, row, col, piece.owner);
    case "PR": {
      const rook = sliderMoves(board, row, col, piece.owner, DIRECTIONS.rook);
      const king = stepMoves(board, row, col, piece.owner, DIRECTIONS.king, 1);
      return [...rook, ...king];
    }
    case "PB": {
      const bishop = sliderMoves(board, row, col, piece.owner, DIRECTIONS.bishop);
      const king = stepMoves(board, row, col, piece.owner, DIRECTIONS.king, 1);
      return [...bishop, ...king];
    }
    default:
      return [];
  }
}

function shouldPromote(piece, toRow) {
  if (piece.promoted) return false;
  if (!["P", "R", "B"].includes(piece.type)) return false;

  if (piece.owner === SENTE) {
    return toRow <= 2;
  }
  return toRow >= BOARD_SIZE - 3;
}

function applyMove(state, move) {
  const nextBoard = cloneBoard(state.board);
  const [fromR, fromC] = move.from;
  const [toR, toC] = move.to;

  const movingPiece = { ...nextBoard[fromR][fromC] };
  nextBoard[fromR][fromC] = null;

  let winner = null;
  const target = nextBoard[toR][toC];
  if (target && target.type === "K") {
    winner = movingPiece.owner;
  }

  if (shouldPromote(movingPiece, toR)) {
    movingPiece.promoted = true;
  }

  nextBoard[toR][toC] = movingPiece;

  return {
    board: nextBoard,
    currentPlayer: state.currentPlayer === SENTE ? GOTE : SENTE,
    winner,
  };
}

function findKing(board, owner) {
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const piece = board[row][col];
      if (piece && piece.owner === owner && piece.type === "K") {
        return [row, col];
      }
    }
  }
  return null;
}

function isInCheck(board, owner) {
  const kingPos = findKing(board, owner);
  if (!kingPos) return true;
  const [kRow, kCol] = kingPos;
  const enemy = owner === SENTE ? GOTE : SENTE;

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const piece = board[row][col];
      if (!piece || piece.owner !== enemy) continue;
      const enemyMoves = pseudoLegalMovesForPiece(board, row, col);
      if (enemyMoves.some((m) => m.to[0] === kRow && m.to[1] === kCol)) {
        return true;
      }
    }
  }
  return false;
}

function legalMovesForPiece(state, row, col) {
  const piece = state.board[row][col];
  if (!piece || piece.owner !== state.currentPlayer) return [];

  const candidates = pseudoLegalMovesForPiece(state.board, row, col);
  return candidates.filter((move) => {
    const next = applyMove({ ...state, winner: null }, move);
    return !isInCheck(next.board, piece.owner);
  });
}

function allLegalMoves(state, owner = state.currentPlayer) {
  const moves = [];
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const piece = state.board[row][col];
      if (!piece || piece.owner !== owner) continue;

      const baseState = { ...state, currentPlayer: owner };
      const pieceMoves = legalMovesForPiece(baseState, row, col);
      moves.push(...pieceMoves);
    }
  }
  return moves;
}

function evaluateBoard(state) {
  if (state.winner === GOTE) return 999999;
  if (state.winner === SENTE) return -999999;

  let score = 0;
  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const piece = state.board[row][col];
      if (!piece) continue;
      const value = PIECE_VALUES[pieceCode(piece)] || 0;
      if (piece.owner === GOTE) {
        score += value;
      } else {
        score -= value;
      }
    }
  }

  const goteMobility = allLegalMoves({ ...state, currentPlayer: GOTE }, GOTE).length;
  const senteMobility = allLegalMoves({ ...state, currentPlayer: SENTE }, SENTE).length;
  score += (goteMobility - senteMobility) * 2;

  return score;
}

function minimax(state, depth, alpha, beta, maximizingPlayer) {
  if (depth === 0 || state.winner) {
    return { score: evaluateBoard(state), move: null };
  }

  const owner = maximizingPlayer ? GOTE : SENTE;
  const moves = allLegalMoves({ ...state, currentPlayer: owner }, owner);

  if (moves.length === 0) {
    const terminal = {
      ...state,
      winner: maximizingPlayer ? SENTE : GOTE,
    };
    return { score: evaluateBoard(terminal), move: null };
  }

  let bestMove = moves[0];

  if (maximizingPlayer) {
    let bestScore = -Infinity;
    for (const move of moves) {
      const next = applyMove({ ...state, currentPlayer: owner, winner: null }, move);
      const result = minimax(next, depth - 1, alpha, beta, false);
      if (result.score > bestScore) {
        bestScore = result.score;
        bestMove = move;
      }
      alpha = Math.max(alpha, result.score);
      if (beta <= alpha) break;
    }
    return { score: bestScore, move: bestMove };
  }

  let bestScore = Infinity;
  for (const move of moves) {
    const next = applyMove({ ...state, currentPlayer: owner, winner: null }, move);
    const result = minimax(next, depth - 1, alpha, beta, true);
    if (result.score < bestScore) {
      bestScore = result.score;
      bestMove = move;
    }
    beta = Math.min(beta, result.score);
    if (beta <= alpha) break;
  }
  return { score: bestScore, move: bestMove };
}

function squareKey(row, col) {
  return `${row}-${col}`;
}

function renderBoard() {
  boardEl.innerHTML = "";
  const moveMap = new Map(legalMoves.map((m) => [squareKey(m.to[0], m.to[1]), m]));

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let col = 0; col < BOARD_SIZE; col += 1) {
      const square = document.createElement("button");
      square.type = "button";
      square.className = `square ${(row + col) % 2 === 0 ? "light" : "dark"}`;
      square.dataset.row = String(row);
      square.dataset.col = String(col);

      const key = squareKey(row, col);
      const move = moveMap.get(key);
      if (selected && selected[0] === row && selected[1] === col) {
        square.classList.add("selected");
      }
      if (move) {
        square.classList.add(move.capture ? "capture" : "legal");
      }

      const piece = gameState.board[row][col];
      if (piece) {
        const pieceEl = document.createElement("span");
        pieceEl.className = `piece ${piece.owner}`;
        pieceEl.textContent = PIECE_LABELS[pieceCode(piece)] || piece.type;
        square.appendChild(pieceEl);
      }

      square.addEventListener("click", onSquareClick);
      boardEl.appendChild(square);
    }
  }
}

function updateStatus(message) {
  turnLabelEl.textContent =
    gameState.currentPlayer === SENTE ? "先手（あなた）" : "後手（AI）";
  statusMessageEl.textContent = message;
}

function moveEquals(a, b) {
  return (
    a.from[0] === b.from[0] &&
    a.from[1] === b.from[1] &&
    a.to[0] === b.to[0] &&
    a.to[1] === b.to[1]
  );
}

function onSquareClick(event) {
  if (gameOver || gameState.currentPlayer !== SENTE) return;

  const row = Number(event.currentTarget.dataset.row);
  const col = Number(event.currentTarget.dataset.col);
  const clickedPiece = gameState.board[row][col];

  if (selected) {
    const chosenMove = legalMoves.find((m) => m.to[0] === row && m.to[1] === col);
    if (chosenMove) {
      performMove(chosenMove);
      return;
    }
  }

  if (clickedPiece && clickedPiece.owner === SENTE) {
    selected = [row, col];
    legalMoves = legalMovesForPiece(gameState, row, col);
    renderBoard();
    updateStatus(legalMoves.length > 0 ? "移動先を選択してください。" : "その駒は動かせません。");
    return;
  }

  selected = null;
  legalMoves = [];
  renderBoard();
  updateStatus("駒を選択してください。");
}

function announceWinner(owner) {
  gameOver = true;
  selected = null;
  legalMoves = [];
  renderBoard();
  if (owner === SENTE) {
    updateStatus("あなたの勝ちです！");
  } else if (owner === GOTE) {
    updateStatus("AIの勝ちです。再戦してみましょう。");
  }
}

function performMove(move) {
  gameState = applyMove(gameState, move);
  selected = null;
  legalMoves = [];
  renderBoard();

  if (gameState.winner) {
    announceWinner(gameState.winner);
    return;
  }

  const nextMoves = allLegalMoves(gameState);
  if (nextMoves.length === 0) {
    gameOver = true;
    updateStatus("合法手がなくなりました。引き分け扱いです。");
    return;
  }

  updateStatus("AIが考えています...");

  if (gameState.currentPlayer === GOTE) {
    window.setTimeout(aiTurn, 40);
  }
}

function aiTurn() {
  if (gameOver || gameState.currentPlayer !== GOTE) return;

  const depth = Number(aiDepthEl.value);
  const result = minimax(gameState, depth, -Infinity, Infinity, true);

  if (!result.move) {
    gameOver = true;
    updateStatus("AIに合法手がありません。あなたの勝ちです！");
    return;
  }

  gameState = applyMove(gameState, result.move);
  renderBoard();

  if (gameState.winner) {
    announceWinner(gameState.winner);
    return;
  }

  const playerMoves = allLegalMoves(gameState);
  if (playerMoves.length === 0) {
    gameOver = true;
    updateStatus("合法手がありません。AIの勝ちです。");
    return;
  }

  updateStatus("あなたの手番です。駒を選択してください。");
}

function resetGame() {
  gameState = createInitialState();
  selected = null;
  legalMoves = [];
  gameOver = false;
  renderBoard();
  updateStatus("駒を選択してください。");
}

resetButtonEl.addEventListener("click", resetGame);

resetGame();
