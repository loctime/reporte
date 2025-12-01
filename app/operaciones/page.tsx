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
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts"

const CustomTooltip = ({ active, payload }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    const value = payload[0].value
    
    return (
      <div className="bg-popover border border-border rounded-lg shadow-lg p-4 max-w-[280px]">
        <p className="font-semibold text-sm mb-3">{data.categoria}</p>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-muted-foreground">Cumplimiento</span>
            <span className={`text-sm font-bold tabular-nums ${
              value >= 80 ? 'text-success' : 
              value >= 60 ? 'text-warning' : 
              'text-destructive'
            }`}>
              {value.toFixed(1)}%
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-muted-foreground">Items Cumplidos</span>
            <span className="text-sm font-semibold tabular-nums">
              {data.cumple} / {data.total}
            </span>
          </div>
          {data.cumpleParcial > 0 && (
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm text-muted-foreground">Cumple Parcialmente</span>
              <span className="text-sm font-semibold tabular-nums">
                {data.cumpleParcial}
              </span>
            </div>
          )}
          {data.noCumple > 0 && (
            <div className="flex items-center justify-between gap-4">
              <span className="text-sm text-muted-foreground">No Cumple</span>
              <span className="text-sm font-semibold tabular-nums text-destructive">
                {data.noCumple}
              </span>
            </div>
          )}
        </div>
      </div>
    )
  }
  return null
}

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

  // Categorías con cálculo correcto de cumplimiento
  const categorias: Record<string, { 
    cumple: number
    cumpleParcial: number
    noCumple: number
    total: number
  }> = {}
  
  itemsOperacion.forEach((item) => {
    if (!categorias[item.categoria]) {
      categorias[item.categoria] = { 
        cumple: 0, 
        cumpleParcial: 0,
        noCumple: 0,
        total: 0 
      }
    }
    
    if (item.estado !== "No aplica") {
      categorias[item.categoria].total += 1
      
      if (item.estado === "Cumple") {
        categorias[item.categoria].cumple += 1
      } else if (item.estado === "Cumple parcialmente") {
        categorias[item.categoria].cumpleParcial += 1
      } else if (item.estado === "No cumple") {
        categorias[item.categoria].noCumple += 1
      }
    }
  })

  const categoriasData = Object.entries(categorias)
    .map(([categoria, data]) => {
      // Calcular cumplimiento correctamente: Cumple=1.0, Cumple Parcial=0.5, No Cumple=0.0
      const puntosCumplimiento = (data.cumple * 1.0) + (data.cumpleParcial * 0.5)
      const cumplimiento = data.total > 0 
        ? (puntosCumplimiento / data.total) * 100 
        : 0
      
      return {
        categoria: categoria,
        categoriaCorta: categoria.length > 40 ? categoria.substring(0, 40) + "..." : categoria,
        cumplimiento: Math.round(cumplimiento * 10) / 10,
        cumple: data.cumple,
        cumpleParcial: data.cumpleParcial,
        noCumple: data.noCumple,
        total: data.total,
      }
    })
    .sort((a, b) => b.cumplimiento - a.cumplimiento)
    .slice(0, 10)

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
                  {categoriasData.length > 0 && (
                    <span className="ml-2">
                      • Promedio: <span className="font-semibold">
                        {Math.round(categoriasData.reduce((acc, d) => acc + d.cumplimiento, 0) / categoriasData.length)}%
                      </span>
                    </span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {categoriasData.length > 0 ? (
                  <>
                    <ResponsiveContainer width="100%" height={Math.max(400, categoriasData.length * 50)}>
                      <BarChart 
                        data={categoriasData} 
                        layout="vertical"
                        margin={{ top: 10, right: 30, left: 0, bottom: 10 }}
                      >
                        <defs>
                          <linearGradient id="barGradient" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#10b981" stopOpacity={0.8} />
                            <stop offset="50%" stopColor="#f59e0b" stopOpacity={0.8} />
                            <stop offset="100%" stopColor="#ef4444" stopOpacity={0.8} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid 
                          strokeDasharray="3 3" 
                          stroke="hsl(var(--border))" 
                          opacity={0.3}
                          horizontal={true}
                          vertical={false}
                        />
                        <XAxis 
                          type="number"
                          domain={[0, 100]}
                          tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
                          tickLine={{ stroke: "hsl(var(--border))" }}
                          label={{ 
                            value: '% Cumplimiento', 
                            position: 'insideBottom',
                            offset: -5,
                            style: { textAnchor: 'middle', fill: 'hsl(var(--muted-foreground))', fontSize: 12 }
                          }}
                        />
                        <YAxis 
                          type="category"
                          dataKey="categoriaCorta"
                          tick={{ fontSize: 12, fill: "hsl(var(--foreground))" }}
                          tickLine={{ stroke: "hsl(var(--border))" }}
                          width={150}
                        />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar 
                          dataKey="cumplimiento" 
                          name="% Cumplimiento"
                          radius={[0, 8, 8, 0]}
                        >
                          {categoriasData.map((entry, index) => {
                            let color = "#10b981" // Verde
                            if (entry.cumplimiento < 80) color = "#f59e0b" // Ámbar
                            if (entry.cumplimiento < 60) color = "#ef4444" // Rojo
                            
                            return (
                              <Cell key={`cell-${index}`} fill={color} />
                            )
                          })}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                    <div className="mt-4 pt-4 border-t border-border">
                      <div className="grid grid-cols-2 gap-3">
                        {categoriasData.length > 0 && (
                          <>
                            <div className="flex items-start gap-3 p-3 rounded-lg bg-success/5 border border-success/20">
                              <CheckCircle2 className="h-5 w-5 text-success flex-shrink-0 mt-0.5" />
                              <div className="flex-1 min-w-0">
                                <p className="text-xs text-muted-foreground mb-1">Mejor Área</p>
                                <p className="text-sm font-semibold truncate">{categoriasData[0].categoria}</p>
                                <p className="text-lg font-bold text-success mt-1">
                                  {categoriasData[0].cumplimiento.toFixed(1)}%
                                </p>
                              </div>
                            </div>
                            {categoriasData.length > 1 && (
                              <div className="flex items-start gap-3 p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                                <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs text-muted-foreground mb-1">Área a Mejorar</p>
                                  <p className="text-sm font-semibold truncate">
                                    {categoriasData[categoriasData.length - 1].categoria}
                                  </p>
                                  <p className="text-lg font-bold text-destructive mt-1">
                                    {categoriasData[categoriasData.length - 1].cumplimiento.toFixed(1)}%
                                  </p>
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="flex items-center justify-center h-[400px] text-muted-foreground">
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
