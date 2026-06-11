import Navbar from '@/components/Navbar'
import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-zinc-950 text-white">
      <Navbar />

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 text-center">
        <div className="max-w-2xl mx-auto space-y-6">
          <h1 className="text-5xl font-bold tracking-tight">
            Welcome
          </h1>
          <p className="text-xl text-zinc-400 leading-relaxed">
            A personal space for games, tools, and experiments. Pick something from the menu above to get started.
          </p>
          <div className="flex flex-wrap gap-4 justify-center pt-4">
            <Link
              href="/games/chess"
              className="px-6 py-3 bg-white text-zinc-900 font-semibold rounded-full hover:bg-zinc-100 transition-colors"
            >
              Play Chess
            </Link>
            <Link
              href="/games"
              className="px-6 py-3 border border-zinc-700 text-zinc-300 font-semibold rounded-full hover:border-zinc-500 hover:text-white transition-colors"
            >
              Browse Games
            </Link>
          </div>
        </div>
      </main>

      <footer className="py-6 text-center text-zinc-600 text-sm border-t border-zinc-900">
        Built with Next.js &amp; Tailwind CSS
      </footer>
    </div>
  )
}
