"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Navigation } from "@/components/navigation"
import { FileUpload } from "@/components/file-upload"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useAudit } from "@/lib/audit-context"
import type { AuditFile } from "@/lib/types"
import { ArrowRight, FileSpreadsheet } from "lucide-react"

export default function UploadPage() {
  const router = useRouter()
  const { addAuditFiles, auditFiles } = useAudit()
  const [processedFiles, setProcessedFiles] = useState<AuditFile[]>([])

  const handleFilesProcessed = (files: AuditFile[]) => {
    setProcessedFiles((prev) => [...prev, ...files])
  }

  const handleContinue = () => {
    if (processedFiles.length > 0) {
      addAuditFiles(processedFiles)
      router.push("/dashboard")
    }
  }

  const totalAudits = auditFiles.length + processedFiles.length

  return (
    <div className="min-h-screen flex flex-col">
      <Navigation />

      <main className="flex-1 py-8 px-4">
        <div className="container mx-auto max-w-4xl">
          <div className="mb-8">
            <h1 className="text-3xl font-bold mb-2">Cargar Auditorías</h1>
            <p className="text-muted-foreground">
              Suba uno o múltiples archivos Excel con auditorías de higiene y seguridad
            </p>
          </div>

          {totalAudits > 0 && (
            <Card className="mb-6 bg-primary/5 border-primary/20">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <FileSpreadsheet className="h-8 w-8 text-primary" />
                    <div>
                      <p className="font-semibold">
                        {totalAudits} auditoría{totalAudits !== 1 ? "s" : ""} en el sistema
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {processedFiles.length > 0 &&
                          `${processedFiles.length} nueva${processedFiles.length !== 1 ? "s" : ""} lista${processedFiles.length !== 1 ? "s" : ""} para agregar`}
                      </p>
                    </div>
                  </div>
                  {processedFiles.length > 0 && (
                    <Button onClick={handleContinue}>
                      Continuar al Dashboard
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          <FileUpload onFilesProcessed={handleFilesProcessed} />

          <Card className="mt-8">
            <CardHeader>
              <CardTitle>Información del Formato</CardTitle>
              <CardDescription>Los archivos Excel deben contener la siguiente estructura:</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2 text-sm">
                <li className="flex items-start gap-2">
                  <span className="text-primary font-bold">•</span>
                  <span>Encabezado con: Operación, Responsable, Cliente, Fecha, Auditor</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary font-bold">•</span>
                  <span>Tabla con items evaluados y columnas: Cumple, Cumple Parcialmente, No Cumple, No Aplica</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary font-bold">•</span>
                  <span>Marcas "x" en las columnas de estado para cada item</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-primary font-bold">•</span>
                  <span>Categorías organizadas por secciones temáticas</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
