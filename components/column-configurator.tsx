"use client"

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, X, AlertCircle } from "lucide-react"
import { saveColumnConfig, loadColumnConfig, type ColumnConfig } from "@/lib/column-config"
import { cn, formatDate } from "@/lib/utils"
import * as XLSX from "xlsx"

interface ColumnConfiguratorProps {
  rawData: any[][]
  headerRowIndex: number
  onConfigComplete: (config: ColumnConfig) => void
  onSkip: () => void
  sheet?: XLSX.WorkSheet // Objeto sheet completo para obtener formato
}

type ConfigStep = "pregunta" | "cumple" | "cumpleParcial" | "noCumple" | "noAplica" | "observacion" | "cumplimiento" | "totalItems" | "cumpleCell" | "cumpleParcialCell" | "noCumpleCell" | "noAplicaCell" | "operacionCell" | "fechaCell" | "cumplePctCell" | "cumpleParcialPctCell" | "noCumplePctCell" | "noAplicaPctCell" | "complete"

const stepLabels: Record<ConfigStep, string> = {
  pregunta: "Columna de Preguntas",
  cumple: "Columna CUMPLE",
  cumpleParcial: "Columna CUMPLE PARCIAL",
  noCumple: "Columna NO CUMPLE",
  noAplica: "Columna NO APLICA",
  observacion: "Columna de Observaciones (opcional)",
  cumplimiento: "Celda de Cumplimiento (opcional)",
  totalItems: "Celda de Total Items",
  cumpleCell: "Celda de Cantidad CUMPLE",
  cumpleParcialCell: "Celda de Cantidad CUMPLE PARCIAL",
  noCumpleCell: "Celda de Cantidad NO CUMPLE",
  noAplicaCell: "Celda de Cantidad NO APLICA",
  operacionCell: "Celda de Operación (para vista previa)",
  fechaCell: "Celda de Fecha (para vista previa)",
  cumplePctCell: "Celda de Porcentaje CUMPLE (C13 por defecto)",
  cumpleParcialPctCell: "Celda de Porcentaje CUMPLE PARCIAL (D13 por defecto)",
  noCumplePctCell: "Celda de Porcentaje NO CUMPLE (E13 por defecto)",
  noAplicaPctCell: "Celda de Porcentaje NO APLICA (F13 por defecto)",
  complete: "Configuración Completa",
}

