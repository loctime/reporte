"use client"

import React, { useRef, useEffect, useMemo, useState } from "react"
import * as XLSX from "xlsx"
import { extractExcelStylesWithExcelJS, type ExcelFormatData } from "@/lib/excel-styles-extractor"
import { ExcelViewer } from "./excel-viewer"

interface ExcelHandsontableViewerProps {
  rawData: any[][]
  sheet?: XLSX.WorkSheet
  file?: File
  onCellClick?: (row: number, col: number) => void
  selectedCells?: Array<{ row: number; col: number }>
  highlightedCells?: Array<{ row: number; col: number; label?: string }>
  maxRows?: number
  className?: string
  readOnly?: boolean
}

/**
 * Visualizador de Excel usando Handsontable
 * Si Handsontable no está instalado, usa ExcelViewer como fallback
 */
export function ExcelHandsontableViewer({
  rawData,
  sheet,
  file,
  onCellClick,
  selectedCells = [],
  highlightedCells = [],
  maxRows = 100,
  className,
  readOnly = true,
}: ExcelHandsontableViewerProps) {
  const [hasHandsontable, setHasHandsontable] = useState(false)
  const [HotTableComponent, setHotTableComponent] = useState<any>(null)
  const [HandsontableLib, setHandsontableLib] = useState<any>(null)
  const hotTableRef = useRef<any>(null)
  const [exceljsFormat, setExceljsFormat] = useState<ExcelFormatData | null>(null)
  const [isLoadingStyles, setIsLoadingStyles] = useState(false)

  // Intentar cargar Handsontable dinámicamente solo en el cliente
  useEffect(() => {
    if (typeof window === "undefined") return

    const loadHandsontable = async () => {
      try {
        // Intentar importar Handsontable
        const [handsontableReact, handsontable] = await Promise.all([
          import("@handsontable/react"),
          import("handsontable"),
        ])
        
        // Importar CSS
        await import("handsontable/dist/handsontable.full.css")
        
        setHotTableComponent(handsontableReact.HotTable)
        setHandsontableLib(handsontable.default || handsontable)
        setHasHandsontable(true)
      } catch (error) {
        // Handsontable no está instalado, usar fallback silenciosamente
        setHasHandsontable(false)
      }
    }

    loadHandsontable()
  }, [])

  // Cargar estilos con ExcelJS
  useEffect(() => {
    if (file) {
      setIsLoadingStyles(true)
      extractExcelStylesWithExcelJS(file)
        .then((format) => {
          setExceljsFormat(format)
          setIsLoadingStyles(false)
        })
        .catch(() => {
          setIsLoadingStyles(false)
          setExceljsFormat(null)
        })
    } else {
      setExceljsFormat(null)
    }
  }, [file])

  // Si Handsontable no está disponible, usar ExcelViewer como fallback
  if (!hasHandsontable || !HotTableComponent || !HandsontableLib) {
    return (
      <ExcelViewer
        rawData={rawData}
        sheet={sheet}
        file={file}
        onCellClick={onCellClick}
        selectedCells={selectedCells}
        highlightedCells={highlightedCells}
        maxRows={maxRows}
        className={className}
      />
    )
  }

  // Preparar datos para Handsontable
  const hotData = useMemo(() => {
    const rowsToShow = rawData.slice(0, maxRows)
    const maxCols = Math.max(...rawData.map(row => row.length), 0)
    
    // Usar valores de ExcelJS si están disponibles
    const data = rowsToShow.map((row, rowIndex) => {
      const newRow: any[] = []
      for (let colIndex = 0; colIndex < maxCols; colIndex++) {
        const colLetter = (() => {
          let result = ""
          let num = colIndex
          while (num >= 0) {
            result = String.fromCharCode(65 + (num % 26)) + result
            num = Math.floor(num / 26) - 1
          }
          return result
        })()
        const cellAddress = `${colLetter}${rowIndex + 1}`
        
        if (exceljsFormat?.cellValues?.[cellAddress] !== undefined) {
          newRow.push(exceljsFormat.cellValues[cellAddress])
        } else if (row[colIndex] !== undefined) {
          newRow.push(row[colIndex])
        } else {
          newRow.push(null)
        }
      }
      return newRow
    })
    
    return data
  }, [rawData, maxRows, exceljsFormat])

  // Configurar celdas combinadas
  const mergeCells = useMemo(() => {
    if (!exceljsFormat && !sheet) return []
    
    const mergedCells: Array<{ s: { r: number; c: number }; e: { r: number; c: number } }> = []
    
    if (exceljsFormat?.mergedCells) {
      mergedCells.push(...exceljsFormat.mergedCells)
    }
    
    if (sheet?.["!merges"]) {
      sheet["!merges"].forEach((merge: XLSX.Range) => {
        mergedCells.push({
          s: { r: merge.s.r, c: merge.s.c },
          e: { r: merge.e.r, c: merge.e.c },
        })
      })
    }

    return mergedCells
      .filter(merge => merge.s.r < maxRows)
      .map(merge => ({
        row: merge.s.r,
        col: merge.s.c,
        rowspan: merge.e.r - merge.s.r + 1,
        colspan: merge.e.c - merge.s.c + 1,
      }))
  }, [exceljsFormat, sheet, maxRows])

  // Configurar anchos de columna
  const colWidths = useMemo(() => {
    const widths: number[] = []
    const maxCols = Math.max(...rawData.map(row => row.length), 0)
    
    for (let i = 0; i < maxCols; i++) {
      if (exceljsFormat?.columnWidths[i]) {
        widths.push(exceljsFormat.columnWidths[i])
      } else if (sheet?.["!cols"]?.[i]?.w) {
        widths.push(sheet["!cols"][i].w * 7.5)
      } else {
        widths.push(80)
      }
    }
    
    return widths
  }, [exceljsFormat, sheet, rawData])

  // Configurar alturas de fila
  const rowHeights = useMemo(() => {
    const heights: number[] = []
    const rowsToShow = Math.min(rawData.length, maxRows)
    
    for (let i = 0; i < rowsToShow; i++) {
      if (exceljsFormat?.rowHeights[i]) {
        heights.push(exceljsFormat.rowHeights[i])
      } else if (sheet?.["!rows"]?.[i]?.hpt) {
        heights.push(sheet["!rows"][i].hpt * 1.33)
      } else {
        heights.push(23)
      }
    }
    
    return heights
  }, [exceljsFormat, sheet, rawData, maxRows])

  // Función para obtener estilos de celda
  const getCellStyle = (row: number, col: number): any => {
    const colLetter = (() => {
      let result = ""
      let num = col
      while (num >= 0) {
        result = String.fromCharCode(65 + (num % 26)) + result
        num = Math.floor(num / 26) - 1
      }
      return result
    })()
    const cellAddress = `${colLetter}${row + 1}`
    
    const excelCellStyle = exceljsFormat?.cellStyles?.[cellAddress]
    const isSelected = selectedCells.some(cell => cell.row === row && cell.col === col)
    const isHighlighted = highlightedCells.some(cell => cell.row === row && cell.col === col)

    return {
      renderer: (instance: any, td: HTMLTableCellElement, row: number, col: number, prop: any, value: any) => {
        td.style.cssText = ""
        td.textContent = value ?? ""
        
        if (excelCellStyle) {
          if (excelCellStyle.backgroundColor) {
            td.style.backgroundColor = excelCellStyle.backgroundColor
          }
          if (excelCellStyle.textColor) {
            td.style.color = excelCellStyle.textColor
          }
          if (excelCellStyle.fontWeight) {
            td.style.fontWeight = excelCellStyle.fontWeight
          }
          if (excelCellStyle.fontStyle) {
            td.style.fontStyle = excelCellStyle.fontStyle
          }
          if (excelCellStyle.fontSize) {
            td.style.fontSize = excelCellStyle.fontSize
          }
          if (excelCellStyle.fontFamily) {
            td.style.fontFamily = excelCellStyle.fontFamily
          }
          if (excelCellStyle.textAlign) {
            td.style.textAlign = excelCellStyle.textAlign
          }
          if (excelCellStyle.verticalAlign) {
            td.style.verticalAlign = excelCellStyle.verticalAlign
          }
          
          if (excelCellStyle.borders) {
            if (excelCellStyle.borders.top) {
              td.style.borderTop = `${excelCellStyle.borders.top.width} ${excelCellStyle.borders.top.style} ${excelCellStyle.borders.top.color}`
            }
            if (excelCellStyle.borders.bottom) {
              td.style.borderBottom = `${excelCellStyle.borders.bottom.width} ${excelCellStyle.borders.bottom.style} ${excelCellStyle.borders.bottom.color}`
            }
            if (excelCellStyle.borders.left) {
              td.style.borderLeft = `${excelCellStyle.borders.left.width} ${excelCellStyle.borders.left.style} ${excelCellStyle.borders.left.color}`
            }
            if (excelCellStyle.borders.right) {
              td.style.borderRight = `${excelCellStyle.borders.right.width} ${excelCellStyle.borders.right.style} ${excelCellStyle.borders.right.color}`
            }
          }
        }
        
        if (isSelected) {
          if (excelCellStyle?.backgroundColor) {
            td.style.boxShadow = "inset 0 0 0 2px rgb(34, 197, 94)"
          } else {
            td.style.backgroundColor = "rgba(34, 197, 94, 0.3)"
            td.style.boxShadow = "inset 0 0 0 2px rgb(34, 197, 94)"
          }
        } else if (isHighlighted) {
          if (excelCellStyle?.backgroundColor) {
            td.style.boxShadow = "inset 0 0 0 1px rgb(34, 197, 94)"
          } else {
            td.style.backgroundColor = "rgba(34, 197, 94, 0.1)"
            td.style.boxShadow = "inset 0 0 0 1px rgb(34, 197, 94)"
          }
        }
      }
    }
  }

  // Configuración de Handsontable
  const hotSettings: any = {
    data: hotData,
    readOnly,
    mergeCells,
    colWidths,
    rowHeights,
    width: "100%",
    height: 600,
    licenseKey: "non-commercial-and-evaluation",
    stretchH: "none",
    autoWrapRow: true,
    autoWrapCol: true,
    manualColumnResize: false,
    manualRowResize: false,
    contextMenu: false,
    columnSorting: false,
    filters: false,
    dropdownMenu: false,
    afterSelectionEnd: (row: number, col: number) => {
      if (onCellClick) {
        onCellClick(row, col)
      }
    },
    cells: (row: number, col: number) => {
      return getCellStyle(row, col)
    },
  }

  return (
    <div className={className}>
      {isLoadingStyles && (
        <div className="text-sm text-muted-foreground mb-2">Cargando estilos...</div>
      )}
      <HotTableComponent
        ref={hotTableRef}
        settings={hotSettings}
      />
    </div>
  )
}
