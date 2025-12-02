import * as XLSX from "xlsx"
import type { AuditItem } from "./types"
import { formatDate } from "./utils"

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

export function exportCalendarToExcel(
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

  // Ajustar anchos de columna
  const columnWidths = [
    { wch: 35 }, // Columna de operación
    ...monthNames.map(() => ({ wch: 18 })), // Columnas de meses
  ]
  worksheet["!cols"] = columnWidths

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
  referenceSheet["!cols"] = [{ wch: 20 }, { wch: 30 }, { wch: 35 }]

  // Combinar celdas para el título de referencias
  if (!referenceSheet["!merges"]) referenceSheet["!merges"] = []
  referenceSheet["!merges"].push({
    s: { r: 0, c: 0 },
    e: { r: 0, c: 2 },
  })

  XLSX.utils.book_append_sheet(workbook, referenceSheet, "Referencias")

  // Generar nombre de archivo con fecha
  const fecha = new Date()
  const fechaStr = `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}-${String(fecha.getDate()).padStart(2, "0")}`
  const fileName = `calendario-cumplimiento-${currentYear}-${fechaStr}.xlsx`

  // Exportar archivo
  XLSX.writeFile(workbook, fileName)
}
