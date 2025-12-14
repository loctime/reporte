"use client"

import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, X, Plus, Trash2, AlertCircle, Save } from "lucide-react"
import {
  saveExcelConfig,
  loadExcelConfig,
  validateExcelConfig,
  createDefaultConfig,
  type ExcelConfig,
  type ExcelField,
} from "@/lib/excel-config"
import { ExcelViewer } from "./excel-viewer"
import * as XLSX from "xlsx"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"

interface ExcelConfiguratorNewProps {
  rawData: any[][]
  sheet?: XLSX.WorkSheet
  file?: File // Archivo Excel para extraer estilos con ExcelJS
  onConfigComplete: (config: ExcelConfig) => void
  onCancel?: () => void
}

type ConfigMode = "columns" | "fields" | "complete"

/**
 * Configurador interactivo de Excel con visualización real
 * Permite configurar columnas y campos personalizados
 */
export function ExcelConfiguratorNew({
  rawData,
  sheet,
  file,
  onConfigComplete,
  onCancel,
}: ExcelConfiguratorNewProps) {
  const [config, setConfig] = useState<ExcelConfig>(() => {
    const saved = loadExcelConfig()
    if (saved) {
      return saved
    }
    return createDefaultConfig()
  })

  const [mode, setMode] = useState<ConfigMode>("columns")
  const [selectedCell, setSelectedCell] = useState<{ row: number; col: number } | null>(null)
  const [selectedColumn, setSelectedColumn] = useState<number | null>(null)
  const [showAddFieldDialog, setShowAddFieldDialog] = useState(false)
  const [newFieldName, setNewFieldName] = useState("")
  const [newFieldRequired, setNewFieldRequired] = useState(false)
  const [newFieldType, setNewFieldType] = useState<"cell" | "column">("cell")

  // Encontrar la fila de encabezado automáticamente
  const headerRowIndex = useMemo(() => {
    if (config.columnMapping.headerRowIndex >= 0) {
      return config.columnMapping.headerRowIndex
    }
    // Buscar fila con "CUMPLE" o "ITEMS"
    return rawData.findIndex(
      (row) =>
        row &&
        row.some(
          (cell: any) =>
            String(cell).toUpperCase().includes("CUMPLE") ||
            String(cell).toUpperCase().includes("ITEMS") ||
            String(cell).toUpperCase().includes("PREGUNTA")
        )
    )
  }, [rawData, config.columnMapping.headerRowIndex])

  // Actualizar headerRowIndex si no está configurado
  if (config.columnMapping.headerRowIndex < 0 && headerRowIndex >= 0) {
    setConfig({
      ...config,
      columnMapping: {
        ...config.columnMapping,
        headerRowIndex,
      },
    })
  }

  // Celdas resaltadas para mostrar qué está configurado
  const highlightedCells = useMemo(() => {
    const highlights: Array<{ row: number; col: number; label: string }> = []

    // Resaltar columnas configuradas
    if (config.columnMapping.pregunta >= 0 && headerRowIndex >= 0) {
      highlights.push({
        row: headerRowIndex,
        col: config.columnMapping.pregunta,
        label: "Pregunta",
      })
    }
    if (config.columnMapping.cumple >= 0 && headerRowIndex >= 0) {
      highlights.push({
        row: headerRowIndex,
        col: config.columnMapping.cumple,
        label: "Cumple",
      })
    }
    if (config.columnMapping.cumpleParcial >= 0 && headerRowIndex >= 0) {
      highlights.push({
        row: headerRowIndex,
        col: config.columnMapping.cumpleParcial,
        label: "Cumple Parcial",
      })
    }
    if (config.columnMapping.noCumple >= 0 && headerRowIndex >= 0) {
      highlights.push({
        row: headerRowIndex,
        col: config.columnMapping.noCumple,
        label: "No Cumple",
      })
    }
    if (config.columnMapping.noAplica >= 0 && headerRowIndex >= 0) {
      highlights.push({
        row: headerRowIndex,
        col: config.columnMapping.noAplica,
        label: "No Aplica",
      })
    }
    if (config.columnMapping.observacion !== null && config.columnMapping.observacion >= 0 && headerRowIndex >= 0) {
      highlights.push({
        row: headerRowIndex,
        col: config.columnMapping.observacion,
        label: "Observación",
      })
    }

    // Resaltar campos personalizados
    config.customFields.forEach((field) => {
      highlights.push({
        row: field.location.row,
        col: field.location.col,
        label: field.name,
      })
    })

    return highlights
  }, [config, headerRowIndex])

  const handleCellClick = (row: number, col: number) => {
    if (mode === "columns") {
      // En modo columnas, seleccionar la columna completa
      setSelectedColumn(col)
    } else if (mode === "fields") {
      // En modo campos, seleccionar la celda
      setSelectedCell({ row, col })
    }
  }

  const handleColumnSelect = (columnType: keyof typeof config.columnMapping) => {
    if (selectedColumn !== null) {
      setConfig({
        ...config,
        columnMapping: {
          ...config.columnMapping,
          [columnType]: selectedColumn,
        },
      })
      setSelectedColumn(null)
    }
  }

  const handleAddCustomField = () => {
    if (!selectedCell || !newFieldName.trim()) return

    const newField: ExcelField = {
      id: `field-${Date.now()}`,
      name: newFieldName.trim(),
      type: newFieldType,
      location: selectedCell,
      required: newFieldRequired,
    }

    setConfig({
      ...config,
      customFields: [...config.customFields, newField],
    })

    setNewFieldName("")
    setNewFieldRequired(false)
    setNewFieldType("cell")
    setSelectedCell(null)
    setShowAddFieldDialog(false)
  }

  const handleRemoveCustomField = (fieldId: string) => {
    setConfig({
      ...config,
      customFields: config.customFields.filter((f) => f.id !== fieldId),
    })
  }

  const handleSave = () => {
    const validation = validateExcelConfig(config)
    if (!validation.valid) {
      alert("Error: " + validation.errors.join("\n"))
      return
    }

    saveExcelConfig(config)
    onConfigComplete(config)
  }

  const isConfigComplete = useMemo(() => {
    const validation = validateExcelConfig(config)
    return validation.valid
  }, [config])

  const requiredColumns = [
    { key: "pregunta" as const, label: "Pregunta/Item" },
    { key: "cumple" as const, label: "Cumple" },
    { key: "cumpleParcial" as const, label: "Cumple Parcial" },
    { key: "noCumple" as const, label: "No Cumple" },
    { key: "noAplica" as const, label: "No Aplica" },
  ]

  const optionalColumns = [{ key: "observacion" as const, label: "Observación" }]

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Configurar Excel</CardTitle>
          <CardDescription>
            Selecciona las columnas y campos necesarios. El Excel se muestra exactamente como está en tu archivo.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Modo de configuración */}
          <div className="flex gap-2">
            <Button
              variant={mode === "columns" ? "default" : "outline"}
              onClick={() => setMode("columns")}
            >
              Configurar Columnas
            </Button>
            <Button
              variant={mode === "fields" ? "default" : "outline"}
              onClick={() => setMode("fields")}
            >
              Agregar Campos Personalizados
            </Button>
          </div>

          {/* Instrucciones según el modo */}
          {mode === "columns" && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="font-semibold mb-2">Configurar Columnas de la Tabla</p>
              <p className="text-sm text-muted-foreground mb-4">
                Haz clic en una columna del Excel para seleccionarla, luego elige qué tipo de columna es.
              </p>

              {/* Columnas requeridas */}
              <div className="space-y-2 mb-4">
                <p className="text-sm font-medium">Columnas Requeridas:</p>
                <div className="flex flex-wrap gap-2">
                  {requiredColumns.map((col) => {
                    const isConfigured = config.columnMapping[col.key] >= 0
                    return (
                      <div key={col.key} className="flex items-center gap-2">
                        <Badge variant={isConfigured ? "default" : "secondary"}>
                          {col.label}
                          {isConfigured && ` (Col ${config.columnMapping[col.key] + 1})`}
                        </Badge>
                        {selectedColumn !== null && !isConfigured && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleColumnSelect(col.key)}
                          >
                            Usar Col {selectedColumn + 1}
                          </Button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Columnas opcionales */}
              <div className="space-y-2">
                <p className="text-sm font-medium">Columnas Opcionales:</p>
                <div className="flex flex-wrap gap-2">
                  {optionalColumns.map((col) => {
                    const isConfigured = config.columnMapping[col.key] !== null && config.columnMapping[col.key]! >= 0
                    return (
                      <div key={col.key} className="flex items-center gap-2">
                        <Badge variant={isConfigured ? "default" : "secondary"}>
                          {col.label}
                          {isConfigured && ` (Col ${config.columnMapping[col.key]! + 1})`}
                        </Badge>
                        {selectedColumn !== null && !isConfigured && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleColumnSelect(col.key)}
                          >
                            Usar Col {selectedColumn + 1}
                          </Button>
                        )}
                        {isConfigured && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              setConfig({
                                ...config,
                                columnMapping: {
                                  ...config.columnMapping,
                                  [col.key]: null,
                                },
                              })
                            }}
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {mode === "fields" && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="font-semibold mb-2">Agregar Campos Personalizados</p>
              <p className="text-sm text-muted-foreground mb-4">
                Haz clic en una celda del Excel para seleccionarla, luego agrega un nombre personalizado.
                Ejemplos: "Operación", "Responsable", "Cliente", "Fecha", "Auditor", etc.
              </p>

              <Button
                onClick={() => {
                  if (selectedCell) {
                    setShowAddFieldDialog(true)
                  } else {
                    alert("Primero selecciona una celda del Excel")
                  }
                }}
                disabled={!selectedCell}
                className="mb-4"
              >
                <Plus className="h-4 w-4 mr-2" />
                Agregar Campo Personalizado
              </Button>

              {/* Lista de campos personalizados */}
              {config.customFields.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Campos Configurados:</p>
                  {config.customFields.map((field) => (
                    <div
                      key={field.id}
                      className="flex items-center justify-between p-2 bg-white border rounded"
                    >
                      <div>
                        <Badge variant={field.required ? "default" : "secondary"}>
                          {field.name}
                        </Badge>
                        <span className="text-xs text-muted-foreground ml-2">
                          Fila {field.location.row + 1}, Col {field.location.col + 1}
                        </span>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRemoveCustomField(field.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Visualizador de Excel */}
          <ExcelViewer
            rawData={rawData}
            sheet={sheet}
            file={file}
            onCellClick={handleCellClick}
            selectedCells={
              selectedCell ? [selectedCell] : selectedColumn !== null
                ? [{ row: headerRowIndex >= 0 ? headerRowIndex : 0, col: selectedColumn }]
                : []
            }
            highlightedCells={highlightedCells}
            maxRows={50}
          />

          {/* Botones de acción */}
          <div className="flex gap-2 justify-end">
            {onCancel && (
              <Button variant="outline" onClick={onCancel}>
                Cancelar
              </Button>
            )}
            <Button onClick={handleSave} disabled={!isConfigComplete}>
              <Save className="h-4 w-4 mr-2" />
              Guardar Configuración
            </Button>
          </div>

          {!isConfigComplete && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div className="text-sm text-yellow-800">
                <p className="font-medium mb-1">Configuración incompleta</p>
                <p>Por favor, configura todas las columnas requeridas antes de guardar.</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog para agregar campo personalizado */}
      <Dialog open={showAddFieldDialog} onOpenChange={setShowAddFieldDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Agregar Campo Personalizado</DialogTitle>
            <DialogDescription>
              Asigna un nombre a la celda seleccionada. Este campo se usará para extraer datos del Excel.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="field-name">Nombre del Campo</Label>
              <Input
                id="field-name"
                value={newFieldName}
                onChange={(e) => setNewFieldName(e.target.value)}
                placeholder="Ej: Operación, Responsable, Fecha, Auditor..."
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Este nombre se usará para identificar este campo en los datos extraídos.
              </p>
            </div>
            <div>
              <Label htmlFor="field-type">Tipo</Label>
              <Select value={newFieldType} onValueChange={(v: "cell" | "column") => setNewFieldType(v)}>
                <SelectTrigger className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="cell">Celda Individual</SelectItem>
                  <SelectItem value="column">Columna Completa</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center space-x-2">
              <Checkbox
                id="field-required"
                checked={newFieldRequired}
                onCheckedChange={(checked) => setNewFieldRequired(checked === true)}
              />
              <Label htmlFor="field-required" className="cursor-pointer">
                Campo requerido
              </Label>
            </div>
            {selectedCell && (
              <div className="text-sm text-muted-foreground">
                Celda seleccionada: Fila {selectedCell.row + 1}, Columna {selectedCell.col + 1}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddFieldDialog(false)}>
              Cancelar
            </Button>
            <Button onClick={handleAddCustomField} disabled={!newFieldName.trim() || !selectedCell}>
              Agregar Campo
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

