import { NextRequest, NextResponse } from "next/server"

export const runtime = "nodejs"

// Importar ExcelJS - usar import estático ya que estamos en el servidor
import ExcelJS from "exceljs"

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File

    if (!file) {
      return NextResponse.json({ error: "No se proporcionó ningún archivo" }, { status: 400 })
    }

    const buffer = await file.arrayBuffer()
    const workbook = new ExcelJS.Workbook()
    await workbook.xlsx.load(buffer)

    const worksheet = workbook.worksheets[0]
    if (!worksheet) {
      return NextResponse.json({ error: "No se encontró ninguna hoja en el archivo" }, { status: 400 })
    }

    const mergedCells: Array<{ s: { r: number; c: number }; e: { r: number; c: number } }> = []
    const columnWidths: Record<number, number> = {}
    const cellStyles: Record<string, any> = {}
    const cellValues: Record<string, any> = {}
    const rowHeights: Record<number, number> = {}

    // Extraer celdas combinadas
    worksheet.model.merges?.forEach((merge) => {
      mergedCells.push({
        s: { r: merge.top, c: merge.left },
        e: { r: merge.bottom, c: merge.right },
      })
    })

    // Extraer anchos de columna
    worksheet.columns?.forEach((col, index) => {
      if (col.width) {
        columnWidths[index] = col.width * 7 // Convertir caracteres a píxeles
      } else {
        columnWidths[index] = 80
      }
    })

    // Extraer altos de fila
    worksheet.eachRow((row, rowNumber) => {
      if (row.height) {
        rowHeights[rowNumber - 1] = row.height * 1.33 // Convertir puntos a píxeles
      }
    })

    // Función para convertir color ExcelJS a CSS
    const exceljsColorToCSS = (color: ExcelJS.Color): string | undefined => {
      if (!color) return undefined

      if (color.rgb) {
        return `#${color.rgb}`
      }

      if (color.argb) {
        const argb = color.argb
        if (typeof argb === "string") {
          if (argb.length === 8) {
            return `#${argb.slice(2)}`
          }
          return `#${argb}`
        }
      }

      if (color.theme !== undefined) {
        const themeColors: Record<number, string> = {
          0: "#000000",
          1: "#FFFFFF",
          2: "#E7E6E6",
          3: "#44546A",
          4: "#5B9BD5",
          5: "#70AD47",
          6: "#A5A5A5",
          7: "#FFC000",
          8: "#4472C4",
          9: "#70AD47",
        }
        return themeColors[color.theme] || undefined
      }

      return undefined
    }

    // Función para convertir estilo de borde a ancho CSS
    const borderStyleToWidth = (style: string): string => {
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

    // Función para obtener letra de columna
    const getColumnLetter = (colNumber: number): string => {
      let result = ""
      let num = colNumber - 1
      while (num >= 0) {
        result = String.fromCharCode(65 + (num % 26)) + result
        num = Math.floor(num / 26) - 1
      }
      return result
    }

    // Crear un Set de direcciones de celdas que son la celda inicial de un merge
    const mergeStartCells = new Set<string>()
    mergedCells.forEach((merge) => {
      const startAddress = `${getColumnLetter(merge.s.c + 1)}${merge.s.r + 1}`
      mergeStartCells.add(startAddress)
    })

    // Función auxiliar para verificar si una celda está en un merge pero NO es la inicial
    const isMergedButNotStart = (rowNumber: number, colNumber: number): boolean => {
      for (const merge of mergedCells) {
        const rowIndex = rowNumber - 1 // Convertir a índice 0-based
        const colIndex = colNumber - 1 // Convertir a índice 0-based
        if (
          rowIndex >= merge.s.r &&
          rowIndex <= merge.e.r &&
          colIndex >= merge.s.c &&
          colIndex <= merge.e.c
        ) {
          // Está en el merge
          const isStart = rowIndex === merge.s.r && colIndex === merge.s.c
          if (!isStart) {
            return true // Está en el merge pero NO es la inicial
          }
        }
      }
      return false
    }

    // Extraer estilos de cada celda
    worksheet.eachRow((row, rowNumber) => {
      row.eachCell((cell, colNumber) => {
        const cellAddress = `${getColumnLetter(colNumber)}${rowNumber}`
        const style: any = {}

        // Color de fondo
        if (cell.fill?.fgColor) {
          style.backgroundColor = exceljsColorToCSS(cell.fill.fgColor)
        } else if (cell.fill?.bgColor) {
          style.backgroundColor = exceljsColorToCSS(cell.fill.bgColor)
        }

        // Color de texto
        if (cell.font?.color) {
          style.textColor = exceljsColorToCSS(cell.font.color)
        }

        // Estilos de fuente
        if (cell.font) {
          style.fontWeight = cell.font.bold ? "bold" : undefined
          style.fontStyle = cell.font.italic ? "italic" : undefined
          style.fontSize = cell.font.size ? `${cell.font.size}pt` : undefined
          style.fontFamily = cell.font.name || undefined
          style.textDecoration = cell.font.underline
            ? "underline"
            : cell.font.strike
              ? "line-through"
              : undefined
        }

        // Alineación
        if (cell.alignment) {
          style.textAlign = cell.alignment.horizontal || undefined
          style.verticalAlign = cell.alignment.vertical || undefined
        }

        // Bordes
        if (cell.border) {
          style.borders = {}
          const borderSides = ["top", "bottom", "left", "right"] as const
          borderSides.forEach((side) => {
            const border = cell.border?.[side]
            if (border && border.style) {
              const borderColor = border.color ? exceljsColorToCSS(border.color) : "#000000"
              const borderWidth = borderStyleToWidth(border.style)
              style.borders[side] = {
                style: border.style,
                color: borderColor,
                width: borderWidth,
              }
            }
          })
        }

        // Valor de la celda - SOLO extraer si NO está en un merge o ES la celda inicial del merge
        // Si está en un merge pero NO es la inicial, NO guardar el valor (para evitar duplicados)
        if (!isMergedButNotStart(rowNumber, colNumber)) {
          // Valor de la celda - usar cell.result (valor calculado) si está disponible, sino cell.value
          // cell.result contiene el valor calculado de fórmulas, mientras que cell.value puede ser la fórmula misma
          let cellValue: any = cell.result !== null && cell.result !== undefined ? cell.result : cell.value
          
          if (cellValue !== null && cellValue !== undefined) {
            // Si es un objeto con richText (texto enriquecido)
            if (typeof cellValue === "object" && "richText" in cellValue) {
              cellValue = cellValue.richText?.map((rt: any) => rt.text || "").join("") || ""
            }
            // Si es una fecha
            else if (cellValue instanceof Date) {
              // Formatear fecha según el formato de la celda si está disponible
              const dateValue = cellValue
              // Intentar usar el formato de Excel si está disponible
              if (cell.numFmt && cell.numFmt.includes("d") && cell.numFmt.includes("m")) {
                // Formato personalizado de fecha
                const day = String(dateValue.getDate()).padStart(2, "0")
                const month = String(dateValue.getMonth() + 1).padStart(2, "0")
                const year = dateValue.getFullYear()
                cellValue = `${day}/${month}/${year}`
              } else {
                cellValue = dateValue.toISOString().split("T")[0] // Formato YYYY-MM-DD por defecto
              }
            }
            // Si es un objeto genérico, intentar extraer propiedades útiles
            else if (typeof cellValue === "object" && !Array.isArray(cellValue)) {
              // Intentar obtener el valor numérico si existe
              if ("result" in cellValue && cellValue.result !== null && cellValue.result !== undefined) {
                cellValue = cellValue.result
              } else if ("text" in cellValue) {
                cellValue = cellValue.text
              } else if ("value" in cellValue) {
                cellValue = cellValue.value
              } else {
                // Si no hay propiedades útiles, intentar convertir a string de forma más inteligente
                try {
                  cellValue = JSON.stringify(cellValue)
                } catch {
                  cellValue = String(cellValue)
                }
              }
            }
            // Si es un array, unir los elementos
            else if (Array.isArray(cellValue)) {
              cellValue = cellValue.map(v => {
                if (typeof v === "object" && v !== null && "text" in v) {
                  return v.text
                }
                return String(v)
              }).join("")
            }
            
            // Convertir a string solo si no es un número
            if (typeof cellValue !== "number" && typeof cellValue !== "string") {
              cellValue = String(cellValue)
            }
            
            cellValues[cellAddress] = cellValue
          }
        }
        // Si está en un merge pero no es la inicial, NO guardar el valor (solo estilos)

        if (Object.keys(style).length > 0) {
          cellStyles[cellAddress] = style
        }
      })
    })

    const result = {
      mergedCells,
      columnWidths,
      cellStyles,
      cellValues,
      rowHeights,
    }
    
    console.log(`✅ Estilos extraídos: ${Object.keys(cellStyles).length} celdas con estilos, ${mergedCells.length} celdas combinadas`)
    
    return NextResponse.json(result)
  } catch (error) {
    console.error("❌ Error extrayendo estilos:", error)
    return NextResponse.json(
      { 
        error: error instanceof Error ? error.message : "Error desconocido al extraer estilos",
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}


