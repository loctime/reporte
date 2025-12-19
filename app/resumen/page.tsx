"use client"

import { useState } from "react"
import { Navigation } from "@/components/navigation"
import { useAudit } from "@/lib/audit-context"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { StatsCard } from "@/components/stats-card"
import { CompliancePieChart } from "@/components/compliance-pie-chart"
import { MonthlyTrendChart } from "@/components/monthly-trend-chart"
import { AnnualCalendarTable } from "@/components/annual-calendar-table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { 
  FileText, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  Building2, 
  User, 
  Calendar,
  BarChart3,
  PieChart
} from "lucide-react"
import Link from "next/link"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts"
import { formatDate } from "@/lib/utils"

// Tooltip personalizado para gráfico de categorías
const CustomTooltipCategorias = ({ active, payload }: any) => {
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

export default function ResumenPage() {
  const { auditFiles, getAllItems, getStats } = useAudit()
  const [selectedOperacion, setSelectedOperacion] = useState<string>("")
  const [selectedAuditor, setSelectedAuditor] = useState<string>("")

  const stats = getStats()
  const operaciones = Object.keys(stats.porOperacion)
  const auditores = Object.keys(stats.porAuditor)

  if (auditFiles.length === 0) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navigation />
        <main className="flex-1 flex items-center justify-center p-4">
          <div className="text-center max-w-md">
            <FileText className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-2xl font-bold mb-2">No hay auditorías cargadas</h2>
            <p className="text-muted-foreground mb-6">
              Suba archivos Excel para comenzar a visualizar el análisis completo
            </p>
            <Button asChild>
              <Link href="/upload">Cargar Auditorías</Link>
            </Button>
          </div>
        </main>
      </div>
    )
  }

  // Datos para la sección de operación
  const operacionActual = selectedOperacion || (operaciones.length > 0 ? operaciones[0] : "")
  const operacionStats = operacionActual ? stats.porOperacion[operacionActual] : null
  const auditoriasOperacion = operacionActual ? auditFiles.filter((f) => f.operacion === operacionActual) : []
  const itemsOperacion = operacionActual ? getAllItems().filter((i) => i.operacion === operacionActual) : []

  const cumpleOperacion = itemsOperacion.filter((i) => i.estado === "Cumple").length
  const cumpleParcialOperacion = itemsOperacion.filter((i) => i.estado === "Cumple parcialmente").length
  const noCumpleOperacion = itemsOperacion.filter((i) => i.estado === "No cumple").length

  // Categorías para la operación seleccionada
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

  // Datos para la sección de auditor
  const auditorActual = selectedAuditor || (auditores.length > 0 ? auditores[0] : "")
  const auditorStats = auditorActual ? stats.porAuditor[auditorActual] : null
  const auditoriasAuditor = auditorActual ? auditFiles.filter((f) => f.auditor === auditorActual) : []
  const itemsAuditor = auditorActual ? getAllItems().filter((i) => i.auditor === auditorActual) : []

  const cumpleAuditor = itemsAuditor.filter((i) => i.estado === "Cumple").length
  const cumpleParcialAuditor = itemsAuditor.filter((i) => i.estado === "Cumple parcialmente").length
  const noCumpleAuditor = itemsAuditor.filter((i) => i.estado === "No cumple").length
  const noAplicaAuditor = itemsAuditor.filter((i) => i.estado === "No aplica").length

  const distribucionData = [
    { name: "Cumple", value: cumpleAuditor },
    { name: "Parcial", value: cumpleParcialAuditor },
    { name: "No Cumple", value: noCumpleAuditor },
    { name: "No Aplica", value: noAplicaAuditor },
  ]

  return (
    <div className="min-h-screen flex flex-col">
      <Navigation />

      <main className="flex-1 py-8 px-4">
        <div className="container mx-auto max-w-7xl">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Resumen Completo</h1>
            <p className="text-muted-foreground">Vista consolidada de análisis general, por operación y por auditor</p>
          </div>

          <Tabs defaultValue="general" className="w-full">
            <TabsList className="mb-6">
              <TabsTrigger value="general">
                <BarChart3 className="h-4 w-4 mr-2" />
                Dashboard General
              </TabsTrigger>
              <TabsTrigger value="operacion">
                <Building2 className="h-4 w-4 mr-2" />
                Por Operación
              </TabsTrigger>
              <TabsTrigger value="auditor">
                <User className="h-4 w-4 mr-2" />
                Por Auditor
              </TabsTrigger>
            </TabsList>

            {/* TAB: Dashboard General */}
            <TabsContent value="general" className="space-y-6">
              {/* Análisis Consolidado */}
              <div>
                <h2 className="text-2xl font-semibold mb-4">Análisis Consolidado</h2>
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
                    description={`${stats.totalItems > 0 ? Math.round((stats.cumple / stats.totalItems) * 100) : 0}% del total`}
                    icon={CheckCircle2}
                  />
                  <StatsCard
                    title="Incumplimientos"
                    value={stats.noCumple}
                    description={`${stats.totalItems > 0 ? Math.round((stats.noCumple / stats.totalItems) * 100) : 0}% del total`}
                    icon={AlertTriangle}
                  />
                </div>
              </div>

              {/* Distribución de Cumplimiento y Tendencia Mensual */}
              <div className="grid gap-6 lg:grid-cols-2">
                <CompliancePieChart
                  cumple={stats.cumple}
                  cumpleParcial={stats.cumpleParcial}
                  noCumple={stats.noCumple}
                  noAplica={stats.noAplica}
                />
                <MonthlyTrendChart data={stats.porMes} />
              </div>

              {/* Calendario Anual de Cumplimiento */}
              <AnnualCalendarTable auditFiles={auditFiles} />
            </TabsContent>

            {/* TAB: Por Operación */}
            <TabsContent value="operacion" className="space-y-6">
              {operaciones.length > 0 ? (
                <Card>
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
              ) : (
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-muted-foreground text-center">No hay operaciones disponibles</p>
                  </CardContent>
                </Card>
              )}

              {/* Stats de la operación */}
              {operacionStats ? (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
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
                    value={cumpleOperacion}
                    description={`${itemsOperacion.length > 0 ? Math.round((cumpleOperacion / itemsOperacion.length) * 100) : 0}% del total`}
                    icon={CheckCircle2}
                  />
                  <StatsCard
                    title="Incumplimientos"
                    value={noCumpleOperacion}
                    description={`${itemsOperacion.length > 0 ? Math.round((noCumpleOperacion / itemsOperacion.length) * 100) : 0}% del total`}
                    icon={AlertTriangle}
                  />
                </div>
              ) : (
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-muted-foreground text-center">No hay operaciones disponibles</p>
                  </CardContent>
                </Card>
              )}

              {/* Cumplimiento por Categoría */}
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
                          <Tooltip content={<CustomTooltipCategorias />} />
                          <Bar 
                            dataKey="cumplimiento" 
                            name="% Cumplimiento"
                            radius={[0, 8, 8, 0]}
                          >
                            {categoriasData.map((entry, index) => {
                              let color = "#10b981"
                              if (entry.cumplimiento < 80) color = "#f59e0b"
                              if (entry.cumplimiento < 60) color = "#ef4444"
                              
                              return (
                                <Cell key={`cell-${index}`} fill={color} />
                              )
                            })}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </>
                  ) : (
                    <div className="flex items-center justify-center h-[400px] text-muted-foreground">
                      No hay datos de categorías disponibles
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Historial de Auditorías */}
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
                          <TableCell>{formatDate(audit.fecha)}</TableCell>
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
            </TabsContent>

            {/* TAB: Por Auditor */}
            <TabsContent value="auditor" className="space-y-6">
              {auditores.length > 0 ? (
                <Card>
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
              ) : (
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-muted-foreground text-center">No hay auditores disponibles</p>
                  </CardContent>
                </Card>
              )}

              {/* Stats del auditor */}
              {auditorStats ? (
                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
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
                    value={noCumpleAuditor}
                    description="Items con no cumple"
                    icon={AlertTriangle}
                  />
                  <StatsCard
                    title="Operaciones"
                    value={[...new Set(auditoriasAuditor.map((a) => a.operacion))].length}
                    description="Diferentes auditadas"
                    icon={Building2}
                  />
                </div>
              ) : (
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-muted-foreground text-center">No hay auditores disponibles</p>
                  </CardContent>
                </Card>
              )}

              {/* Distribución de Hallazgos */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <PieChart className="h-4 w-4 text-primary" />
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

              {/* Operaciones Auditadas */}
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
            </TabsContent>
          </Tabs>
        </div>
      </main>
    </div>
  )
}

