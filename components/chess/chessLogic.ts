// ─── Types ───────────────────────────────────────────────────────────────────

export type Color = 'white' | 'black'
export type PieceType = 'king' | 'queen' | 'rook' | 'bishop' | 'knight' | 'pawn'

export interface Piece {
  type: PieceType
  color: Color
}

export type Square = Piece | null
export type Board = Square[][]  // [row 0..7][col 0..7], row 0 = rank 8 (black back rank)

export interface CastlingRights {
  whiteKingside: boolean
  whiteQueenside: boolean
  blackKingside: boolean
  blackQueenside: boolean
}

export interface GameState {
  board: Board
  turn: Color
  castling: CastlingRights
  enPassantTarget: [number, number] | null  // [row, col] of the capture square
  halfMoveClock: number
  fullMoveNumber: number
  status: 'playing' | 'checkmate' | 'stalemate' | 'draw'
  winner: Color | null
  capturedByWhite: Piece[]
  capturedByBlack: Piece[]
  lastMove: { from: [number, number]; to: [number, number] } | null
  moveHistory: string[]
}

// ─── Initial board ────────────────────────────────────────────────────────────

export function createInitialBoard(): Board {
  const board: Board = Array.from({ length: 8 }, () => Array(8).fill(null))

  const backRank: PieceType[] = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook']

  // Black back rank (row 0)
  backRank.forEach((type, col) => {
    board[0][col] = { type, color: 'black' }
  })
  // Black pawns (row 1)
  for (let col = 0; col < 8; col++) {
    board[1][col] = { type: 'pawn', color: 'black' }
  }
  // White pawns (row 6)
  for (let col = 0; col < 8; col++) {
    board[6][col] = { type: 'pawn', color: 'white' }
  }
  // White back rank (row 7)
  backRank.forEach((type, col) => {
    board[7][col] = { type, color: 'white' }
  })

  return board
}

export function createInitialState(): GameState {
  return {
    board: createInitialBoard(),
    turn: 'white',
    castling: {
      whiteKingside: true,
      whiteQueenside: true,
      blackKingside: true,
      blackQueenside: true,
    },
    enPassantTarget: null,
    halfMoveClock: 0,
    fullMoveNumber: 1,
    status: 'playing',
    winner: null,
    capturedByWhite: [],
    capturedByBlack: [],
    lastMove: null,
    moveHistory: [],
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function inBounds(row: number, col: number): boolean {
  return row >= 0 && row < 8 && col >= 0 && col < 8
}

function cloneBoard(board: Board): Board {
  return board.map((row) => [...row])
}

function findKing(board: Board, color: Color): [number, number] {
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const p = board[r][c]
      if (p && p.type === 'king' && p.color === color) return [r, c]
    }
  }
  throw new Error(`King not found for ${color}`)
}

// ─── Attack map (squares attacked by a side, ignoring king-safety) ────────────

export function getAttackedSquares(board: Board, byColor: Color): Set<string> {
  const attacked = new Set<string>()

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c]
      if (!piece || piece.color !== byColor) continue

      const targets = getRawMoves(board, r, c, null)
      for (const [tr, tc] of targets) {
        attacked.add(`${tr},${tc}`)
      }
    }
  }

  return attacked
}

