"use client"

import { useState } from "react"
import { Navigation } from "@/components/navigation"
import { useAudit } from "@/lib/audit-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { StatsCard } from "@/components/stats-card"
import { MonthlyTrendChart } from "@/components/monthly-trend-chart"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { User, TrendingUp, AlertTriangle, Calendar, Building2 } from "lucide-react"
import Link from "next/link"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts"
import { formatDate } from "@/lib/utils"

export default function AuditoresPage() {
  const { auditFiles, getAllItems, getStats } = useAudit()
  const [selectedAuditor, setSelectedAuditor] = useState<string>("")

  const stats = getStats()
  const auditores = Object.keys(stats.porAuditor)

  if (auditFiles.length === 0) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navigation />
        <main className="flex-1 flex items-center justify-center p-4">
          <div className="text-center max-w-md">
            <User className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-2xl font-bold mb-2">No hay auditorías cargadas</h2>
            <p className="text-muted-foreground mb-6">Suba archivos Excel para analizar auditores</p>
            <Button asChild>
              <Link href="/upload">Cargar Auditorías</Link>
            </Button>
          </div>
        </main>
      </div>
    )
  }

  const auditorActual = selectedAuditor || auditores[0]
  const auditorStats = stats.porAuditor[auditorActual]

  const auditoriasAuditor = auditFiles.filter((f) => f.auditor === auditorActual)
  const itemsAuditor = getAllItems().filter((i) => i.auditor === auditorActual)

  const cumple = itemsAuditor.filter((i) => i.estado === "Cumple").length
  const cumpleParcial = itemsAuditor.filter((i) => i.estado === "Cumple parcialmente").length
  const noCumple = itemsAuditor.filter((i) => i.estado === "No cumple").length
  const noAplica = itemsAuditor.filter((i) => i.estado === "No aplica").length

  // Operaciones que auditó
  const operacionesAuditadas = [...new Set(auditoriasAuditor.map((a) => a.operacion))]

  // Datos por mes para este auditor
  const porMesAuditor: Record<string, { total: number; cumplimiento: number; auditorias: number }> = {}
  auditoriasAuditor.forEach((file) => {
    const mes = `${file.fecha.getFullYear()}-${String(file.fecha.getMonth() + 1).padStart(2, "0")}`
    const itemsMes = file.items.filter((i) => i.estado !== "No aplica")
    const cumpleMes = file.items.filter((i) => i.estado === "Cumple" || i.estado === "Cumple parcialmente").length
    const cumplimientoMes = itemsMes.length > 0 ? (cumpleMes / itemsMes.length) * 100 : 0

    if (!porMesAuditor[mes]) {
      porMesAuditor[mes] = { total: 0, cumplimiento: 0, auditorias: 0 }
    }
    porMesAuditor[mes].total += itemsMes.length
    porMesAuditor[mes].cumplimiento =
      (porMesAuditor[mes].cumplimiento * porMesAuditor[mes].auditorias + cumplimientoMes) /
      (porMesAuditor[mes].auditorias + 1)
    porMesAuditor[mes].auditorias += 1
  })

  // Distribución de estados detectados
  const distribucionData = [
    { name: "Cumple", value: cumple },
    { name: "Parcial", value: cumpleParcial },
    { name: "No Cumple", value: noCumple },
    { name: "No Aplica", value: noAplica },
  ]

  // Observaciones más frecuentes
  const observaciones: Record<string, number> = {}
  itemsAuditor.forEach((item) => {
    if (item.observacion && item.observacion.length > 10) {
      const obs = item.observacion.substring(0, 50)
      observaciones[obs] = (observaciones[obs] || 0) + 1
    }
  })
  const topObservaciones = Object.entries(observaciones)
    .map(([obs, count]) => ({ observacion: obs, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  return (
    <div className="min-h-screen flex flex-col">
      <Navigation />

      <main className="flex-1 py-8 px-4">
        <div className="container mx-auto max-w-7xl">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Análisis por Auditor</h1>
            <p className="text-muted-foreground">Seleccione un auditor para ver su desempeño y patrones</p>
          </div>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Seleccionar Auditor</CardTitle>
            </CardHeader>
            <CardContent>
              <Select value={auditorActual} onValueChange={setSelectedAuditor}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Seleccione un auditor" />
                </SelectTrigger>
                <SelectContent>
                  {auditores.map((auditor) => (
                    <SelectItem key={auditor} value={auditor}>
                      {auditor}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-6">
            <StatsCard
              title="Auditorías"
              value={auditorStats.auditorias}
              description="Total realizadas"
              icon={Calendar}
            />
            <StatsCard
              title="Porcentaje de Cumplimiento"
              value={`${Math.round(auditorStats.cumplimiento)}%`}
              description="Promedio de todas sus auditorías"
              icon={TrendingUp}
            />
            <StatsCard
              title="Incumplimientos Detectados"
              value={noCumple}
              description="Items con no cumple"
              icon={AlertTriangle} // AlertCircle variable is undeclared, replaced with AlertTriangle
            />
            <StatsCard
              title="Operaciones"
              value={operacionesAuditadas.length}
              description="Diferentes auditadas"
              icon={Building2}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2 mb-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  Distribución de Hallazgos
                </CardTitle>
                <CardDescription>
                  Estados detectados por este auditor en todas sus evaluaciones
                  {distribucionData.length > 0 && (
                    <span className="ml-2">
                      • Total: <span className="font-semibold">
                        {distribucionData.reduce((acc, d) => acc + d.value, 0).toLocaleString()} items
                      </span>
                    </span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {distribucionData.length > 0 && distribucionData.some(d => d.value > 0) ? (
                  <>
                    <ResponsiveContainer width="100%" height={320}>
                      <BarChart data={distribucionData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                        <CartesianGrid 
                          strokeDasharray="3 3" 
                          stroke="hsl(var(--border))" 
                          opacity={0.3}
                        />
                        <XAxis 
                          dataKey="name" 
                          tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                          tickLine={{ stroke: "hsl(var(--border))" }}
                        />
                        <YAxis 
                          tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                          tickLine={{ stroke: "hsl(var(--border))" }}
                          label={{ 
                            value: 'Cantidad de Items', 
                            angle: -90, 
                            position: 'insideLeft',
                            style: { textAnchor: 'middle', fill: 'hsl(var(--muted-foreground))', fontSize: 12 }
                          }}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "hsl(var(--popover))",
                            border: "1px solid hsl(var(--border))",
                            borderRadius: "8px",
                            padding: "12px",
                          }}
                          formatter={(value: number, name: string) => [
                            `${value.toLocaleString()} items`,
                            name
                          ]}
                        />
                        <Bar 
                          dataKey="value" 
                          name="Cantidad"
                          radius={[8, 8, 0, 0]}
                        >
                          {distribucionData.map((entry, index) => {
                            let color = "hsl(var(--primary))"
                            if (entry.name === "Cumple") color = "#10b981"
                            else if (entry.name === "Parcial") color = "#f59e0b"
                            else if (entry.name === "No Cumple") color = "#ef4444"
                            else if (entry.name === "No Aplica") color = "#6b7280"
                            
                            return (
                              <Cell key={`cell-${index}`} fill={color} />
                            )
                          })}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                    <div className="mt-4 pt-4 border-t border-border">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {distribucionData.map((item) => {
                          const total = distribucionData.reduce((acc, d) => acc + d.value, 0)
                          const percentage = total > 0 ? ((item.value / total) * 100).toFixed(1) : "0"
                          
                          let color = "hsl(var(--primary))"
                          if (item.name === "Cumple") color = "#10b981"
                          else if (item.name === "Parcial") color = "#f59e0b"
                          else if (item.name === "No Cumple") color = "#ef4444"
                          else if (item.name === "No Aplica") color = "#6b7280"
                          
                          return (
                            <div key={item.name} className="text-center">
                              <div className="flex items-center justify-center gap-2 mb-1">
                                <div 
                                  className="h-3 w-3 rounded-full" 
                                  style={{ backgroundColor: color }}
                                />
                                <p className="text-xs text-muted-foreground">{item.name}</p>
                              </div>
                              <p className="text-lg font-bold tabular-nums" style={{ color }}>
                                {item.value.toLocaleString()}
                              </p>
                              <p className="text-xs text-muted-foreground">{percentage}%</p>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-center h-[320px] text-muted-foreground">
                    No hay datos disponibles
                  </div>
                )}
              </CardContent>
            </Card>

            <MonthlyTrendChart data={porMesAuditor} />
          </div>

          <div className="grid gap-6 mb-6">
            <Card>
              <CardHeader>
                <CardTitle>Operaciones Auditadas</CardTitle>
                <CardDescription>Historial de auditorías realizadas</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Operación</TableHead>
                      <TableHead>Responsable</TableHead>
                      <TableHead className="text-right">Items</TableHead>
                      <TableHead className="text-right">Cumplimiento</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {auditoriasAuditor.map((audit, index) => (
                      <TableRow key={index}>
                        <TableCell>{formatDate(audit.fecha)}</TableCell>
                        <TableCell className="max-w-xs truncate">{audit.operacion}</TableCell>
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

          {topObservaciones.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Observaciones Más Frecuentes</CardTitle>
                <CardDescription>Patrones en las observaciones de este auditor</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {topObservaciones.map((obs, index) => (
                    <div key={index} className="flex items-center justify-between p-3 rounded-lg border border-border">
                      <p className="text-sm flex-1">{obs.observacion}...</p>
                      <Badge variant="secondary">{obs.count} veces</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  )
}
