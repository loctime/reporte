import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

interface ProblemItemsTableProps {
  items: Array<{
    pregunta: string
    categoria: string
    noCumple: number
    frecuencia: number
  }>
}

export function ProblemItemsTable({ items }: ProblemItemsTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Items Más Problemáticos</CardTitle>
        <CardDescription>Items con mayor cantidad de incumplimientos</CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[50px]">#</TableHead>
              <TableHead>Categoría</TableHead>
              <TableHead>Pregunta</TableHead>
              <TableHead className="text-right">Incumplimientos</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {items.slice(0, 10).map((item, index) => (
              <TableRow key={index}>
                <TableCell className="font-medium">{index + 1}</TableCell>
                <TableCell>
                  <Badge variant="secondary">{item.categoria}</Badge>
                </TableCell>
                <TableCell className="max-w-md">
                  <div className="line-clamp-2 text-sm">{item.pregunta}</div>
                </TableCell>
                <TableCell className="text-right">
                  <Badge variant="destructive">{item.noCumple}</Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
