import * as XLSX from "xlsx"
import type { AuditItem } from "./types"
import { formatDate } from "./utils"

// Importar exceljs de forma condicional
let ExcelJS: any = null
try {
  ExcelJS = require("exceljs")
} catch {
  // exceljs no está instalado, usaremos XLSX básico
}

export function exportToExcel(items: AuditItem[], fileName = "auditorias-consolidadas.xlsx") {
  const data = items.map((item) => ({
    Operación: item.operacion,
    Responsable: item.responsable,
    Cliente: item.cliente,
    Fecha: formatDate(item.fecha),
    Auditor: item.auditor,
    Categoría: item.categoria,
    Item: item.item,
    Pregunta: item.pregunta,
    Estado: item.estado,
    Observación: item.observacion,
    "Oportunidad de Mejora": item.oportunidadMejora,
    Normativa: item.normativa,
  }))

  const worksheet = XLSX.utils.json_to_sheet(data)
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, "Auditorías")

  // Ajustar anchos de columna
  const maxWidth = 50
  const columnWidths = [
    { wch: 30 }, // Operación
    { wch: 20 }, // Responsable
    { wch: 20 }, // Cliente
    { wch: 12 }, // Fecha
    { wch: 20 }, // Auditor
    { wch: 25 }, // Categoría
    { wch: 8 }, // Item
    { wch: maxWidth }, // Pregunta
    { wch: 15 }, // Estado
    { wch: maxWidth }, // Observación
    { wch: maxWidth }, // Oportunidad
    { wch: 20 }, // Normativa
  ]
  worksheet["!cols"] = columnWidths

  XLSX.writeFile(workbook, fileName)
}

export function exportDashboardToPDF() {
  // Esta función simula exportación a PDF
  // En producción, se usaría una librería como jsPDF o html2canvas
  alert(
    "Funcionalidad de exportación a PDF estará disponible próximamente. Por ahora, puede usar la función de impresión del navegador (Ctrl+P)",
  )
  window.print()
}

export async function exportCalendarToExcel(
  tableData: Array<{
    operacion: string
    meses: (number | null)[]
    monthFiles: (import("./types").AuditFile[] | null)[]
  }>,
  currentYear: number,
  monthNames: string[],
) {
  // Si exceljs está disponible, usar formato avanzado
  if (ExcelJS) {
    return exportCalendarWithExcelJS(tableData, currentYear, monthNames)
  }
  
  // Si no, usar XLSX básico con mejor formato posible
  return exportCalendarWithXLSX(tableData, currentYear, monthNames)
}

