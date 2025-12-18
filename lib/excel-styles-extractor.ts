import * as XLSX from "xlsx"

export interface ExcelCellStyle {
  backgroundColor?: string
  textColor?: string
  fontWeight?: string
  fontStyle?: string
  fontSize?: string
  fontFamily?: string
  textAlign?: string
  verticalAlign?: string
  textDecoration?: string
  borders?: {
    top?: { style: string; color: string; width: string }
    bottom?: { style: string; color: string; width: string }
    left?: { style: string; color: string; width: string }
    right?: { style: string; color: string; width: string }
  }
}

export interface ExcelFormatData {
  mergedCells: Array<{ s: { r: number; c: number }; e: { r: number; c: number } }>
  columnWidths: Record<number, number>
  cellStyles: Record<string, ExcelCellStyle>
  cellValues: Record<string, any>
  rowHeights: Record<number, number>
}

/**
 * Extrae estilos completos de un archivo Excel usando ExcelJS en el servidor
 * Llama a un API route que usa ExcelJS para extraer todos los estilos, colores y bordes
 * Si falla, usa XLSX como fallback
 */
export async function extractExcelStylesWithExcelJS(file: File): Promise<ExcelFormatData> {
  // Intentar primero con el API route que usa ExcelJS en el servidor
  // Envolver todo en try-catch para capturar cualquier error, incluso síncronos
  try {
    try {
      const formData = new FormData()
      formData.append("file", file)

      const response = await fetch("/api/extract-excel-styles", {
        method: "POST",
        body: formData,
      })

      if (response.ok) {
        const data = await response.json()
        const styleCount = Object.keys(data.cellStyles || {}).length
        const mergedCount = (data.mergedCells || []).length
        console.log(`✅ Estilos extraídos exitosamente con ExcelJS: ${styleCount} celdas con estilos, ${mergedCount} celdas combinadas`)
        
        // Devolver los datos incluso si no hay estilos, porque puede haber celdas combinadas y valores
        return data as ExcelFormatData
      }
      // Si response.ok es false, continuar al fallback silenciosamente
    } catch (fetchError) {
      // Error al hacer fetch - continuar al fallback silenciosamente
      // No loguear errores aquí
    }
  } catch (outerError) {
    // Capturar cualquier error síncrono que pueda ocurrir antes del fetch
    // No loguear errores - continuar al fallback
  }

  // Fallback: usar XLSX básico (siempre se ejecuta si ExcelJS falla)
  try {
    return await extractExcelStylesWithXLSX(file)
  } catch (fallbackError) {
    // Si incluso el fallback falla, devolver estructura vacía pero válida
    return {
      mergedCells: [],
      columnWidths: {},
      cellStyles: {},
      cellValues: {},
      rowHeights: {},
    }
  }
}

/**
 * Extrae estilos básicos usando XLSX (fallback)
 * XLSX tiene limitaciones para leer estilos completos
 */
