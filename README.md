# Sistema de Análisis de Auditorías

Plataforma web para consolidar y analizar auditorías de higiene y seguridad. Genere reportes automáticos, visualice tendencias, exporte datos y tome decisiones informadas basadas en análisis completos de cumplimiento.

## 📋 Tabla de Contenidos

- [Descripción](#-descripción)
- [Características Principales](#-características-principales)
- [Páginas y Funcionalidades](#-páginas-y-funcionalidades)
- [Formato de Archivo Excel](#-formato-de-archivo-excel)
- [Tecnologías](#-tecnologías)
- [Instalación](#-instalación)
- [Guía de Uso](#-guía-de-uso)
- [Estructura del Proyecto](#-estructura-del-proyecto)
- [Deployment](#-deployment-en-vercel)
- [Scripts Disponibles](#-scripts-disponibles)

## 🎯 Descripción

El Sistema de Análisis de Auditorías es una aplicación web desarrollada con Next.js que permite:

- **Consolidar** múltiples auditorías de higiene y seguridad en una sola plataforma
- **Analizar** el cumplimiento y desempeño de diferentes operaciones
- **Visualizar** tendencias y métricas mediante gráficos interactivos
- **Exportar** reportes y calendarios anuales en formato Excel
- **Identificar** problemas recurrentes y áreas de mejora
- **Comparar** el rendimiento entre operaciones y auditores

## 🚀 Características Principales

### Carga y Procesamiento
- ✅ **Carga Múltiple**: Arrastre y suelte múltiples archivos Excel simultáneamente
- ✅ **Detección Automática**: El sistema detecta automáticamente la estructura del Excel
- ✅ **Configuración Flexible**: Personalice las columnas del Excel según su formato
- ✅ **Re-parsing**: Re-procese archivos cargados con nueva configuración
- ✅ **Validación**: Verificación de formato antes de cargar datos

### Análisis y Visualización
- ✅ **Análisis Automático**: Métricas de cumplimiento y tendencias generadas instantáneamente
- ✅ **Visualizaciones Interactivas**: Gráficos profesionales con Recharts
- ✅ **Detección de Problemas**: Identifique items recurrentes con incumplimientos
- ✅ **Análisis Comparativo**: Compare el desempeño entre diferentes operaciones
- ✅ **Análisis por Auditor**: Evalúe el rendimiento de cada auditor
- ✅ **Tendencias Mensuales**: Visualice la evolución del cumplimiento a lo largo del tiempo

### Funcionalidades Avanzadas
- ✅ **Calendario Anual**: Vista mensual del cumplimiento por operación
- ✅ **Exportación a Excel**: Exporte registros y calendarios anuales
- ✅ **Filtros Avanzados**: Busque y filtre por múltiples criterios
- ✅ **Vista Simple/Avanzada**: Modo de visualización adaptable
- ✅ **Vista Previa**: Visualice archivos Excel antes de procesarlos
- ✅ **Persistencia**: La configuración se guarda automáticamente

## 📱 Páginas y Funcionalidades

### 1. Página de Inicio (`/`)
- Landing page con información general del sistema
- Acceso rápido a las funcionalidades principales
- Descripción de características y beneficios

### 2. Cargar Auditorías (`/upload`)
- **Carga múltiple** de archivos Excel mediante drag & drop
- **Información del formato** esperado
- **Botón de re-parsing** para reprocesar archivos con nueva configuración
- Visualización de archivos procesados antes de continuar

### 3. Dashboard General (`/dashboard`)
- **Tarjetas de estadísticas**: Total de auditorías, items, cumplimiento promedio
- **Gráfico de cumplimiento**: Gráfico de pastel con distribución de estados
- **Gráfico de operaciones**: Comparación de cumplimiento por operación
- **Tendencias mensuales**: Gráfico de líneas con evolución temporal
- **Tabla de problemas**: Items con mayor frecuencia de incumplimientos
- **Modo simple/avanzado**: Alterna entre vistas simplificadas y detalladas

### 4. Resumen Completo (`/resumen`)
- **Calendario anual de cumplimiento**: Tabla mensual por operación con códigos de color
  - Verde: Cumple (75-100%)
  - Amarillo: Cumple parcialmente (50-75%)
  - Rojo: No cumple (<50%)
  - Gris: No aplica
- **Exportación del calendario** a Excel con formato profesional
- **Vista previa** de archivos Excel al hacer clic en celdas del calendario
- **Información detallada**: Responsable y auditor por mes

### 5. Análisis por Operación (`/operaciones`)
- **Selector de operación**: Elija qué operación analizar
- **Estadísticas específicas**: Métricas detalladas de la operación seleccionada
- **Gráfico de cumplimiento**: Distribución de estados
- **Tendencias temporales**: Evolución del cumplimiento
- **Items problemáticos**: Top items con mayor incumplimiento

### 6. Análisis por Auditor (`/auditores`)
- **Selector de auditor**: Elija qué auditor analizar
- **Estadísticas del auditor**: Métricas y rendimiento
- **Lista de auditorías**: Auditorías realizadas por el auditor seleccionado
- **Análisis comparativo**: Compare el desempeño entre auditores

### 7. Registros (`/registros`)
- **Vista completa**: Tabla con todos los items evaluados
- **Filtros avanzados**:
  - Búsqueda por texto (pregunta, observación, operación)
  - Filtro por operación
  - Filtro por auditor
  - Filtro por estado (Cumple, Cumple parcialmente, No cumple, No aplica)
  - Filtro por categoría
- **Paginación**: 50 registros por página
- **Exportación a Excel**: Descargue los registros filtrados

### 8. Verificar Excel (`/verificar`)
- **Vista previa detallada**: Visualice el contenido completo del archivo Excel
- **Configurador de columnas**: Configure manualmente las columnas del Excel
- **Detección automática**: El sistema sugiere automáticamente las columnas
- **Guardado de configuración**: La configuración se guarda en localStorage
- **Depuración**: Vea los datos sin procesar y los metadatos detectados

## 📄 Formato de Archivo Excel

El sistema espera archivos Excel con la siguiente estructura:

### Encabezado (Primeras 15 filas)
Debe contener la siguiente información en cualquier formato:
- **Operación**: Nombre de la operación auditada
- **Responsable**: Responsable de la operación
- **Cliente**: Cliente o entidad
- **Fecha**: Fecha de la auditoría (formato flexible)
- **Auditor**: Nombre del auditor

Ejemplo:
```
Operación: Planta Industrial Norte
Responsable: Juan Pérez
Cliente: Empresa ABC
Fecha: 15/03/2024
Auditor: María González
```

### Tabla de Items
- **Fila de encabezado**: Debe contener las columnas de estado
- **Columnas requeridas**:
  - Pregunta/Item (columna con las preguntas evaluadas)
  - Cumple
  - Cumple Parcialmente / Cumple Parcial
  - No Cumple
  - No Aplica
  - Observación (opcional)
- **Marcas**: Use "x" o "X" en las columnas de estado para indicar el estado de cada item
- **Categorías**: Organice los items por categorías temáticas

### Estadísticas
El sistema puede leer estadísticas directamente del Excel si están disponibles:
- Total de items
- Cantidad por estado (Cumple, Cumple Parcial, No Cumple, No Aplica)
- Porcentaje de cumplimiento

### Configuración de Columnas

La primera vez que use el sistema, debe configurar las columnas del Excel:

1. Vaya a la página **"Verificar Excel"**
2. Cargue un archivo Excel de ejemplo
3. Configure las columnas:
   - Seleccione la fila donde está el encabezado
   - Asigne cada columna (Pregunta, Cumple, Cumple Parcial, etc.)
   - Indique la ubicación de metadatos (Operación, Fecha, etc.)
4. Guarde la configuración (se guarda automáticamente)

La configuración se aplicará a todos los archivos subsecuentes.

## 🛠️ Tecnologías

### Frontend
- **Next.js 16** - Framework React con App Router
- **React 19** - Biblioteca de interfaz de usuario
- **TypeScript** - Tipado estático para mayor seguridad
- **Tailwind CSS 4** - Framework de estilos utility-first
- **Radix UI** - Componentes accesibles y personalizables
- **Recharts** - Librería para visualización de datos
- **Lucide React** - Iconos modernos

### Procesamiento de Datos
- **XLSX** - Lectura y escritura de archivos Excel
- **ExcelJS** - Procesamiento avanzado de Excel con formato
- **date-fns** - Manipulación de fechas

### Utilidades
- **React Hook Form** - Manejo de formularios
- **Zod** - Validación de esquemas
- **Sonner** - Notificaciones toast
- **next-themes** - Soporte para temas claro/oscuro

## 📦 Instalación

### Requisitos Previos
- Node.js 18 o superior
- pnpm (recomendado) o npm/yarn

### Pasos de Instalación

1. **Clonar el repositorio** (si aplica)
   ```bash
   git clone <url-del-repositorio>
   cd audit-analysis-app
   ```

2. **Instalar dependencias**
   ```bash
   pnpm install
   ```

3. **Ejecutar en desarrollo**
   ```bash
   pnpm dev
   ```

4. **Abrir en el navegador**
   ```
   http://localhost:3000
   ```

### Construcción para Producción

```bash
# Construir la aplicación
pnpm build

# Ejecutar en producción
pnpm start
```

## 📖 Guía de Uso

### Primer Uso

1. **Configure las columnas del Excel**:
   - Vaya a `/verificar`
   - Cargue un archivo Excel de ejemplo
   - Configure las columnas y guarde (se guarda automáticamente)

2. **Cargue sus auditorías**:
   - Vaya a `/upload`
   - Arrastre y suelte sus archivos Excel
   - Revise los archivos procesados
   - Haga clic en "Continuar al Dashboard"

3. **Explore los análisis**:
   - Visite el Dashboard para una vista general
   - Use el Resumen para ver el calendario anual
   - Analice operaciones o auditores específicos
   - Exporte los datos que necesite

### Flujo de Trabajo Recomendado

1. **Configuración inicial** (una sola vez)
   - Configure las columnas en `/verificar`

2. **Carga de datos** (cada vez que tenga nuevas auditorías)
   - Suba los archivos Excel en `/upload`
   - Verifique que todos los archivos se procesaron correctamente

3. **Análisis** (según necesite)
   - Dashboard: Vista general rápida
   - Resumen: Calendario anual y tendencias
   - Operaciones/Auditores: Análisis específicos
   - Registros: Búsqueda y filtrado detallado

4. **Exportación** (cuando necesite reportes)
   - Exporte el calendario anual desde `/resumen`
   - Exporte registros filtrados desde `/registros`

## 📁 Estructura del Proyecto

```
audit-analysis-app/
├── app/                    # Páginas Next.js (App Router)
│   ├── page.tsx           # Página de inicio
│   ├── upload/            # Carga de archivos
│   ├── dashboard/         # Dashboard general
│   ├── resumen/           # Resumen y calendario anual
│   ├── operaciones/       # Análisis por operación
│   ├── auditores/         # Análisis por auditor
│   ├── registros/         # Vista de registros
│   ├── verificar/         # Verificación y configuración
│   └── layout.tsx         # Layout principal
├── components/            # Componentes React
│   ├── ui/               # Componentes de UI (Radix UI)
│   ├── annual-calendar-table.tsx
│   ├── column-configurator.tsx
│   ├── compliance-pie-chart.tsx
│   ├── file-upload.tsx
│   ├── monthly-trend-chart.tsx
│   ├── navigation.tsx
│   ├── operations-bar-chart.tsx
│   ├── problem-items-table.tsx
│   └── stats-card.tsx
├── lib/                   # Utilidades y lógica
│   ├── audit-context.tsx  # Contexto global de auditorías
│   ├── column-config.ts   # Configuración de columnas
│   ├── excel-parser.ts    # Parser de archivos Excel
│   ├── export-utils.ts    # Utilidades de exportación
│   ├── types.ts          # Tipos TypeScript
│   └── utils.ts          # Utilidades generales
├── public/                # Archivos estáticos
├── styles/                # Estilos globales
├── package.json          # Dependencias
├── tsconfig.json         # Configuración TypeScript
├── next.config.mjs       # Configuración Next.js
└── README.md            # Este archivo
```

## 🌐 Deployment en Vercel

Este proyecto está configurado para desplegarse fácilmente en Vercel.

### Opción 1: Deploy desde GitHub (Recomendado)

1. **Sube tu código a GitHub**
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin <tu-repositorio-github>
   git push -u origin main
   ```

2. **Conecta con Vercel**
   - Ve a [vercel.com](https://vercel.com)
   - Inicia sesión con tu cuenta de GitHub
   - Haz clic en "Add New Project"
   - Importa tu repositorio
   - Vercel detectará automáticamente Next.js y configurará todo

3. **Configuración automática**
   - Framework: Next.js (detectado automáticamente)
   - Build Command: `pnpm build`
   - Install Command: `pnpm install`
   - Output Directory: `.next` (automático)

### Opción 2: Deploy desde CLI

1. **Instala Vercel CLI**
   ```bash
   npm i -g vercel
   ```

2. **Inicia sesión**
   ```bash
   vercel login
   ```

3. **Despliega**
   ```bash
   vercel
   ```

4. **Para producción**
   ```bash
   vercel --prod
   ```

### Variables de Entorno

Si necesitas configurar variables de entorno:

1. Ve a tu proyecto en Vercel Dashboard
2. Settings → Environment Variables
3. Agrega las variables necesarias

**Nota**: Este proyecto actualmente no requiere variables de entorno, pero pueden agregarse para futuras funcionalidades (como autenticación, APIs externas, etc.).

## 📝 Scripts Disponibles

- `pnpm dev` - Inicia el servidor de desarrollo en `http://localhost:3000`
- `pnpm build` - Construye la aplicación para producción
- `pnpm start` - Inicia el servidor de producción (requiere build previo)
- `pnpm lint` - Ejecuta ESLint para verificar el código

## 🔧 Funcionalidades Técnicas

### Gestión de Estado
- **Context API**: Estado global de auditorías con React Context
- **localStorage**: Persistencia de configuración de columnas
- **Estado local**: Componentes individuales manejan su propio estado cuando es apropiado

### Procesamiento de Datos
- **Parsing inteligente**: Detección automática de estructura de Excel
- **Validación**: Verificación de datos antes de procesar
- **Cálculos automáticos**: Métricas y estadísticas generadas dinámicamente
- **Agrupación**: Organización de datos por operación, auditor, fecha, etc.

### Exportación
- **Excel avanzado**: Formato profesional con colores, bordes y estilos
- **Múltiples formatos**: Calendarios, registros, reportes
- **Optimización**: Nombres acortados para mejor visualización
- **Compatibilidad**: Funciona con ExcelJS y XLSX básico

### Rendimiento
- **Carga diferida**: Componentes pesados se cargan bajo demanda
- **Memoización**: Cálculos optimizados con useMemo
- **Paginación**: Registros divididos en páginas para mejor rendimiento
- **Filtrado eficiente**: Búsquedas rápidas en grandes volúmenes de datos

## 📄 Licencia

Este proyecto es privado.

---

**Desarrollado con ❤️ usando Next.js y TypeScript**