// Raw moves: where a piece *attacks* (not safe — doesn't check for leaving king in check)
function getRawMoves(
  board: Board,
  row: number,
  col: number,
  enPassantTarget: [number, number] | null
): [number, number][] {
  const piece = board[row][col]
  if (!piece) return []

  const moves: [number, number][] = []
  const { type, color } = piece

  const pushSliding = (dr: number, dc: number) => {
    let r = row + dr
    let c = col + dc
    while (inBounds(r, c)) {
      if (board[r][c]) {
        if (board[r][c]!.color !== color) moves.push([r, c])
        break
      }
      moves.push([r, c])
      r += dr
      c += dc
    }
  }

  switch (type) {
    case 'pawn': {
      const dir = color === 'white' ? -1 : 1
      // Attacks (diagonal only, for raw attack map)
      const attackSquares: [number, number][] = [
        [row + dir, col - 1],
        [row + dir, col + 1],
      ]
      for (const [r, c] of attackSquares) {
        if (inBounds(r, c)) moves.push([r, c])
      }
      break
    }
    case 'knight': {
      const jumps: [number, number][] = [
        [-2, -1], [-2, 1], [-1, -2], [-1, 2],
        [1, -2], [1, 2], [2, -1], [2, 1],
      ]
      for (const [dr, dc] of jumps) {
        const r = row + dr
        const c = col + dc
        if (inBounds(r, c) && board[r][c]?.color !== color) moves.push([r, c])
      }
      break
    }
    case 'bishop':
      pushSliding(-1, -1)
      pushSliding(-1, 1)
      pushSliding(1, -1)
      pushSliding(1, 1)
      break
    case 'rook':
      pushSliding(-1, 0)
      pushSliding(1, 0)
      pushSliding(0, -1)
      pushSliding(0, 1)
      break
    case 'queen':
      pushSliding(-1, -1)
      pushSliding(-1, 1)
      pushSliding(1, -1)
      pushSliding(1, 1)
      pushSliding(-1, 0)
      pushSliding(1, 0)
      pushSliding(0, -1)
      pushSliding(0, 1)
      break
    case 'king': {
      const dirs: [number, number][] = [
        [-1, -1], [-1, 0], [-1, 1],
        [0, -1],           [0, 1],
        [1, -1],  [1, 0],  [1, 1],
      ]
      for (const [dr, dc] of dirs) {
        const r = row + dr
        const c = col + dc
        if (inBounds(r, c) && board[r][c]?.color !== color) moves.push([r, c])
      }
      break
    }
  }

  return moves
}

// ─── Is king in check? ────────────────────────────────────────────────────────

export function isInCheck(board: Board, color: Color): boolean {
  const [kr, kc] = findKing(board, color)
  const opponent: Color = color === 'white' ? 'black' : 'white'
  const attacked = getAttackedSquares(board, opponent)
  return attacked.has(`${kr},${kc}`)
}

// ─── Legal moves ─────────────────────────────────────────────────────────────

export function getLegalMoves(
  state: GameState,
  row: number,
  col: number
): [number, number][] {
  const { board, enPassantTarget, castling } = state
  const piece = board[row][col]
  if (!piece) return []

  const color = piece.color
  const moves: [number, number][] = []

  // --- Pawn moves (non-attacking) + captures + en passant ---
  if (piece.type === 'pawn') {
    const dir = color === 'white' ? -1 : 1
    const startRow = color === 'white' ? 6 : 1

    // Forward one
    if (inBounds(row + dir, col) && !board[row + dir][col]) {
      moves.push([row + dir, col])
      // Forward two from starting position
      if (row === startRow && !board[row + 2 * dir][col]) {
        moves.push([row + 2 * dir, col])
      }
    }

    // Diagonal captures
    for (const dc of [-1, 1]) {
      const r = row + dir
      const c = col + dc
      if (inBounds(r, c)) {
        if (board[r][c] && board[r][c]!.color !== color) {
          moves.push([r, c])
        }
        // En passant
        if (enPassantTarget && enPassantTarget[0] === r && enPassantTarget[1] === c) {
          moves.push([r, c])
        }
      }
    }
  } else if (piece.type === 'king') {
    // Normal king moves
    const rawKingMoves = getRawMoves(board, row, col, enPassantTarget)
    for (const [r, c] of rawKingMoves) {
      moves.push([r, c])
    }

    // Castling
    const opponent: Color = color === 'white' ? 'black' : 'white'
    const enemyAttacked = getAttackedSquares(board, opponent)
    const kingRow = color === 'white' ? 7 : 0

    if (row === kingRow && col === 4 && !enemyAttacked.has(`${kingRow},4`)) {
      // Kingside
      const ksCan = color === 'white' ? castling.whiteKingside : castling.blackKingside
      if (
        ksCan &&
        !board[kingRow][5] &&
        !board[kingRow][6] &&
        board[kingRow][7]?.type === 'rook' &&
        board[kingRow][7]?.color === color &&
        !enemyAttacked.has(`${kingRow},5`) &&
        !enemyAttacked.has(`${kingRow},6`)
      ) {
        moves.push([kingRow, 6])
      }
      // Queenside
      const qsCan = color === 'white' ? castling.whiteQueenside : castling.blackQueenside
      if (
        qsCan &&
        !board[kingRow][3] &&
        !board[kingRow][2] &&
        !board[kingRow][1] &&
        board[kingRow][0]?.type === 'rook' &&
        board[kingRow][0]?.color === color &&
        !enemyAttacked.has(`${kingRow},3`) &&
        !enemyAttacked.has(`${kingRow},2`)
      ) {
        moves.push([kingRow, 2])
      }
    }
  } else {
    const rawMoves = getRawMoves(board, row, col, enPassantTarget)
    for (const [r, c] of rawMoves) {
      moves.push([r, c])
    }
  }

  // Filter moves that leave the king in check
  const legal = moves.filter(([tr, tc]) => {
    const testBoard = cloneBoard(board)
    applyMoveOnBoard(testBoard, row, col, tr, tc, enPassantTarget)
    return !isInCheck(testBoard, color)
  })

  return legal
}

