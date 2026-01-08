import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { HeroUIProvider } from '@heroui/react'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'LogInsight AI - Technical Log Humanizer',
  description: 'Transform technical system logs into human-readable insights using AI',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <HeroUIProvider>
          {children}
        </HeroUIProvider>
      </body>
    </html>
  )
}