async function exportCalendarWithExcelJS(
  tableData: Array<{
    operacion: string
    meses: (number | null)[]
    monthFiles: (import("./types").AuditFile[] | null)[]
  }>,
  currentYear: number,
  monthNames: string[],
) {
  const workbook = new ExcelJS.Workbook()
  
  // Crear hoja principal
  const worksheet = workbook.addWorksheet("Calendario Anual")

  // Calcular el ancho máximo necesario para la columna de operación
  let maxOperacionWidth = 20
  tableData.forEach((row) => {
    if (row.operacion.length > maxOperacionWidth) {
      maxOperacionWidth = Math.min(row.operacion.length + 5, 50)
    }
  })

  // Calcular anchos óptimos para las columnas de meses
  const monthColumnWidths = monthNames.map((_, monthIndex) => {
    let maxWidth = 12
    tableData.forEach((row) => {
      const monthFiles = row.monthFiles[monthIndex]
      const porcentaje = row.meses[monthIndex]
      if (porcentaje !== null) {
        const file = monthFiles && monthFiles.length > 0 ? monthFiles[0] : null
        let cellLength = `${porcentaje.toFixed(0)}%`.length
        if (file) {
          if (file.responsable) {
            cellLength = Math.max(cellLength, `Resp: ${file.responsable}`.length)
          }
          if (file.auditor) {
            cellLength = Math.max(cellLength, `Aud: ${file.auditor}`.length)
          }
        }
        maxWidth = Math.max(maxWidth, Math.min(cellLength + 3, 25))
      }
    })
    return maxWidth
  })

  // Estilo para bordes
  const borderStyle: Partial<ExcelJS.Border> = {
    style: "thin",
    color: { argb: "FF000000" },
  }

  const allBorders: Partial<ExcelJS.Borders> = {
    top: borderStyle,
    bottom: borderStyle,
    left: borderStyle,
    right: borderStyle,
  }

  // Fila 1: Título
  const titleRow = worksheet.addRow([`CALENDARIO ANUAL DE CUMPLIMIENTO - AÑO ${currentYear}`])
  titleRow.height = 30
  const titleCell = worksheet.getCell(1, 1)
  titleCell.font = { bold: true, size: 16, color: { argb: "FF000000" } }
  titleCell.alignment = { horizontal: "center", vertical: "middle" }
  titleCell.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE0E0E0" },
  }
  worksheet.mergeCells(1, 1, 1, monthNames.length + 1)

  // Fila 2: Vacía
  worksheet.addRow([])

  // Fila 3: Subtítulo
  const subtitleRow = worksheet.addRow(["FR 42 - Control de Calidad en Campo"])
  subtitleRow.height = 20
  const subtitleCell = worksheet.getCell(3, 1)
  subtitleCell.font = { bold: true, size: 12, color: { argb: "FF000000" } }
  subtitleCell.alignment = { horizontal: "center", vertical: "middle" }
  worksheet.mergeCells(3, 1, 3, monthNames.length + 1)

  // Fila 4: Vacía
  worksheet.addRow([])

  // Fila 5: Encabezados
  const headerRow = worksheet.addRow(["OPERACIÓN", ...monthNames])
  headerRow.height = 25
  headerRow.eachCell((cell, colNumber) => {
    cell.font = { bold: true, size: 11, color: { argb: "FF000000" } }
    cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true }
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFD3D3D3" },
    }
    cell.border = allBorders
  })

  // Filas de datos
  tableData.forEach((row, rowIndex) => {
    const dataRow = worksheet.addRow([])
    dataRow.height = 60

    // Celda de operación
    const operacionCell = dataRow.getCell(1)
    operacionCell.value = row.operacion
    operacionCell.font = { bold: true, size: 10 }
    operacionCell.alignment = { vertical: "middle", wrapText: true }
    operacionCell.border = allBorders

    // Celdas de meses
    row.meses.forEach((porcentaje, monthIndex) => {
      const cell = dataRow.getCell(monthIndex + 2)
      const monthFiles = row.monthFiles[monthIndex]
      
      if (porcentaje !== null) {
        const file = monthFiles && monthFiles.length > 0 ? monthFiles[0] : null
        let cellValue = `${porcentaje.toFixed(0)}%`
        
        if (file) {
          const details: string[] = []
          if (file.responsable) details.push(`Resp: ${file.responsable}`)
          if (file.auditor) details.push(`Aud: ${file.auditor}`)
          if (details.length > 0) {
            cellValue += `\n${details.join("\n")}`
          }
        }
        
        cell.value = cellValue
        cell.alignment = { horizontal: "center", vertical: "middle", wrapText: true }
        cell.font = { size: 10 }
        cell.border = allBorders

        // Aplicar color de fondo según el porcentaje
        if (porcentaje >= 75) {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFC6EFCE" }, // Verde claro
          }
          cell.font = { ...cell.font, color: { argb: "FF006100" }, bold: true }
        } else if (porcentaje >= 50) {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFFFEB9C" }, // Amarillo claro
          }
          cell.font = { ...cell.font, color: { argb: "FF9C6500" }, bold: true }
        } else {
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFFFC7CE" }, // Rojo claro
          }
          cell.font = { ...cell.font, color: { argb: "FF9C0006" }, bold: true }
        }
      } else {
        cell.value = "-"
        cell.alignment = { horizontal: "center", vertical: "middle" }
        cell.font = { size: 10, color: { argb: "FF808080" } }
        cell.border = allBorders
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF0F0F0" },
        }
      }
    })
  })

  // Ajustar anchos de columna
  worksheet.getColumn(1).width = maxOperacionWidth
  monthNames.forEach((_, index) => {
    worksheet.getColumn(index + 2).width = monthColumnWidths[index]
  })

  // Crear hoja de referencias
  const referenceSheet = workbook.addWorksheet("Referencias")

  // Título
  const refTitleRow = referenceSheet.addRow(["REFERENCIAS FR 42 - CONTROL DE CALIDAD EN CAMPO"])
  refTitleRow.height = 25
  const refTitleCell = referenceSheet.getCell(1, 1)
  refTitleCell.font = { bold: true, size: 14 }
  refTitleCell.alignment = { horizontal: "center" }
  referenceSheet.mergeCells(1, 1, 1, 3)

  referenceSheet.addRow([])

  // Encabezados
  const refHeaderRow = referenceSheet.addRow(["Color", "Estado", "Rango de Cumplimiento"])
  refHeaderRow.height = 20
  refHeaderRow.eachCell((cell) => {
    cell.font = { bold: true }
    cell.alignment = { horizontal: "center" }
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FFD3D3D3" },
    }
    cell.border = allBorders
  })

  // Datos de referencias
  const referenceData = [
    ["Verde", "CUMPLE", "% entre 75 y 100"],
    ["Amarillo", "CUMPLE PARCIALMENTE", "% entre 50 y 75"],
    ["Rojo", "NO CUMPLE", "% menor a 50"],
    ["Gris", "NO APLICA", "Sin datos"],
  ]

  referenceData.forEach((rowData) => {
    const row = referenceSheet.addRow(rowData)
    row.height = 18
    row.eachCell((cell) => {
      cell.border = allBorders
      cell.alignment = { vertical: "middle" }
    })
  })

  referenceSheet.addRow([])

  // Notas
  const notes = [
    "NOTA:",
    "En cada celda del calendario se muestra:",
    "1. Porcentaje de cumplimiento general",
    "2. Responsable de la operación (si está disponible)",
    "3. Auditor (si está disponible)",
  ]

  notes.forEach((note, index) => {
    const noteRow = referenceSheet.addRow([note])
    noteRow.height = 20
    const noteCell = referenceSheet.getCell(8 + index, 1)
    noteCell.font = index === 0 ? { bold: true } : {}
    noteCell.alignment = { vertical: "middle", wrapText: true }
    referenceSheet.mergeCells(8 + index, 1, 8 + index, 3)
    noteCell.border = allBorders
  })

  // Ajustar anchos de columna en referencias
  referenceSheet.getColumn(1).width = 20
  referenceSheet.getColumn(2).width = 30
  referenceSheet.getColumn(3).width = 40

  // Generar nombre de archivo con fecha
  const fecha = new Date()
  const fechaStr = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}-${String(fecha.getDate()).padStart(2, "0")}`
  const fileName = `calendario-cumplimiento-${currentYear}-${fechaStr}.xlsx`

  // Exportar archivo
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = fileName
  link.click()
  window.URL.revokeObjectURL(url)
}

async function exportCalendarWithXLSX(
  tableData: Array<{
    operacion: string
    meses: (number | null)[]
    monthFiles: (import("./types").AuditFile[] | null)[]
  }>,
  currentYear: number,
  monthNames: string[],
) {
  const workbook = XLSX.utils.book_new()

  // Crear datos para la hoja principal
  const data: any[][] = []

  // Fila de título
  data.push([`CALENDARIO ANUAL DE CUMPLIMIENTO - AÑO ${currentYear}`])
  data.push([]) // Fila vacía
  data.push([
    "FR 42 - Control de Calidad en Campo",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
    "",
  ])
  data.push([]) // Fila vacía

  // Fila de encabezados
  const headers = ["OPERACIÓN", ...monthNames]
  data.push(headers)

  // Calcular el ancho máximo necesario para la columna de operación
  let maxOperacionWidth = 20
  tableData.forEach((row) => {
    if (row.operacion.length > maxOperacionWidth) {
      maxOperacionWidth = Math.min(row.operacion.length + 5, 50)
    }
  })

  // Filas de datos
  tableData.forEach((row) => {
    const rowData: any[] = [row.operacion]
    row.meses.forEach((porcentaje, index) => {
      const monthFiles = row.monthFiles[index]
      if (porcentaje !== null) {
        const file = monthFiles && monthFiles.length > 0 ? monthFiles[0] : null
        let cellValue = `${porcentaje.toFixed(0)}%`
        
        // Agregar responsable y auditor si están disponibles
        if (file) {
          const details: string[] = []
          if (file.responsable) details.push(`Resp: ${file.responsable}`)
          if (file.auditor) details.push(`Aud: ${file.auditor}`)
          if (details.length > 0) {
            cellValue += `\n${details.join("\n")}`
          }
        }
        
        rowData.push(cellValue)
      } else {
        rowData.push("-")
      }
    })
    data.push(rowData)
  })

  // Crear hoja de cálculo
  const worksheet = XLSX.utils.aoa_to_sheet(data)

  // Calcular anchos óptimos para las columnas de meses basándose en el contenido
  const monthColumnWidths = monthNames.map((_, monthIndex) => {
    let maxWidth = 12 // Ancho mínimo
    tableData.forEach((row) => {
      const monthFiles = row.monthFiles[monthIndex]
      const porcentaje = row.meses[monthIndex]
      if (porcentaje !== null) {
        const file = monthFiles && monthFiles.length > 0 ? monthFiles[0] : null
        let cellLength = `${porcentaje.toFixed(0)}%`.length
        if (file) {
          if (file.responsable) {
            cellLength = Math.max(cellLength, `Resp: ${file.responsable}`.length)
          }
          if (file.auditor) {
            cellLength = Math.max(cellLength, `Aud: ${file.auditor}`.length)
          }
        }
        maxWidth = Math.max(maxWidth, Math.min(cellLength + 3, 25))
      }
    })
    return { wch: maxWidth }
  })

  // Ajustar anchos de columna con valores calculados
  const columnWidths = [
    { wch: maxOperacionWidth }, // Columna de operación (ajustada al contenido)
    ...monthColumnWidths, // Columnas de meses (ajustadas al contenido)
  ]
  worksheet["!cols"] = columnWidths

  // Configurar alturas de fila
  if (!worksheet["!rows"]) worksheet["!rows"] = []
  
  // Altura para título (fila 0)
  worksheet["!rows"][0] = { hpt: 30 }
  
  // Altura para subtítulo (fila 2)
  worksheet["!rows"][2] = { hpt: 20 }
  
  // Altura para encabezados (fila 4)
  worksheet["!rows"][4] = { hpt: 25 }
  
  // Altura para filas de datos (mínimo 60 puntos para que quepa el texto con wrap)
  for (let i = 5; i <= data.length; i++) {
    worksheet["!rows"][i] = { hpt: 60 }
  }

  // Combinar celdas para el título (fila 1)
  if (!worksheet["!merges"]) worksheet["!merges"] = []
  const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1")
  worksheet["!merges"].push({
    s: { r: 0, c: 0 },
    e: { r: 0, c: range.e.c },
  })

  // Combinar celdas para el subtítulo (fila 3)
  worksheet["!merges"].push({
    s: { r: 2, c: 0 },
    e: { r: 2, c: range.e.c },
  })

  // Agregar hoja al libro
  XLSX.utils.book_append_sheet(workbook, worksheet, "Calendario Anual")

  // Agregar hoja de referencias
  const referenceData = [
    ["REFERENCIAS FR 42 - CONTROL DE CALIDAD EN CAMPO"],
    [],
    ["Color", "Estado", "Rango de Cumplimiento"],
    ["Verde", "CUMPLE", "% entre 75 y 100"],
    ["Amarillo", "CUMPLE PARCIALMENTE", "% entre 50 y 75"],
    ["Rojo", "NO CUMPLE", "% menor a 50"],
    ["Gris", "NO APLICA", "Sin datos"],
    [],
    ["NOTA:", "", ""],
    [
      "En cada celda del calendario se muestra:",
      "",
      "",
    ],
    [
      "1. Porcentaje de cumplimiento general",
      "",
      "",
    ],
    [
      "2. Responsable de la operación (si está disponible)",
      "",
      "",
    ],
    [
      "3. Auditor (si está disponible)",
      "",
      "",
    ],
  ]

  const referenceSheet = XLSX.utils.aoa_to_sheet(referenceData)
  referenceSheet["!cols"] = [{ wch: 20 }, { wch: 30 }, { wch: 40 }]

  // Configurar alturas de fila para referencias
  if (!referenceSheet["!rows"]) referenceSheet["!rows"] = []
  referenceSheet["!rows"][0] = { hpt: 25 } // Título
  referenceSheet["!rows"][2] = { hpt: 20 } // Encabezados
  for (let i = 3; i <= 6; i++) {
    referenceSheet["!rows"][i] = { hpt: 18 } // Filas de datos
  }
  for (let i = 8; i <= 13; i++) {
    referenceSheet["!rows"][i] = { hpt: 20 } // Notas
  }

  // Combinar celdas para el título de referencias
  if (!referenceSheet["!merges"]) referenceSheet["!merges"] = []
  referenceSheet["!merges"].push({
    s: { r: 0, c: 0 },
    e: { r: 0, c: 2 },
  })

  // Combinar celdas para las notas
  const refRange = XLSX.utils.decode_range(referenceSheet["!ref"] || "A1")
  for (let row = 9; row <= 13; row++) {
    referenceSheet["!merges"].push({
      s: { r: row, c: 0 },
      e: { r: row, c: 2 },
    })
  }

  XLSX.utils.book_append_sheet(workbook, referenceSheet, "Referencias")

  // Generar nombre de archivo con fecha
  const fecha = new Date()
  const fechaStr = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}-${String(fecha.getDate()).padStart(2, "0")}`
  const fileName = `calendario-cumplimiento-${currentYear}-${fechaStr}.xlsx`

  // Exportar archivo
  XLSX.writeFile(workbook, fileName)
}
