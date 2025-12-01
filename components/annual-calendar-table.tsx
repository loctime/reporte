"use client"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Calendar } from "lucide-react"
import { cn } from "@/lib/utils"
import type { AuditFile } from "@/lib/types"

interface AnnualCalendarTableProps {
  auditFiles: AuditFile[]
}

const monthNames = ["ENE", "FEB", "MAR", "ABR", "MAY", "JUN", "JUL", "AGO", "SEP", "OCT", "NOV", "DIC"]

const getComplianceColor = (percentage: number | null): string => {
  if (percentage === null) return "bg-muted/30 border-border/50"
  if (percentage >= 75) return "bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700"
  if (percentage >= 50) return "bg-yellow-100 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700"
  return "bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700"
}

const getComplianceTextColor = (percentage: number | null): string => {
  if (percentage === null) return "text-muted-foreground"
  if (percentage >= 75) return "text-green-700 dark:text-green-300 font-bold"
  if (percentage >= 50) return "text-yellow-700 dark:text-yellow-300 font-bold"
  return "text-red-700 dark:text-red-300 font-bold"
}

const getComplianceLabel = (percentage: number | null): string => {
  if (percentage === null) return "N/A"
  if (percentage >= 75) return "Cumple"
  if (percentage >= 50) return "Cumple Parcialmente"
  return "No Cumple"
}

export function AnnualCalendarTable({ auditFiles }: AnnualCalendarTableProps) {
  // Obtener todas las operaciones únicas
  const operaciones = [...new Set(auditFiles.map((f) => f.operacion))].sort()

  // Obtener el rango de años de las auditorías
  const years = [...new Set(auditFiles.map((f) => f.fecha.getFullYear()))].sort()
  const currentYear = years.length > 0 ? years[years.length - 1] : new Date().getFullYear()

  // Crear estructura de datos: operación -> mes -> cumplimiento
  const dataByOperacionMes: Record<
    string,
    Record<string, { cumplimiento: number; auditorias: number }>
  > = {}

  // Inicializar todas las operaciones
  operaciones.forEach((operacion) => {
    dataByOperacionMes[operacion] = {}
  })

  // Procesar cada auditoría
  auditFiles.forEach((file) => {
    const operacion = file.operacion
    const year = file.fecha.getFullYear()
    const month = file.fecha.getMonth() // 0-11
    const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`

    if (!dataByOperacionMes[operacion]) {
      dataByOperacionMes[operacion] = {}
    }

    // Si hay múltiples auditorías en el mismo mes para la misma operación, promediamos
    if (!dataByOperacionMes[operacion][monthKey]) {
      dataByOperacionMes[operacion][monthKey] = {
        cumplimiento: file.cumplimiento,
        auditorias: 1,
      }
    } else {
      // Promediar el cumplimiento
      const existing = dataByOperacionMes[operacion][monthKey]
      const totalAuditorias = existing.auditorias + 1
      dataByOperacionMes[operacion][monthKey] = {
        cumplimiento:
          (existing.cumplimiento * existing.auditorias + file.cumplimiento) / totalAuditorias,
        auditorias: totalAuditorias,
      }
    }
  })

  // Crear datos para la tabla del año actual
  const tableData = operaciones.map((operacion) => {
    const row: {
      operacion: string
      meses: (number | null)[]
    } = {
      operacion,
      meses: [],
    }

    // Para cada mes del año actual
    for (let month = 0; month < 12; month++) {
      const monthKey = `${currentYear}-${String(month + 1).padStart(2, "0")}`
      const data = dataByOperacionMes[operacion]?.[monthKey]

      if (data) {
        row.meses.push(Math.round(data.cumplimiento * 10) / 10)
      } else {
        row.meses.push(null)
      }
    }

    return row
  })

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Calendar className="h-4 w-4 text-primary" />
          </div>
          Calendario Anual de Cumplimiento
        </CardTitle>
        <CardDescription>
          Porcentajes mensuales de cumplimiento por operación - Año {currentYear}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {/* Referencias */}
        <div className="mb-6 p-4 rounded-lg bg-muted/50 border border-border">
          <h3 className="text-sm font-semibold mb-3">Referencias FR 42 - Control de Calidad en Campo</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="flex items-center gap-2">
              <div className="h-5 w-5 rounded border-2 bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700" />
              <div>
                <p className="text-xs font-semibold text-green-700 dark:text-green-300">CUMPLE</p>
                <p className="text-xs text-muted-foreground">% entre 75 y 100</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-5 w-5 rounded border-2 bg-yellow-100 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700" />
              <div>
                <p className="text-xs font-semibold text-yellow-700 dark:text-yellow-300">CUMPLE PARCIALMENTE</p>
                <p className="text-xs text-muted-foreground">% entre 50 y 75</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-5 w-5 rounded border-2 bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700" />
              <div>
                <p className="text-xs font-semibold text-red-700 dark:text-red-300">NO CUMPLE</p>
                <p className="text-xs text-muted-foreground">% menor a 50</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-5 w-5 rounded border-2 bg-muted/30 border-border" />
              <div>
                <p className="text-xs font-semibold text-muted-foreground">NO APLICA</p>
                <p className="text-xs text-muted-foreground">Sin datos</p>
              </div>
            </div>
          </div>
        </div>

        {/* Tabla */}
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="sticky left-0 z-10 bg-card min-w-[200px] font-semibold">OPERACIÓN</TableHead>
                {monthNames.map((month) => (
                  <TableHead key={month} className="text-center min-w-[70px] font-semibold">
                    {month}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {tableData.map((row, rowIndex) => (
                <TableRow key={rowIndex}>
                  <TableCell className="sticky left-0 z-10 bg-card font-medium">
                    {row.operacion}
                  </TableCell>
                  {row.meses.map((porcentaje, monthIndex) => (
                    <TableCell
                      key={monthIndex}
                      className={cn(
                        "text-center border-2 p-2",
                        getComplianceColor(porcentaje),
                        porcentaje !== null && "font-mono"
                      )}
                    >
                      {porcentaje !== null ? (
                        <span className={cn("text-sm font-semibold", getComplianceTextColor(porcentaje))}>
                          {porcentaje.toFixed(0)}%
                        </span>
                      ) : (
                        <span className="text-muted-foreground/50 text-xs">-</span>
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>

        {tableData.length === 0 && (
          <div className="flex items-center justify-center h-[200px] text-muted-foreground">
            No hay datos disponibles para mostrar
          </div>
        )}
      </CardContent>
    </Card>
  )
}

