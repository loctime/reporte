"use client"

import { useState } from "react"
import { Navigation } from "@/components/navigation"
import { useAudit } from "@/lib/audit-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { StatsCard } from "@/components/stats-card"
import { MonthlyTrendChart } from "@/components/monthly-trend-chart"
import { ProblemItemsTable } from "@/components/problem-items-table"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Building2, TrendingUp, AlertTriangle, CheckCircle2, Calendar } from "lucide-react"
import Link from "next/link"
import { RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar, ResponsiveContainer } from "recharts"

export default function OperacionesPage() {
  const { auditFiles, getAllItems, getStats } = useAudit()
  const [selectedOperacion, setSelectedOperacion] = useState<string>("")

  const stats = getStats()
  const operaciones = Object.keys(stats.porOperacion)

  if (auditFiles.length === 0) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navigation />
        <main className="flex-1 flex items-center justify-center p-4">
          <div className="text-center max-w-md">
            <Building2 className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-2xl font-bold mb-2">No hay auditorías cargadas</h2>
            <p className="text-muted-foreground mb-6">Suba archivos Excel para analizar operaciones</p>
            <Button asChild>
              <Link href="/upload">Cargar Auditorías</Link>
            </Button>
          </div>
        </main>
      </div>
    )
  }

  const operacionActual = selectedOperacion || operaciones[0]
  const operacionStats = stats.porOperacion[operacionActual]

  const auditoriasOperacion = auditFiles.filter((f) => f.operacion === operacionActual)
  const itemsOperacion = getAllItems().filter((i) => i.operacion === operacionActual)

  const cumple = itemsOperacion.filter((i) => i.estado === "Cumple").length
  const cumpleParcial = itemsOperacion.filter((i) => i.estado === "Cumple parcialmente").length
  const noCumple = itemsOperacion.filter((i) => i.estado === "No cumple").length
  const noAplica = itemsOperacion.filter((i) => i.estado === "No aplica").length

  // Items problemáticos de esta operación
  const itemCounter: Record<string, { pregunta: string; categoria: string; noCumple: number }> = {}
  itemsOperacion
    .filter((i) => i.estado === "No cumple")
    .forEach((item) => {
      const key = `${item.categoria}::${item.pregunta}`
      if (!itemCounter[key]) {
        itemCounter[key] = { pregunta: item.pregunta, categoria: item.categoria, noCumple: 0 }
      }
      itemCounter[key].noCumple += 1
    })
  const itemsProblematicos = Object.values(itemCounter)
    .map((item) => ({ ...item, frecuencia: item.noCumple }))
    .sort((a, b) => b.noCumple - a.noCumple)

  // Datos por mes para esta operación
  const porMesOperacion: Record<string, { total: number; cumplimiento: number; auditorias: number }> = {}
  auditoriasOperacion.forEach((file) => {
    const mes = `${file.fecha.getFullYear()}-${String(file.fecha.getMonth() + 1).padStart(2, "0")}`
    const itemsMes = file.items.filter((i) => i.estado !== "No aplica")
    const cumpleMes = file.items.filter((i) => i.estado === "Cumple" || i.estado === "Cumple parcialmente").length
    const cumplimientoMes = itemsMes.length > 0 ? (cumpleMes / itemsMes.length) * 100 : 0

    if (!porMesOperacion[mes]) {
      porMesOperacion[mes] = { total: 0, cumplimiento: 0, auditorias: 0 }
    }
    porMesOperacion[mes].total += itemsMes.length
    porMesOperacion[mes].cumplimiento =
      (porMesOperacion[mes].cumplimiento * porMesOperacion[mes].auditorias + cumplimientoMes) /
      (porMesOperacion[mes].auditorias + 1)
    porMesOperacion[mes].auditorias += 1
  })

  // Categorías para radar
  const categorias: Record<string, { cumple: number; total: number }> = {}
  itemsOperacion.forEach((item) => {
    if (!categorias[item.categoria]) {
      categorias[item.categoria] = { cumple: 0, total: 0 }
    }
    if (item.estado !== "No aplica") {
      categorias[item.categoria].total += 1
      if (item.estado === "Cumple" || item.estado === "Cumple parcialmente") {
        categorias[item.categoria].cumple += 1
      }
    }
  })

  const radarData = Object.entries(categorias)
    .map(([categoria, data]) => ({
      categoria: categoria.length > 20 ? categoria.substring(0, 20) + "..." : categoria,
      cumplimiento: data.total > 0 ? Math.round((data.cumple / data.total) * 100) : 0,
    }))
    .slice(0, 8)

  return (
    <div className="min-h-screen flex flex-col">
      <Navigation />

      <main className="flex-1 py-8 px-4">
        <div className="container mx-auto max-w-7xl">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Análisis por Operación</h1>
            <p className="text-muted-foreground">Seleccione una operación para ver su desempeño detallado</p>
          </div>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Seleccionar Operación</CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={operacionActual} onValueChange={setSelectedOperacion}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleccione una operación" />
                </SelectTrigger>
                <SelectContent>
                  {operaciones.map((op) => (
                    <SelectItem key={op} value={op}>
                      {op}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-6">
            <StatsCard
              title="Auditorías"
              value={operacionStats.auditorias}
              description="Total realizadas"
              icon={Calendar}
            />
            <StatsCard
              title="Cumplimiento"
              value={`${Math.round(operacionStats.cumplimiento)}%`}
              description="Promedio general"
              icon={TrendingUp}
            />
            <StatsCard
              title="Items Cumplidos"
              value={cumple}
              description={`${Math.round((cumple / itemsOperacion.length) * 100)}% del total`}
              icon={CheckCircle2}
            />
            <StatsCard
              title="Incumplimientos"
              value={noCumple}
              description={`${Math.round((noCumple / itemsOperacion.length) * 100)}% del total`}
              icon={AlertTriangle}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2 mb-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Building2 className="h-4 w-4 text-primary" />
                  </div>
                  Cumplimiento por Categoría
                </CardTitle>
                <CardDescription>
                  Comparación de desempeño entre áreas de la operación
                  {radarData.length > 0 && (
                    <span className="ml-2">
                      • Promedio: <span className="font-semibold">
                        {Math.round(radarData.reduce((acc, d) => acc + d.cumplimiento, 0) / radarData.length)}%
                      </span>
                    </span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {radarData.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={320}>
                      <RadarChart data={radarData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                        <defs>
                          <linearGradient id="radarGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.4} />
                            <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.1} />
                          </linearGradient>
                        </defs>
                        <PolarGrid 
                          stroke="hsl(var(--border))" 
                          strokeWidth={1}
                          opacity={0.5}
                        />
                        <PolarAngleAxis 
                          dataKey="categoria" 
                          tick={{ 
                            fill: "hsl(var(--foreground))", 
                            fontSize: 11,
                            fontWeight: 500
                          }} 
                        />
                        <PolarRadiusAxis 
                          angle={90} 
                          domain={[0, 100]} 
                          tick={{ 
                            fill: "hsl(var(--muted-foreground))",
                            fontSize: 10
                          }} 
                          tickCount={5}
                        />
                        <Radar
                          name="% Cumplimiento"
                          dataKey="cumplimiento"
                          stroke="hsl(var(--primary))"
                          strokeWidth={2}
                          fill="url(#radarGradient)"
                          fillOpacity={0.6}
                          dot={{ 
                            fill: "hsl(var(--primary))", 
                            strokeWidth: 2, 
                            r: 4,
                            stroke: "hsl(var(--background))"
                          }}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--popover))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                            padding: "12px",
                          }}
                          formatter={(value: number) => [`${value.toFixed(1)}%`, "Cumplimiento"]}
                        />
                      </RadarChart>
                    </ResponsiveContainer>
                    <div className="mt-4 pt-4 border-t border-border">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground mb-1">Mejor Área</p>
                          <p className="text-sm font-semibold truncate">
                            {radarData.reduce((max, item) => 
                              item.cumplimiento > max.cumplimiento ? item : max
                            ).categoria}
                          </p>
                          <p className="text-lg font-bold text-success mt-1">
                            {Math.max(...radarData.map(d => d.cumplimiento)).toFixed(0)}%
                          </p>
                        </div>
                        <div className="text-center">
                          <p className="text-xs text-muted-foreground mb-1">Área a Mejorar</p>
                          <p className="text-sm font-semibold truncate">
                            {radarData.reduce((min, item) => 
                              item.cumplimiento < min.cumplimiento ? item : min
                            ).categoria}
                          </p>
                          <p className="text-lg font-bold text-destructive mt-1">
                            {Math.min(...radarData.map(d => d.cumplimiento)).toFixed(0)}%
                          </p>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-center h-[320px] text-muted-foreground">
                    No hay datos de categorías disponibles
                  </div>
                )}
              </CardContent>
            </Card>

            <MonthlyTrendChart data={porMesOperacion} />
          </div>

          <div className="grid gap-6 mb-6">
            <Card>
              <CardHeader>
                <CardTitle>Historial de Auditorías</CardTitle>
                <CardDescription>Todas las auditorías realizadas en esta operación</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Auditor</TableHead>
                      <TableHead>Responsable</TableHead>
                      <TableHead className="text-right">Items</TableHead>
                      <TableHead className="text-right">Cumplimiento</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditoriasOperacion.map((audit, index) => (
                      <TableRow key={index}>
                        <TableCell>{audit.fecha.toLocaleDateString("es-AR")}</TableCell>
                        <TableCell>{audit.auditor}</TableCell>
                        <TableCell>{audit.responsable}</TableCell>
                        <TableCell className="text-right">{audit.totalItems}</TableCell>
                        <TableCell className="text-right">
                          <Badge
                            variant={
                              audit.cumplimiento >= 75
                                ? "default"
                                : audit.cumplimiento >= 50
                                  ? "secondary"
                                  : "destructive"
                            }
                          >
                            {audit.cumplimiento}%
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          {itemsProblematicos.length > 0 && <ProblemItemsTable items={itemsProblematicos} />}
        </div>
      </main>
    </div>
  )
}
