# Wallet — Expense Tracker Personal

## Stack
- **Frontend**: HTML + CSS + Vanilla JS (SPA)
- **Íconos**: Lucide (CDN `https://unpkg.com/lucide@latest`)
- **Fuentes**: Sistema nativa (UI + números usan la misma fuente del sistema, sin imports externos)
- **Persistencia**: `localStorage` (sin backend)
- **IA**: Gemini API (`generativelanguage.googleapis.com`) para importar extractos bancarios

## Estructura de archivos
- `index.html` — Shell de la SPA (sidebar, main view, settings, modales)
- `css/base.css` — Variables, tema claro/oscuro, reset
- `css/layout.css` — Grid, sidebar, main, toolbar, filter panel
- `css/components.css` — Botones, tabla, modales, forms, dropdowns, tags
- `css/settings.css` — Layout de settings, panes, cuentas, predefinidos
- `css/dashboard.css` — Dashboard, charts, categorías, cobertura
- `css/helpers.css` — Import modal, help, CSV, installment
- `js/state.js` — Estado global y persistencia
- `js/currency.js` — Cotizaciones en línea, conversión de monedas (open.er-api.com)
- `js/utils.js` — formatCurrency, formatDate, calculateBalances, helpers, evaluateExpression, isPlainNumber
- `js/modals.js` — Help modal, confirm modal
- `js/sidebar.js` — Sidebar, filtros, métricas de cobertura
- `js/transactions.js` — CRUD, tabla, batch ops, inline editing, selectores
- `js/dashboard.js` — Dashboard, charts, navegación mensual
- `js/settings.js` — Settings, cuentas, predefinidos, icon picker
- `js/import.js` — Gemini import, CSV/XLS parsing
- `js/backup.js` — Exportación e importación de datos (backup JSON)
- `js/app.js` — Init, showView, theme, shortcuts, renderAll, window.* bindings
- `schema.sql` — Schema PostgreSQL de referencia (no usado actualmente)

## Convenciones de código

### Nombres
- `camelCase` para funciones y variables JS
- `kebab-case` para clases CSS e IDs HTML
- Prefijo `tx-` para elementos del modal de transacciones
- Prefijo `acc-` para elementos de creación de cuentas
- Prefijo `set-` para elementos de settings
- Prefijo `spane-` / `snav-` para settings panes / navegación (panes: `general`, `apariencia`, `accounts`, `listas`, `sistema`)
- Prefijo `metric-` para indicadores de cobertura
- Prefijo `sidebar-` para elementos del sidebar

### IDs
- `view-main` / `view-settings` — Vistas principales
- `tx-modal` / `import-modal` — Modales
- `tx-table-body` — Tbody de la tabla de transacciones
- `tx-search-input` — Input de búsqueda
- `net-worth-val` — Patrimonio neto en sidebar
- `tx-account` / `tx-date` / `tx-amount` — Campos del formulario
- `tx-payee-search` / `tx-category-search` — Selectores buscables
- `dropdown-payee` / `dropdown-category` — Dropdowns buscables
- `btn-sign-expense` / `btn-sign-income` — Botones de signo
- `tx-tags-checklist` — Checklist de etiquetas en el modal
- `tx-amount-error` — Mensaje de error de calculadora en modal de monto
- `tx-is-receivable` — Checkbox de préstamo a cobrar
- `tx-due-date` — Fecha de cobro estimada
- `tx-count-badge` — Contador de transacciones filtradas
- `metric-liquid-val` / `metric-projected-val` — Valores de cobertura
- `nav-main-btn` / `nav-settings-btn` — Botones de navegación en sidebar
- `split-modal` — Modal de división de transacciones
- `split-rows-wrap` — Contenedor de filas de división
- `split-total-val` / `split-remaining` — Info de monto total y restante
- `acc-name` / `acc-type` / `acc-balance` / `acc-close-day` / `acc-due-day` — Formulario de cuenta
- `acc-edit-excluded` — Checkbox de excluir cuenta en modal de edición
- `cc-closing-fields` — Campos extra de tarjeta de crédito
- `accounts-scroll-container` — Lista de cuentas en settings
- `predefined-payees-list` / `predefined-categories-list` / `predefined-tags-list` — Listas editables
- `set-gemini-key` — Input de API key
- `import-text` / `import-account-id` / `import-review-tbody` — Modal de importación
- `import-backup-modal` — Modal de importación de backup
- `import-backup-upload` / `import-backup-preview` — Secciones del modal de backup
- `import-backup-input` — Input de archivo de backup
- `import-backup-filename` / `import-backup-stats` — Info del archivo de backup
- `btn-confirm-import-backup` — Botón de confirmación de importación
- `backup-date-from` / `backup-date-to` — Filtros de fecha para exportación de backup
- `sidebar-liquid-list` / `sidebar-credit-list` — Listas de cuentas en sidebar
- `receivables-sum-val` — Suma de préstamos activos
- `theme-icon` / `theme-icon-settings` — Íconos de tema
- `set-currency` / `set-show-symbol` / `set-decimals` — Configuración de moneda

