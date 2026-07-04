import {
  ChessClient,
  GameStateDto,
  MakeMoveDto,
  GameStatus,
  GameMode,
  Player,
  GameMove,
  PagedResultDto_1OfOfGameStateDtoAndAPIAnd_0AndCulture_neutralAndPublicKeyToken_null as PagedGames,
} from './generated/ChessAPI'

export type { GameStateDto, MakeMoveDto, PagedGames, GameMove }
export { GameStatus, Player, GameMode }

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'https://localhost:44322'

const api = new ChessClient(API_BASE_URL)

// ─── Game lifecycle ───────────────────────────────────────────────────────────

/** Create a new game on the server. Returns the game ID. */
export async function createGame(mode: GameMode): Promise<string | null> {
  // The server returns an `id` field in the response, but GameStateDto doesn't define it.
  // We intercept the raw axios response to extract it.
  const axiosInstance = (api as unknown as { instance: import('axios').AxiosInstance }).instance
  const baseUrl = (api as unknown as { baseUrl: string }).baseUrl
  const response = await axiosInstance.post(`${baseUrl}/api/Chess/CreateGame?GameMode=${encodeURIComponent(mode)}`)
  return response.data?.id ?? null
}

/** Send a move in UCI notation (e.g. "e2e4", "g1f3"). Returns updated game state including any computer response move. */
export async function makeMove(gameId: string, moveUci: string): Promise<{ status: string; winner: string | null; computerMoveUci: string | null }> {
  const axiosInstance = (api as unknown as { instance: import('axios').AxiosInstance }).instance
  const baseUrl = (api as unknown as { baseUrl: string }).baseUrl
  const response = await axiosInstance.post(
    `${baseUrl}/api/Chess/UpdateGame?GameId=${encodeURIComponent(gameId)}&MoveUci=${encodeURIComponent(moveUci)}`
  )
  const data = response.data
  const moves = data?.moves as Array<{ moveUci?: string; player?: string }> | undefined
  
  // In VsComputer mode, the last move in the list is the computer's response
  const lastMove = moves && moves.length > 0 ? moves[moves.length - 1] : null
  const computerMoveUci = lastMove?.player === 'Black' ? (lastMove.moveUci ?? null) : null

  console.log('Server response:', { status: data?.status, movesCount: moves?.length, lastMove, computerMoveUci })

  return {
    status: data?.status ?? 'InProgress',
    winner: data?.winner ?? null,
    computerMoveUci,
  }
}

/** Alternative: make a move via request body. */
export async function makeMoveViaBody(move: MakeMoveDto): Promise<GameStateDto> {
  return api.chessPUT(move)
}

// ─── Game retrieval ───────────────────────────────────────────────────────────

/** Get a game by ID (custom endpoint). */
export async function getGame(id: string): Promise<GameStateDto> {
  return api.getGame(id)
}

/** Get a game by ID (CRUD endpoint). */
export async function getGameById(id: string): Promise<GameStateDto> {
  return api.chessGET2(id)
}

/** List games with pagination. */
export async function listGames(
  sorting?: string,
  skipCount?: number,
  maxResultCount?: number
): Promise<PagedGames> {
  return api.chessGET(sorting, skipCount, maxResultCount)
}

// ─── Game management ──────────────────────────────────────────────────────────

/** Start a new game (ABP app service endpoint). */
export async function startNewGame(mode: GameMode): Promise<GameStateDto> {
  return api.chessPOST(mode)
}

/** Delete a game. */
export async function deleteGame(id: string): Promise<void> {
  return api.chessDELETE(id)
}

/** Resign the current game. */
export async function resignGame(gameId: string): Promise<void> {
  await api.resignGame(gameId)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Convert our local color type to the API's Player enum. */
export function toApiPlayer(color: 'white' | 'black' | null): Player {
  if (color === 'white') return Player.White
  if (color === 'black') return Player.Black
  return Player.None
}

/** Convert the API's Player enum to our local color type. */
export function fromApiPlayer(player: Player | undefined): 'white' | 'black' | null {
  if (player === Player.White) return 'white'
  if (player === Player.Black) return 'black'
  return null
}
