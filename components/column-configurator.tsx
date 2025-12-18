"use client"

import { useState, useMemo, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { CheckCircle2, X, AlertCircle } from "lucide-react"
import { saveColumnConfig, loadColumnConfig, type ColumnConfig } from "@/lib/column-config"
import { cn, formatDate } from "@/lib/utils"
import * as XLSX from "xlsx"
import { extractExcelStylesWithExcelJS, type ExcelFormatData } from "@/lib/excel-styles-extractor"
import { ExcelHandsontableViewer } from "@/components/excel-handsontable-viewer"

interface ColumnConfiguratorProps {
  rawData: any[][]
  headerRowIndex: number
  onConfigComplete: (config: ColumnConfig) => void
  onSkip: () => void
  sheet?: XLSX.WorkSheet // Objeto sheet completo para obtener formato
  file?: File // Archivo Excel opcional para usar ExcelJS (mejor extracción de estilos)
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
  file,
}: ColumnConfiguratorProps) {
  const [exceljsFormat, setExceljsFormat] = useState<ExcelFormatData | null>(null)
  const [isLoadingStyles, setIsLoadingStyles] = useState(false)

  // Cargar estilos con ExcelJS si hay un archivo (mejor extracción de estilos y colores)
  useEffect(() => {
    if (file) {
      setIsLoadingStyles(true)
      extractExcelStylesWithExcelJS(file)
        .then((format) => {
          setExceljsFormat(format)
          setIsLoadingStyles(false)
        })
        .catch((error) => {
          // Error al cargar estilos con ExcelJS, usar XLSX como fallback
          // No loguear el error - el fallback XLSX se maneja automáticamente en extractExcelStylesWithExcelJS
          setIsLoadingStyles(false)
          setExceljsFormat(null)
        })
    } else {
      setExceljsFormat(null)
    }
  }, [file])
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

  // Extraer información de formato del Excel (usar ExcelJS si está disponible, sino XLSX)
  const excelFormat = useMemo(() => {
    // Si tenemos datos de ExcelJS, usarlos (son más completos y precisos)
    if (exceljsFormat) {
      return {
        mergedCells: exceljsFormat.mergedCells,
        columnWidths: exceljsFormat.columnWidths,
        cellStyles: exceljsFormat.cellStyles,
        cellValues: exceljsFormat.cellValues,
        rowHeights: exceljsFormat.rowHeights,
      }
    }

    // Fallback a XLSX
    if (!sheet) return { mergedCells: [], columnWidths: {}, cellStyles: {}, rowHeights: {}, cellValues: {} }
    
    // DEBUG: Log de merged cells para verificar que se están extrayendo
    if (sheet['!merges'] && sheet['!merges'].length > 0) {
      console.log(`📊 Celdas combinadas detectadas: ${sheet['!merges'].length} merges encontrados`)
    }

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
          // Excel almacena anchos en unidades de "caracteres estándar"
          // La conversión precisa es: 1 unidad Excel ≈ 7-8 píxeles (depende de la fuente)
          // Usar 7.5 como promedio
          columnWidths[index] = col.w * 7.5
        } else if (col && col.width) {
          columnWidths[index] = col.width * 7.5
        } else {
          // Ancho por defecto si no está especificado
          columnWidths[index] = 80
        }
      })
    } else {
      // Si no hay !cols, calcular anchos basados en el contenido como fallback
      for (let i = 0; i < maxColumns; i++) {
        let maxLength = 0
        rawData.forEach(row => {
          const cellValue = String(row[i] || '')
          if (cellValue.length > maxLength) {
            maxLength = cellValue.length
          }
        })
        // Aproximación: 1 carácter ≈ 8px + padding (16px)
        columnWidths[i] = Math.max(maxLength * 8 + 16, 80)
      }
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

    // Extraer estilos de celdas y valores
    const cellStyles: Record<string, any> = {}
    const cellValues: Record<string, any> = {}
    Object.keys(sheet).forEach((key) => {
      if (key.startsWith('!')) return
      const cell = sheet[key]
      if (cell) {
        // Extraer valor de la celda (solo en la celda inicial si está en un merge)
        if (cell.v !== null && cell.v !== undefined) {
          cellValues[key] = cell.v
        }
        
        // XLSX puede tener estilos en cell.s, pero también necesitamos verificar otras propiedades
        if (cell.s) {
          cellStyles[key] = cell.s
        }
        // También intentar extraer directamente si no hay cell.s pero hay propiedades de estilo
        // Esto puede pasar con algunos formatos de Excel
        if (!cell.s && (cell.f || cell.z)) {
          // Intentar construir un objeto de estilo básico
          const basicStyle: any = {}
          if (cell.f) {
            basicStyle.fill = cell.f
          }
          if (cell.z) {
            basicStyle.font = cell.z
          }
          if (Object.keys(basicStyle).length > 0) {
            cellStyles[key] = basicStyle
          }
        }
        // También verificar cell.pattern para colores de relleno
        if (cell.s && cell.s.pattern) {
          if (!cellStyles[key]) {
            cellStyles[key] = {}
          }
          if (!cellStyles[key].pattern) {
            cellStyles[key].pattern = cell.s.pattern
          }
        }
      }
    })

    return { mergedCells, columnWidths, cellStyles, rowHeights, cellValues }
  }, [sheet, exceljsFormat])

  // Función para verificar si una celda está en un merged range
  const getMergedCellInfo = (rowIndex: number, colIndex: number) => {
    for (const merge of excelFormat.mergedCells) {
      // Verificar si esta celda está dentro del rango del merge
      if (
        rowIndex >= merge.s.r &&
        rowIndex <= merge.e.r &&
        colIndex >= merge.s.c &&
        colIndex <= merge.e.c
      ) {
        const isStartCell = rowIndex === merge.s.r && colIndex === merge.s.c
        const rowSpan = merge.e.r - merge.s.r + 1
        const colSpan = merge.e.c - merge.s.c + 1
        return { 
          isMerged: true, 
          isStartCell, 
          rowSpan, 
          colSpan,
          mergeRange: merge // Guardar el rango completo para referencia
        }
      }
    }
    return { isMerged: false, isStartCell: false, rowSpan: 1, colSpan: 1, mergeRange: null }
  }
  
  // Función auxiliar para verificar si una celda está ocupada por un merge vertical de una fila anterior
  // Esto es necesario porque cuando hay rowspan, las filas siguientes no deben renderizar esa celda
  const isCellOccupiedByVerticalMerge = (rowIndex: number, colIndex: number): boolean => {
    for (const merge of excelFormat.mergedCells) {
      // Si esta celda está dentro de un merge que comenzó en una fila anterior
      // (es decir, rowIndex > merge.s.r pero está dentro del rango del merge)
      if (
        rowIndex > merge.s.r && // La fila actual es posterior a la fila inicial del merge
        rowIndex <= merge.e.r && // Pero está dentro del rango del merge (incluye la fila final)
        colIndex >= merge.s.c && // Y está dentro del rango de columnas del merge
        colIndex <= merge.e.c
      ) {
        // Esta celda está ocupada por un merge vertical que comenzó arriba
        return true
      }
    }
    return false
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
      // Mapeo más completo de temas comunes de Excel (basado en temas estándar de Office)
      const themeColors: Record<number, string> = {
        0: "#000000", // Texto 1
        1: "#FFFFFF", // Fondo 1
        2: "#E7E6E6", // Texto 2
        3: "#44546A", // Fondo 2
        4: "#5B9BD5", // Acento 1 (Azul)
        5: "#70AD47", // Acento 2 (Verde)
        6: "#A5A5A5", // Acento 3 (Gris)
        7: "#FFC000", // Acento 4 (Amarillo)
        8: "#4472C4", // Acento 5 (Azul oscuro)
        9: "#70AD47", // Acento 6 (Verde)
        10: "#FF0000", // Rojo (común en Excel)
        11: "#00FF00", // Verde brillante
        12: "#0000FF", // Azul brillante
        13: "#FFFF00", // Amarillo brillante
        14: "#FF00FF", // Magenta
        15: "#00FFFF", // Cyan
      }
      return themeColors[color.theme] || undefined
    }
    
    // También verificar si hay un índice de color directo (algunos formatos de Excel)
    if (color.index !== undefined) {
      // Mapeo de índices de color comunes de Excel
      const indexedColors: Record<number, string> = {
        0: "#000000", // Negro
        1: "#FFFFFF", // Blanco
        2: "#FF0000", // Rojo
        3: "#00FF00", // Verde
        4: "#0000FF", // Azul
        5: "#FFFF00", // Amarillo
        6: "#FF00FF", // Magenta
        7: "#00FFFF", // Cyan
        8: "#800000", // Marrón oscuro
        9: "#008000", // Verde oscuro
        10: "#000080", // Azul oscuro
        11: "#808000", // Oliva
        12: "#800080", // Púrpura
        13: "#008080", // Teal
        14: "#C0C0C0", // Plata
        15: "#808080", // Gris
      }
      return indexedColors[color.index] || undefined
    }

    return undefined
  }

  // Función para obtener el estilo de una celda
  const getCellStyle = (rowIndex: number, colIndex: number): React.CSSProperties => {
    const cellAddress = getCellAddress(rowIndex, colIndex)

    // Si usamos ExcelJS, los estilos ya vienen procesados y son más precisos
    if (exceljsFormat) {
      const exceljsStyle = exceljsFormat.cellStyles[cellAddress]
      if (exceljsStyle) {
        const borderStyle: React.CSSProperties = {}
        if (exceljsStyle.borders) {
          Object.entries(exceljsStyle.borders).forEach(([side, border]: [string, any]) => {
            borderStyle[`border${side.charAt(0).toUpperCase() + side.slice(1)}` as keyof React.CSSProperties] = 
              `${border.width} solid ${border.color}`
          })
        }

        return {
          backgroundColor: exceljsStyle.backgroundColor,
          color: exceljsStyle.textColor,
          fontWeight: exceljsStyle.fontWeight,
          fontStyle: exceljsStyle.fontStyle,
          fontSize: exceljsStyle.fontSize,
          fontFamily: exceljsStyle.fontFamily,
          textAlign: exceljsStyle.textAlign as any,
          verticalAlign: exceljsStyle.verticalAlign as any,
          textDecoration: exceljsStyle.textDecoration,
          ...borderStyle,
        }
      }
    }

    // Fallback a XLSX - procesar estilos de XLSX
    const style = excelFormat.cellStyles[cellAddress] || {}

    // Extraer color de fondo - XLSX puede tener fill en diferentes lugares
    let backgroundColor: string | undefined
    // Primero intentar en style.fill (estructura estándar de XLSX)
    if (style.fill) {
      if (style.fill.fgColor) {
        backgroundColor = excelColorToCSS(style.fill.fgColor)
      } else if (style.fill.bgColor) {
        backgroundColor = excelColorToCSS(style.fill.bgColor)
      }
    }
    // También intentar en style.f (formato alternativo)
    if (!backgroundColor && (style as any).f && (style as any).f.fill) {
      const fill = (style as any).f.fill
      if (fill.fgColor) {
        backgroundColor = excelColorToCSS(fill.fgColor)
      } else if (fill.bgColor) {
        backgroundColor = excelColorToCSS(fill.bgColor)
      }
    }
    // También verificar directamente en la celda del sheet si no está en cellStyles
    // Esto es importante porque XLSX puede no extraer todos los estilos correctamente
    if (!backgroundColor && sheet) {
      const cell = sheet[cellAddress]
      if (cell && cell.s) {
        const cellStyle = cell.s
        // Intentar fill en diferentes estructuras
        if (cellStyle.fill) {
          if (cellStyle.fill.fgColor) {
            backgroundColor = excelColorToCSS(cellStyle.fill.fgColor)
          } else if (cellStyle.fill.bgColor) {
            backgroundColor = excelColorToCSS(cellStyle.fill.bgColor)
          }
        }
        // También intentar en cellStyle.f
        if (!backgroundColor && (cellStyle as any).f && (cellStyle as any).f.fill) {
          const fill = (cellStyle as any).f.fill
          if (fill.fgColor) {
            backgroundColor = excelColorToCSS(fill.fgColor)
          } else if (fill.bgColor) {
            backgroundColor = excelColorToCSS(fill.bgColor)
          }
        }
      }
    }

    // También intentar buscar colores en patrones de relleno
    if (!backgroundColor && sheet) {
      const cell = sheet[cellAddress]
      if (cell && cell.s && cell.s.pattern) {
        const pattern = cell.s.pattern
        if (pattern.fgColor) {
          backgroundColor = excelColorToCSS(pattern.fgColor)
        } else if (pattern.bgColor) {
          backgroundColor = excelColorToCSS(pattern.bgColor)
        }
      }
    }

    // Extraer color de texto
    let textColor: string | undefined
    if (style.font?.color) {
      textColor = excelColorToCSS(style.font.color)
    }
    // También intentar en style.f
    if (!textColor && (style as any).f && (style as any).f.font && (style as any).f.font.color) {
      textColor = excelColorToCSS((style as any).f.font.color)
    }
    // También verificar directamente en la celda del sheet
    if (!textColor && sheet) {
      const cell = sheet[cellAddress]
      if (cell && cell.s && cell.s.font && cell.s.font.color) {
        textColor = excelColorToCSS(cell.s.font.color)
      }
    }

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
          
          {/* Usar Handsontable para renderizar Excel con estilos completos */}
          <div className="overflow-auto max-h-[600px] bg-white">
            <ExcelHandsontableViewer
              rawData={rawData}
              sheet={sheet}
              file={file}
              maxRows={rawData.length}
              readOnly={true}
              onCellClick={(row, col) => {
                if (currentStep === "totalItems" || currentStep === "cumpleCell" || currentStep === "cumpleParcialCell" || currentStep === "noCumpleCell" || currentStep === "noAplicaCell" || currentStep === "operacionCell" || currentStep === "fechaCell" || currentStep === "cumplePctCell" || currentStep === "cumpleParcialPctCell" || currentStep === "noCumplePctCell" || currentStep === "noAplicaPctCell") {
                  handleCellClick(row, col)
                } else if (currentStep === "cumplimiento") {
                  handleColumnClick(col)
                } else if (row === headerRowIndex) {
                  handleColumnClick(col)
                }
              }}
              selectedCells={(() => {
                const selected: Array<{ row: number; col: number }> = []
                if (currentStep === "totalItems" && config.totalItemsCell) {
                  selected.push(config.totalItemsCell)
                } else if (currentStep === "cumpleCell" && config.cumpleCell) {
                  selected.push(config.cumpleCell)
                } else if (currentStep === "cumpleParcialCell" && config.cumpleParcialCell) {
                  selected.push(config.cumpleParcialCell)
                } else if (currentStep === "noCumpleCell" && config.noCumpleCell) {
                  selected.push(config.noCumpleCell)
                } else if (currentStep === "noAplicaCell" && config.noAplicaCell) {
                  selected.push(config.noAplicaCell)
                } else if (currentStep === "operacionCell" && config.operacionCell) {
                  selected.push(config.operacionCell)
                } else if (currentStep === "fechaCell" && config.fechaCell) {
                  selected.push(config.fechaCell)
                } else if (currentStep === "cumplePctCell" && config.cumplePctCell) {
                  selected.push(config.cumplePctCell)
                } else if (currentStep === "cumpleParcialPctCell" && config.cumpleParcialPctCell) {
                  selected.push(config.cumpleParcialPctCell)
                } else if (currentStep === "noCumplePctCell" && config.noCumplePctCell) {
                  selected.push(config.noCumplePctCell)
                } else if (currentStep === "noAplicaPctCell" && config.noAplicaPctCell) {
                  selected.push(config.noAplicaPctCell)
                } else if (currentStep !== "totalItems" && currentStep !== "cumpleCell" && currentStep !== "cumpleParcialCell" && currentStep !== "noCumpleCell" && currentStep !== "noAplicaCell" && currentStep !== "operacionCell" && currentStep !== "fechaCell" && currentStep !== "cumplePctCell" && currentStep !== "cumpleParcialPctCell" && currentStep !== "noCumplePctCell" && currentStep !== "noAplicaPctCell") {
                  // Para pasos de columnas, seleccionar toda la columna según el paso actual
                  let colIndex: number | null = null
                  if (currentStep === "pregunta" && config.pregunta !== null && config.pregunta !== undefined) {
                    colIndex = config.pregunta
                  } else if (currentStep === "cumple" && config.cumple !== null && config.cumple !== undefined) {
                    colIndex = config.cumple
                  } else if (currentStep === "cumpleParcial" && config.cumpleParcial !== null && config.cumpleParcial !== undefined) {
                    colIndex = config.cumpleParcial
                  } else if (currentStep === "noCumple" && config.noCumple !== null && config.noCumple !== undefined) {
                    colIndex = config.noCumple
                  } else if (currentStep === "noAplica" && config.noAplica !== null && config.noAplica !== undefined) {
                    colIndex = config.noAplica
                  } else if (currentStep === "observacion" && config.observacion !== null && config.observacion !== undefined) {
                    colIndex = config.observacion
                  } else if (currentStep === "cumplimiento" && config.cumplimientoCol !== null && config.cumplimientoCol !== undefined) {
                    colIndex = config.cumplimientoCol
                  }
                  if (colIndex !== null && colIndex >= 0) {
                    rawData.forEach((_, rowIdx) => {
                      selected.push({ row: rowIdx, col: colIndex! })
                    })
                  }
                }
                return selected
              })()}
              highlightedCells={(() => {
                const highlighted: Array<{ row: number; col: number; label?: string }> = []
                // Resaltar celdas previamente configuradas
                if (config.totalItemsCell && currentStep !== "totalItems") {
                  highlighted.push({ ...config.totalItemsCell, label: "Total Items" })
                }
                if (config.cumpleCell && currentStep !== "cumpleCell") {
                  highlighted.push({ ...config.cumpleCell, label: "Cumple" })
                }
                if (config.cumpleParcialCell && currentStep !== "cumpleParcialCell") {
                  highlighted.push({ ...config.cumpleParcialCell, label: "Cumple Parcial" })
                }
                if (config.noCumpleCell && currentStep !== "noCumpleCell") {
                  highlighted.push({ ...config.noCumpleCell, label: "No Cumple" })
                }
                if (config.noAplicaCell && currentStep !== "noAplicaCell") {
                  highlighted.push({ ...config.noAplicaCell, label: "No Aplica" })
                }
                if (config.operacionCell && currentStep !== "operacionCell") {
                  highlighted.push({ ...config.operacionCell, label: "Operación" })
                }
                if (config.fechaCell && currentStep !== "fechaCell") {
                  highlighted.push({ ...config.fechaCell, label: "Fecha" })
                }
                if (config.cumplePctCell && currentStep !== "cumplePctCell") {
                  highlighted.push({ ...config.cumplePctCell, label: "% Cumple" })
                }
                if (config.cumpleParcialPctCell && currentStep !== "cumpleParcialPctCell") {
                  highlighted.push({ ...config.cumpleParcialPctCell, label: "% Cumple Parcial" })
                }
                if (config.noCumplePctCell && currentStep !== "noCumplePctCell") {
                  highlighted.push({ ...config.noCumplePctCell, label: "% No Cumple" })
                }
                if (config.noAplicaPctCell && currentStep !== "noAplicaPctCell") {
                  highlighted.push({ ...config.noAplicaPctCell, label: "% No Aplica" })
                }
                // Resaltar columnas previamente configuradas
                if (currentStep !== "pregunta" && config.pregunta !== null && config.pregunta !== undefined) {
                  rawData.forEach((_, rowIdx) => {
                    highlighted.push({ row: rowIdx, col: config.pregunta!, label: "Pregunta" })
                  })
                }
                if (currentStep !== "cumple" && config.cumple !== null && config.cumple !== undefined) {
                  rawData.forEach((_, rowIdx) => {
                    highlighted.push({ row: rowIdx, col: config.cumple!, label: "Cumple" })
                  })
                }
                if (currentStep !== "cumpleParcial" && config.cumpleParcial !== null && config.cumpleParcial !== undefined) {
                  rawData.forEach((_, rowIdx) => {
                    highlighted.push({ row: rowIdx, col: config.cumpleParcial!, label: "Cumple Parcial" })
                  })
                }
                if (currentStep !== "noCumple" && config.noCumple !== null && config.noCumple !== undefined) {
                  rawData.forEach((_, rowIdx) => {
                    highlighted.push({ row: rowIdx, col: config.noCumple!, label: "No Cumple" })
                  })
                }
                if (currentStep !== "noAplica" && config.noAplica !== null && config.noAplica !== undefined) {
                  rawData.forEach((_, rowIdx) => {
                    highlighted.push({ row: rowIdx, col: config.noAplica!, label: "No Aplica" })
                  })
                }
                if (currentStep !== "observacion" && config.observacion !== null && config.observacion !== undefined) {
                  rawData.forEach((_, rowIdx) => {
                    highlighted.push({ row: rowIdx, col: config.observacion!, label: "Observación" })
                  })
                }
                return highlighted
              })()}
            />
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