// Apply a move on a board (mutates) — used for check testing and actual moves
function applyMoveOnBoard(
  board: Board,
  fromRow: number,
  fromCol: number,
  toRow: number,
  toCol: number,
  enPassantTarget: [number, number] | null
) {
  const piece = board[fromRow][fromCol]!
  board[toRow][toCol] = piece
  board[fromRow][fromCol] = null

  // En passant capture
  if (piece.type === 'pawn' && enPassantTarget && toRow === enPassantTarget[0] && toCol === enPassantTarget[1]) {
    const capturedPawnRow = piece.color === 'white' ? toRow + 1 : toRow - 1
    board[capturedPawnRow][toCol] = null
  }

  // Castling — move the rook
  if (piece.type === 'king') {
    const colDiff = toCol - fromCol
    if (colDiff === 2) {
      // Kingside
      board[toRow][5] = board[toRow][7]
      board[toRow][7] = null
    } else if (colDiff === -2) {
      // Queenside
      board[toRow][3] = board[toRow][0]
      board[toRow][0] = null
    }
  }
}

// ─── Apply move to game state ─────────────────────────────────────────────────

export function applyMove(
  state: GameState,
  fromRow: number,
  fromCol: number,
  toRow: number,
  toCol: number,
  promotionPiece: PieceType = 'queen'
): GameState {
  const board = cloneBoard(state.board)
  const piece = board[fromRow][fromCol]!
  const captured = board[toRow][toCol]
  const opponent: Color = piece.color === 'white' ? 'black' : 'white'

  const capturedByWhite = [...state.capturedByWhite]
  const capturedByBlack = [...state.capturedByBlack]

  // Track captures
  if (captured) {
    if (piece.color === 'white') capturedByWhite.push(captured)
    else capturedByBlack.push(captured)
  }

  // En passant capture — track the pawn
  let enPassantCapture: Piece | null = null
  if (piece.type === 'pawn' && state.enPassantTarget && toRow === state.enPassantTarget[0] && toCol === state.enPassantTarget[1]) {
    const capRow = piece.color === 'white' ? toRow + 1 : toRow - 1
    enPassantCapture = board[capRow][toCol]
    if (enPassantCapture) {
      if (piece.color === 'white') capturedByWhite.push(enPassantCapture)
      else capturedByBlack.push(enPassantCapture)
    }
  }

  applyMoveOnBoard(board, fromRow, fromCol, toRow, toCol, state.enPassantTarget)

  // Pawn promotion
  if (piece.type === 'pawn' && (toRow === 0 || toRow === 7)) {
    board[toRow][toCol] = { type: promotionPiece, color: piece.color }
  }

  // New en passant target
  let newEnPassant: [number, number] | null = null
  if (piece.type === 'pawn' && Math.abs(toRow - fromRow) === 2) {
    newEnPassant = [(fromRow + toRow) / 2, toCol]
  }

  // Update castling rights
  const castling = { ...state.castling }
  if (piece.type === 'king') {
    if (piece.color === 'white') {
      castling.whiteKingside = false
      castling.whiteQueenside = false
    } else {
      castling.blackKingside = false
      castling.blackQueenside = false
    }
  }
  if (piece.type === 'rook') {
    if (fromRow === 7 && fromCol === 7) castling.whiteKingside = false
    if (fromRow === 7 && fromCol === 0) castling.whiteQueenside = false
    if (fromRow === 0 && fromCol === 7) castling.blackKingside = false
    if (fromRow === 0 && fromCol === 0) castling.blackQueenside = false
  }

  const halfMoveClock = piece.type === 'pawn' || captured ? 0 : state.halfMoveClock + 1
  const fullMoveNumber = piece.color === 'black' ? state.fullMoveNumber + 1 : state.fullMoveNumber

  // Check game status for opponent
  const opponentHasLegalMoves = hasAnyLegalMove(board, opponent, newEnPassant, castling)
  const opponentInCheck = isInCheck(board, opponent)

  let status: GameState['status'] = 'playing'
  let winner: Color | null = null

  if (!opponentHasLegalMoves) {
    if (opponentInCheck) {
      status = 'checkmate'
      winner = piece.color
    } else {
      status = 'stalemate'
    }
  } else if (halfMoveClock >= 100) {
    status = 'draw'
  }

  return {
    board,
    turn: opponent,
    castling,
    enPassantTarget: newEnPassant,
    halfMoveClock,
    fullMoveNumber,
    status,
    winner,
    capturedByWhite,
    capturedByBlack,
    lastMove: { from: [fromRow, fromCol], to: [toRow, toCol] },
    moveHistory: [...state.moveHistory, generateNotation(
      state.board, piece, fromRow, fromCol, toRow, toCol,
      !!captured || !!enPassantCapture,
      promotionPiece,
      status === 'checkmate',
      status === 'playing' && isInCheck(board, opponent),
    )],
  }
}

