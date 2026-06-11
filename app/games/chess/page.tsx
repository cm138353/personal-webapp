import Navbar from '@/components/Navbar'
import ChessGame from '@/components/chess/ChessGame'

export default function ChessPage() {
  return (
    <div className="min-h-screen flex flex-col bg-zinc-950 text-white">
      <Navbar />
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="text-3xl font-bold">Chess</h1>
          <p className="text-zinc-400 text-sm mt-1">Two player • 10 minutes per side</p>
        </div>
        <ChessGame />
      </main>
    </div>
  )
}
