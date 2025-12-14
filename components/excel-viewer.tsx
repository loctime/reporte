"use client"

import { useMemo, useState, useEffect } from "react"
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
      extractExcelStylesWithExcelJS(file)
        .then((format) => {
          setExceljsFormat(format)
          setIsLoadingStyles(false)
        })
        .catch((error) => {
          // Error al cargar estilos con ExcelJS, usar XLSX como fallback
          console.warn("⚠️ No se pudieron cargar estilos con ExcelJS, usando fallback XLSX:", error)
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
        const borderStyle: React.CSSProperties = {}
        if (exceljsStyle.borders) {
          Object.entries(exceljsStyle.borders).forEach(([side, border]) => {
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
          
          borderStyle[`border${side.charAt(0).toUpperCase() + side.slice(1)}`] = `${borderWidth} solid ${borderColor}`
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
    
    // Obtener la dirección de la celda
    const cellAddress = getCellAddress(rowIndex, colIndex)
    
    // Priorizar valores de ExcelJS si están disponibles (estos ya tienen el valor correcto en la celda inicial)
    let rawValue = exceljsFormat?.cellValues[cellAddress] ?? 
                   excelFormat.cellValues[cellAddress]
    
    // Si no hay valor en los formatos extraídos, usar rawData SOLO si no está en un merge
    // (porque rawData puede tener valores duplicados en celdas combinadas)
    if ((rawValue === null || rawValue === undefined || rawValue === "") && !mergedInfo.isMerged) {
      rawValue = rawData[rowIndex]?.[colIndex]
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

    // Convertir a string final
    if (typeof rawValue === "number") {
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
    return excelFormat.rowHeights[rowIndex] || 32
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
            // Verificar si esta fila está dentro de un merge vertical (pero no es la fila inicial)
            const isInVerticalMerge = excelFormat.mergedCells.some(merge => 
              rowIndex > merge.s.r && rowIndex <= merge.e.r
            )
            
            // Si está en un merge vertical pero no es la fila inicial, usar altura normal
            const rowHeight = getRowHeight(rowIndex)
            
            return (
              <div key={rowIndex} className="flex" style={{ height: `${rowHeight}px`, minHeight: `${rowHeight}px` }}>
                {/* Número de fila (sticky) */}
                <div 
                  className="bg-gray-100 border-r border-b border-gray-400 min-w-[50px] w-[50px] flex items-center justify-center text-xs font-medium text-gray-600 sticky left-0 z-10"
                  style={{ height: `${rowHeight}px`, minHeight: `${rowHeight}px` }}
                >
                  {rowIndex + 1}
                </div>

                {/* Celdas de la fila */}
                {Array.from({ length: maxColumns }).map((_, colIndex) => {
                  // Verificar si esta celda está en un merged range
                  const mergedInfo = getMergedCellInfo(rowIndex, colIndex)

                  // Si está en un merge pero NO es la celda inicial, renderizar celda vacía (sin texto)
                  if (mergedInfo.isMerged && !mergedInfo.isStartCell) {
                    // Encontrar el merge que contiene esta celda
                    const containingMerge = excelFormat.mergedCells.find(
                      (m) => 
                        rowIndex >= m.s.r && rowIndex <= m.e.r &&
                        colIndex >= m.s.c && colIndex <= m.e.c
                    )
                    
                    // Obtener el estilo de la celda inicial del merge para mantener consistencia
                    let mergedBgColor: string | undefined
                    if (containingMerge) {
                      const startCellAddress = getCellAddress(containingMerge.s.r, containingMerge.s.c)
                      
                      // Priorizar estilos de ExcelJS si están disponibles
                      if (exceljsFormat) {
                        const exceljsStyle = exceljsFormat.cellStyles[startCellAddress]
                        if (exceljsStyle?.backgroundColor) {
                          mergedBgColor = exceljsStyle.backgroundColor
                        }
                      }
                      
                      // Fallback a estilos de XLSX
                      if (!mergedBgColor) {
                        const mergedStyle = excelFormat.cellStyles[startCellAddress] || {}
                        mergedBgColor = mergedStyle.fill?.fgColor 
                          ? excelColorToCSS(mergedStyle.fill.fgColor)
                          : mergedStyle.fill?.bgColor
                            ? excelColorToCSS(mergedStyle.fill.bgColor)
                            : mergedStyle.backgroundColor
                              ? excelColorToCSS(mergedStyle.backgroundColor)
                              : undefined
                      }
                    }
                    
                    // Calcular altura de esta celda (puede ser parte de un merge vertical)
                    const cellRowHeight = getRowHeight(rowIndex)
                    
                    return (
                      <div
                        key={colIndex}
                        className="border-r border-b border-gray-300"
                        style={{
                          minWidth: `${getColumnWidth(colIndex)}px`,
                          width: `${getColumnWidth(colIndex)}px`,
                          height: `${cellRowHeight}px`,
                          minHeight: `${cellRowHeight}px`,
                          backgroundColor: mergedBgColor,
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
                  let totalHeight = 32 // Altura por defecto
                  
                  if (mergedInfo.isMerged && mergedInfo.isStartCell) {
                    // Calcular ancho total de celdas combinadas horizontalmente
                    totalWidth = 0
                    for (let c = colIndex; c <= colIndex + mergedInfo.colSpan - 1; c++) {
                      totalWidth += getColumnWidth(c)
                    }
                    
                    // Calcular altura total de celdas combinadas verticalmente
                    totalHeight = 0
                    for (let r = rowIndex; r <= rowIndex + mergedInfo.rowSpan - 1; r++) {
                      // Usar altura de fila si está disponible, sino 32px por defecto
                      const rowHeight = excelFormat.rowHeights[r] || 32
                      totalHeight += rowHeight
                    }
                  }

                  // Aplicar bordes por defecto solo si no hay bordes definidos en el estilo
                  const hasCustomBorders = cellStyle.borderTop || cellStyle.borderBottom || 
                                          cellStyle.borderLeft || cellStyle.borderRight
                  
                  return (
                    <div
                      key={colIndex}
                      className={cn(
                        "p-1 text-xs overflow-hidden relative",
                        !hasCustomBorders && "border-r border-b border-gray-300",
                        isSelected && "ring-2 ring-blue-500 ring-offset-1",
                        highlighted && !isSelected && "ring-1 ring-yellow-400",
                        onCellClick && "cursor-pointer hover:opacity-80",
                        mergedInfo.isMerged && mergedInfo.isStartCell && "flex items-center justify-center"
                      )}
                      style={{
                        minWidth: `${totalWidth}px`,
                        width: `${totalWidth}px`,
                        height: `${totalHeight}px`,
                        minHeight: `${totalHeight}px`,
                        ...cellStyle,
                        // Si está seleccionada o resaltada, mantener el color de fondo pero con overlay
                        ...(isSelected && !cellStyle.backgroundColor && { backgroundColor: "rgba(59, 130, 246, 0.1)" }),
                        ...(highlighted && !isSelected && !cellStyle.backgroundColor && { backgroundColor: "rgba(250, 204, 21, 0.2)" }),
                      }}
                      onClick={() => onCellClick?.(rowIndex, colIndex)}
                      title={highlighted?.label || cellValue || `Fila ${rowIndex + 1}, Col ${colIndex + 1}`}
                    >
                      <div className="truncate w-full" title={cellValue} style={{ 
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

