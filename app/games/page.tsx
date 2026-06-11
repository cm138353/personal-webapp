import Navbar from '@/components/Navbar'
import Link from 'next/link'

const games = [
  {
    title: 'Chess',
    description: 'Classic two-player chess with drag & drop, move highlighting, and a 10-minute timer per player.',
    href: '/games/chess',
    available: true,
    emoji: '♟️',
  },
  {
    title: 'Tic-Tac-Toe',
    description: 'The classic three-in-a-row game.',
    href: '/games/tictactoe',
    available: false,
    emoji: '⭕',
  },
  {
    title: 'Minesweeper',
    description: 'Clear the board without detonating a mine.',
    href: '/games/minesweeper',
    available: false,
    emoji: '💣',
  },
  {
    title: 'Sudoku',
    description: 'Fill in the 9×9 grid with digits.',
    href: '/games/sudoku',
    available: false,
    emoji: '🔢',
  },
]

export default function GamesPage() {
  return (
    <div className="min-h-screen flex flex-col bg-zinc-950 text-white">
      <Navbar />
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-16">
        <h1 className="text-4xl font-bold mb-2">Games</h1>
        <p className="text-zinc-400 mb-10">Pick a game and jump in.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {games.map((game) =>
            game.available ? (
              <Link
                key={game.title}
                href={game.href}
                className="group block p-6 bg-zinc-900 border border-zinc-800 rounded-xl hover:border-zinc-600 hover:bg-zinc-800 transition-all"
              >
                <div className="text-4xl mb-3">{game.emoji}</div>
                <h2 className="text-xl font-semibold mb-1 group-hover:text-white">{game.title}</h2>
                <p className="text-zinc-400 text-sm">{game.description}</p>
              </Link>
            ) : (
              <div
                key={game.title}
                className="block p-6 bg-zinc-900/50 border border-zinc-800/50 rounded-xl opacity-50 cursor-not-allowed"
              >
                <div className="text-4xl mb-3">{game.emoji}</div>
                <h2 className="text-xl font-semibold mb-1">{game.title}</h2>
                <p className="text-zinc-500 text-sm">{game.description}</p>
                <span className="inline-block mt-3 text-xs text-zinc-600 border border-zinc-700 rounded-full px-2 py-0.5">
                  Coming soon
                </span>
              </div>
            )
          )}
        </div>
      </main>
    </div>
  )
}