function hasAnyLegalMove(
  board: Board,
  color: Color,
  enPassantTarget: [number, number] | null,
  castling: CastlingRights
): boolean {
  const fakeState: GameState = {
    board,
    turn: color,
    castling,
    enPassantTarget,
    halfMoveClock: 0,
    fullMoveNumber: 1,
    status: 'playing',
    winner: null,
    capturedByWhite: [],
    capturedByBlack: [],
    lastMove: null,
    moveHistory: [],
  }

  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const piece = board[r][c]
      if (piece && piece.color === color) {
        const moves = getLegalMoves(fakeState, r, c)
        if (moves.length > 0) return true
      }
    }
  }
  return false
}

// ─── Move notation (Standard Algebraic Notation) ─────────────────────────────

const PIECE_LETTER: Record<PieceType, string> = {
  king: 'K',
  queen: 'Q',
  rook: 'R',
  bishop: 'B',
  knight: 'N',
  pawn: '',
}

function colToFile(col: number): string {
  return String.fromCharCode(97 + col) // a-h
}

function rowToRank(row: number): string {
  return String(8 - row) // 1-8
}

function squareName(row: number, col: number): string {
  return colToFile(col) + rowToRank(row)
}

function generateNotation(
  boardBefore: Board,
  piece: Piece,
  fromRow: number,
  fromCol: number,
  toRow: number,
  toCol: number,
  isCapture: boolean,
  promotionPiece: PieceType,
  isCheckmate: boolean,
  isCheck: boolean,
): string {
  // Castling
  if (piece.type === 'king' && Math.abs(toCol - fromCol) === 2) {
    const notation = toCol > fromCol ? 'O-O' : 'O-O-O'
    if (isCheckmate) return notation + '#'
    if (isCheck) return notation + '+'
    return notation
  }

  let notation = ''

  // Piece letter (pawns don't get one)
  notation += PIECE_LETTER[piece.type]

  // Disambiguation: if another piece of same type+color can also reach the target
  if (piece.type !== 'pawn') {
    const ambiguous: [number, number][] = []
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (r === fromRow && c === fromCol) continue
        const other = boardBefore[r][c]
        if (other && other.type === piece.type && other.color === piece.color) {
          ambiguous.push([r, c])
        }
      }
    }

    if (ambiguous.length > 0) {
      const needFile = ambiguous.some(([, c]) => c !== fromCol) || ambiguous.some(([r]) => r === fromRow)
      const needRank = ambiguous.some(([r]) => r !== fromRow) || ambiguous.some(([, c]) => c === fromCol)
      
      if (needFile) notation += colToFile(fromCol)
      if (needRank && ambiguous.some(([, c]) => c === fromCol)) notation += rowToRank(fromRow)
    }
  }

  // Pawn captures include the file
  if (piece.type === 'pawn' && isCapture) {
    notation += colToFile(fromCol)
  }

  // Capture symbol
  if (isCapture) notation += 'x'

  // Destination square
  notation += squareName(toRow, toCol)

  // Promotion
  if (piece.type === 'pawn' && (toRow === 0 || toRow === 7)) {
    notation += '=' + PIECE_LETTER[promotionPiece]
  }

  // Check / checkmate
  if (isCheckmate) notation += '#'
  else if (isCheck) notation += '+'

  return notation
}
