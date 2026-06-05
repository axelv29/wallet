-- Crear la tabla de Cuentas
CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('liquid', 'credit_card', 'receivable')),
  balance NUMERIC(12, 2) DEFAULT 0.00,
  card_closing_day INT, -- Solo para tarjetas de crédito
  card_due_day INT, -- Solo para tarjetas de crédito
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Crear la tabla de Categorías
CREATE TABLE categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  color TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Insertar algunas categorías por defecto
INSERT INTO categories (name, color) VALUES
  ('Comida', '#ef4444'),
  ('Transporte', '#3b82f6'),
  ('Servicios', '#eab308'),
  ('Entretenimiento', '#a855f7'),
  ('Salud', '#10b981'),
  ('Educación', '#f97316'),
  ('Sueldo / Ingresos', '#22c55e'),
  ('Otros', '#6b7280')
ON CONFLICT (name) DO NOTHING;

-- Crear la tabla de Transacciones
CREATE TABLE transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  account_id UUID REFERENCES accounts(id) ON DELETE CASCADE,
  payee TEXT NOT NULL, -- Beneficiario
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  amount NUMERIC(12, 2) NOT NULL, -- Negativo para gastos, positivo para ingresos
  notes TEXT,
  tags TEXT[], -- Etiquetas
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);
