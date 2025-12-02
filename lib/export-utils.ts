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