async function extractExcelStylesWithXLSX(file: File): Promise<ExcelFormatData> {
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: "array", cellStyles: true })
  const worksheet = workbook.Sheets[workbook.SheetNames[0]]
  
  if (!worksheet) {
    throw new Error("No se encontró ninguna hoja en el archivo Excel")
  }

  const mergedCells: Array<{ s: { r: number; c: number }; e: { r: number; c: number } }> = []
  const columnWidths: Record<number, number> = {}
  const cellStyles: Record<string, ExcelCellStyle> = {}
  const cellValues: Record<string, any> = {}
  const rowHeights: Record<number, number> = {}

  // Extraer celdas combinadas
  if (worksheet["!merges"]) {
    worksheet["!merges"].forEach((merge: XLSX.Range) => {
      mergedCells.push({
        s: { r: merge.s.r, c: merge.s.c },
        e: { r: merge.e.r, c: merge.e.c },
      })
    })
  }

  // Extraer anchos de columna
  if (worksheet["!cols"]) {
    worksheet["!cols"].forEach((col: any, index: number) => {
      if (col && col.w) {
        columnWidths[index] = col.w * 7 // Convertir caracteres a píxeles
      } else {
        columnWidths[index] = 80
      }
    })
  }

  // Extraer estilos de cada celda
  Object.keys(worksheet).forEach((key) => {
    if (key.startsWith("!")) return
    
    const cell = worksheet[key]
    if (!cell) return

    const style: ExcelCellStyle = {}

    // Extraer estilo si está disponible en cell.s
    // XLSX almacena estilos en cell.s, pero la estructura puede variar
    if (cell.s) {
      const cellStyle = cell.s

      // Color de fondo - XLSX puede tener fill en diferentes propiedades
      if (cellStyle.fill) {
        const fill = cellStyle.fill
        if (fill.fgColor) {
          style.backgroundColor = xlsxColorToCSS(fill.fgColor)
        } else if (fill.bgColor) {
          style.backgroundColor = xlsxColorToCSS(fill.bgColor)
        }
      }
      // También intentar en cellStyle.f (formato)
      if (cellStyle.f && (cellStyle.f as any).fill) {
        const fill = (cellStyle.f as any).fill
        if (fill.fgColor) {
          style.backgroundColor = xlsxColorToCSS(fill.fgColor)
        } else if (fill.bgColor) {
          style.backgroundColor = xlsxColorToCSS(fill.bgColor)
        }
      }

      // Color de texto y fuente
      if (cellStyle.font) {
        const font = cellStyle.font
        if (font.color) {
          style.textColor = xlsxColorToCSS(font.color)
        }
        if (font.bold) style.fontWeight = "bold"
        if (font.italic) style.fontStyle = "italic"
        if (font.sz) style.fontSize = `${font.sz}pt`
        if (font.name) style.fontFamily = font.name
        if (font.underline) style.textDecoration = "underline"
        if (font.strike) style.textDecoration = "line-through"
      }
      // También intentar en cellStyle.f
      if (cellStyle.f && (cellStyle.f as any).font) {
        const font = (cellStyle.f as any).font
        if (font.color) {
          style.textColor = xlsxColorToCSS(font.color)
        }
        if (font.bold) style.fontWeight = "bold"
        if (font.italic) style.fontStyle = "italic"
        if (font.sz) style.fontSize = `${font.sz}pt`
        if (font.name) style.fontFamily = font.name
        if (font.underline) style.textDecoration = "underline"
        if (font.strike) style.textDecoration = "line-through"
      }

      // Alineación
      if (cellStyle.alignment) {
        const alignment = cellStyle.alignment
        if (alignment.horizontal) style.textAlign = alignment.horizontal
        if (alignment.vertical) style.verticalAlign = alignment.vertical
      }
      if (cellStyle.a) {
        const alignment = cellStyle.a
        if (alignment.h) style.textAlign = alignment.h
        if (alignment.v) style.verticalAlign = alignment.v
      }

      // Bordes
      if (cellStyle.border) {
        const border = cellStyle.border
        style.borders = {}
        const sides = ["top", "bottom", "left", "right"] as const
        sides.forEach((side) => {
          const borderSide = border[side]
          if (borderSide && borderSide.style) {
            const borderColor = borderSide.color ? xlsxColorToCSS(borderSide.color) : "#000000"
            const borderWidth = borderStyleToWidth(borderSide.style)
            style.borders![side] = {
              style: borderSide.style,
              color: borderColor,
              width: borderWidth,
            }
          }
        })
      }
      if (cellStyle.b) {
        const border = cellStyle.b
        style.borders = style.borders || {}
        const sides = ["top", "bottom", "left", "right"] as const
        sides.forEach((side) => {
          const borderSide = border[side]
          if (borderSide && borderSide.style) {
            const borderColor = borderSide.color ? xlsxColorToCSS(borderSide.color) : "#000000"
            const borderWidth = borderStyleToWidth(borderSide.style)
            style.borders![side] = {
              style: borderSide.style,
              color: borderColor,
              width: borderWidth,
            }
          }
        })
      }
    }

    // Valor de la celda
    if (cell.v !== null && cell.v !== undefined) {
      cellValues[key] = cell.v
    }

    if (Object.keys(style).length > 0) {
      cellStyles[key] = style
    }
  })

  return {
    mergedCells,
    columnWidths,
    cellStyles,
    cellValues,
    rowHeights,
  }
}

/**
 * Convierte un color de XLSX a CSS
 */
function xlsxColorToCSS(color: any): string | undefined {
  if (!color) return undefined

  // RGB directo
  if (color.rgb) {
    return `#${color.rgb}`
  }

  // ARGB (formato: AARRGGBB)
  if (color.argb) {
    const argb = color.argb
    if (typeof argb === "string") {
      if (argb.length === 8) {
        return `#${argb.slice(2)}`
      }
      return `#${argb}`
    }
  }

  // Tema (referencia a tema de Excel)
  if (color.theme !== undefined) {
    const themeColors: Record<number, string> = {
      0: "#000000", // Texto 1
      1: "#FFFFFF", // Fondo 1
      2: "#E7E6E6", // Texto 2
      3: "#44546A", // Fondo 2
      4: "#5B9BD5", // Acento 1
      5: "#70AD47", // Acento 2
      6: "#A5A5A5", // Acento 3
      7: "#FFC000", // Acento 4
      8: "#4472C4", // Acento 5
      9: "#70AD47", // Acento 6
    }
    return themeColors[color.theme] || undefined
  }

  return undefined
}

/**
 * Convierte un estilo de borde a ancho CSS
 */
function borderStyleToWidth(style: string): string {
  const styleMap: Record<string, string> = {
    thin: "1px",
    medium: "2px",
    thick: "3px",
    double: "3px",
    hair: "0.5px",
    dotted: "1px",
    dashed: "1px",
    dashDot: "1px",
    dashDotDot: "1px",
    slantDashDot: "1px",
  }
  return styleMap[style] || "1px"
}


