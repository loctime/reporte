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
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"

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
                <CardTitle>Distribución de Hallazgos</CardTitle>
                <CardDescription>Estados detectados por este auditor</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={distribucionData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="name" stroke="hsl(var(--foreground))" />
                    <YAxis stroke="hsl(var(--foreground))" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Bar dataKey="value" fill="hsl(var(--chart-1))" name="Cantidad" />
                  </BarChart>
                </ResponsiveContainer>
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
                        <TableCell>{audit.fecha.toLocaleDateString("es-AR")}</TableCell>
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
