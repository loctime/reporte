"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Area, AreaChart } from "recharts"
import { TrendingUp } from "lucide-react"

interface MonthlyTrendChartProps {
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
      <div className="bg-popover border border-border rounded-lg shadow-lg p-4">
        <p className="font-semibold text-sm mb-3">{label}</p>
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-4">
            <span className="text-sm text-muted-foreground">Cumplimiento</span>
            <span className="text-sm font-bold tabular-nums text-primary">
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

export function MonthlyTrendChart({ data }: MonthlyTrendChartProps) {
  const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]

  const chartData = Object.entries(data)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mes, stats]) => {
      const [year, month] = mes.split("-")
      return {
        mes: `${monthNames[Number.parseInt(month) - 1]} ${year}`,
        mesCorto: `${monthNames[Number.parseInt(month) - 1]}`,
        cumplimiento: Math.round(stats.cumplimiento * 10) / 10,
        auditorias: stats.auditorias,
        total: stats.total,
      }
    })

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <TrendingUp className="h-4 w-4 text-primary" />
            </div>
            Tendencia Mensual de Cumplimiento
          </CardTitle>
          <CardDescription>Evolución del cumplimiento a lo largo del tiempo</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[300px] text-muted-foreground">
            No hay datos disponibles
          </div>
        </CardContent>
      </Card>
    )
  }

  // Calcular la tendencia general
  const tendencia = chartData.length > 1 
    ? chartData[chartData.length - 1].cumplimiento - chartData[0].cumplimiento
    : 0
  const isMejorando = tendencia > 0

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <TrendingUp className="h-4 w-4 text-primary" />
          </div>
          Tendencia Mensual de Cumplimiento
        </CardTitle>
        <CardDescription>
          Evolución del porcentaje de cumplimiento a lo largo del tiempo
          {chartData.length > 1 && (
            <span className={`ml-2 font-semibold ${isMejorando ? 'text-success' : 'text-destructive'}`}>
              {isMejorando ? '↑' : '↓'} {Math.abs(tendencia).toFixed(1)}% 
              {isMejorando ? ' mejorando' : ' disminuyendo'}
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={320}>
          <AreaChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
            <defs>
              <linearGradient id="colorCumplimiento" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0.05}/>
              </linearGradient>
            </defs>
            <CartesianGrid 
              strokeDasharray="3 3" 
              stroke="hsl(var(--border))" 
              opacity={0.3}
            />
            <XAxis 
              dataKey="mes" 
              stroke="hsl(var(--muted-foreground))"
              tick={{ fontSize: 12 }}
              tickLine={{ stroke: "hsl(var(--border))" }}
            />
            <YAxis 
              stroke="hsl(var(--muted-foreground))"
              domain={[0, 100]}
              tick={{ fontSize: 12 }}
              tickLine={{ stroke: "hsl(var(--border))" }}
              label={{ 
                value: '% Cumplimiento', 
                angle: -90, 
                position: 'insideLeft',
                style: { textAnchor: 'middle', fill: 'hsl(var(--muted-foreground))', fontSize: 12 }
              }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Area
              type="monotone"
              dataKey="cumplimiento"
              stroke="hsl(var(--primary))"
              strokeWidth={3}
              fill="url(#colorCumplimiento)"
              name="% Cumplimiento"
              dot={{ 
                fill: "hsl(var(--primary))", 
                strokeWidth: 2, 
                r: 5,
                stroke: "hsl(var(--background))"
              }}
              activeDot={{ 
                r: 7, 
                stroke: "hsl(var(--primary))",
                strokeWidth: 2,
                fill: "hsl(var(--background))"
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
        {chartData.length > 0 && (
          <div className="mt-4 pt-4 border-t border-border">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Promedio</p>
                <p className="text-lg font-bold tabular-nums">
                  {(chartData.reduce((acc, d) => acc + d.cumplimiento, 0) / chartData.length).toFixed(1)}%
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Máximo</p>
                <p className="text-lg font-bold tabular-nums text-success">
                  {Math.max(...chartData.map(d => d.cumplimiento)).toFixed(1)}%
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Mínimo</p>
                <p className="text-lg font-bold tabular-nums text-destructive">
                  {Math.min(...chartData.map(d => d.cumplimiento)).toFixed(1)}%
                </p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