### Clases CSS
- `app-container` — Grid principal (sidebar + main)
- `sidebar` / `main-content` — Layout
- `ledger` — Tabla de transacciones
- `account-item-sidebar` — Items de cuenta en sidebar (modificador `.active`)
- `sidebar-footer-btn` — Botones del footer del sidebar (modificador `.active-nav`)
- `modal-overlay` / `modal-card` — Modales (modificador `.open` / `.wide`)
- `sign-btn` — Botones de signo (modificadores `.active-expense` / `.active-income`)
- `searchable-wrap` / `searchable-dropdown` — Selectores buscables (modificador `.open`)
- `tag-pill` — Badges de etiquetas (modificadores `.a` / `.b` / `.c`)
- `row-action` — Botones de acción en tabla (modificadores `.danger` / `.success`)
- `cov-badge` — Badge de cobertura (modificadores `.ok` / `.warn` / `.bad`)
- `tag-check-label` — Labels de checklist de etiquetas
- `amount-cell` — Celdas de monto (modificadores `.expense` / `.income`)
- `settings-nav-btn` — Botones de navegación de settings (modificador `.active`)
- `settings-pane` — Paneles de settings (modificador `.active`)
- `btn` — Botones (modificador `.btn-primary` / `.btn-ghost` / `.w-full`)
- `btn-danger` — Botón de peligro (fondo rojo, para acciones destructivas)
- `theme-light` / `theme-dark` — Modo en body
- `scheme-ocean` / `scheme-forest` / `scheme-lavender` / `scheme-midnight` / `scheme-ember` / `scheme-default-dark` — Esquemas de color en body
- `scheme-grid` / `scheme-card` — Grid de esquemas de color (modificador `.active`)
- `scheme-dots` / `scheme-dot` — Puntos de color en tarjetas de esquema
- `scheme-card-custom` / `scheme-dot-custom` — Tarjeta y puntos del esquema personalizado
- `form-row` / `form-row-3` — Filas de formulario
- `form-group` — Grupo de formulario
- `delete-btn` — Botón de eliminar genérico
- `net-worth-amount` — Monto de patrimonio (modificador `.negative`)
- `acc-balance-sidebar` — Balance en sidebar (modificador `.negative`)
- `accounts-split` — Grid de 2 columnas en settings de cuentas
- `predefined-scroll` / `predefined-add-row` — Listas editables
- `search-box` — Input de búsqueda con lupa
- `tx-count` — Badge contador de transacciones
- `coverage-strip` / `cov-item` — Strip de métricas en header
- `closing-fields` — Campos de cierre de tarjeta
- `cc-note` — Nota informativa de tarjeta
- `compact-table` — Tabla compacta en import review
- `empty-row` — Fila vacía de tabla
- `col-sortable` / `sort-arrow` / `sort-active` / `sort-desc` — Headers sortables con flecha
- `predefined-item-left` / `predefined-name` / `predefined-icon-btn` / `predefined-rename-input` — Items editables en listas de settings
- `tag-color-btn` / `tag-color-dot` / `tag-color-popover` / `tag-color-grid` / `tag-color-opt` — Color picker de etiquetas
- `tag-check-dot` — Bola de color en checklist de etiquetas
- `split-child-row` — Fila de hijo de división (indentada, fondo distinto)
- `split-child-bullet` — Bullet circular alineado con beneficiario
- `split-parent-badge` — Badge de división en fila padre
- `split-toggle` — Botón de colapsar/expandir hijos
- `split-total-header` / `split-progress-track` / `split-progress-bar` — Barra de progreso del modal
- `split-rows-wrap` / `split-row` / `split-row-main` — Elementos del modal de división
- `split-actions-row` — Botones de acción del modal (Agregar, Igualar, Eliminar)
- `calc-error` — Mensaje de error de calculadora en editor inline de monto
- `calc-error-modal` — Mensaje de error de calculadora en input de monto del modal
- `account-excluded` — Item de cuenta excluida en sidebar (texto opaco, badge)
- `acc-excluded-badge` — Badge "Excluida" en sidebar y lista de cuentas
- `acc-excluded-toggle` — Toggle de excluir en modal de edición de cuenta

