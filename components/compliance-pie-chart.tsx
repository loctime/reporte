"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts"
import { CheckCircle2, AlertTriangle, XCircle, Minus } from "lucide-react"

interface CompliancePieChartProps {
  cumple: number
  cumpleParcial: number
  noCumple: number
  noAplica: number
}

const COLORS = {
  cumple: "#10b981", // Verde esmeralda
  cumpleParcial: "#f59e0b", // Ámbar
  noCumple: "#ef4444", // Rojo
  noAplica: "#6b7280", // Gris
}

const CustomTooltip = ({ active, payload, total }: any) => {
  if (active && payload && payload.length) {
    const data = payload[0]
    const percentage = total > 0 ? ((data.value / total) * 100).toFixed(1) : "0"
    
    return (
      <div className="bg-popover border border-border rounded-lg shadow-lg p-3">
        <p className="font-semibold text-sm mb-1">{data.name}</p>
        <p className="text-sm text-muted-foreground">
          <span className="font-mono font-semibold text-foreground">{data.value.toLocaleString()}</span> items
        </p>
        <p className="text-sm text-muted-foreground">
          <span className="font-semibold text-foreground">{percentage}%</span> del total
        </p>
      </div>
    )
  }
  return null
}

export function CompliancePieChart({ cumple, cumpleParcial, noCumple, noAplica }: CompliancePieChartProps) {
  const total = cumple + cumpleParcial + noCumple + noAplica
  
  const data = [
    { 
      name: "Cumple", 
      value: cumple, 
      color: COLORS.cumple,
      icon: CheckCircle2,
      description: "Items que cumplen completamente con los requisitos"
    },
    { 
      name: "Cumple Parcialmente", 
      value: cumpleParcial, 
      color: COLORS.cumpleParcial,
      icon: AlertTriangle,
      description: "Items con cumplimiento parcial"
    },
    { 
      name: "No Cumple", 
      value: noCumple, 
      color: COLORS.noCumple,
      icon: XCircle,
      description: "Items que no cumplen con los requisitos"
    },
    { 
      name: "No Aplica", 
      value: noAplica, 
      color: COLORS.noAplica,
      icon: Minus,
      description: "Items que no aplican en esta evaluación"
    },
  ].filter(item => item.value > 0) // Solo mostrar categorías con datos

  if (total === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Distribución de Cumplimiento</CardTitle>
          <CardDescription>Estado consolidado de todos los items evaluados</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[300px] text-muted-foreground">
            No hay datos disponibles
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-success/10 flex items-center justify-center">
            <CheckCircle2 className="h-4 w-4 text-success" />
          </div>
          Distribución de Cumplimiento
        </CardTitle>
        <CardDescription>
          Estado consolidado de {total.toLocaleString()} items evaluados en todas las auditorías
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={320}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent, value }) => {
                if (percent < 0.05) return "" // No mostrar etiquetas muy pequeñas
                return `${(percent * 100).toFixed(0)}%`
              }}
              outerRadius={100}
              innerRadius={40}
              paddingAngle={2}
              dataKey="value"
              animationBegin={0}
              animationDuration={800}
            >
              {data.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.color}
                  stroke={entry.color}
                  strokeWidth={2}
                />
              ))}
            </Pie>
            <Tooltip content={(props) => <CustomTooltip {...props} total={total} />} />
            <Legend 
              verticalAlign="bottom" 
              height={36}
              formatter={(value: string) => value}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-6">
          {data.map((item) => {
            const Icon = item.icon
            const percentage = ((item.value / total) * 100).toFixed(1)
            
            return (
              <div 
                key={item.name} 
                className="flex items-start gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
              >
                <div 
                  className="h-5 w-5 rounded-full flex-shrink-0 mt-0.5 flex items-center justify-center"
                  style={{ backgroundColor: `${item.color}20`, color: item.color }}
                >
                  <Icon className="h-3 w-3" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <span className="text-sm font-semibold text-foreground">{item.name}</span>
                    <span className="text-sm font-bold tabular-nums" style={{ color: item.color }}>
                      {percentage}%
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-1">{item.description}</p>
                  <p className="text-xs font-mono text-muted-foreground">
                    {item.value.toLocaleString()} items
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
