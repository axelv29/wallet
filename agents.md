# Wallet — Expense Tracker Personal

## Stack
- **Frontend**: HTML + CSS + Vanilla JS (SPA)
- **Íconos**: Lucide (CDN `https://unpkg.com/lucide@latest`)
- **Fuentes**: Sistema nativa (UI + números usan la misma fuente del sistema, sin imports externos)
- **Persistencia**: `localStorage` (sin backend)
- **IA**: Gemini API (`generativelanguage.googleapis.com`) para importar extractos bancarios

## Estructura de archivos
- `index.html` — Shell de la SPA (sidebar, main view, settings, modales)
- `styles.css` — Sistema de diseño completo con tema claro/oscuro
- `app.js` — Toda la lógica de la aplicación
- `schema.sql` — Schema PostgreSQL de referencia (no usado actualmente)

## Convenciones de código

### Nombres
- `camelCase` para funciones y variables JS
- `kebab-case` para clases CSS e IDs HTML
- Prefijo `tx-` para elementos del modal de transacciones
- Prefijo `acc-` para elementos de creación de cuentas
- Prefijo `set-` para elementos de settings
- Prefijo `spane-` / `snav-` para settings panes / navegación
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
- `tx-is-receivable` — Checkbox de préstamo a cobrar
- `tx-due-date` — Fecha de cobro estimada
- `tx-count-badge` — Contador de transacciones filtradas
- `metric-liquid-val` / `metric-projected-val` — Valores de cobertura
- `nav-main-btn` / `nav-settings-btn` — Botones de navegación en sidebar
- `acc-name` / `acc-type` / `acc-balance` / `acc-close-day` / `acc-due-day` — Formulario de cuenta
- `cc-closing-fields` — Campos extra de tarjeta de crédito
- `accounts-scroll-container` — Lista de cuentas en settings
- `predefined-payees-list` / `predefined-categories-list` / `predefined-tags-list` — Listas editables
- `set-gemini-key` — Input de API key
- `import-text` / `import-account-id` / `import-review-tbody` — Modal de importación
- `sidebar-liquid-list` / `sidebar-credit-list` — Listas de cuentas en sidebar
- `receivables-sum-val` — Suma de préstamos activos
- `theme-icon` / `theme-icon-settings` — Íconos de tema

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
- `theme-light` / `theme-dark` — Modo en body
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
  card_closing_day: 20,     // solo credit_card
  card_due_day: 30          // solo credit_card
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
  due_date: ''              // solo si is_receivable
}
```

### Signature de funciones clave
- `renderAll()` — Renderiza todo (sidebar, header, tabla, selectors)
- `renderSidebar()` — Sidebar con cuentas y balances corrientes
- `renderHeaderAndMetrics()` — Header y métricas de cobertura
- `renderTransactions()` — Tabla filtrada
- `calculateBalances()` — Devuelve `{ liquid, credit_card, receivables }`
- `filterTransactions(viewId)` — Cambia vista (`'all'` | `'receivables'` | account id)
- `showView(name)` — Cambia entre `'main'` y `'settings'`
- `switchSettingsPane(name)` — Cambia entre `'general'` | `'accounts'` | `'payees'` | `'categories'` | `'tags'`
- `toggleTheme()` — Alterna light/dark
- `setTxSign(sign)` — `-1` para gasto, `1` para ingreso
- `saveData(type)` — Persiste a localStorage (`'accounts'` | `'transactions'` | `'predefined'`)
- `formatCurrency(value)` — Formatea a ARS
- `formatDate(dateString)` — Formatea a locale argentino

### Predefinidos editables
```js
state.predefined = {
  payees: ['Leo', 'Escaramuza', ...],
  categories: ['Fuera del presupuesto', 'Entretenimiento', ...],
  tags: ['Rocio', 'NyL', 'pan', 'viaje', 'compras']
}
```

### Reglas de renderizado
- **Sidebar**: Los balances se calculan como `balance inicial + suma de amounts de transacciones` para cada cuenta
- **Header**: `cobertura líquida = liquid + credit_card`, `cobertura proyectada = liquid + credit_card + receivables`
- **Tabla**: Columnas: Fecha | Cuenta | Beneficiario | Notas/Detalle | Categoría | Pago | Ingreso | Acciones
  - Las transacciones con `amount < 0` muestran el monto en columna "Pago"
  - Las transacciones con `amount > 0` muestran el monto en columna "Ingreso"
  - Si `is_receivable` muestra botón "marcar como cobrado" que crea una tx inversa
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

### Keys de localStorage
- `wallet_accounts` — Array de cuentas
- `wallet_transactions` — Array de transacciones
- `wallet_predefined` — Objeto con payees, categories, tags
- `wallet_settings` — Objeto con `geminiKey` y `theme`

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
- Muestra:
  - **Resumen del mes**: ingresos totales, gastos totales, diferencia neta (mes calendario actual)
  - **Gastos por categoría**: barras proporcionales de gasto por categoría
  - **Cobertura**: cobertura líquida, proyectada y patrimonio neto
  - **Actividad reciente**: últimas 5 transacciones
- Se renderiza automáticamente desde `renderAll()` y al navegar al dashboard

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
- [x] Tema claro/oscuro
- [x] Selectores buscables (payee, categoría)
- [x] Atajo de teclado: `+`/`-` en campo de monto
- [x] Importación de extractos con Gemini AI
- [x] Persistencia con localStorage
- [x] Dashboard con resumen mensual, categorías y cobertura
- [x] Modal de ayuda explicativo
