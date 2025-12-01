"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, X, AlertCircle } from "lucide-react"
import { saveColumnConfig, loadColumnConfig, type ColumnConfig } from "@/lib/column-config"
import { cn } from "@/lib/utils"

interface ColumnConfiguratorProps {
  rawData: any[][]
  headerRowIndex: number
  onConfigComplete: (config: ColumnConfig) => void
  onSkip: () => void
}

type ConfigStep = "pregunta" | "cumple" | "cumpleParcial" | "noCumple" | "noAplica" | "observacion" | "cumplimiento" | "complete"

const stepLabels: Record<ConfigStep, string> = {
  pregunta: "Columna de Preguntas",
  cumple: "Columna CUMPLE",
  cumpleParcial: "Columna CUMPLE PARCIAL",
  noCumple: "Columna NO CUMPLE",
  noAplica: "Columna NO APLICA",
  observacion: "Columna de Observaciones (opcional)",
  cumplimiento: "Celda de Cumplimiento (opcional)",
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
    }
  })

  const headerRow = rawData[headerRowIndex] || []
  const maxColumns = Math.max(...rawData.map((row) => row?.length || 0), 0)

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
      setCurrentStep("complete")
    }
  }

  const handleSkipObservacion = () => {
    setConfig({ ...config, observacion: null })
    setCurrentStep("cumplimiento")
  }

  const handleSkipCumplimiento = () => {
    setConfig({ ...config, cumplimientoCol: null, cumplimientoRow: null })
    setCurrentStep("complete")
  }

  const handleComplete = () => {
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
      }
      saveColumnConfig(finalConfig)
      onConfigComplete(finalConfig)
    }
  }

  const handleReset = () => {
    setConfig({ headerRowIndex, observacion: null, cumplimientoCol: null, cumplimientoRow: null })
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
            Paso {currentStep === "pregunta" ? 1 : currentStep === "cumple" ? 2 : currentStep === "cumpleParcial" ? 3 : currentStep === "noCumple" ? 4 : currentStep === "noAplica" ? 5 : currentStep === "observacion" ? 6 : currentStep === "cumplimiento" ? 7 : 8}:
            {stepLabels[currentStep]}
          </p>
          <p className="text-sm text-muted-foreground">
            {currentStep === "observacion"
              ? "Haz clic en la columna de observaciones o salta este paso si no existe"
              : currentStep === "cumplimiento"
                ? "Haz clic en la columna donde está el porcentaje de cumplimiento (ej: % DE CUMPLIMIENTO)"
                : "Haz clic en la columna correspondiente en la fila de encabezados"}
          </p>
        </div>

        <div className="overflow-x-auto">
          <div className="inline-block min-w-full">
            <div className="border rounded-lg overflow-hidden">
              <div className="bg-muted p-2 text-sm font-medium">
                {currentStep === "cumplimiento" 
                  ? `Filas ${headerRowIndex + 1} y ${headerRowIndex + 2} - Buscar columna de Cumplimiento`
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