export function ColumnConfigurator({
  rawData,
  headerRowIndex,
  onConfigComplete,
  onSkip,
  sheet,
}: ColumnConfiguratorProps) {
  const [currentStep, setCurrentStep] = useState<ConfigStep>("pregunta")
  const [config, setConfig] = useState<Partial<ColumnConfig>>(() => {
    // Cargar configuración guardada si existe
    const saved = loadColumnConfig()
    if (saved) {
      return saved
    }
    return {
      headerRowIndex,
      observacion: null,
      cumplimientoCol: null,
      cumplimientoRow: null,
      totalItemsCell: null,
      cumpleCell: null,
      cumpleParcialCell: null,
      noCumpleCell: null,
      noAplicaCell: null,
      operacionCell: null,
      fechaCell: null,
      cumplePctCell: null,
      cumpleParcialPctCell: null,
      noCumplePctCell: null,
      noAplicaPctCell: null,
    }
  })

  const headerRow = rawData[headerRowIndex] || []
  const maxColumns = Math.max(...rawData.map((row) => row?.length || 0), 0)

  const [selectedRow, setSelectedRow] = useState<number | null>(null)

  // Extraer información de formato del Excel
  const excelFormat = useMemo(() => {
    if (!sheet) return { mergedCells: [], columnWidths: {}, cellStyles: {}, rowHeights: {} }

    // Extraer merged cells
    const mergedCells: Array<{ s: { r: number; c: number }; e: { r: number; c: number } }> = []
    if (sheet['!merges']) {
      sheet['!merges'].forEach((merge: XLSX.Range) => {
        mergedCells.push({
          s: { r: merge.s.r, c: merge.s.c },
          e: { r: merge.e.r, c: merge.e.c },
        })
      })
    }

    // Extraer anchos de columna
    const columnWidths: Record<number, number> = {}
    if (sheet['!cols']) {
      sheet['!cols'].forEach((col: any, index: number) => {
        if (col && col.w) {
          // w está en caracteres, convertir a píxeles aproximados (1 char ≈ 7px)
          columnWidths[index] = col.w * 7
        } else if (col && col.width) {
          columnWidths[index] = col.width * 7
        }
      })
    }

    // Extraer alturas de fila
    const rowHeights: Record<number, number> = {}
    if (sheet['!rows']) {
      Object.keys(sheet['!rows']).forEach((rowIndex) => {
        const row = sheet['!rows'][parseInt(rowIndex)]
        if (row && row.hpt) {
          // hpt está en puntos, convertir a píxeles (1 punto ≈ 1.33px)
          rowHeights[parseInt(rowIndex)] = row.hpt * 1.33
        } else if (row && row.h) {
          rowHeights[parseInt(rowIndex)] = row.h * 1.33
        }
      })
    }

    // Extraer estilos de celdas
    const cellStyles: Record<string, any> = {}
    Object.keys(sheet).forEach((key) => {
      if (key.startsWith('!')) return
      const cell = sheet[key]
      if (cell && cell.s) {
        cellStyles[key] = cell.s
      }
    })

    return { mergedCells, columnWidths, cellStyles, rowHeights }
  }, [sheet])

  // Función para verificar si una celda está en un merged range
  const getMergedCellInfo = (rowIndex: number, colIndex: number) => {
    for (const merge of excelFormat.mergedCells) {
      if (
        rowIndex >= merge.s.r &&
        rowIndex <= merge.e.r &&
        colIndex >= merge.s.c &&
        colIndex <= merge.e.c
      ) {
        const isStartCell = rowIndex === merge.s.r && colIndex === merge.s.c
        const rowSpan = merge.e.r - merge.s.r + 1
        const colSpan = merge.e.c - merge.s.c + 1
        return { isMerged: true, isStartCell, rowSpan, colSpan }
      }
    }
    return { isMerged: false, isStartCell: false, rowSpan: 1, colSpan: 1 }
  }

  // Función para obtener el ancho de columna
  const getColumnWidth = (colIndex: number): number => {
    return excelFormat.columnWidths[colIndex] || 120 // Ancho por defecto
  }

  // Función para obtener la altura de fila
  const getRowHeight = (rowIndex: number): number => {
    return excelFormat.rowHeights[rowIndex] || 32 // Altura por defecto
  }

  // Función para convertir índice de columna a notación Excel (A, B, C, ..., Z, AA, AB, ...)
  const colIndexToExcel = (colIndex: number): string => {
    let result = ""
    let num = colIndex
    while (num >= 0) {
      result = String.fromCharCode(65 + (num % 26)) + result
      num = Math.floor(num / 26) - 1
    }
    return result
  }

  // Función para obtener la dirección de celda en notación Excel (A1, B2, etc.)
  const getCellAddress = (rowIndex: number, colIndex: number): string => {
    return `${colIndexToExcel(colIndex)}${rowIndex + 1}`
  }

  // Función para convertir color Excel a CSS
  const excelColorToCSS = (color: any): string | undefined => {
    if (!color) return undefined

    // RGB directo
    if (color.rgb) {
      return `#${color.rgb}`
    }

    // ARGB (formato Excel: AARRGGBB)
    if (color.argb) {
      const argb = color.argb
      // Si tiene formato completo AARRGGBB, tomar solo RGB
      if (argb.length === 8) {
        return `#${argb.slice(2)}`
      }
      return `#${argb}`
    }

    // Tema (referencia a tema de Excel)
    if (color.theme !== undefined) {
      // Mapeo básico de temas comunes de Excel
      const themeColors: Record<number, string> = {
        0: "#000000", // Texto 1
        1: "#FFFFFF", // Fondo 1
        2: "#FF0000", // Acento 1
        3: "#00FF00", // Acento 2
        4: "#0000FF", // Acento 3
        5: "#FFFF00", // Acento 4
        6: "#FF00FF", // Acento 5
        7: "#00FFFF", // Acento 6
      }
      return themeColors[color.theme] || undefined
    }

    return undefined
  }

  // Función para obtener el estilo de una celda
  const getCellStyle = (rowIndex: number, colIndex: number): React.CSSProperties => {
    const cellAddress = getCellAddress(rowIndex, colIndex)
    const style = excelFormat.cellStyles[cellAddress] || {}

    // Extraer color de fondo
    let backgroundColor: string | undefined
    if (style.fill) {
      if (style.fill.fgColor) {
        backgroundColor = excelColorToCSS(style.fill.fgColor)
      } else if (style.fill.bgColor) {
        backgroundColor = excelColorToCSS(style.fill.bgColor)
      }
    }

    // Extraer color de texto
    const textColor = style.font?.color ? excelColorToCSS(style.font.color) : undefined

    // Extraer estilos de borde
    const borderStyle: React.CSSProperties = {}
    if (style.border) {
      const borders = ["top", "bottom", "left", "right"] as const
      borders.forEach((side) => {
        const border = style.border[side]
        if (border && border.style) {
          const borderColor = border.color ? excelColorToCSS(border.color) : "#000000"
          const borderWidth = border.style === "thin" ? "1px" : 
                            border.style === "medium" ? "2px" :
                            border.style === "thick" ? "3px" :
                            border.style === "double" ? "3px" : "1px"
          
          borderStyle[`border${side.charAt(0).toUpperCase() + side.slice(1)}` as keyof React.CSSProperties] = `${borderWidth} solid ${borderColor}`
        }
      })
    }

    return {
      backgroundColor,
      color: textColor,
      fontWeight: style.font?.bold ? "bold" : style.font?.weight || undefined,
      fontStyle: style.font?.italic ? "italic" : undefined,
      textAlign: style.alignment?.horizontal || "left",
      verticalAlign: style.alignment?.vertical || "top",
      fontSize: style.font?.sz ? `${style.font.sz}pt` : undefined,
      textDecoration: style.font?.underline ? "underline" : 
                     style.font?.strike ? "line-through" : undefined,
      fontFamily: style.font?.name || undefined,
      ...borderStyle,
    }
  }

  // Función para formatear fechas de Excel (números seriales)
  const formatExcelDate = (value: any): string => {
    if (value === null || value === undefined || value === "") {
      return "(vacía)"
    }
    
    // Usar la función centralizada de formateo
    const formatted = formatDate(value)
    if (formatted && formatted !== String(value)) {
      return formatted
    }
    
    // Si no se pudo formatear como fecha, devolver el valor como string
    return String(value)
  }

  const handleCellClick = (rowIndex: number, colIndex: number) => {
    // Para pasos de celdas (estadísticas), necesitamos fila y columna
    if (currentStep === "totalItems") {
      setConfig({ ...config, totalItemsCell: { row: rowIndex, col: colIndex } })
      setCurrentStep("cumpleCell")
    } else if (currentStep === "cumpleCell") {
      setConfig({ ...config, cumpleCell: { row: rowIndex, col: colIndex } })
      setCurrentStep("cumpleParcialCell")
    } else if (currentStep === "cumpleParcialCell") {
      setConfig({ ...config, cumpleParcialCell: { row: rowIndex, col: colIndex } })
      setCurrentStep("noCumpleCell")
    } else if (currentStep === "noCumpleCell") {
      setConfig({ ...config, noCumpleCell: { row: rowIndex, col: colIndex } })
      setCurrentStep("noAplicaCell")
    } else if (currentStep === "noAplicaCell") {
      setConfig({ ...config, noAplicaCell: { row: rowIndex, col: colIndex } })
      setCurrentStep("operacionCell")
    } else if (currentStep === "operacionCell") {
      setConfig({ ...config, operacionCell: { row: rowIndex, col: colIndex } })
      setCurrentStep("fechaCell")
    } else if (currentStep === "fechaCell") {
      setConfig({ ...config, fechaCell: { row: rowIndex, col: colIndex } })
      setCurrentStep("cumplePctCell")
    } else if (currentStep === "cumplePctCell") {
      setConfig({ ...config, cumplePctCell: { row: rowIndex, col: colIndex } })
      setCurrentStep("cumpleParcialPctCell")
    } else if (currentStep === "cumpleParcialPctCell") {
      setConfig({ ...config, cumpleParcialPctCell: { row: rowIndex, col: colIndex } })
      setCurrentStep("noCumplePctCell")
    } else if (currentStep === "noCumplePctCell") {
      setConfig({ ...config, noCumplePctCell: { row: rowIndex, col: colIndex } })
      setCurrentStep("noAplicaPctCell")
    } else if (currentStep === "noAplicaPctCell") {
      setConfig({ ...config, noAplicaPctCell: { row: rowIndex, col: colIndex } })
      setCurrentStep("complete")
    } else {
      // Para pasos de columnas, solo necesitamos la columna
      handleColumnClick(colIndex)
    }
  }

  const handleColumnClick = (colIndex: number) => {
    if (currentStep === "pregunta") {
      setConfig({ ...config, pregunta: colIndex })
      setCurrentStep("cumple")
    } else if (currentStep === "cumple") {
      setConfig({ ...config, cumple: colIndex })
      setCurrentStep("cumpleParcial")
    } else if (currentStep === "cumpleParcial") {
      setConfig({ ...config, cumpleParcial: colIndex })
      setCurrentStep("noCumple")
    } else if (currentStep === "noCumple") {
      setConfig({ ...config, noCumple: colIndex })
      setCurrentStep("noAplica")
    } else if (currentStep === "noAplica") {
      setConfig({ ...config, noAplica: colIndex })
      setCurrentStep("observacion")
    } else if (currentStep === "observacion") {
      setConfig({ ...config, observacion: colIndex })
      setCurrentStep("cumplimiento")
    } else if (currentStep === "cumplimiento") {
      // Para cumplimiento necesitamos fila y columna
      // Por ahora solo guardamos la columna, la fila la detectaremos automáticamente
      setConfig({ ...config, cumplimientoCol: colIndex })
      setCurrentStep("totalItems")
    }
  }

  const handleSkipObservacion = () => {
    setConfig({ ...config, observacion: null })
    setCurrentStep("cumplimiento")
  }

  const handleSkipCumplimiento = () => {
    setConfig({ ...config, cumplimientoCol: null, cumplimientoRow: null })
    setCurrentStep("totalItems")
  }

  const handleSkipStats = () => {
    // Saltar todas las estadísticas y usar cálculos
    setConfig({
      ...config,
      totalItemsCell: null,
      cumpleCell: null,
      cumpleParcialCell: null,
      noCumpleCell: null,
      noAplicaCell: null,
    })
    setCurrentStep("operacionCell")
  }

  const handleSkipOperacionFecha = () => {
    // Saltar configuración de operación y fecha
    setConfig({
      ...config,
      operacionCell: null,
      fechaCell: null,
    })
    setCurrentStep("cumplePctCell")
  }

  const handleSkipPorcentajes = () => {
    // Saltar configuración de porcentajes (usar valores por defecto C13, D13, E13, F13)
    setConfig({
      ...config,
      cumplePctCell: null,
      cumpleParcialPctCell: null,
      noCumplePctCell: null,
      noAplicaPctCell: null,
    })
    setCurrentStep("complete")
  }

  const handleComplete = () => {
    // Las celdas de estadísticas son opcionales, solo requerimos las columnas básicas
    if (
      config.pregunta !== undefined &&
      config.cumple !== undefined &&
      config.cumpleParcial !== undefined &&
      config.noCumple !== undefined &&
      config.noAplica !== undefined &&
      config.headerRowIndex !== undefined
    ) {
      const finalConfig: ColumnConfig = {
        pregunta: config.pregunta,
        cumple: config.cumple,
        cumpleParcial: config.cumpleParcial,
        noCumple: config.noCumple,
        noAplica: config.noAplica,
        observacion: config.observacion ?? null,
        headerRowIndex: config.headerRowIndex,
        cumplimientoCol: config.cumplimientoCol ?? null,
        cumplimientoRow: config.cumplimientoRow ?? null,
        totalItemsCell: config.totalItemsCell ?? null,
        cumpleCell: config.cumpleCell ?? null,
        cumpleParcialCell: config.cumpleParcialCell ?? null,
        noCumpleCell: config.noCumpleCell ?? null,
        noAplicaCell: config.noAplicaCell ?? null,
        operacionCell: config.operacionCell ?? null,
        fechaCell: config.fechaCell ?? null,
        cumplePctCell: config.cumplePctCell ?? null,
        cumpleParcialPctCell: config.cumpleParcialPctCell ?? null,
        noCumplePctCell: config.noCumplePctCell ?? null,
        noAplicaPctCell: config.noAplicaPctCell ?? null,
      }
      saveColumnConfig(finalConfig)
      onConfigComplete(finalConfig)
    }
  }

  const handleReset = () => {
    setConfig({ 
      headerRowIndex, 
      observacion: null, 
      cumplimientoCol: null, 
      cumplimientoRow: null,
      totalItemsCell: null,
      cumpleCell: null,
      cumpleParcialCell: null,
      noCumpleCell: null,
      noAplicaCell: null,
      operacionCell: null,
      fechaCell: null,
      cumplePctCell: null,
      cumpleParcialPctCell: null,
      noCumplePctCell: null,
      noAplicaPctCell: null,
    })
    setCurrentStep("pregunta")
  }

  const isColumnSelected = (colIndex: number): boolean => {
    return (
      config.pregunta === colIndex ||
      config.cumple === colIndex ||
      config.cumpleParcial === colIndex ||
      config.noCumple === colIndex ||
      config.noAplica === colIndex ||
      config.observacion === colIndex ||
      config.cumplimientoCol === colIndex
    )
  }

  const getColumnLabel = (colIndex: number): string | null => {
    if (config.pregunta === colIndex) return "Pregunta"
    if (config.cumple === colIndex) return "Cumple"
    if (config.cumpleParcial === colIndex) return "Cumple Parcial"
    if (config.noCumple === colIndex) return "No Cumple"
    if (config.noAplica === colIndex) return "No Aplica"
    if (config.observacion === colIndex) return "Observación"
    if (config.cumplimientoCol === colIndex) return "Cumplimiento"
    return null
  }

  const isConfigComplete =
    config.pregunta !== undefined &&
    config.cumple !== undefined &&
    config.cumpleParcial !== undefined &&
    config.noCumple !== undefined &&
    config.noAplica !== undefined

  if (currentStep === "complete" && isConfigComplete) {
    return (
      <Card className="border-success">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-success">
            <CheckCircle2 className="h-5 w-5" />
            Configuración Completa
          </CardTitle>
          <CardDescription>La configuración ha sido guardada y se usará para todos los archivos</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="p-3 border rounded-lg">
              <p className="text-sm text-muted-foreground">Pregunta</p>
              <p className="font-semibold">Columna {config.pregunta! + 1}</p>
            </div>
            <div className="p-3 border rounded-lg">
              <p className="text-sm text-muted-foreground">Cumple</p>
              <p className="font-semibold">Columna {config.cumple! + 1}</p>
            </div>
            <div className="p-3 border rounded-lg">
              <p className="text-sm text-muted-foreground">Cumple Parcial</p>
              <p className="font-semibold">Columna {config.cumpleParcial! + 1}</p>
            </div>
            <div className="p-3 border rounded-lg">
              <p className="text-sm text-muted-foreground">No Cumple</p>
              <p className="font-semibold">Columna {config.noCumple! + 1}</p>
            </div>
            <div className="p-3 border rounded-lg">
              <p className="text-sm text-muted-foreground">No Aplica</p>
              <p className="font-semibold">Columna {config.noAplica! + 1}</p>
            </div>
            {config.observacion !== null && config.observacion !== undefined && (
              <div className="p-3 border rounded-lg">
                <p className="text-sm text-muted-foreground">Observación</p>
                <p className="font-semibold">Columna {config.observacion + 1}</p>
              </div>
            )}
            {config.cumplimientoCol !== null && config.cumplimientoCol !== undefined && (
              <div className="p-3 border rounded-lg">
                <p className="text-sm text-muted-foreground">Cumplimiento</p>
                <p className="font-semibold">Columna {config.cumplimientoCol + 1}</p>
              </div>
            )}
            {config.totalItemsCell && (
              <div className="p-3 border rounded-lg">
                <p className="text-sm text-muted-foreground">Total Items</p>
                <p className="font-semibold">Fila {config.totalItemsCell.row + 1}, Col {config.totalItemsCell.col + 1}</p>
              </div>
            )}
            {config.cumpleCell && (
              <div className="p-3 border rounded-lg">
                <p className="text-sm text-muted-foreground">Cumple</p>
                <p className="font-semibold">Fila {config.cumpleCell.row + 1}, Col {config.cumpleCell.col + 1}</p>
              </div>
            )}
            {config.cumpleParcialCell && (
              <div className="p-3 border rounded-lg">
                <p className="text-sm text-muted-foreground">Cumple Parcial</p>
                <p className="font-semibold">Fila {config.cumpleParcialCell.row + 1}, Col {config.cumpleParcialCell.col + 1}</p>
              </div>
            )}
            {config.noCumpleCell && (
              <div className="p-3 border rounded-lg">
                <p className="text-sm text-muted-foreground">No Cumple</p>
                <p className="font-semibold">Fila {config.noCumpleCell.row + 1}, Col {config.noCumpleCell.col + 1}</p>
              </div>
            )}
            {config.noAplicaCell && (
              <div className="p-3 border rounded-lg">
                <p className="text-sm text-muted-foreground">No Aplica</p>
                <p className="font-semibold">Fila {config.noAplicaCell.row + 1}, Col {config.noAplicaCell.col + 1}</p>
              </div>
            )}
            {config.operacionCell && (
              <div className="p-3 border rounded-lg">
                <p className="text-sm text-muted-foreground">Operación</p>
                <p className="font-semibold">Fila {config.operacionCell.row + 1}, Col {config.operacionCell.col + 1}</p>
              </div>
            )}
            {config.fechaCell && (
              <div className="p-3 border rounded-lg">
                <p className="text-sm text-muted-foreground">Fecha</p>
                <p className="font-semibold">Fila {config.fechaCell.row + 1}, Col {config.fechaCell.col + 1}</p>
              </div>
            )}
            {config.cumplePctCell && (
              <div className="p-3 border rounded-lg">
                <p className="text-sm text-muted-foreground">% Cumple</p>
                <p className="font-semibold">Fila {config.cumplePctCell.row + 1}, Col {config.cumplePctCell.col + 1}</p>
              </div>
            )}
            {config.cumpleParcialPctCell && (
              <div className="p-3 border rounded-lg">
                <p className="text-sm text-muted-foreground">% Cumple Parcial</p>
                <p className="font-semibold">Fila {config.cumpleParcialPctCell.row + 1}, Col {config.cumpleParcialPctCell.col + 1}</p>
              </div>
            )}
            {config.noCumplePctCell && (
              <div className="p-3 border rounded-lg">
                <p className="text-sm text-muted-foreground">% No Cumple</p>
                <p className="font-semibold">Fila {config.noCumplePctCell.row + 1}, Col {config.noCumplePctCell.col + 1}</p>
              </div>
            )}
            {config.noAplicaPctCell && (
              <div className="p-3 border rounded-lg">
                <p className="text-sm text-muted-foreground">% No Aplica</p>
                <p className="font-semibold">Fila {config.noAplicaPctCell.row + 1}, Col {config.noAplicaPctCell.col + 1}</p>
              </div>
            )}
          </div>
          <div className="flex gap-2">
            <Button onClick={handleComplete} className="flex-1">
              Usar Esta Configuración
            </Button>
            <Button variant="outline" onClick={handleReset}>
              Reconfigurar
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configurar Columnas del Excel</CardTitle>
        <CardDescription>
          Visualiza tu Excel completo y selecciona las columnas y celdas necesarias. Esta configuración se guardará
          para todos los archivos con el mismo formato.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-4 bg-primary/10 border border-primary/20 rounded-lg">
          <p className="font-semibold mb-2">
            Paso {currentStep === "pregunta" ? 1 : currentStep === "cumple" ? 2 : currentStep === "cumpleParcial" ? 3 : currentStep === "noCumple" ? 4 : currentStep === "noAplica" ? 5 : currentStep === "observacion" ? 6 : currentStep === "cumplimiento" ? 7 : currentStep === "totalItems" ? 8 : currentStep === "cumpleCell" ? 9 : currentStep === "cumpleParcialCell" ? 10 : currentStep === "noCumpleCell" ? 11 : currentStep === "noAplicaCell" ? 12 : currentStep === "operacionCell" ? 13 : currentStep === "fechaCell" ? 14 : currentStep === "cumplePctCell" ? 15 : currentStep === "cumpleParcialPctCell" ? 16 : currentStep === "noCumplePctCell" ? 17 : currentStep === "noAplicaPctCell" ? 18 : 19}:
            {stepLabels[currentStep]}
          </p>
          <p className="text-sm text-muted-foreground">
            {currentStep === "observacion"
              ? "Haz clic en la columna de observaciones o salta este paso si no existe"
              : currentStep === "cumplimiento"
                ? "Haz clic en la columna donde está el porcentaje de cumplimiento (ej: % DE CUMPLIMIENTO)"
                : currentStep === "totalItems" || currentStep === "cumpleCell" || currentStep === "cumpleParcialCell" || currentStep === "noCumpleCell" || currentStep === "noAplicaCell" || currentStep === "operacionCell" || currentStep === "fechaCell" || currentStep === "cumplePctCell" || currentStep === "cumpleParcialPctCell" || currentStep === "noCumplePctCell" || currentStep === "noAplicaPctCell"
                  ? "Haz clic en la CELDA específica donde está este valor en el Excel (ej: fila 13, columna C para % Cumple)"
                  : "Haz clic en la columna correspondiente en la fila de encabezados"}
          </p>
        </div>

        {/* Excel completo con todas las filas */}
        <div className="border rounded-lg overflow-hidden bg-background">
          <div className="bg-muted/50 p-2 text-xs font-medium border-b sticky top-0 z-10">
            <div className="flex items-center justify-between">
              <span>
                Excel Completo - {rawData.length} filas × {maxColumns} columnas
              </span>
              <span className="text-muted-foreground">
                {currentStep === "cumplimiento" 
                  ? "Selecciona una columna"
                  : currentStep === "totalItems" || currentStep === "cumpleCell" || currentStep === "cumpleParcialCell" || currentStep === "noCumpleCell" || currentStep === "noAplicaCell" || currentStep === "operacionCell" || currentStep === "fechaCell" || currentStep === "cumplePctCell" || currentStep === "cumpleParcialPctCell" || currentStep === "noCumplePctCell" || currentStep === "noAplicaPctCell"
                    ? "Selecciona una celda específica"
                    : "Selecciona una columna completa"}
              </span>
            </div>
          </div>
          
          <div className="overflow-auto max-h-[600px]">
            <table className="border-collapse" style={{ tableLayout: 'fixed', width: '100%' }}>
              <colgroup>
                <col style={{ width: '60px' }} /> {/* Columna de números de fila */}
                {Array.from({ length: maxColumns }).map((_, colIndex) => (
                  <col key={colIndex} style={{ width: `${getColumnWidth(colIndex)}px` }} />
                ))}
              </colgroup>
              
              <thead className="sticky top-[41px] z-10 bg-muted/80 backdrop-blur-sm">
                <tr>
                  <th className="bg-muted/90 p-2 text-xs font-bold border border-gray-300 sticky left-0 z-20">
                    {/* Celda vacía para números de fila */}
                  </th>
                  {Array.from({ length: maxColumns }).map((_, colIndex) => {
                    const isColSelected = isColumnSelected(colIndex)
                    const label = getColumnLabel(colIndex)
                    
                    return (
                      <th
                        key={colIndex}
                        className={cn(
                          "p-2 text-xs font-semibold border border-gray-300 text-center",
                          isColSelected
                            ? "bg-success/30 border-success"
                            : "bg-muted/50"
                        )}
                      >
                        {colIndexToExcel(colIndex)}
                        {label && (
                          <div className="text-[10px] mt-1 text-success font-bold">
                            {label}
                          </div>
                        )}
                      </th>
                    )
                  })}
                </tr>
              </thead>
              
              <tbody>
              {rawData.map((row, rowIndex) => {
                const isHeaderRow = rowIndex === headerRowIndex
                const rowHeight = getRowHeight(rowIndex)
                
                // Crear un mapa de celdas procesadas para esta fila
                const processedCells = new Map<number, boolean>()
                
                return (
                  <tr 
                    key={rowIndex} 
                    style={{ height: `${rowHeight}px` }}
                  >
                    {/* Número de fila (sticky) */}
                    <td 
                      className={cn(
                        "bg-muted/50 p-2 text-xs font-medium border border-gray-300 sticky left-0 z-10 text-center",
                        isHeaderRow && "bg-primary/20 font-bold"
                      )}
                      style={{ 
                        height: `${rowHeight}px`,
                        verticalAlign: 'middle'
                      }}
                    >
                      {rowIndex + 1}
                    </td>
                    
                    {/* Celdas de la fila */}
                    {Array.from({ length: maxColumns }).map((_, colIndex) => {
                      // Verificar si esta celda está en un merged range
                      const mergedInfo = getMergedCellInfo(rowIndex, colIndex)
                      
                      // Si ya procesamos esta celda (es parte de un merge anterior), saltarla
                      if (processedCells.get(colIndex)) {
                        return null
                      }
                      
                      // Si está en un merge pero no es la celda inicial, no renderizar
                      const isMergedHidden = mergedInfo.isMerged && !mergedInfo.isStartCell
                      if (isMergedHidden) {
                        return null
                      }
                      
                      // Obtener el valor de la celda
                      const cellValue = row[colIndex]
                      const displayValue = currentStep === "fechaCell" 
                        ? formatExcelDate(cellValue)
                        : String(cellValue || "").trim()
                      
                      // Si esta celda es parte de un merge, marcar las siguientes celdas como procesadas
                      if (mergedInfo.isMerged && mergedInfo.isStartCell) {
                        for (let c = colIndex + 1; c <= colIndex + mergedInfo.colSpan - 1; c++) {
                          processedCells.set(c, true)
                        }
                      }
                      
                      // Determinar si esta celda/columna está seleccionada
                      let isSelected = false
                      let label = ""
                      let isHighlighted = false
                      
                      if (currentStep === "totalItems" || currentStep === "cumpleCell" || currentStep === "cumpleParcialCell" || currentStep === "noCumpleCell" || currentStep === "noAplicaCell" || currentStep === "operacionCell" || currentStep === "fechaCell" || currentStep === "cumplePctCell" || currentStep === "cumpleParcialPctCell" || currentStep === "noCumplePctCell" || currentStep === "noAplicaPctCell") {
                        // Para pasos de celdas específicas
                        if (currentStep === "totalItems" && config.totalItemsCell?.row === rowIndex && config.totalItemsCell?.col === colIndex) {
                          isSelected = true
                          label = "Total Items"
                        } else if (currentStep === "cumpleCell" && config.cumpleCell?.row === rowIndex && config.cumpleCell?.col === colIndex) {
                          isSelected = true
                          label = "Cumple"
                        } else if (currentStep === "cumpleParcialCell" && config.cumpleParcialCell?.row === rowIndex && config.cumpleParcialCell?.col === colIndex) {
                          isSelected = true
                          label = "Cumple Parcial"
                        } else if (currentStep === "noCumpleCell" && config.noCumpleCell?.row === rowIndex && config.noCumpleCell?.col === colIndex) {
                          isSelected = true
                          label = "No Cumple"
                        } else if (currentStep === "noAplicaCell" && config.noAplicaCell?.row === rowIndex && config.noAplicaCell?.col === colIndex) {
                          isSelected = true
                          label = "No Aplica"
                        } else if (currentStep === "operacionCell" && config.operacionCell?.row === rowIndex && config.operacionCell?.col === colIndex) {
                          isSelected = true
                          label = "Operación"
                        } else if (currentStep === "fechaCell" && config.fechaCell?.row === rowIndex && config.fechaCell?.col === colIndex) {
                          isSelected = true
                          label = "Fecha"
                        } else if (currentStep === "cumplePctCell" && config.cumplePctCell?.row === rowIndex && config.cumplePctCell?.col === colIndex) {
                          isSelected = true
                          label = "% Cumple"
                        } else if (currentStep === "cumpleParcialPctCell" && config.cumpleParcialPctCell?.row === rowIndex && config.cumpleParcialPctCell?.col === colIndex) {
                          isSelected = true
                          label = "% Cumple Parcial"
                        } else if (currentStep === "noCumplePctCell" && config.noCumplePctCell?.row === rowIndex && config.noCumplePctCell?.col === colIndex) {
                          isSelected = true
                          label = "% No Cumple"
                        } else if (currentStep === "noAplicaPctCell" && config.noAplicaPctCell?.row === rowIndex && config.noAplicaPctCell?.col === colIndex) {
                          isSelected = true
                          label = "% No Aplica"
                        }
                        
                        // Resaltar celdas previamente seleccionadas
                        if (config.totalItemsCell?.row === rowIndex && config.totalItemsCell?.col === colIndex && !isSelected) {
                          isHighlighted = true
                          label = "Total Items"
                        } else if (config.cumpleCell?.row === rowIndex && config.cumpleCell?.col === colIndex && !isSelected) {
                          isHighlighted = true
                          label = "Cumple"
                        } else if (config.cumpleParcialCell?.row === rowIndex && config.cumpleParcialCell?.col === colIndex && !isSelected) {
                          isHighlighted = true
                          label = "Cumple Parcial"
                        } else if (config.noCumpleCell?.row === rowIndex && config.noCumpleCell?.col === colIndex && !isSelected) {
                          isHighlighted = true
                          label = "No Cumple"
                        } else if (config.noAplicaCell?.row === rowIndex && config.noAplicaCell?.col === colIndex && !isSelected) {
                          isHighlighted = true
                          label = "No Aplica"
                        } else if (config.operacionCell?.row === rowIndex && config.operacionCell?.col === colIndex && !isSelected) {
                          isHighlighted = true
                          label = "Operación"
                        } else if (config.fechaCell?.row === rowIndex && config.fechaCell?.col === colIndex && !isSelected) {
                          isHighlighted = true
                          label = "Fecha"
                        } else if (config.cumplePctCell?.row === rowIndex && config.cumplePctCell?.col === colIndex && !isSelected) {
                          isHighlighted = true
                          label = "% Cumple"
                        } else if (config.cumpleParcialPctCell?.row === rowIndex && config.cumpleParcialPctCell?.col === colIndex && !isSelected) {
                          isHighlighted = true
                          label = "% Cumple Parcial"
                        } else if (config.noCumplePctCell?.row === rowIndex && config.noCumplePctCell?.col === colIndex && !isSelected) {
                          isHighlighted = true
                          label = "% No Cumple"
                        } else if (config.noAplicaPctCell?.row === rowIndex && config.noAplicaPctCell?.col === colIndex && !isSelected) {
                          isHighlighted = true
                          label = "% No Aplica"
                        }
                      } else {
                        // Para pasos de columnas
                        if (isColumnSelected(colIndex)) {
                          isSelected = isHeaderRow && isColumnSelected(colIndex)
                          label = getColumnLabel(colIndex) || ""
                        }
                        
                        // Resaltar toda la columna si está seleccionada
                        if (isColumnSelected(colIndex)) {
                          isHighlighted = true
                        }
                      }
                      
                      // Determinar si es clickeable según el paso actual
                      const isClickable = 
                        (currentStep === "totalItems" || currentStep === "cumpleCell" || currentStep === "cumpleParcialCell" || currentStep === "noCumpleCell" || currentStep === "noAplicaCell" || currentStep === "operacionCell" || currentStep === "fechaCell" || currentStep === "cumplePctCell" || currentStep === "cumpleParcialPctCell" || currentStep === "noCumplePctCell" || currentStep === "noAplicaPctCell")
                          ? true // Cualquier celda es clickeable en pasos de celdas
                          : (currentStep === "cumplimiento")
                            ? true // Cualquier celda es clickeable en paso de cumplimiento
                            : (currentStep !== "complete" && isHeaderRow) // Solo encabezados en pasos de columnas
                      
                      // Obtener estilos de Excel para esta celda
                      const excelCellStyle = getCellStyle(rowIndex, colIndex)
                      
                      // Calcular colspan y rowspan si está combinada
                      const colspan = mergedInfo.isMerged && mergedInfo.isStartCell ? mergedInfo.colSpan : 1
                      const rowspan = mergedInfo.isMerged && mergedInfo.isStartCell ? mergedInfo.rowSpan : 1

                      return (
                        <td
                          key={colIndex}
                          colSpan={colspan}
                          rowSpan={rowspan}
                          className={cn(
                            "border border-gray-300 p-2 text-sm transition-all",
                            // Solo aplicar clases de fondo si no hay color de Excel
                            !excelCellStyle.backgroundColor && (
                              isSelected
                                ? "bg-success/30 border-success border-2"
                                : isHighlighted
                                  ? "bg-success/10 border-success/50"
                                  : isHeaderRow
                                    ? "bg-primary/5 font-semibold"
                                    : "bg-background"
                            ),
                            isClickable && "cursor-pointer hover:opacity-80",
                            !isClickable && "cursor-default"
                          )}
                          style={{ 
                            // Aplicar estilos de Excel (colores, fuentes, bordes, etc.)
                            ...excelCellStyle,
                            verticalAlign: excelCellStyle.verticalAlign || 'top',
                            // Mantener colores de selección/resaltado si están activos (con overlay)
                            ...(isSelected && excelCellStyle.backgroundColor && { 
                              backgroundColor: excelCellStyle.backgroundColor,
                              boxShadow: 'inset 0 0 0 2px rgb(34 197 94 / 0.5)'
                            }),
                            ...(isHighlighted && !isSelected && excelCellStyle.backgroundColor && { 
                              backgroundColor: excelCellStyle.backgroundColor,
                              boxShadow: 'inset 0 0 0 1px rgb(34 197 94 / 0.3)'
                            }),
                          }}
                          onClick={() => {
                            if (isClickable) {
                              if (currentStep === "totalItems" || currentStep === "cumpleCell" || currentStep === "cumpleParcialCell" || currentStep === "noCumpleCell" || currentStep === "noAplicaCell" || currentStep === "operacionCell" || currentStep === "fechaCell" || currentStep === "cumplePctCell" || currentStep === "cumpleParcialPctCell" || currentStep === "noCumplePctCell" || currentStep === "noAplicaPctCell") {
                                handleCellClick(rowIndex, colIndex)
                              } else if (currentStep === "cumplimiento") {
                                handleColumnClick(colIndex)
                              } else if (isHeaderRow) {
                                handleColumnClick(colIndex)
                              }
                            }
                          }}
                          title={displayValue || `Fila ${rowIndex + 1}, Col ${colIndex + 1}`}
                        >
                          <div 
                            className="truncate" 
                            title={displayValue}
                            style={{
                              // Aplicar estilos de texto de Excel
                              color: excelCellStyle.color,
                              fontWeight: excelCellStyle.fontWeight,
                              fontStyle: excelCellStyle.fontStyle,
                              fontSize: excelCellStyle.fontSize,
                              fontFamily: excelCellStyle.fontFamily,
                              textAlign: excelCellStyle.textAlign as any,
                              textDecoration: excelCellStyle.textDecoration,
                            }}
                          >
                            {displayValue || ""}
                          </div>
                          {label && (
                            <Badge 
                              variant={isSelected ? "default" : "secondary"} 
                              className="mt-1 text-[10px] px-1 py-0"
                            >
                              {label}
                            </Badge>
                          )}
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
              </tbody>
            </table>
          </div>
        </div>

        {currentStep === "observacion" && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleSkipObservacion} className="flex-1">
              Saltar (No hay columna de observaciones)
            </Button>
          </div>
        )}

        {currentStep === "cumplimiento" && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleSkipCumplimiento} className="flex-1">
              Saltar (Calcular automáticamente)
            </Button>
          </div>
        )}

        {(currentStep === "totalItems" || currentStep === "cumpleCell" || currentStep === "cumpleParcialCell" || currentStep === "noCumpleCell" || currentStep === "noAplicaCell") && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleSkipStats} className="flex-1">
              Saltar (Calcular desde items parseados)
            </Button>
          </div>
        )}

        {(currentStep === "operacionCell" || currentStep === "fechaCell") && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleSkipOperacionFecha} className="flex-1">
              Saltar (Usar valores por defecto: C5 y K5)
            </Button>
          </div>
        )}

        {(currentStep === "cumplePctCell" || currentStep === "cumpleParcialPctCell" || currentStep === "noCumplePctCell" || currentStep === "noAplicaPctCell") && (
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleSkipPorcentajes} className="flex-1">
              Saltar (Usar valores por defecto: C13, D13, E13, F13)
            </Button>
          </div>
        )}

        <div className="flex gap-2">
          <Button variant="outline" onClick={onSkip} className="flex-1">
            Usar Detección Automática
          </Button>
          {Object.keys(config).length > 2 && (
            <Button variant="outline" onClick={handleReset}>
              Reiniciar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

