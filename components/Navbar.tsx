'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'

interface DropdownItem {
  label: string
  href: string
  disabled?: boolean
}

interface NavDropdownProps {
  label: string
  items: DropdownItem[]
}

function NavDropdown({ label, items }: NavDropdownProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-zinc-200 hover:text-white hover:bg-white/10 rounded-md transition-colors"
        aria-haspopup="true"
        aria-expanded={open}
      >
        {label}
        <svg
          className={`w-4 h-4 transition-transform ${open ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute left-0 top-full mt-1 w-48 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-50 overflow-hidden">
          {items.map((item) =>
            item.disabled ? (
              <span
                key={item.label}
                className="block px-4 py-2 text-sm text-zinc-500 cursor-not-allowed"
              >
                {item.label}
                <span className="ml-2 text-xs text-zinc-600">(soon)</span>
              </span>
            ) : (
              <Link
                key={item.label}
                href={item.href}
                onClick={() => setOpen(false)}
                className="block px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-700 hover:text-white transition-colors"
              >
                {item.label}
              </Link>
            )
          )}
        </div>
      )}
    </div>
  )
}

export default function Navbar() {
  const toolsItems: DropdownItem[] = [
    { label: 'Color Palette Generator', href: '/tools/color-palette', disabled: true },
    { label: 'JSON Formatter', href: '/tools/json-formatter', disabled: true },
    { label: 'Markdown Editor', href: '/tools/markdown', disabled: true },
    { label: 'Unit Converter', href: '/tools/unit-converter', disabled: true },
  ]

  const gamesItems: DropdownItem[] = [
    { label: 'Chess', href: '/games/chess' },
    { label: 'Tic-Tac-Toe', href: '/games/tictactoe', disabled: true },
    { label: 'Minesweeper', href: '/games/minesweeper', disabled: true },
    { label: 'Sudoku', href: '/games/sudoku', disabled: true },
  ]

  return (
    <nav className="sticky top-0 z-40 w-full bg-zinc-900/95 backdrop-blur border-b border-zinc-800">
      <div className="max-w-7xl mx-auto px-4 flex items-center justify-between h-14">
        <Link href="/" className="text-white font-semibold text-lg tracking-tight hover:text-zinc-300 transition-colors">
          MyApp
        </Link>
        <div className="flex items-center gap-1">
          <NavDropdown label="Tools" items={toolsItems} />
          <NavDropdown label="Games" items={gamesItems} />
        </div>
      </div>
    </nav>
  )
}