### Tipos de cuenta (`acc.type`)
- `'liquid'` — Cuenta líquida (efectivo/débito)
- `'credit_card'` — Tarjeta de crédito
- `'receivable'` — (definido en schema.sql pero no usado en JS)

### Atributos de cuenta
```js
{
  id: 'acc-1',
  name: 'Itaú Débito',
  type: 'liquid',           // 'liquid' | 'credit_card'
  balance: 1047.40,
  currency: 'ARS',          // 'ARS' | 'USD' | 'EUR' | 'UYU'
  excluded: false,          // excluir del balance total, estadísticas y dashboard
  card_closing_day: 20,     // solo credit_card (obsoleto, migrado a card_schedule)
  card_due_day: 30          // solo credit_card (obsoleto, migrado a card_schedule)
}
```

### Atributos de transacción
```js
{
  id: 'tx-1',
  date: '2026-06-01',
  account_id: 'acc-4',
  payee: 'Escaramuza',
  category_name: 'Entretenimiento',
  amount: -258.75,          // negativo = gasto, positivo = ingreso
  notes: 'Libro w/',
  tags: ['Rocio'],
  is_receivable: false,
  due_date: '',             // solo si is_receivable
  excluded: false,          // excluir del total
  split_group: null,        // ID de grupo de división ('sg-...') si tiene hijos
  split_parent_id: null,    // ID del padre si es hijo de una división
  amount_expression: null   // expresión original del calculador (ej: '345+100'), null si es número simple
}
```

### Signature de funciones clave
- `renderAll()` — Renderiza todo (sidebar, header, tabla, selectors)
- `renderSidebar()` — Sidebar con cuentas y balances corrientes
- `renderHeaderAndMetrics()` — Header y métricas de cobertura
- `renderTransactions()` — Tabla filtrada
- `calculateBalances()` — Devuelve `{ liquid, credit_card, receivables }` (convertidos a moneda de settings)
- `filterTransactions(viewId)` — Cambia vista (`'all'` | `'receivables'` | account id)
- `showView(name)` — Cambia entre `'main'` y `'settings'`
- `switchSettingsPane(name)` — Cambia entre `'general'` | `'apariencia'` | `'accounts'` | `'listas'` | `'sistema'` | `'currency'`
- `toggleTheme()` — Alterna light/dark (busca primer esquema del modo opuesto)
- `setColorScheme(name)` — Establece esquema de color (auto-detecta modo light/dark)
- `syncThemeUI()` — Sincroniza tarjetas del picker de temas
- `setTxSign(sign)` — `-1` para gasto, `1` para ingreso
- `saveData(type)` — Persiste a localStorage (`'accounts'` | `'transactions'` | `'predefined'`)
- `formatCurrency(value)` — Formatea a moneda global (settings)
- `formatAccountCurrency(value, currency)` — Formatea a moneda de cuenta (siempre muestra símbolo nativo)
- `getConvertedTooltip(value, currency)` — Devuelve string con valor convertido a moneda de settings para tooltips
- `formatDate(dateString)` — Formatea a locale argentino
- `fetchExchangeRates()` — Descarga cotizaciones de open.er-api.com (cache 24h en localStorage)
- `convertCurrency(value, from, to)` — Convierte monto entre monedas usando cotizaciones cacheadas
- `exportBackup()` — Exporta todos los datos a un archivo JSON descargable
- `openImportBackupModal()` — Abre modal de importación de backup
- `closeImportBackupModal()` — Cierra modal de importación
- `onImportBackupFile(e)` — Procesa archivo JSON seleccionado
- `confirmImportBackup()` — Confirma e ejecuta la importación (reemplazar o agregar)
- `confirmDeleteAllData()` — Abre modal de confirmación para borrar todos los datos
- `deleteAllData()` — Ejecuta el borrado: transacciones, cuentas y listas personalizadas
- `initCustomThemeUI()` — Inicializa la UI del selector de colores personalizado (scheme-card + color pickers)
- `buildCustomPalette(tableBase, sidebarBase, accentBase)` — Genera toda la paleta CSS desde 3 colores hex
- `applyCustomTheme()` — Aplica las variables CSS del tema personalizado al body via style tag
- `saveCustomThemeColors()` — Guarda los colores personalizados en localStorage y aplica el tema
- `openSplitModal(txId)` — Abre modal de división para una transacción
- `closeSplitModal()` — Cierra modal de división
- `addSplitRow(notes, amount, tags)` — Agrega una fila de división al modal
- `removeSplitRow(btn)` — Elimina una fila de división y redistribuye el monto al último
- `removeAllSplits()` — Elimina todas las filas y deja 2 vacías
- `distributeEqually()` — Reparte el total en partes iguales entre todas las filas
- `onSplitAmountInput(changedInput)` — Recalcula el último split al editar uno
- `recalcSplitProgress()` — Actualiza barra de progreso y monto restante
- `saveSplits()` — Guarda las divisiones creando transacciones hijas
- `mergeSplitChildren(txId)` — Elimina hijos y limpia split_group (reunir)
- `deleteSplitChildren(txId)` — Elimina todos los hijos de un padre
- `toggleSplitChildren(txId)` — Colapsa/expande hijos en la tabla
- `isSplitChildrenOpen(txId)` — Verifica si los hijos están expandidos
- `evaluateExpression(expr, decimals)` — Evalúa expresión aritmética, devuelve `{ value, error }` o `null`
- `isPlainNumber(str)` — Detecta si un string es un número simple (no expresión)

