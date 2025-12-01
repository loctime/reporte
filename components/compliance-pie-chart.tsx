"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from "recharts"

interface CompliancePieChartProps {
  cumple: number
  cumpleParcial: number
  noCumple: number
  noAplica: number
}

export function CompliancePieChart({ cumple, cumpleParcial, noCumple, noAplica }: CompliancePieChartProps) {
  const data = [
    { name: "Cumple", value: cumple, color: "hsl(var(--chart-2))" },
    { name: "Cumple Parcialmente", value: cumpleParcial, color: "hsl(var(--chart-4))" },
    { name: "No Cumple", value: noCumple, color: "hsl(var(--chart-3))" },
    { name: "No Aplica", value: noAplica, color: "hsl(var(--muted))" },
  ]

  const total = cumple + cumpleParcial + noCumple + noAplica

  return (
    <Card>
      <CardHeader>
        <CardTitle>Distribución de Cumplimiento</CardTitle>
        <CardDescription>Estado consolidado de todos los items evaluados</CardDescription>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
        <div className="grid grid-cols-2 gap-4 mt-4">
          {data.map((item) => (
            <div key={item.name} className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="text-sm">
                {item.name}: <span className="font-semibold">{item.value}</span> (
                {((item.value / total) * 100).toFixed(1)}%)
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
