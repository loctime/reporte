"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Calendar, FileSpreadsheet } from "lucide-react"
import { cn, formatDate } from "@/lib/utils"
import type { AuditFile } from "@/lib/types"
import { useAudit } from "@/lib/audit-context"
import { loadColumnConfig } from "@/lib/column-config"
import * as XLSX from "xlsx"

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

interface PreviewData {
  c5: string | number | null
  k5: string | number | null
  fileName: string
}

export function AnnualCalendarTable({ auditFiles }: AnnualCalendarTableProps) {
  const { getFileBlob } = useAudit()
  const [isPreviewOpen, setIsPreviewOpen] = useState(false)
  const [previewData, setPreviewData] = useState<PreviewData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  
  // Obtener todas las operaciones únicas
  const operaciones = [...new Set(auditFiles.map((f) => f.operacion))].sort()

  // Obtener el rango de años de las auditorías
  const years = [...new Set(auditFiles.map((f) => f.fecha.getFullYear()))].sort()
  const currentYear = years.length > 0 ? years[years.length - 1] : new Date().getFullYear()

  // Función para mostrar vista previa del archivo Excel
  const handleCellClick = async (operacion: string, monthIndex: number, files: AuditFile[] | null) => {
    if (!files || files.length === 0) return
    
    // Si hay múltiples archivos, usar el primero (el más reciente)
    const fileToPreview = files[0]
    const blob = getFileBlob(fileToPreview.fileName)
    
    if (!blob) {
      return
    }

    setIsLoading(true)
    setIsPreviewOpen(true)

    try {
      // Leer el archivo Excel
      const arrayBuffer = await blob.arrayBuffer()
      const workbook = XLSX.read(arrayBuffer, { type: "array" })
      const firstSheet = workbook.Sheets[workbook.SheetNames[0]]

      // Obtener configuración de columnas
      const config = loadColumnConfig()
      
      // Función para convertir índice de columna a notación Excel (0=A, 1=B, ..., 25=Z, 26=AA, etc.)
      const colIndexToExcel = (colIndex: number): string => {
        let result = ""
        let num = colIndex
        while (num >= 0) {
          result = String.fromCharCode(65 + (num % 26)) + result
          num = Math.floor(num / 26) - 1
        }
        return result
      }
      
      // Determinar qué celdas leer (usar configuración o valores por defecto)
      let operacionCell = "C5" // Por defecto
      let fechaCell = "K5" // Por defecto
      
      if (config?.operacionCell) {
        // Convertir índices base 0 a notación Excel (ej: fila 4, col 2 = C5)
        const colLetter = colIndexToExcel(config.operacionCell.col)
        operacionCell = `${colLetter}${config.operacionCell.row + 1}`
      }
      
      if (config?.fechaCell) {
        const colLetter = colIndexToExcel(config.fechaCell.col)
        fechaCell = `${colLetter}${config.fechaCell.row + 1}`
      }

      // Extraer las celdas configuradas (o por defecto)
      const operacion = firstSheet[operacionCell] ? firstSheet[operacionCell].v : null
      let fecha: string | number | null = null
      
      const fechaCellData = firstSheet[fechaCell]
      if (fechaCellData) {
        // Siempre usar el valor crudo (v) para evitar problemas de formato
        // El valor formateado (w) puede estar en diferentes formatos según la configuración de Excel
        fecha = formatDate(fechaCellData.v)
      }

      setPreviewData({
        c5: operacion,
        k5: fecha,
        fileName: fileToPreview.fileName,
      })
    } catch (error) {
      console.error("Error al leer el archivo Excel:", error)
      setPreviewData({
        c5: "Error al leer",
        k5: "Error al leer",
        fileName: fileToPreview.fileName,
      })
    } finally {
      setIsLoading(false)
    }
  }

  // Crear estructura de datos: operación -> mes -> cumplimiento y archivos
  const dataByOperacionMes: Record<
    string,
    Record<string, { cumplimiento: number; auditorias: number; files: AuditFile[] }>
  > = {}

  // Inicializar todas las operaciones
  operaciones.forEach((operacion) => {
    dataByOperacionMes[operacion] = {}
  })

  // Procesar cada auditoría
  // Ordenar por fecha para asegurar consistencia
  const sortedFiles = [...auditFiles].sort((a, b) => a.fecha.getTime() - b.fecha.getTime())
  
  sortedFiles.forEach((file) => {
    const operacion = file.operacion
    const year = file.fecha.getFullYear()
    const month = file.fecha.getMonth() // 0-11
    const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`
    
    // Validar que la fecha sea válida
    if (isNaN(file.fecha.getTime())) {
      console.warn(`Fecha inválida en archivo: ${file.fileName}`, file.fecha)
      return
    }

    if (!dataByOperacionMes[operacion]) {
      dataByOperacionMes[operacion] = {}
    }

    // Si hay múltiples auditorías en el mismo mes para la misma operación, promediamos
    if (!dataByOperacionMes[operacion][monthKey]) {
      dataByOperacionMes[operacion][monthKey] = {
        cumplimiento: file.cumplimiento,
        auditorias: 1,
        files: [file],
      }
    } else {
      // Promediar el cumplimiento y agregar el archivo
      const existing = dataByOperacionMes[operacion][monthKey]
      const totalAuditorias = existing.auditorias + 1
      dataByOperacionMes[operacion][monthKey] = {
        cumplimiento:
          (existing.cumplimiento * existing.auditorias + file.cumplimiento) / totalAuditorias,
        auditorias: totalAuditorias,
        files: [...existing.files, file],
      }
    }
  })

  // Crear datos para la tabla del año actual
  const tableData = operaciones.map((operacion) => {
    const row: {
      operacion: string
      meses: (number | null)[]
      monthFiles: (AuditFile[] | null)[]
    } = {
      operacion,
      meses: [],
      monthFiles: [],
    }

    // Para cada mes del año actual
    for (let month = 0; month < 12; month++) {
      const monthKey = `${currentYear}-${String(month + 1).padStart(2, "0")}`
      const data = dataByOperacionMes[operacion]?.[monthKey]

      if (data) {
        row.meses.push(Math.round(data.cumplimiento * 10) / 10)
        row.monthFiles.push(data.files)
      } else {
        row.meses.push(null)
        row.monthFiles.push(null)
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
                  {row.meses.map((porcentaje, monthIndex) => {
                    const monthFiles = row.monthFiles[monthIndex]
                    const hasFile = monthFiles !== null && monthFiles.length > 0
                    return (
                      <TableCell
                        key={monthIndex}
                        onClick={() => hasFile && handleCellClick(row.operacion, monthIndex, monthFiles)}
                        className={cn(
                          "text-center border-2 p-2",
                          getComplianceColor(porcentaje),
                          porcentaje !== null && "font-mono",
                          hasFile && "cursor-pointer hover:opacity-80 transition-opacity"
                        )}
                        title={hasFile ? "Haz clic para ver vista previa del archivo Excel" : undefined}
                      >
                        {porcentaje !== null ? (
                          <span className={cn("text-sm font-semibold", getComplianceTextColor(porcentaje))}>
                            {porcentaje.toFixed(0)}%
                          </span>
                        ) : (
                          <span className="text-muted-foreground/50 text-xs">-</span>
                        )}
                      </TableCell>
                    )
                  })}
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

      {/* Diálogo de vista previa */}
      <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              Vista Previa del Archivo
            </DialogTitle>
            <DialogDescription>
              {previewData?.fileName}
            </DialogDescription>
          </DialogHeader>
          
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-muted-foreground">Cargando...</div>
            </div>
          ) : previewData ? (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
                  <span className="font-semibold text-sm">Operación (C5):</span>
                  <span className="text-sm font-mono text-right max-w-[60%] break-words">
                    {previewData.c5 !== null ? String(previewData.c5) : "Vacía"}
                  </span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border">
                  <span className="font-semibold text-sm">Fecha (K5):</span>
                  <span className="text-sm font-mono">
                    {previewData.k5 !== null ? String(previewData.k5) : "Vacía"}
                  </span>
                </div>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </Card>
  )
}

