"use client"

import { useState, useMemo } from "react"
import { Navigation } from "@/components/navigation"
import { useAudit } from "@/lib/audit-context"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { exportToExcel } from "@/lib/export-utils"
import { formatDate } from "@/lib/utils"
import { TableIcon, Download, Search, Filter } from "lucide-react"
import Link from "next/link"
import type { AuditStatus } from "@/lib/types"

export default function RegistrosPage() {
  const { auditFiles, getAllItems, getStats } = useAudit()
  const [searchTerm, setSearchTerm] = useState("")
  const [filterOperacion, setFilterOperacion] = useState<string>("all")
  const [filterAuditor, setFilterAuditor] = useState<string>("all")
  const [filterEstado, setFilterEstado] = useState<string>("all")
  const [filterCategoria, setFilterCategoria] = useState<string>("all")
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 50

  const stats = getStats()
  const allItems = getAllItems()

  const operaciones = Object.keys(stats.porOperacion)
  const auditores = Object.keys(stats.porAuditor)
  const categorias = [...new Set(allItems.map((i) => i.categoria))]

  const filteredItems = useMemo(() => {
    return allItems.filter((item) => {
      const matchesSearch =
        item.pregunta.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.observacion.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.operacion.toLowerCase().includes(searchTerm.toLowerCase())

      const matchesOperacion = filterOperacion === "all" || item.operacion === filterOperacion
      const matchesAuditor = filterAuditor === "all" || item.auditor === filterAuditor
      const matchesEstado = filterEstado === "all" || item.estado === filterEstado
      const matchesCategoria = filterCategoria === "all" || item.categoria === filterCategoria

      return matchesSearch && matchesOperacion && matchesAuditor && matchesEstado && matchesCategoria
    })
  }, [allItems, searchTerm, filterOperacion, filterAuditor, filterEstado, filterCategoria])

  const totalPages = Math.ceil(filteredItems.length / itemsPerPage)
  const paginatedItems = filteredItems.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)

  const handleExport = () => {
    exportToExcel(filteredItems)
  }

  const clearFilters = () => {
    setSearchTerm("")
    setFilterOperacion("all")
    setFilterAuditor("all")
    setFilterEstado("all")
    setFilterCategoria("all")
    setCurrentPage(1)
  }

  const getEstadoBadgeVariant = (estado: AuditStatus): "default" | "secondary" | "destructive" | "outline" => {
    switch (estado) {
      case "Cumple":
        return "default"
      case "Cumple parcialmente":
        return "secondary"
      case "No cumple":
        return "destructive"
      case "No aplica":
        return "outline"
      default:
        return "outline"
    }
  }

  if (auditFiles.length === 0) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navigation />
        <main className="flex-1 flex items-center justify-center p-4">
          <div className="text-center max-w-md">
            <TableIcon className="h-16 w-16 mx-auto mb-4 text-muted-foreground" />
            <h2 className="text-2xl font-bold mb-2">No hay registros</h2>
            <p className="text-muted-foreground mb-6">Suba archivos Excel para ver todos los registros de auditorías</p>
            <Button asChild>
              <Link href="/upload">Cargar Auditorías</Link>
            </Button>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navigation />

      <main className="flex-1 py-8 px-4">
        <div className="container mx-auto max-w-7xl">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-3xl font-bold mb-2">Registros de Auditorías</h1>
              <p className="text-muted-foreground">
                Vista completa de todos los items evaluados ({filteredItems.length} registros)
              </p>
            </div>
            <Button onClick={handleExport}>
              <Download className="mr-2 h-4 w-4" />
              Exportar Excel
            </Button>
          </div>

          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Filter className="h-5 w-5" />
                Filtros
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Buscar</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar en preguntas, observaciones..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Operación</label>
                  <Select value={filterOperacion} onValueChange={setFilterOperacion}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      {operaciones.map((op) => (
                        <SelectItem key={op} value={op}>
                          {op}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Auditor</label>
                  <Select value={filterAuditor} onValueChange={setFilterAuditor}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      {auditores.map((aud) => (
                        <SelectItem key={aud} value={aud}>
                          {aud}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Estado</label>
                  <Select value={filterEstado} onValueChange={setFilterEstado}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="Cumple">Cumple</SelectItem>
                      <SelectItem value="Cumple parcialmente">Cumple Parcialmente</SelectItem>
                      <SelectItem value="No cumple">No Cumple</SelectItem>
                      <SelectItem value="No aplica">No Aplica</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">Categoría</label>
                  <Select value={filterCategoria} onValueChange={setFilterCategoria}>
                    <SelectTrigger>
                      <SelectValue placeholder="Todas" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todas</SelectItem>
                      {categorias.map((cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2 flex items-end">
                  <Button variant="outline" onClick={clearFilters} className="w-full bg-transparent">
                    Limpiar Filtros
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px]">Fecha</TableHead>
                      <TableHead>Operación</TableHead>
                      <TableHead>Auditor</TableHead>
                      <TableHead>Categoría</TableHead>
                      <TableHead className="max-w-md">Pregunta</TableHead>
                      <TableHead>Estado</TableHead>
                      <TableHead className="max-w-xs">Observación</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedItems.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                          No se encontraron registros con los filtros aplicados
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedItems.map((item, index) => (
                        <TableRow key={item.id}>
                          <TableCell className="text-sm">{formatDate(item.fecha)}</TableCell>
                          <TableCell className="max-w-[200px]">
                            <div className="truncate text-sm" title={item.operacion}>
                              {item.operacion}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">{item.auditor}</TableCell>
                          <TableCell>
                            <Badge variant="secondary" className="text-xs">
                              {item.categoria}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-md">
                            <div className="line-clamp-2 text-sm" title={item.pregunta}>
                              {item.pregunta}
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge variant={getEstadoBadgeVariant(item.estado)}>{item.estado}</Badge>
                          </TableCell>
                          <TableCell className="max-w-xs">
                            <div className="line-clamp-2 text-sm text-muted-foreground" title={item.observacion}>
                              {item.observacion || "-"}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-between px-6 py-4 border-t border-border">
                  <div className="text-sm text-muted-foreground">
                    Mostrando {(currentPage - 1) * itemsPerPage + 1} a{" "}
                    {Math.min(currentPage * itemsPerPage, filteredItems.length)} de {filteredItems.length} registros
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      Anterior
                    </Button>
                    <div className="text-sm">
                      Página {currentPage} de {totalPages}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Siguiente
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
