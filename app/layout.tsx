import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { Analytics } from "@vercel/analytics/next"
import { AuditProvider } from "@/lib/audit-context"
import "./globals.css"
import type { ReactNode } from "react"

const _geist = Geist({ subsets: ["latin"] })
const _geistMono = Geist_Mono({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Sistema de Análisis de Auditorías",
  description: "Plataforma para consolidar y analizar auditorías de higiene y seguridad",
  generator: "v0.app",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: ReactNode
}>) {
  return (
    <html lang="es">
      <body className={`font-sans antialiased`}>
        <AuditProvider>{children}</AuditProvider>
        <Analytics />
      </body>
    </html>
  )
}
