"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"

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

export function MonthlyTrendChart({ data }: MonthlyTrendChartProps) {
  const monthNames = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"]

  const chartData = Object.entries(data)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([mes, stats]) => {
      const [year, month] = mes.split("-")
      return {
        mes: `${monthNames[Number.parseInt(month) - 1]} ${year}`,
        cumplimiento: Math.round(stats.cumplimiento),
        auditorias: stats.auditorias,
      }
    })

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tendencia Mensual de Cumplimiento</CardTitle>
        <CardDescription>Evolución del cumplimiento a lo largo del tiempo</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <LineChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="mes" stroke="hsl(var(--foreground))" />
            <YAxis stroke="hsl(var(--foreground))" domain={[0, 100]} />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
              }}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="cumplimiento"
              stroke="hsl(var(--chart-1))"
              strokeWidth={2}
              name="% Cumplimiento"
              dot={{ fill: "hsl(var(--chart-1))" }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
