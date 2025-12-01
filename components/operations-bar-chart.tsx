"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from "recharts"
import { Building2, TrendingUp, TrendingDown } from "lucide-react"

interface OperationsBarChartProps {
  data: Record<
    string,
    {
      total: number
      cumplimiento: number
      auditorias: number
    }
  >
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0].payload
    
    return (
      <div className="bg-popover border border-border rounded-lg shadow-lg p-4 max-w-[280px]">
        <p className="font-semibold text-sm mb-3 line-clamp-2">{label}</p>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-muted-foreground">Cumplimiento</span>
            <span className={`text-sm font-bold tabular-nums ${
              data.cumplimiento >= 80 ? 'text-success' : 
              data.cumplimiento >= 60 ? 'text-warning' : 
              'text-destructive'
            }`}>
              {data.cumplimiento.toFixed(1)}%
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-muted-foreground">Auditorías</span>
            <span className="text-sm font-semibold tabular-nums">
              {data.auditorias}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-muted-foreground">Total Items</span>
            <span className="text-sm font-semibold tabular-nums">
              {data.total.toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    )
  }
  return null
}

const getBarColor = (value: number) => {
  if (value >= 80) return "#10b981" // Verde
  if (value >= 60) return "#f59e0b" // Ámbar
  return "#ef4444" // Rojo
}

export function OperationsBarChart({ data }: OperationsBarChartProps) {
  const chartData = Object.entries(data)
    .map(([operacion, stats]) => ({
      operacion: operacion,
      operacionCorta: operacion.length > 35 ? operacion.substring(0, 35) + "..." : operacion,
      cumplimiento: Math.round(stats.cumplimiento * 10) / 10,
      auditorias: stats.auditorias,
      total: stats.total,
    }))
    .sort((a, b) => b.cumplimiento - a.cumplimiento)
    .slice(0, 10)

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Building2 className="h-4 w-4 text-primary" />
            </div>
            Cumplimiento por Operación
          </CardTitle>
          <CardDescription>Top 10 operaciones ordenadas por porcentaje de cumplimiento</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[400px] text-muted-foreground">
            No hay datos disponibles
          </div>
        </CardContent>
      </Card>
    )
  }

  const promedio = chartData.reduce((acc, d) => acc + d.cumplimiento, 0) / chartData.length
  const mejorOperacion = chartData[0]
  const peorOperacion = chartData[chartData.length - 1]

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Building2 className="h-4 w-4 text-primary" />
          </div>
          Cumplimiento por Operación
        </CardTitle>
        <CardDescription>
          Top {chartData.length} operaciones ordenadas por porcentaje de cumplimiento
          {chartData.length > 1 && (
            <span className="ml-2 text-xs">
              • Promedio: <span className="font-semibold">{promedio.toFixed(1)}%</span>
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={420}>
          <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 80 }}>
            <CartesianGrid 
              strokeDasharray="3 3" 
              stroke="hsl(var(--border))" 
              opacity={0.3}
            />
            <XAxis 
              dataKey="operacionCorta" 
              angle={-45} 
              textAnchor="end" 
              height={100}
              tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              tickLine={{ stroke: "hsl(var(--border))" }}
            />
            <YAxis 
              stroke="hsl(var(--muted-foreground))"
              tick={{ fontSize: 12 }}
              tickLine={{ stroke: "hsl(var(--border))" }}
              label={{ 
                value: '% Cumplimiento', 
                angle: -90, 
                position: 'insideLeft',
                style: { textAnchor: 'middle', fill: 'hsl(var(--muted-foreground))', fontSize: 12 }
              }}
              domain={[0, 100]}
            />
            <Tooltip content={<CustomTooltip />} />
            <Bar 
              dataKey="cumplimiento" 
              name="% Cumplimiento"
              radius={[8, 8, 0, 0]}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getBarColor(entry.cumplimiento)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
        <div className="mt-6 pt-4 border-t border-border">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {mejorOperacion && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-success/5 border border-success/20">
                <TrendingUp className="h-5 w-5 text-success flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground mb-1">Mejor Desempeño</p>
                  <p className="text-sm font-semibold truncate">{mejorOperacion.operacion}</p>
                  <p className="text-lg font-bold text-success mt-1">
                    {mejorOperacion.cumplimiento.toFixed(1)}%
                  </p>
                </div>
              </div>
            )}
            {peorOperacion && peorOperacion.operacion !== mejorOperacion?.operacion && (
              <div className="flex items-start gap-3 p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                <TrendingDown className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground mb-1">Necesita Mejora</p>
                  <p className="text-sm font-semibold truncate">{peorOperacion.operacion}</p>
                  <p className="text-lg font-bold text-destructive mt-1">
                    {peorOperacion.cumplimiento.toFixed(1)}%
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
