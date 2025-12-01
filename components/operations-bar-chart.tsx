"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts"

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

export function OperationsBarChart({ data }: OperationsBarChartProps) {
  const chartData = Object.entries(data)
    .map(([operacion, stats]) => ({
      operacion: operacion.length > 30 ? operacion.substring(0, 30) + "..." : operacion,
      cumplimiento: Math.round(stats.cumplimiento),
      auditorias: stats.auditorias,
    }))
    .sort((a, b) => b.cumplimiento - a.cumplimiento)
    .slice(0, 10)

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cumplimiento por Operación</CardTitle>
        <CardDescription>Top 10 operaciones ordenadas por porcentaje de cumplimiento</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart data={chartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="operacion" angle={-45} textAnchor="end" height={100} stroke="hsl(var(--foreground))" />
            <YAxis stroke="hsl(var(--foreground))" />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "8px",
              }}
            />
            <Legend />
            <Bar dataKey="cumplimiento" fill="hsl(var(--chart-1))" name="% Cumplimiento" />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