### Predefinidos editables
```js
state.predefined = {
  payees: ['Leo', 'Escaramuza', ...],
  categories: [{ name: 'Fuera del presupuesto', icon: 'banknote' }, ...],  // 'Sin asignar' (protegida)
  tags: [{ name: 'Rocio', color: '#f9a8d4' }, ...]
}
```
- En settings se edita el nombre tocándolo, y para categorías el ícono tocando el icono.
- Cada etiqueta tiene un color asignado (bola de color). Se cambia tocando la bola, abre un picker con 18 pares de colores base+pastel.

### Reglas de renderizado
- **Sidebar**: Los balances se calculan como `balance inicial + suma de amounts de transacciones` para cada cuenta
- **Header**: `cobertura líquida = liquid + credit_card`, `cobertura proyectada = liquid + credit_card + receivables`
- **Tabla**: Columnas: Fecha | Cuenta | Beneficiario | Notas/Detalle | Categoría | Pago | Ingreso | Acciones
  - Las transacciones con `amount < 0` muestran el monto en columna "Pago"
  - Las transacciones con `amount > 0` muestran el monto en columna "Ingreso"
  - Si `is_receivable` muestra botón "marcar como cobrado" que crea una tx inversa
  - **Sort**: Hacer click en header de columna ordena asc → desc → sin orden. Estado en `state.sortColumn` y `state.sortDirection`. Columnas sortables: fecha, cuenta, beneficiario, notas, etiquetas, categoría, monto. Función `toggleSort(column)`.
- **Modal de transacción**: Formulario con fecha, cuenta, beneficiario (buscable), categoría (buscable), monto con toggle gasto/ingreso, etiquetas (checklist), notas y opción de préstamo a cobrar
- **Etiquetas en tabla**: Se muestran como pills de colores: `#Rocio` → rosa, `#NyL` → amarillo, otras → azul

### Comportamiento de búsqueda
- Filtra por `payee`, `notes`, `tags`, `account.name`, `category_name`
- Búsqueda case-insensitive
- Se ejecuta en cada `oninput` del campo de búsqueda

### Reglas de negocio
- Los montos de transacciones son **negativos para gastos** y **positivos para ingresos**
- `handleTransactionSubmit` auto-agrega payees y categorías nuevos a `state.predefined`
- Al marcar como cobrado un préstamo, se crea una transacción inversa (positiva) y se desmarca el original
- El modal de importación usa Gemini API para parsear texto de extractos bancarios
- **Divisiones de transacciones**: Una transacción puede dividirse en partes (hijos). El padre mantiene el monto total para totales. Los hijos son desglose informativo con notas y etiquetas propias. El último hijo siempre es "el resto" y se auto-calcula.
- **Calculadora de monto**: El campo de monto acepta expresiones aritméticas (`+`, `-`, `*`, `/`, paréntesis). Se evalúa al confirmar (Enter/Tab/blurred). La expresión original se guarda en `amount_expression` y se muestra al re-editar. Límite: 15 dígitos (>= 1e15 muestra error).

