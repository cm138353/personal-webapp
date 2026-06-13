import { ChessClient, GameStateDto, Color as ApiColor } from './generated/ChessAPI'

// TODO: Replace with your actual API base URL (or use an env variable)
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'https://localhost:44322'

const api = new ChessClient(API_BASE_URL)

export async function saveCompletedGame(
  winner: 'white' | 'black' | null,
  moveHistory: string[],
  startTime: Date,
  endTime: Date
): Promise<GameStateDto> {
  const apiWinner = winner === 'white' ? ApiColor.White : winner === 'black' ? ApiColor.Black : undefined

  return api.createGame(
    undefined,   // id — let server assign
    apiWinner,
    moveHistory,
    startTime,
    endTime
  )
}
