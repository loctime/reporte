"use client"

import { Navigation } from "@/components/navigation"
import { StatsCard } from "@/components/stats-card"
import { CompliancePieChart } from "@/components/compliance-pie-chart"
import { OperationsBarChart } from "@/components/operations-bar-chart"
import { MonthlyTrendChart } from "@/components/monthly-trend-chart"
import { ProblemItemsTable } from "@/components/problem-items-table"
import { useAudit } from "@/lib/audit-context"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { FileSpreadsheet, TrendingUp, AlertTriangle, CheckCircle2, FileText } from "lucide-react"
import Link from "next/link"

export default function DashboardPage() {
  const { auditFiles, getStats, viewMode, toggleViewMode } = useAudit()
  const stats = getStats()

  if (auditFiles.length === 0) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navigation />
        <main className="flex-1 flex items-center justify-center p-4">
          <div className="text-center max-w-md">
            <FileSpreadsheet className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-2xl font-bold mb-2">No hay auditorías cargadas</h2>
            <p className="text-muted-foreground mb-6">
              Suba archivos Excel para comenzar a visualizar el análisis consolidado
            </p>
            <Button asChild>
              <Link href="/upload">Cargar Auditorías</Link>
            </Button>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navigation />

      <main className="flex-1 py-8 px-4">
        <div className="container mx-auto max-w-7xl">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold mb-2">Dashboard General</h1>
              <p className="text-muted-foreground">Análisis consolidado de {stats.totalAuditorias} auditorías</p>
            </div>

            <div className="flex items-center gap-2">
              <Label htmlFor="view-mode">Modo Avanzado</Label>
              <Switch id="view-mode" checked={viewMode === "advanced"} onCheckedChange={toggleViewMode} />
            </div>
          </div>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-6">
            <StatsCard
              title="Total Auditorías"
              value={stats.totalAuditorias}
              description={`${stats.totalItems} items evaluados`}
              icon={FileText}
            />
            <StatsCard
              title="Porcentaje de Cumplimiento"
              value={`${Math.round(stats.cumplimientoPromedio)}%`}
              description="Promedio de todas las auditorías"
              icon={TrendingUp}
            />
            <StatsCard
              title="Items Cumplidos"
              value={stats.cumple}
              description={`${Math.round((stats.cumple / stats.totalItems) * 100)}% del total`}
              icon={CheckCircle2}
            />
            <StatsCard
              title="Incumplimientos"
              value={stats.noCumple}
              description={`${Math.round((stats.noCumple / stats.totalItems) * 100)}% del total`}
              icon={AlertTriangle}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2 mb-6">
            <CompliancePieChart
              cumple={stats.cumple}
              cumpleParcial={stats.cumpleParcial}
              noCumple={stats.noCumple}
              noAplica={stats.noAplica}
            />
            <MonthlyTrendChart data={stats.porMes} />
          </div>

          <div className="grid gap-6 mb-6">
            <OperationsBarChart data={stats.porOperacion} />
          </div>

          {viewMode === "advanced" && (
            <div className="grid gap-6">
              <ProblemItemsTable items={stats.itemsMasProblematicos} />
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
