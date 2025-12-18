"use client"

import React, { useMemo, useState, useEffect } from "react"
import { cn } from "@/lib/utils"
import * as XLSX from "xlsx"
import { extractExcelStylesWithExcelJS, type ExcelFormatData } from "@/lib/excel-styles-extractor"

interface ExcelViewerProps {
  rawData: any[][]
  sheet?: XLSX.WorkSheet
  file?: File // Archivo Excel opcional para usar ExcelJS
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
  file,
  onCellClick,
  selectedCells = [],
  highlightedCells = [],
  maxRows = 100,
  className,
}: ExcelViewerProps) {
  const [exceljsFormat, setExceljsFormat] = useState<ExcelFormatData | null>(null)
  const [isLoadingStyles, setIsLoadingStyles] = useState(false)

  // Cargar estilos con ExcelJS si hay un archivo
  // Nota: ExcelJS no funciona en el navegador, así que por ahora usamos XLSX
  useEffect(() => {
    if (file) {
      setIsLoadingStyles(true)
      // Intentar cargar estilos, pero si falla, usar XLSX como fallback
      // Envolver en try-catch adicional para capturar errores síncronos
      Promise.resolve()
        .then(() => extractExcelStylesWithExcelJS(file))
        .then((format) => {
          setExceljsFormat(format)
          setIsLoadingStyles(false)
        })
        .catch((error) => {
          // Error al cargar estilos con ExcelJS, usar XLSX como fallback
          // No loguear el error - el fallback XLSX se maneja automáticamente en extractExcelStylesWithExcelJS
          setIsLoadingStyles(false)
          // No establecer null aquí, el fallback XLSX ya devuelve datos
          setExceljsFormat(null)
        })
    } else {
      setExceljsFormat(null)
    }
  }, [file])

  // Extraer información de formato del Excel (fallback a XLSX)
  const excelFormat = useMemo(() => {
    // Si tenemos datos de ExcelJS, usarlos (son más completos)
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
    if (!sheet) {
      return {
        mergedCells: [],
        columnWidths: {} as Record<number, number>,
        cellStyles: {} as Record<string, any>,
        cellValues: {} as Record<string, any>,
        rowHeights: {},
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
        // Extraer estilo completo (puede estar en cell.s o en el workbook styles)
        cellStyles[key] = cell.s || {}
        cellValues[key] = cell.v
        
        // Si hay referencia a estilos del workbook, intentar obtenerlos
        if (cell.t === "s" && typeof cell.v === "number") {
          // Es una celda de texto compartido
          // El valor real está en sharedStrings
        }
      }
    })

    return { mergedCells, columnWidths, cellStyles, cellValues, rowHeights: {} }
  }, [sheet, exceljsFormat])

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
  const getCellStyle = (rowIndex: number, colIndex: number) => {
    const cellAddress = getCellAddress(rowIndex, colIndex)
    const style = excelFormat.cellStyles[cellAddress] || {}

    // Si usamos ExcelJS, los estilos ya vienen procesados
    if (exceljsFormat) {
      const exceljsStyle = exceljsFormat.cellStyles[cellAddress]
      if (exceljsStyle) {
        const borderStyle: any = {}
        if (exceljsStyle.borders) {
          Object.entries(exceljsStyle.borders).forEach(([side, border]) => {
            const borderKey = `border${side.charAt(0).toUpperCase() + side.slice(1)}` as keyof React.CSSProperties
            borderStyle[borderKey] = `${border.width} solid ${border.color}`
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

    // Fallback a XLSX (código anterior)
    let backgroundColor: string | undefined
    if (style.fill) {
      if (style.fill.fgColor) {
        backgroundColor = excelColorToCSS(style.fill.fgColor)
      } else if (style.fill.bgColor) {
        backgroundColor = excelColorToCSS(style.fill.bgColor)
      }
    }

    const textColor = style.font?.color ? excelColorToCSS(style.font.color) : undefined

    const borderStyle: any = {}
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
          
          const borderKey = `border${side.charAt(0).toUpperCase() + side.slice(1)}` as keyof React.CSSProperties
          borderStyle[borderKey] = `${borderWidth} solid ${borderColor}`
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

  // Función para obtener el valor de una celda (con formato)
  const getCellValue = (rowIndex: number, colIndex: number): string => {
    // Verificar si esta celda está en un merged range
    const mergedInfo = getMergedCellInfo(rowIndex, colIndex)
    
    // Si está en un merge pero NO es la celda inicial, devolver cadena vacía
    // El valor solo debe mostrarse en la celda inicial del merge
    if (mergedInfo.isMerged && !mergedInfo.isStartCell) {
      return ""
    }
    
    // Determinar qué celda usar para obtener el valor
    // Si está en un merge, usar siempre la celda inicial del merge
    let actualRowIndex = rowIndex
    let actualColIndex = colIndex
    
    if (mergedInfo.isMerged) {
      // Encontrar el merge que contiene esta celda para obtener las coordenadas de la celda inicial
      const containingMerge = excelFormat.mergedCells.find(
        (m) => 
          rowIndex >= m.s.r && rowIndex <= m.e.r &&
          colIndex >= m.s.c && colIndex <= m.e.c
      )
      if (containingMerge) {
        actualRowIndex = containingMerge.s.r
        actualColIndex = containingMerge.s.c
      }
    }
    
    // Obtener la dirección de la celda (usar la celda inicial si está en un merge)
    const cellAddress = getCellAddress(actualRowIndex, actualColIndex)
    
    // Priorizar valores de ExcelJS si están disponibles (estos ya tienen el valor correcto en la celda inicial)
    let rawValue = exceljsFormat?.cellValues[cellAddress] ?? 
                   excelFormat.cellValues[cellAddress]
    
    // Si no hay valor en los formatos extraídos, usar rawData de la celda inicial del merge
    if (rawValue === null || rawValue === undefined || rawValue === "") {
      rawValue = rawData[actualRowIndex]?.[actualColIndex]
    }

    if (rawValue === null || rawValue === undefined || rawValue === "") {
      return ""
    }

    // Si es un objeto, intentar extraer el valor útil
    if (typeof rawValue === "object") {
      // Si tiene una propiedad 'result', usarla (valor calculado de fórmula)
      if ("result" in rawValue && rawValue.result !== null && rawValue.result !== undefined) {
        rawValue = rawValue.result
      }
      // Si tiene una propiedad 'text', usarla
      else if ("text" in rawValue) {
        rawValue = rawValue.text
      }
      // Si tiene una propiedad 'value', usarla
      else if ("value" in rawValue) {
        rawValue = rawValue.value
      }
      // Si es un array, unir los elementos
      else if (Array.isArray(rawValue)) {
        rawValue = rawValue.map(v => String(v)).join("")
      }
      // Último recurso: convertir a string
      else {
        rawValue = String(rawValue)
      }
    }

    // Convertir a string final con formato
    if (typeof rawValue === "number") {
      // Verificar si es un porcentaje (formato de Excel)
      // Los porcentajes en Excel pueden estar como decimal (0.68) o como número (68)
      // Intentar detectar si la celda tiene formato de porcentaje
      const cellAddress = getCellAddress(actualRowIndex, actualColIndex)
      const cell = sheet?.[cellAddress]
      
      // Verificar formato de porcentaje en XLSX
      if (cell && cell.z) {
        // cell.z contiene el formato de número
        const format = String(cell.z)
        if (format.includes("%") || format.includes("0%") || format.includes("0.0%")) {
          // Es un porcentaje - formatear según el formato
          if (rawValue < 1 && rawValue > 0) {
            // Es decimal (0.68 = 68%)
            return `${(rawValue * 100).toFixed(0)}%`
          } else if (rawValue >= 1 && rawValue <= 100) {
            // Ya está como porcentaje (68 = 68%)
            return `${rawValue.toFixed(0)}%`
          }
        }
      }
      
      // Verificar si el valor parece ser un porcentaje decimal (0-1)
      if (rawValue > 0 && rawValue < 1 && rawValue !== Math.floor(rawValue)) {
        // Podría ser un porcentaje decimal, pero solo formatearlo si parece razonable
        // (evitar formatear números como 0.5 que podrían ser fracciones)
        const asPercent = rawValue * 100
        if (asPercent >= 0.1 && asPercent <= 100) {
          // Formatear como porcentaje solo si está en un rango razonable
          return `${asPercent.toFixed(0)}%`
        }
      }
      
      return String(rawValue)
    }

    return String(rawValue)
  }

  // Función para obtener el ancho de columna
  const getColumnWidth = (colIndex: number): number => {
    return excelFormat.columnWidths[colIndex] || 80
  }

  // Función para obtener la altura de fila
  const getRowHeight = (rowIndex: number): number => {
    return (excelFormat.rowHeights as Record<number, number>)[rowIndex] || 32
  }

  // Calcular el número máximo de columnas
  const maxColumns = Math.max(...rawData.map((row) => row?.length || 0), 0)

  // Filas a mostrar
  const rowsToShow = rawData.slice(0, maxRows)

  // Crear Set de celdas ocupadas por merges (para saltarlas en el renderizado)
  const occupiedCells = useMemo(() => {
    const occupied = new Set<string>()
    excelFormat.mergedCells.forEach((merge) => {
      for (let r = merge.s.r; r <= merge.e.r; r++) {
        for (let c = merge.s.c; c <= merge.e.c; c++) {
          // Marcar todas las celdas del merge excepto la inicial
          if (!(r === merge.s.r && c === merge.s.c)) {
            occupied.add(`${r},${c}`)
          }
        }
      }
    })
    return occupied
  }, [excelFormat.mergedCells])

  return (
    <div className={cn("border border-gray-300 rounded-lg overflow-hidden bg-white", className)}>
      {/* Barra de herramientas estilo Excel */}
      <div className="bg-gray-100 border-b border-gray-300 px-2 py-1 text-xs text-gray-600">
        Excel Viewer - {rawData.length} filas × {maxColumns} columnas
      </div>

      {/* Contenedor con scroll */}
      <div className="overflow-auto max-h-[600px] bg-white">
        <table className="border-collapse" style={{ tableLayout: "auto", minWidth: "100%" }}>
          <colgroup>
            <col style={{ width: "50px" }} />
            {Array.from({ length: maxColumns }).map((_, colIndex) => (
              <col key={colIndex} style={{ width: `${getColumnWidth(colIndex)}px`, minWidth: `${getColumnWidth(colIndex)}px` }} />
            ))}
          </colgroup>
          
          <thead>
            <tr>
              <th className="bg-gray-200 border border-gray-400 p-1 text-xs text-center sticky left-0 z-30 bg-gray-200">
                {/* Espacio para números de fila */}
              </th>
              {Array.from({ length: maxColumns }).map((_, colIndex) => (
                <th
                  key={colIndex}
                  className="bg-gray-50 border border-gray-400 p-1 text-xs text-center font-semibold sticky top-0 z-20"
                >
                  {colIndexToExcel(colIndex)}
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
                    const cells: React.ReactElement[] = []
                    const renderedCols = new Set<number>()
                    
                    for (let colIndex = 0; colIndex < maxColumns; colIndex++) {
                      // Si esta columna ya fue cubierta por un colspan anterior, saltarla
                      if (renderedCols.has(colIndex)) {
                        continue
                      }
                      
                      // Verificar si está ocupada por un merge
                      const isOccupied = occupiedCells.has(`${rowIndex},${colIndex}`)
                      const mergedInfo = getMergedCellInfo(rowIndex, colIndex)
                      
                      // Si está ocupada O está en un merge pero NO es la inicial, saltarla
                      if (isOccupied || (mergedInfo.isMerged && !mergedInfo.isStartCell)) {
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
                      } else {
                        renderedCols.add(colIndex)
                      }

                      // Aplicar bordes por defecto solo si no hay bordes definidos en el estilo
                      const hasCustomBorders = cellStyle.borderTop || cellStyle.borderBottom || 
                                              cellStyle.borderLeft || cellStyle.borderRight

                      const tdProps: any = {
                        className: cn(
                          "p-1 text-xs",
                          !hasCustomBorders && "border border-gray-300",
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
                        title: highlighted?.label || cellValue || `Fila ${rowIndex + 1}, Col ${colIndex + 1}`,
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
                          <div className="truncate w-full" style={{ 
                            color: cellStyle.color,
                            fontWeight: cellStyle.fontWeight,
                            fontSize: cellStyle.fontSize,
                            textAlign: cellStyle.textAlign as any,
                            verticalAlign: cellStyle.verticalAlign as any,
                          }}>
                            {cellValue}
                          </div>
                          {highlighted?.label && (
                            <div className="absolute top-0 right-0 bg-yellow-400 text-yellow-900 text-[8px] px-1 rounded-bl z-10">
                              {highlighted.label}
                            </div>
                          )}
                        </td>
                      )
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


