import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formatea una fecha en formato DD/MM/YYYY de manera consistente en toda la aplicación
 * @param date - Puede ser un Date, un número serial de Excel, o un string de fecha
 * @returns String formateado como DD/MM/YYYY
 */
export function formatDate(date: Date | number | string | null | undefined): string {
  if (!date) {
    return ""
  }

  let dateObj: Date

  // Si es un número, podría ser un serial de Excel
  if (typeof date === "number") {
    // Si es un número serial de Excel (típicamente entre 1 y 100000)
    if (date > 0 && date < 100000) {
      // Excel usa números seriales donde 1 = 1 de enero de 1900
      // Pero JavaScript Date usa milisegundos desde 1970
      // Necesitamos convertir el número serial de Excel a fecha
      // Excel epoch es 30 de diciembre de 1899 (pero Excel cuenta 1900 como bisiesto)
      const excelEpoch = new Date(1899, 11, 30) // 30 de diciembre de 1899 (Excel epoch)
      dateObj = new Date(excelEpoch.getTime() + (date - 1) * 24 * 60 * 60 * 1000)
    } else {
      // Si es un timestamp
      dateObj = new Date(date)
    }
  } else if (typeof date === "string") {
    // Si es un string, intentar parsearlo como fecha DD/MM/YYYY primero
    // Formato común en Argentina: DD/MM/YYYY
    const dateParts = date.split(/[\/\-]/)
    if (dateParts.length === 3) {
      const part1 = Number.parseInt(dateParts[0])
      const part2 = Number.parseInt(dateParts[1])
      let part3 = Number.parseInt(dateParts[2])
      
      // Manejar años de 2 dígitos
      if (part3 < 100) {
        if (part3 < 50) {
          part3 = 2000 + part3
        } else {
          part3 = 1900 + part3
        }
      }
      
      // Validar y crear fecha en formato DD/MM/YYYY
      if (part1 > 0 && part1 <= 31 && part2 > 0 && part2 <= 12 && part3 >= 2000 && part3 < 2100) {
        // Asumir DD/MM/YYYY (formato argentino)
        dateObj = new Date(part3, part2 - 1, part1)
      } else {
        // Intentar parseo estándar
        dateObj = new Date(date)
      }
    } else {
      dateObj = new Date(date)
    }
  } else {
    dateObj = date
  }

  // Verificar que sea una fecha válida
  if (isNaN(dateObj.getTime())) {
    return String(date)
  }

  // Formatear en formato DD/MM/YYYY
  const day = String(dateObj.getDate()).padStart(2, "0")
  const month = String(dateObj.getMonth() + 1).padStart(2, "0")
  const year = dateObj.getFullYear()

  return `${day}/${month}/${year}`
}
