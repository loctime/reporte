"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, X, AlertCircle } from "lucide-react"
import { saveColumnConfig, loadColumnConfig, type ColumnConfig } from "@/lib/column-config"
import { cn, formatDate } from "@/lib/utils"

interface ColumnConfiguratorProps {
  rawData: any[][]
  headerRowIndex: number
  onConfigComplete: (config: ColumnConfig) => void
  onSkip: () => void
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
            {config.observacion !== null && (
              <div className="p-3 border rounded-lg">
                <p className="text-sm text-muted-foreground">Observación</p>
                <p className="font-semibold">Columna {config.observacion + 1}</p>
              </div>
            )}
            {config.cumplimientoCol !== null && (
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
          Haz clic en las columnas de la fila de encabezados para configurar el sistema. Esta configuración se guardará
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

        <div className="overflow-x-auto">
          <div className="inline-block min-w-full">
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-muted p-2 text-sm font-medium">
                {currentStep === "cumplimiento" 
                  ? `Filas ${headerRowIndex + 1} y ${headerRowIndex + 2} - Buscar columna de Cumplimiento`
                  : currentStep === "totalItems" || currentStep === "cumpleCell" || currentStep === "cumpleParcialCell" || currentStep === "noCumpleCell" || currentStep === "noAplicaCell" || currentStep === "operacionCell" || currentStep === "fechaCell" || currentStep === "cumplePctCell" || currentStep === "cumpleParcialPctCell" || currentStep === "noCumplePctCell" || currentStep === "noAplicaPctCell"
                    ? `Selecciona la CELDA específica (fila y columna) - Busca en las primeras 15 filas`
                    : `Fila ${headerRowIndex + 1} - Encabezados`}
              </div>
              {currentStep === "cumplimiento" ? (
                // Mostrar múltiples filas para cumplimiento
                <div className="space-y-2 p-2">
                  {[headerRowIndex, headerRowIndex + 1, headerRowIndex + 2].filter(i => i < rawData.length).map((rowIndex) => (
                    <div key={rowIndex} className="flex">
                      <div className="bg-muted/50 p-2 text-xs font-medium min-w-[80px] border-r">
                        Fila {rowIndex + 1}
                      </div>
                      {Array.from({ length: Math.min(maxColumns, 15) }).map((_, colIndex) => {
                        const cellValue = String(rawData[rowIndex]?.[colIndex] || "").trim()
                        const isSelected = config.cumplimientoCol === colIndex
                        const numValue = typeof rawData[rowIndex]?.[colIndex] === "number" 
                          ? rawData[rowIndex]?.[colIndex] 
                          : Number.parseFloat(String(rawData[rowIndex]?.[colIndex] || ""))
                        const isPercentageValue = !isNaN(numValue) && ((numValue >= 0.5 && numValue <= 1.0) || (numValue > 0 && numValue <= 100))

                        return (
                          <div
                            key={colIndex}
                            className={cn(
                              "border-r border-b p-2 min-w-[120px] cursor-pointer transition-all text-sm",
                              isSelected
                                ? "bg-success/20 border-success"
                                : isPercentageValue && rowIndex === headerRowIndex + 1
                                  ? "bg-warning/10 hover:bg-warning/20"
                                  : "hover:bg-primary/10 hover:border-primary",
                            )}
                            onClick={() => {
                              if (currentStep === "cumplimiento") {
                                handleColumnClick(colIndex)
                              }
                            }}
                          >
                            <div className="text-xs text-muted-foreground mb-1">Col {colIndex + 1}</div>
                            <div className="truncate font-medium" title={cellValue}>
                              {cellValue || "(vacía)"}
                            </div>
                            {isSelected && (
                              <Badge variant="default" className="mt-1 text-xs">
                                Cumplimiento
                              </Badge>
                            )}
                            {isPercentageValue && rowIndex === headerRowIndex + 1 && !isSelected && (
                              <Badge variant="secondary" className="mt-1 text-xs">
                                Posible valor
                              </Badge>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </div>
              ) : currentStep === "totalItems" || currentStep === "cumpleCell" || currentStep === "cumpleParcialCell" || currentStep === "noCumpleCell" || currentStep === "noAplicaCell" || currentStep === "operacionCell" || currentStep === "fechaCell" || currentStep === "cumplePctCell" || currentStep === "cumpleParcialPctCell" || currentStep === "noCumplePctCell" || currentStep === "noAplicaPctCell" ? (
                // Mostrar múltiples filas para seleccionar celdas de estadísticas
                <div className="space-y-2 p-2 max-h-[400px] overflow-y-auto">
                  {Array.from({ length: Math.min(15, rawData.length) }).map((_, rowIndex) => (
                    <div key={rowIndex} className="flex">
                      <div className="bg-muted/50 p-2 text-xs font-medium min-w-[80px] border-r">
                        Fila {rowIndex + 1}
                      </div>
                      {Array.from({ length: Math.min(maxColumns, 15) }).map((_, colIndex) => {
                        const cellValue = rawData[rowIndex]?.[colIndex]
                        // Formatear la fecha si estamos en el paso de fechaCell
                        const displayValue = currentStep === "fechaCell" 
                          ? formatExcelDate(cellValue)
                          : String(cellValue || "").trim()
                        const cellValueStr = displayValue === "(vacía)" ? "" : displayValue
                        const numValue = typeof cellValue === "number" ? cellValue : Number.parseInt(String(cellValue || ""), 10)
                        const isNumeric = !isNaN(numValue) && numValue > 0
                        
                        // Detectar si es una fecha (número serial de Excel)
                        const isDateValue = typeof cellValue === "number" && cellValue > 0 && cellValue < 100000 && currentStep === "fechaCell"
                        
                        // Verificar si esta celda está seleccionada
                        let isSelected = false
                        let label = ""
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

                        return (
                          <div
                            key={colIndex}
                            className={cn(
                              "border-r border-b p-2 min-w-[120px] cursor-pointer transition-all text-sm",
                              isSelected
                                ? "bg-success/20 border-success"
                                : isNumeric
                                  ? "bg-warning/10 hover:bg-warning/20"
                                  : "hover:bg-primary/10 hover:border-primary",
                            )}
                            onClick={() => {
                              handleCellClick(rowIndex, colIndex)
                            }}
                          >
                            <div className="text-xs text-muted-foreground mb-1">Col {colIndex + 1}</div>
                            <div className="truncate font-medium" title={displayValue}>
                              {displayValue}
                            </div>
                            {isSelected && (
                              <Badge variant="default" className="mt-1 text-xs">
                                {label}
                              </Badge>
                            )}
                            {isDateValue && !isSelected && (
                              <Badge variant="secondary" className="mt-1 text-xs">
                                Fecha
                              </Badge>
                            )}
                            {isNumeric && !isDateValue && !isSelected && (
                              <Badge variant="secondary" className="mt-1 text-xs">
                                Número
                              </Badge>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  ))}
                </div>
              ) : (
                // Mostrar solo encabezados para otros pasos
                <div className="flex">
                  {Array.from({ length: Math.min(maxColumns, 15) }).map((_, colIndex) => {
                    const cellValue = String(headerRow[colIndex] || "").trim()
                    const isSelected = isColumnSelected(colIndex)
                    const label = getColumnLabel(colIndex)

                    return (
                      <div
                        key={colIndex}
                        className={cn(
                          "border-r border-b p-3 min-w-[150px] cursor-pointer transition-all",
                          isSelected
                            ? "bg-success/20 border-success"
                            : currentStep !== "complete" && currentStep !== "observacion" && currentStep !== "cumplimiento"
                              ? "hover:bg-primary/10 hover:border-primary"
                              : "bg-background",
                        )}
                        onClick={() => {
                          if (currentStep !== "complete" && currentStep !== "cumplimiento") {
                            handleColumnClick(colIndex)
                          }
                        }}
                      >
                        <div className="text-xs text-muted-foreground mb-1">Col {colIndex + 1}</div>
                        <div className="text-sm font-medium truncate" title={cellValue}>
                          {cellValue || "(vacía)"}
                        </div>
                        {label && (
                          <Badge variant="default" className="mt-2 text-xs">
                            {label}
                          </Badge>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
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

