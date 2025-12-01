"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { FileUp, LayoutDashboard, Building2, User, Table, Search } from "lucide-react"

const navItems = [
  { href: "/", label: "Inicio", icon: LayoutDashboard },
  { href: "/upload", label: "Cargar Auditorías", icon: FileUp },
  { href: "/dashboard", label: "Dashboard General", icon: LayoutDashboard },
  { href: "/operaciones", label: "Por Operación", icon: Building2 },
  { href: "/auditores", label: "Por Auditor", icon: User },
  { href: "/registros", label: "Registros", icon: Table },
  { href: "/verificar", label: "Verificar Excel", icon: Search },
]

export function Navigation() {
  const pathname = usePathname()

  return (
    <nav className="border-b border-border bg-card">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2 font-semibold text-lg">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <LayoutDashboard className="h-5 w-5 text-primary-foreground" />
            </div>
            <span>Auditorías</span>
          </Link>

          <div className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    isActive
                      ? "bg-secondary text-secondary-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/50",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              )
            })}
          </div>
        </div>
      </div>
    </nav>
  )
}