### Keys de localStorage
- `wallet_accounts` — Array de cuentas
- `wallet_transactions` — Array de transacciones
- `wallet_predefined` — Objeto con payees, categories, tags
- `wallet_settings` — Objeto con `geminiKey`, `theme` y `colorScheme`
- `wallet_exchange_rates` — Cache de cotizaciones (base USD, 24h TTL)

## Design System

### Layout
- Sidebar: 228px fija, main: 1fr
- Altura de inputs: 32px
- Padding estándar: 12px 16px

### Tipografía
- UI: sistema nativa (10-15px)
- Números: misma fuente del sistema
- Tablas: 12px cuerpo, 10px headers

### Espaciado
- Gap entre elementos: 6-8px
- Form rows: gap 10px
- Section padding: 20px

### Bordes y radios
- `--r-xs: 4px`, `--r-sm: 6px`, `--r-md: 8px`, `--r-lg: 12px`
- Inputs/botones: var(--r-sm)
- Modales/cards: var(--r-lg)
- Sidebar: sin border-radius

### Sombras
- Modales: `0 20px 60px rgba(0,0,0,.25)`
- Dropdowns: `0 4px 12px rgba(0,0,0,.12)`
- Botones: sin sombra

### Paleta
- Fondo: `--bg-root` (claro #f5f4f1, oscuro #111113)
- Superficie: `--bg-surface`
- Acento global: `--accent` (#5b52f5 / #7c75f8)
- Acento dashboard: `--accent` (#e6b800 / #fbbf24) — amarillo/dorado
- Texto: `--text-hi/mid/lo`
- Bordes: `--border`
- Danger: `#dc2626` / `#ef4444` (dashboard)
- Success: `#16a34a` / `#22c55e` (dashboard)

### Componentes clave
- Botón primario: bg accent, text white, border-radius var(--r-sm), padding 8px 14px
- Input: bg surface, border var(--border), radius var(--r-sm), height 32px
- Select: mismo estilo que input
- Tabla: bordered, hover row, sticky header
- Etiquetas: pills con 3 colores predefinidos (rosa, amarillo, azul)
- Dashboard card (`.dash-card`): bg surface, border, radius var(--r-md), padding 16px 20px, head con `.dash-card-head` (uppercase, 10px, text-lo)
- Section dropdown (`.dash-section-dropdown`): btn con ícono + menú de checkboxes, abierto con `.open`
- Metric card (`.dash-metric-card`): icon box + label + value, grid 4 columnas
- Progress circle (`.dash-progress-svg`): SVG circular con track y fill, percentage center text

### CSS / Diseño
- **Layout**: Grid de 2 columnas (sidebar 228px + main 1fr)
- **Paleta**: Blanco roto + carbón + acento índigo (`#5b52f5`)
- **Variables globales**: `--bg-root`, `--bg-surface`, `--text-hi/mid/lo`, `--accent`, `--border`, etc.
- **Modales**: Overlay con backdrop-blur, animación fade
- **Breakpoints**: Sin media queries (versión desktop-first)

### Reglas para agentes de IA

#### Al modificar HTML
1. Usar `data-lucide="icon-name"` para íconos + `lucide.createIcons()` después de manipular DOM
2. Los modales requieren la clase `.open` en el `.modal-overlay` para mostrarse
3. Los dropdowns buscables requieren la clase `.open` en `.searchable-dropdown`
4. Las vistas se muestran/ocultan con `style.display = 'flex'/'none'` mediante `showView()`
5. Los settings panes se activan con clase `.active` mediante `switchSettingsPane()`

#### Al modificar CSS
1. No romper el sistema de variables CSS (tema claro/oscuro)
2. Mantener la consistencia con la escala tipográfica (10px-15px para UI, mono para números)
3. No agregar media queries (versión desktop)
4. Usar border-radius variables (`--r-xs`, `--r-sm`, `--r-md`, `--r-lg`)
5. Los colores de tags se definen en variables `--tag-a-bg/tx`, `--tag-b-*`, `--tag-c-*`

#### Al modificar JS
1. `lucide.createIcons()` debe llamarse después de cualquier manipulación del DOM que agregue/quita íconos
2. `saveData()` después de mutar `state.accounts`, `state.transactions` o `state.predefined`
3. `renderAll()` después de crear/eliminar transacciones — llama a sidebar, header, tabla y selectors
4. Los IDs de transacciones y cuentas se generan con `'tx-' + Date.now()` y `'acc-' + Date.now()`
5. Exponer toda función nueva al scope global con `window.fnName = fnName`
6. No usar módulos ES6 ni bundlers — todo en un solo script global

#### Al agregar funcionalidad nueva
1. Verificar que los IDs de elementos HTML existan antes de referenciarlos en JS
2. Agregar nuevos tipos de datos al `state` con su correspondiente `saveData()` y `loadData()`
3. No agregar dependencias externas — mantener stack minimalista (solo Lucide + Google Fonts + Gemini API)
4. Para nuevas vistas: agregar div con `id="view-nombre"` y controlar visibilidad desde `showView()`
5. Para nuevos settings panes: agregar `id="spane-nombre"` + botón `id="snav-nombre"` y mapear en `switchSettingsPane()`

### Vistas
- `showView('main')` — Vista de movimientos (tabla de transacciones)
- `showView('dashboard')` — Dashboard con resumen del mes, categorías y cobertura
- `showView('settings')` — Ajustes y configuración

### Dashboard
- `view-dashboard` en HTML, `renderDashboard()` en JS
- Secciones unificadas en una sola vista con toggle dropdown (`.dash-section-dropdown` con clase `.open`)
- `dashToggleSection(name)` alterna visibilidad de cada sección via clase `.dash-hidden` en `.dash-section-block`
- `dashToggleDropdown()` abre/cierra el menú de secciones
- `dashCloseDropdown()` cierra el menú (usado en click-outside)
- Muestra:
  - **Resumen del mes**: metric cards (ingresos, gastos, diferencia, movimientos), line/area chart últimos 6 meses, progress circle tasa de ahorro, actividad reciente
  - **Gastos por categoría**: donut y barras proporcionales de gasto
  - **Ingresos**: donut y barras de ingresos por categoría
  - **Cobertura**: cobertura líquida, proyectada y patrimonio neto, con detalles
- Se renderiza automáticamente desde `renderAll()` y al navegar al dashboard
- Los charts solo se dibujan si su sección está visible
- **Style "nly"**: acento amarillo/dorado (#e6b800), fuente DM Sans, line charts suaves con área, progress circles SVG

### Modal de ayuda
- `help-modal` en HTML, `openHelpModal()` / `closeHelpModal()` en JS
- Botón `?` en los headers de main y settings
- Explica: cuentas, cobertura (líquida vs proyectada), transacciones y dashboard

### Funcionalidades existentes
- [x] CRUD de transacciones (modal con formulario completo)
- [x] CRUD de cuentas (líquidas y tarjetas de crédito)
- [x] Predefinidos editables (beneficiarios, categorías, etiquetas)
- [x] Búsqueda en tabla (payee, notas, tags, cuenta, categoría)
- [x] Filtro por cuenta individual (sidebar clicks)
- [x] Vista de préstamos a cobrar
- [x] Marcado de cobro de préstamos (crea tx inversa automática)
- [x] Métricas de cobertura líquida y proyectada
- [x] Cálculo de patrimonio neto
- [x] Tema claro/oscuro con esquemas de color (default, ocean, forest, lavender, default-dark, midnight, ember)
- [x] Tema personalizado: generador de paleta completa desde 3 colores base (tabla, sidebar, botones)
- [x] Selectores buscables (payee, categoría)
- [x] Calculadora en campo de monto (expresiones: `+`, `-`, `*`, `/`, paréntesis) con validación y límite de 15 dígitos
- [x] Importación de extractos con Gemini AI
- [x] Persistencia con localStorage
- [x] Dashboard con resumen mensual, categorías y cobertura
- [x] Modal de ayuda explicativo
- [x] Backup de datos (exportar/importar JSON con filtro de fechas)
- [x] Borrar todos los datos (con confirmación, mantiene predefinidos)
