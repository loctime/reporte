import { NextRequest, NextResponse } from "next/server"
import ExcelJS from "exceljs"

export const runtime = "nodejs"

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

    // Convertir Excel a HTML
    let html = '<table style="border-collapse: collapse; font-family: Arial, sans-serif;">'
    
    // Extraer anchos de columna
    const columnWidths: number[] = []
    worksheet.columns?.forEach((col, index) => {
      columnWidths[index] = col.width ? col.width * 7 : 80
    })

    // Extraer alturas de fila
    const rowHeights: number[] = []
    worksheet.eachRow((row, rowNumber) => {
      if (row.height) {
        rowHeights[rowNumber - 1] = row.height * 1.33
      } else {
        rowHeights[rowNumber - 1] = 23
      }
    })

    // Función para convertir color ExcelJS a CSS
    const exceljsColorToCSS = (color: ExcelJS.Color): string | undefined => {
      if (!color) return undefined
      if (color.rgb) return `#${color.rgb}`
      if (color.argb) {
        const argb = color.argb
        if (typeof argb === "string" && argb.length === 8) {
          return `#${argb.slice(2)}`
        }
        return `#${argb}`
      }
      if (color.theme !== undefined) {
        const themeColors: Record<number, string> = {
          0: "#000000", 1: "#FFFFFF", 2: "#E7E6E6", 3: "#44546A",
          4: "#5B9BD5", 5: "#70AD47", 6: "#A5A5A5", 7: "#FFC000",
          8: "#4472C4", 9: "#70AD47",
        }
        return themeColors[color.theme] || undefined
      }
      return undefined
    }

    // Procesar celdas combinadas
    const mergedCells: Array<{ s: { r: number; c: number }; e: { r: number; c: number } }> = []
    if (worksheet.model.merges) {
      worksheet.model.merges.forEach((merge: any) => {
        mergedCells.push({
          s: { r: merge.top, c: merge.left },
          e: { r: merge.bottom, c: merge.right },
        })
      })
    }
    
    // Debug: Log de merges detectados
    console.log(`📊 Celdas combinadas detectadas: ${mergedCells.length} merges`)
    if (mergedCells.length > 0) {
      console.log(`📊 Primer merge: fila ${mergedCells[0].s.r}-${mergedCells[0].e.r}, col ${mergedCells[0].s.c}-${mergedCells[0].e.c}`)
    }

    // Función para verificar si una celda está en un merge
    const getMergedInfo = (row: number, col: number) => {
      for (const merge of mergedCells) {
        // Verificar si esta celda está dentro del rango del merge
        if (
          row >= merge.s.r &&
          row <= merge.e.r &&
          col >= merge.s.c &&
          col <= merge.e.c
        ) {
          // Verificar si es la celda inicial del merge
          const isStart = row === merge.s.r && col === merge.s.c
          return {
            isMerged: true,
            isStart,
            rowspan: merge.e.r - merge.s.r + 1,
            colspan: merge.e.c - merge.s.c + 1,
            mergeRange: merge, // Guardar el rango para referencia
          }
        }
      }
      return { isMerged: false, isStart: false, rowspan: 1, colspan: 1, mergeRange: null }
    }
    
    // Crear un mapa de celdas ocupadas por merges (para verificación rápida)
    const occupiedCells = new Set<string>()
    mergedCells.forEach((merge) => {
      for (let r = merge.s.r; r <= merge.e.r; r++) {
        for (let c = merge.s.c; c <= merge.e.c; c++) {
          // Solo marcar como ocupadas las que NO son la inicial
          if (!(r === merge.s.r && c === merge.s.c)) {
            occupiedCells.add(`${r},${c}`)
          }
        }
      }
    })
    
    // Debug: Log de celdas ocupadas
    console.log(`📊 Celdas ocupadas por merges: ${occupiedCells.size}`)
    if (occupiedCells.size > 0) {
      const firstOccupied = Array.from(occupiedCells)[0]
      console.log(`📊 Primera celda ocupada: ${firstOccupied}`)
    }

    // Obtener el número máximo de columnas
    let maxColumns = 0
    worksheet.eachRow((row) => {
      const rowColumnCount = row.cellCount
      if (rowColumnCount > maxColumns) {
        maxColumns = rowColumnCount
      }
    })
    
    // También verificar en mergedCells
    mergedCells.forEach((merge) => {
      if (merge.e.c + 1 > maxColumns) {
        maxColumns = merge.e.c + 1
      }
    })

    // Generar HTML
    worksheet.eachRow((row, rowNumber) => {
      const rowIndex = rowNumber - 1
      const rowHeight = rowHeights[rowIndex] || 23
      
      html += `<tr style="height: ${rowHeight}px;">`
      
      // Iterar sobre todas las columnas posibles
      for (let colIndex = 0; colIndex < maxColumns; colIndex++) {
        // Verificar rápidamente si esta celda está ocupada por un merge
        if (occupiedCells.has(`${rowIndex},${colIndex}`)) {
          continue // No renderizar esta celda, está ocupada por el merge
        }
        
        const mergedInfo = getMergedInfo(rowIndex, colIndex)

        // Obtener la celda de ExcelJS
        const cell = row.getCell(colIndex + 1)

        // Si está en un merge, obtener el valor y estilos de la celda inicial
        let cellValue: any = null
        let fill: any = null
        let font: any = null
        let alignment: any = null
        let border: any = null
        
        if (mergedInfo.isMerged && mergedInfo.isStart && mergedInfo.mergeRange) {
          // Para celdas combinadas, obtener la celda inicial del merge
          const startRow = worksheet.getRow(mergedInfo.mergeRange.s.r + 1)
          const startCell = startRow.getCell(mergedInfo.mergeRange.s.c + 1)
          cellValue = startCell.result !== null && startCell.result !== undefined ? startCell.result : startCell.value
          fill = startCell.style?.fill
          font = startCell.style?.font
          alignment = startCell.style?.alignment
          border = startCell.style?.border
        } else {
          // Para celdas normales, usar la celda directamente
          cellValue = cell.result !== null && cell.result !== undefined ? cell.result : cell.value
          fill = cell.style?.fill
          font = cell.style?.font
          alignment = cell.style?.alignment
          border = cell.style?.border
        }

        let cellStyle = `padding: 4px; border: 1px solid #d1d5db;`
        
        // Color de fondo
        if (fill?.fgColor) {
          const bgColor = exceljsColorToCSS(fill.fgColor)
          if (bgColor) cellStyle += ` background-color: ${bgColor};`
        } else if (fill?.bgColor) {
          const bgColor = exceljsColorToCSS(fill.bgColor)
          if (bgColor) cellStyle += ` background-color: ${bgColor};`
        }

        // Color de texto
        if (font?.color) {
          const textColor = exceljsColorToCSS(font.color)
          if (textColor) cellStyle += ` color: ${textColor};`
        }

        // Fuente
        if (font?.bold) cellStyle += ` font-weight: bold;`
        if (font?.italic) cellStyle += ` font-style: italic;`
        if (font?.size) cellStyle += ` font-size: ${font.size}pt;`
        if (font?.name) cellStyle += ` font-family: ${font.name};`

        // Alineación
        if (alignment?.horizontal) {
          cellStyle += ` text-align: ${alignment.horizontal};`
        }
        if (alignment?.vertical) {
          cellStyle += ` vertical-align: ${alignment.vertical};`
        }

        // Ancho de columna
        const colWidth = columnWidths[colIndex] || 80
        if (mergedInfo.isMerged && mergedInfo.isStart) {
          const totalWidth = columnWidths.slice(colIndex, colIndex + mergedInfo.colspan)
            .reduce((sum, w) => sum + (w || 80), 0)
          cellStyle += ` width: ${totalWidth}px;`
        } else {
          cellStyle += ` width: ${colWidth}px;`
        }

        // Bordes
        if (border) {
          if (border.top) {
            const borderColor = exceljsColorToCSS(border.top.color) || "#000000"
            cellStyle += ` border-top: ${border.top.style || "thin"} ${borderColor};`
          }
          if (border.bottom) {
            const borderColor = exceljsColorToCSS(border.bottom.color) || "#000000"
            cellStyle += ` border-bottom: ${border.bottom.style || "thin"} ${borderColor};`
          }
          if (border.left) {
            const borderColor = exceljsColorToCSS(border.left.color) || "#000000"
            cellStyle += ` border-left: ${border.left.style || "thin"} ${borderColor};`
          }
          if (border.right) {
            const borderColor = exceljsColorToCSS(border.right.color) || "#000000"
            cellStyle += ` border-right: ${border.right.style || "thin"} ${borderColor};`
          }
        }

        // Atributos de merge - SIEMPRE aplicar si está en un merge y es la inicial
        let mergeAttrs = ""
        if (mergedInfo.isMerged && mergedInfo.isStart) {
          // Aplicar rowspan y colspan incluso si es 1 (para asegurar que funciona)
          mergeAttrs += ` rowspan="${mergedInfo.rowspan}"`
          mergeAttrs += ` colspan="${mergedInfo.colspan}"`
        }

        // Formatear valor de la celda
        if (cellValue === null || cellValue === undefined) cellValue = ""
        if (typeof cellValue === "number") cellValue = cellValue.toString()
        if (typeof cellValue === "object") cellValue = JSON.stringify(cellValue)
        
        // Escapar HTML para seguridad
        const escapedValue = String(cellValue)
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/"/g, "&quot;")
          .replace(/'/g, "&#039;")

        html += `<td style="${cellStyle}"${mergeAttrs}>${escapedValue}</td>`
      }
      
      html += "</tr>"
    })

    html += "</table>"

    return NextResponse.json({ html })
  } catch (error) {
    console.error("Error al convertir Excel a HTML:", error)
    return NextResponse.json(
      { error: "Error al convertir Excel a HTML" },
      { status: 500 }
    )
  }
}

