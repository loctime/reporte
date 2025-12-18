"use client"

import React, { useMemo, useEffect, useState } from "react"
import * as XLSX from "xlsx"
import { extractExcelStylesWithExcelJS, type ExcelFormatData } from "@/lib/excel-styles-extractor"
import { cn } from "@/lib/utils"

interface ExcelTableViewerProps {
  rawData: any[][]
  sheet?: XLSX.WorkSheet
  file?: File
  onCellClick?: (row: number, col: number) => void
  selectedCells?: Array<{ row: number; col: number }>
  highlightedCells?: Array<{ row: number; col: number; label?: string }>
  maxRows?: number
  className?: string
}

/**
 * Visualizador de Excel usando tabla HTML real
 * Usa rowspan y colspan para celdas combinadas - la forma más confiable
 */
export function ExcelTableViewer({
  rawData,
  sheet,
  file,
  onCellClick,
  selectedCells = [],
  highlightedCells = [],
  maxRows = 100,
  className,
}: ExcelTableViewerProps) {
  const [exceljsFormat, setExceljsFormat] = useState<ExcelFormatData | null>(null)
  const [isLoadingStyles, setIsLoadingStyles] = useState(false)

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

  // Extraer información de formato
  const excelFormat = useMemo(() => {
    if (exceljsFormat) {
      return {
        mergedCells: exceljsFormat.mergedCells,
        columnWidths: exceljsFormat.columnWidths,
        cellStyles: exceljsFormat.cellStyles,
        cellValues: exceljsFormat.cellValues,
        rowHeights: exceljsFormat.rowHeights,
      }
    }

    if (!sheet) {
      return { mergedCells: [], columnWidths: {}, cellStyles: {}, rowHeights: {}, cellValues: {} }
    }

    const mergedCells: Array<{ s: { r: number; c: number }; e: { r: number; c: number } }> = []
    if (sheet["!merges"]) {
      sheet["!merges"].forEach((merge: XLSX.Range) => {
        mergedCells.push({
          s: { r: merge.s.r, c: merge.s.c },
          e: { r: merge.e.r, c: merge.e.c },
        })
      })
    }

    const columnWidths: Record<number, number> = {}
    if (sheet["!cols"]) {
      sheet["!cols"].forEach((col: any, index: number) => {
        if (col && col.w) {
          columnWidths[index] = col.w * 7.5
        } else {
          columnWidths[index] = 80
        }
      })
    }

    const rowHeights: Record<number, number> = {}
    if (sheet["!rows"]) {
      Object.keys(sheet["!rows"]).forEach((rowIndex) => {
        const row = sheet["!rows"][parseInt(rowIndex)]
        if (row && row.hpt) {
          rowHeights[parseInt(rowIndex)] = row.hpt * 1.33
        }
      })
    }

    const cellStyles: Record<string, any> = {}
    const cellValues: Record<string, any> = {}
    Object.keys(sheet).forEach((key) => {
      if (key.startsWith("!")) return
      const cell = sheet[key]
      if (cell) {
        if (cell.v !== null && cell.v !== undefined) {
          cellValues[key] = cell.v
        }
        if (cell.s) {
          cellStyles[key] = cell.s
        }
      }
    })

    return { mergedCells, columnWidths, cellStyles, rowHeights, cellValues }
  }, [sheet, exceljsFormat])

  // Función para obtener información de merge
  const getMergedCellInfo = (rowIndex: number, colIndex: number) => {
    // Validar y procesar solo merges válidos
    const validMerges = excelFormat.mergedCells.filter(merge => 
      merge && 
      merge.s && merge.e &&
      typeof merge.s.r === 'number' && typeof merge.s.c === 'number' &&
      typeof merge.e.r === 'number' && typeof merge.e.c === 'number' &&
      merge.s.r >= 0 && merge.s.c >= 0 &&
      merge.e.r >= merge.s.r && merge.e.c >= merge.s.c
    )
    
    for (const merge of validMerges) {
      // Verificar si esta celda está dentro del rango del merge
      if (
        rowIndex >= merge.s.r &&
        rowIndex <= merge.e.r &&
        colIndex >= merge.s.c &&
        colIndex <= merge.e.c
      ) {
        // Verificar si es la celda inicial del merge
        const isStartCell = rowIndex === merge.s.r && colIndex === merge.s.c
        return {
          isMerged: true,
          isStartCell,
          rowSpan: merge.e.r - merge.s.r + 1,
          colSpan: merge.e.c - merge.s.c + 1,
          mergeRange: merge,
        }
      }
    }
    return { isMerged: false, isStartCell: false, rowSpan: 1, colSpan: 1, mergeRange: null }
  }

  // Función para obtener dirección de celda
  const getCellAddress = (rowIndex: number, colIndex: number): string => {
    const colLetter = (() => {
      let result = ""
      let num = colIndex
      while (num >= 0) {
        result = String.fromCharCode(65 + (num % 26)) + result
        num = Math.floor(num / 26) - 1
      }
      return result
    })()
    return `${colLetter}${rowIndex + 1}`
  }

  // Función para obtener ancho de columna
  const getColumnWidth = (colIndex: number): number => {
    return excelFormat.columnWidths[colIndex] || 80
  }

  // Función para obtener altura de fila
  const getRowHeight = (rowIndex: number): number => {
    return excelFormat.rowHeights[rowIndex] || 23
  }

  // Función para obtener estilo de celda
  const getCellStyle = (rowIndex: number, colIndex: number): React.CSSProperties => {
    const cellAddress = getCellAddress(rowIndex, colIndex)
    
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

    // Fallback a XLSX
    const style = excelFormat.cellStyles[cellAddress] || {}
    const fill = style.fill
    const font = style.font

    const backgroundColor = fill?.fgColor?.rgb 
      ? `#${fill.fgColor.rgb}` 
      : fill?.bgColor?.rgb 
        ? `#${fill.bgColor.rgb}`
        : undefined

    const textColor = font?.color?.rgb ? `#${font.color.rgb}` : undefined

    return {
      backgroundColor,
      color: textColor,
      fontWeight: font?.bold ? "bold" : undefined,
      fontStyle: font?.italic ? "italic" : undefined,
      fontSize: font?.size ? `${font.size}pt` : undefined,
      fontFamily: font?.name,
      textAlign: style.alignment?.horizontal,
      verticalAlign: style.alignment?.vertical,
    }
  }

  // Función para obtener valor de celda
  const getCellValue = (rowIndex: number, colIndex: number): any => {
    const mergedInfo = getMergedCellInfo(rowIndex, colIndex)
    
    // Si está en un merge, obtener valor de la celda inicial
    if (mergedInfo.isMerged && mergedInfo.mergeRange) {
      const startAddress = getCellAddress(mergedInfo.mergeRange.s.r, mergedInfo.mergeRange.s.c)
      if (exceljsFormat?.cellValues[startAddress] !== undefined) {
        return exceljsFormat.cellValues[startAddress]
      }
      if (excelFormat.cellValues[startAddress] !== undefined) {
        return excelFormat.cellValues[startAddress]
      }
      return rawData[mergedInfo.mergeRange.s.r]?.[mergedInfo.mergeRange.s.c] ?? ""
    }

    // Celda normal
    const cellAddress = getCellAddress(rowIndex, colIndex)
    if (exceljsFormat?.cellValues[cellAddress] !== undefined) {
      return exceljsFormat.cellValues[cellAddress]
    }
    if (excelFormat.cellValues[cellAddress] !== undefined) {
      return excelFormat.cellValues[cellAddress]
    }
    return rawData[rowIndex]?.[colIndex] ?? ""
  }

  // Crear Set de celdas ocupadas por merges
  const occupiedCells = useMemo(() => {
    const occupied = new Set<string>()
    
    // Validar y procesar solo merges válidos
    const validMerges = excelFormat.mergedCells.filter(merge => 
      merge && 
      merge.s && merge.e &&
      typeof merge.s.r === 'number' && typeof merge.s.c === 'number' &&
      typeof merge.e.r === 'number' && typeof merge.e.c === 'number' &&
      merge.s.r >= 0 && merge.s.c >= 0 &&
      merge.e.r >= merge.s.r && merge.e.c >= merge.s.c
    )
    
    validMerges.forEach((merge) => {
      for (let r = merge.s.r; r <= merge.e.r; r++) {
        for (let c = merge.s.c; c <= merge.e.c; c++) {
          // Marcar todas las celdas del merge EXCEPTO la inicial
          if (!(r === merge.s.r && c === merge.s.c)) {
            occupied.add(`${r},${c}`)
          }
        }
      }
    })
    
    // Debug logs
    if (validMerges.length > 0) {
      console.log(`📊 Total merges válidos: ${validMerges.length} de ${excelFormat.mergedCells.length}`)
      const firstMerge = validMerges[0]
      console.log(`📊 Primer merge: fila ${firstMerge.s.r}-${firstMerge.e.r}, col ${firstMerge.s.c}-${firstMerge.e.c}`)
      console.log(`📊 Celdas ocupadas por merges: ${occupied.size}`)
      if (occupied.size > 0) {
        const sample = Array.from(occupied).slice(0, 5)
        console.log(`📊 Ejemplos de celdas ocupadas:`, sample)
      }
    }
    
    return occupied
  }, [excelFormat.mergedCells])

  const maxColumns = Math.max(...rawData.map((row) => row?.length || 0), 0)
  const rowsToShow = rawData.slice(0, maxRows)

  return (
    <div className={cn("border border-gray-300 rounded-lg overflow-hidden bg-white", className)}>
      <div className="bg-gray-100 border-b border-gray-300 px-2 py-1 text-xs text-gray-600">
        Excel Viewer - {rawData.length} filas × {maxColumns} columnas
      </div>

      <div className="overflow-auto max-h-[600px] bg-white">
        <table style={{ borderCollapse: "collapse", tableLayout: "fixed", width: "100%" }}>
          <colgroup>
            <col style={{ width: "50px" }} />
            {Array.from({ length: maxColumns }).map((_, colIndex) => (
              <col key={colIndex} style={{ width: `${getColumnWidth(colIndex)}px` }} />
            ))}
          </colgroup>

          <thead>
            <tr>
              <th className="bg-gray-200 border border-gray-400 p-1 text-xs font-semibold sticky left-0 z-10">
                {/* Celda vacía para números de fila */}
              </th>
              {Array.from({ length: maxColumns }).map((_, colIndex) => (
                <th
                  key={colIndex}
                  className="bg-gray-50 border border-gray-400 p-1 text-xs font-semibold text-center"
                >
                  {(() => {
                    let result = ""
                    let num = colIndex
                    while (num >= 0) {
                      result = String.fromCharCode(65 + (num % 26)) + result
                      num = Math.floor(num / 26) - 1
                    }
                    return result
                  })()}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {rowsToShow.map((row, rowIndex) => {
              const rowHeight = getRowHeight(rowIndex)
              
              return (
                <tr key={rowIndex} style={{ height: `${rowHeight}px` }}>
                  <td className="bg-gray-100 border border-gray-400 p-1 text-xs text-center sticky left-0 z-10">
                    {rowIndex + 1}
                  </td>
                  
                  {(() => {
                    const cells: React.ReactNode[] = []
                    const renderedCols = new Set<number>()
                    
                    for (let colIndex = 0; colIndex < maxColumns; colIndex++) {
                      // Si esta columna ya fue cubierta por un colspan anterior, saltarla
                      if (renderedCols.has(colIndex)) {
                        if (rowIndex < 3 && colIndex < 12) {
                          console.log(`⏭️ Saltando columna ${colIndex} (ya cubierta por colspan)`)
                        }
                        continue
                      }
                      
                      // Verificar si está ocupada por un merge
                      const isOccupied = occupiedCells.has(`${rowIndex},${colIndex}`)
                      const mergedInfo = getMergedCellInfo(rowIndex, colIndex)
                      
                      // Si está ocupada O está en un merge pero NO es la inicial, saltarla
                      if (isOccupied || (mergedInfo.isMerged && !mergedInfo.isStartCell)) {
                        if (rowIndex < 3 && colIndex < 12) {
                          console.log(`⏭️ Saltando columna ${colIndex} (ocupada o no es inicio de merge)`)
                        }
                        continue
                      }

                      const cellValue = getCellValue(rowIndex, colIndex)
                      const cellStyle = getCellStyle(rowIndex, colIndex)
                      
                      const isSelected = selectedCells.some(cell => cell.row === rowIndex && cell.col === colIndex)
                      const highlighted = highlightedCells.find(cell => cell.row === rowIndex && cell.col === colIndex)

                      // Aplicar rowspan y colspan solo si es la celda inicial del merge
                      const rowSpan = mergedInfo.isMerged && mergedInfo.isStartCell && mergedInfo.rowSpan > 1 ? mergedInfo.rowSpan : undefined
                      const colSpan = mergedInfo.isMerged && mergedInfo.isStartCell && mergedInfo.colSpan > 1 ? mergedInfo.colSpan : undefined

                      // Marcar las columnas que serán cubiertas por este colspan
                      if (colSpan && colSpan > 1) {
                        for (let c = colIndex; c < colIndex + colSpan; c++) {
                          renderedCols.add(c)
                        }
                        if (rowIndex < 3 && colIndex < 12) {
                          console.log(`✅ Marcando columnas ${colIndex} a ${colIndex + colSpan - 1} como cubiertas por colspan=${colSpan}`)
                        }
                      } else {
                        renderedCols.add(colIndex)
                      }

                      // Debug para las primeras filas y columnas
                      if (rowIndex < 3 && colIndex < 12) {
                        console.log(`🔍 Renderizando celda [${rowIndex},${colIndex}]: rowSpan=${rowSpan || 1}, colSpan=${colSpan || 1}, valor="${cellValue}", isMerged=${mergedInfo.isMerged}, isStartCell=${mergedInfo.isStartCell}`)
                      }

                      const tdProps: any = {
                        className: cn(
                          "border border-gray-300 p-1 text-xs",
                          isSelected && "ring-2 ring-blue-500",
                          highlighted && !isSelected && "ring-1 ring-yellow-400",
                          onCellClick && "cursor-pointer hover:opacity-80"
                        ),
                        style: {
                          ...cellStyle,
                          ...(isSelected && !cellStyle.backgroundColor && { backgroundColor: "rgba(59, 130, 246, 0.1)" }),
                          ...(highlighted && !isSelected && !cellStyle.backgroundColor && { backgroundColor: "rgba(250, 204, 21, 0.2)" }),
                        },
                        onClick: () => onCellClick?.(rowIndex, colIndex),
                        title: highlighted?.label || String(cellValue) || `Fila ${rowIndex + 1}, Col ${colIndex + 1}`,
                      }
                      
                      // Aplicar rowSpan y colSpan solo si tienen valores válidos
                      if (rowSpan && rowSpan > 1) {
                        tdProps.rowSpan = rowSpan
                      }
                      if (colSpan && colSpan > 1) {
                        tdProps.colSpan = colSpan
                      }

                      cells.push(
                        <td key={colIndex} {...tdProps}>
                          {String(cellValue || "")}
                        </td>
                      )
                    }
                    
                    if (rowIndex < 3) {
                      console.log(`📋 Fila ${rowIndex}: ${cells.length} celdas renderizadas`)
                    }
                    
                    return cells
                  })()}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

