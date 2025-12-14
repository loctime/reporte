"use client"

import { useMemo } from "react"
import { cn } from "@/lib/utils"
import * as XLSX from "xlsx"

interface ExcelViewerProps {
  rawData: any[][]
  sheet?: XLSX.WorkSheet
  onCellClick?: (row: number, col: number) => void
  selectedCells?: Array<{ row: number; col: number }>
  highlightedCells?: Array<{ row: number; col: number; label?: string }>
  maxRows?: number
  className?: string
}

/**
 * Visualizador de Excel que se ve exactamente como una hoja de cálculo
 * Con estilos, colores, bordes, celdas combinadas, etc.
 */
export function ExcelViewer({
  rawData,
  sheet,
  onCellClick,
  selectedCells = [],
  highlightedCells = [],
  maxRows = 100,
  className,
}: ExcelViewerProps) {
  // Extraer información de formato del Excel
  const excelFormat = useMemo(() => {
    if (!sheet) {
      return {
        mergedCells: [],
        columnWidths: {} as Record<number, number>,
        cellStyles: {} as Record<string, any>,
        cellValues: {} as Record<string, any>,
      }
    }

    // Extraer merged cells
    const mergedCells: Array<{ s: { r: number; c: number }; e: { r: number; c: number } }> = []
    if (sheet["!merges"]) {
      sheet["!merges"].forEach((merge: XLSX.Range) => {
        mergedCells.push({
          s: { r: merge.s.r, c: merge.s.c },
          e: { r: merge.e.r, c: merge.e.c },
        })
      })
    }

    // Extraer anchos de columna
    const columnWidths: Record<number, number> = {}
    if (sheet["!cols"]) {
      sheet["!cols"].forEach((col: any, index: number) => {
        if (col && col.w) {
          // w está en caracteres, convertir a píxeles aproximados (1 char ≈ 7px)
          columnWidths[index] = col.w * 7
        } else if (col && col.width) {
          columnWidths[index] = col.width * 7
        } else {
          // Ancho por defecto
          columnWidths[index] = 80
        }
      })
    }

    // Extraer estilos de celdas
    const cellStyles: Record<string, any> = {}
    const cellValues: Record<string, any> = {}
    Object.keys(sheet).forEach((key) => {
      if (key.startsWith("!")) return
      const cell = sheet[key]
      if (cell) {
        cellStyles[key] = cell.s || {}
        cellValues[key] = cell.v
      }
    })

    return { mergedCells, columnWidths, cellStyles, cellValues }
  }, [sheet])

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
  const getCellAddress = (row: number, col: number): string => {
    return `${colIndexToExcel(col)}${row + 1}`
  }

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

  // Función para obtener el estilo de una celda
  const getCellStyle = (rowIndex: number, colIndex: number) => {
    const cellAddress = getCellAddress(rowIndex, colIndex)
    const style = excelFormat.cellStyles[cellAddress] || {}

    const cssStyle: React.CSSProperties = {
      backgroundColor: style.fill?.fgColor?.rgb
        ? `#${style.fill.fgColor.rgb}`
        : style.fill?.fgColor?.argb
          ? `#${style.fill.fgColor.argb.slice(2)}`
          : undefined,
      color: style.font?.color?.rgb
        ? `#${style.font.color.rgb}`
        : style.font?.color?.argb
          ? `#${style.font.color.argb.slice(2)}`
          : undefined,
      fontWeight: style.font?.bold ? "bold" : undefined,
      fontStyle: style.font?.italic ? "italic" : undefined,
      textAlign: style.alignment?.horizontal || "left",
      verticalAlign: style.alignment?.vertical || "top",
      fontSize: style.font?.sz ? `${style.font.sz}pt` : undefined,
      textDecoration: style.font?.underline ? "underline" : undefined,
    }

    return cssStyle
  }

  // Función para obtener el valor de una celda (con formato)
  const getCellValue = (rowIndex: number, colIndex: number): string => {
    const cellAddress = getCellAddress(rowIndex, colIndex)
    const rawValue = excelFormat.cellValues[cellAddress] ?? rawData[rowIndex]?.[colIndex]

    if (rawValue === null || rawValue === undefined || rawValue === "") {
      return ""
    }

    // Si es un número y tiene formato, intentar mantener el formato
    if (typeof rawValue === "number") {
      return String(rawValue)
    }

    return String(rawValue)
  }

  // Función para obtener el ancho de columna
  const getColumnWidth = (colIndex: number): number => {
    return excelFormat.columnWidths[colIndex] || 80
  }

  // Calcular el número máximo de columnas
  const maxColumns = Math.max(...rawData.map((row) => row?.length || 0), 0)

  // Filas a mostrar
  const rowsToShow = rawData.slice(0, maxRows)

  return (
    <div className={cn("border border-gray-300 rounded-lg overflow-hidden bg-white", className)}>
      {/* Barra de herramientas estilo Excel */}
      <div className="bg-gray-100 border-b border-gray-300 px-2 py-1 text-xs text-gray-600">
        Excel Viewer - {rawData.length} filas × {maxColumns} columnas
      </div>

      {/* Contenedor con scroll */}
      <div className="overflow-auto max-h-[600px] bg-white">
        <div className="inline-block min-w-full">
          {/* Encabezado de columnas (A, B, C, ...) */}
          <div className="flex sticky top-0 z-20 bg-gray-50 border-b-2 border-gray-400">
            {/* Celda vacía para alinear con números de fila */}
            <div className="bg-gray-200 border-r border-b border-gray-400 min-w-[50px] w-[50px] h-6 flex items-center justify-center text-xs font-semibold text-gray-700 sticky left-0 z-30">
              {/* Espacio para números de fila */}
            </div>
            {Array.from({ length: maxColumns }).map((_, colIndex) => {
              const colWidth = getColumnWidth(colIndex)
              return (
                <div
                  key={colIndex}
                  className="bg-gray-50 border-r border-b border-gray-400 h-6 flex items-center justify-center text-xs font-semibold text-gray-700"
                  style={{ minWidth: `${colWidth}px`, width: `${colWidth}px` }}
                >
                  {colIndexToExcel(colIndex)}
                </div>
              )
            })}
          </div>

          {/* Filas del Excel */}
          {rowsToShow.map((row, rowIndex) => {
            return (
              <div key={rowIndex} className="flex">
                {/* Número de fila (sticky) */}
                <div className="bg-gray-100 border-r border-b border-gray-400 min-w-[50px] w-[50px] h-8 flex items-center justify-center text-xs font-medium text-gray-600 sticky left-0 z-10">
                  {rowIndex + 1}
                </div>

                {/* Celdas de la fila */}
                {Array.from({ length: maxColumns }).map((_, colIndex) => {
                  // Verificar si esta celda está en un merged range
                  const mergedInfo = getMergedCellInfo(rowIndex, colIndex)

                  // Si está en un merge pero no es la celda inicial, renderizar celda vacía
                  if (mergedInfo.isMerged && !mergedInfo.isStartCell) {
                    return (
                      <div
                        key={colIndex}
                        className="border-r border-b border-gray-300"
                        style={{
                          minWidth: `${getColumnWidth(colIndex)}px`,
                          width: `${getColumnWidth(colIndex)}px`,
                          height: "32px",
                        }}
                      />
                    )
                  }

                  const cellValue = getCellValue(rowIndex, colIndex)
                  const cellStyle = getCellStyle(rowIndex, colIndex)

                  // Verificar si está seleccionada
                  const isSelected = selectedCells.some(
                    (c) => c.row === rowIndex && c.col === colIndex
                  )

                  // Verificar si está resaltada
                  const highlighted = highlightedCells.find(
                    (c) => c.row === rowIndex && c.col === colIndex
                  )

                  const colWidth = getColumnWidth(colIndex)
                  let totalWidth = colWidth
                  if (mergedInfo.isMerged && mergedInfo.isStartCell) {
                    // Calcular ancho total de celdas combinadas
                    totalWidth = 0
                    for (let c = colIndex; c <= colIndex + mergedInfo.colSpan - 1; c++) {
                      totalWidth += getColumnWidth(c)
                    }
                  }

                  return (
                    <div
                      key={colIndex}
                      className={cn(
                        "border-r border-b border-gray-300 p-1 text-xs overflow-hidden relative",
                        isSelected && "ring-2 ring-blue-500 ring-offset-1 bg-blue-50",
                        highlighted && !isSelected && "bg-yellow-100 ring-1 ring-yellow-400",
                        onCellClick && "cursor-pointer hover:bg-gray-50",
                        mergedInfo.isMerged && mergedInfo.isStartCell && "flex items-center"
                      )}
                      style={{
                        minWidth: `${totalWidth}px`,
                        width: `${totalWidth}px`,
                        height: "32px",
                        ...cellStyle,
                      }}
                      onClick={() => onCellClick?.(rowIndex, colIndex)}
                      title={highlighted?.label || cellValue || `Fila ${rowIndex + 1}, Col ${colIndex + 1}`}
                    >
                      <div className="truncate w-full" title={cellValue}>
                        {cellValue}
                      </div>
                      {highlighted?.label && (
                        <div className="absolute top-0 right-0 bg-yellow-400 text-yellow-900 text-[8px] px-1 rounded-bl z-10">
                          {highlighted.label}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
