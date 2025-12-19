"use client"

import React, { useRef, useEffect, useMemo, useState } from "react"
import * as XLSX from "xlsx"
import { extractExcelStylesWithExcelJS, type ExcelFormatData } from "@/lib/excel-styles-extractor"
import { ExcelViewer } from "./excel-viewer"
import { loadColumnConfig } from "@/lib/column-config"

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
 * Componente interno que SOLO se renderiza cuando Handsontable está completamente listo
 */
function HandsontableRenderer({
  rawData,
  sheet,
  file,
  onCellClick,
  selectedCells,
  highlightedCells,
  maxRows,
  className,
  readOnly,
  exceljsFormat,
}: ExcelHandsontableViewerProps & { exceljsFormat: ExcelFormatData | null }) {
  const [HotTableComponent, setHotTableComponent] = useState<any>(null)
  const [HandsontableLib, setHandsontableLib] = useState<any>(null)
  const hotTableRef = useRef<any>(null)
  const [isRefReady, setIsRefReady] = useState(false)

  // Cargar Handsontable dinámicamente SOLO cuando este componente se monta
  useEffect(() => {
    let isMounted = true

    const loadHandsontable = async () => {
      try {
        const [handsontableReact, handsontable] = await Promise.all([
          import("@handsontable/react"),
          import("handsontable"),
        ])
        
        await import("handsontable/dist/handsontable.full.css" as any)
        
        if (isMounted) {
          setHotTableComponent(() => handsontableReact.HotTable)
          setHandsontableLib(() => handsontable.default || handsontable)
        }
      } catch (error) {
        console.error("Error cargando Handsontable:", error)
      }
    }

    loadHandsontable()

    return () => {
      isMounted = false
    }
  }, [])

  // Verificar que el ref esté listo DESPUÉS del render
  useEffect(() => {
    if (HotTableComponent && HandsontableLib) {
      // Dar tiempo para que React asigne el ref
      const timer = setTimeout(() => {
        if (hotTableRef.current) {
          setIsRefReady(true)
        } else {
          setIsRefReady(false)
        }
      }, 50)
      return () => clearTimeout(timer)
    } else {
      setIsRefReady(false)
    }
  }, [HotTableComponent, HandsontableLib])

  // Preparar datos para Handsontable
  const hotData = useMemo(() => {
    const rowsToShow = rawData.slice(0, maxRows ?? 100)
    const maxCols = Math.max(...rawData.map(row => row.length), 0)
    
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
      .filter(merge => merge.s.r < (maxRows ?? 100))
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
      } else if (sheet?.["!cols"]?.[i]) {
        const colInfo = sheet["!cols"][i] as any
        if (colInfo?.w) {
          widths.push(colInfo.w * 7.5)
        } else {
          widths.push(80)
        }
      } else {
        widths.push(80)
      }
    }
    
    return widths
  }, [exceljsFormat, sheet, rawData])

  // Configurar alturas de fila
  const rowHeights = useMemo(() => {
    const heights: number[] = []
    const rowsToShow = Math.min(rawData.length, maxRows ?? 100)
    
    for (let i = 0; i < rowsToShow; i++) {
      if (exceljsFormat?.rowHeights[i]) {
        heights.push(exceljsFormat.rowHeights[i])
      } else if (sheet?.["!rows"]?.[i]?.hpt) {
        heights.push((sheet["!rows"][i] as any).hpt * 1.33)
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
    const isSelected = (selectedCells ?? []).some(cell => cell.row === row && cell.col === col)
    const isHighlighted = (highlightedCells ?? []).some(cell => cell.row === row && cell.col === col)

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

  // NO renderizar Handsontable si no está completamente listo
  if (!HotTableComponent || !HandsontableLib) {
    return (
      <div className={className}>
        <div className="p-4 text-sm text-muted-foreground">
          Cargando Handsontable...
        </div>
      </div>
    )
  }

  // Renderizar Handsontable - el ref se asignará después del render
  // Si el ref no se asigna correctamente, el useEffect lo detectará
  return (
    <div className={className}>
      <HotTableComponent
        ref={(ref: any) => {
          hotTableRef.current = ref
          if (ref && HotTableComponent && HandsontableLib) {
            setIsRefReady(true)
          }
        }}
        settings={hotSettings}
      />
    </div>
  )
}

/**
 * Visualizador de Excel usando Handsontable
 * Si Handsontable no está instalado o la configuración es inválida, usa ExcelViewer como fallback
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
  const [isMounted, setIsMounted] = useState(false)
  const [exceljsFormat, setExceljsFormat] = useState<ExcelFormatData | null>(null)
  const [isLoadingStyles, setIsLoadingStyles] = useState(false)

  // Verificar que el componente esté montado
  useEffect(() => {
    setIsMounted(true)
    return () => setIsMounted(false)
  }, [])

  // EARLY RETURN #1: Verificar que estamos en el cliente y montado
  if (typeof window === "undefined" || !isMounted) {
    return (
      <div className={className}>
        <div className="p-4 text-sm text-muted-foreground">
          Cargando visualizador...
        </div>
      </div>
    )
  }

  // EARLY RETURN #2: Verificar configuración ANTES de cualquier hook relacionado con Handsontable
  const config = loadColumnConfig()
  const hasValidConfig = config?.fechaCell && config?.operacionCell && 
    typeof config.fechaCell.row === "number" && 
    typeof config.fechaCell.col === "number" &&
    typeof config.operacionCell.row === "number" && 
    typeof config.operacionCell.col === "number"

  if (!hasValidConfig) {
    return (
      <div className={className}>
        <div className="p-4 text-sm text-destructive bg-destructive/10 rounded-md border border-destructive/20">
          <p className="font-semibold mb-1">Error de configuración</p>
          <p>La configuración no incluye las celdas de fecha u operación. Por favor, completa la configuración.</p>
        </div>
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
      </div>
    )
  }

  // Cargar estilos con ExcelJS (esto no depende de Handsontable)
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

  // Solo renderizar el componente de Handsontable si todas las condiciones se cumplen
  return (
    <div className={className}>
      {isLoadingStyles && (
        <div className="text-sm text-muted-foreground mb-2">Cargando estilos...</div>
      )}
      <HandsontableRenderer
        rawData={rawData}
        sheet={sheet}
        file={file}
        onCellClick={onCellClick}
        selectedCells={selectedCells}
        highlightedCells={highlightedCells}
        maxRows={maxRows}
        className={undefined}
        readOnly={readOnly}
        exceljsFormat={exceljsFormat}
      />
    </div>
  )
}
