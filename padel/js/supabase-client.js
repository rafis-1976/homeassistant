// ============================================
// Conexión única a Supabase (sin autenticación)
// ============================================
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

const SUPABASE_URL = 'https://mwzhyozqmsqmfpgtzeek.supabase.co'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im13emh5b3pxbXNxbWZwZ3R6ZWVrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTAyMjE3ODEsImV4cCI6MjEwNTc5Nzc4MX0.U03Ec0QqhWznmy9_pyyjvp0yS9vzuPy9FY01UvfZDs0'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// ============================================
// Nombres de tablas centralizados
// ============================================
export const TABLES = {
  alumnos:          'padel_alumnos',
  clases:           'padel_clases',
  claseAlumnos:     'padel_clase_alumnos',
  ejercicios:       'padel_ejercicios',
  progresoAlumnos:  'padel_progreso_alumnos',
  faltas:           'padel_faltas',
  pagos:            'padel_pagos',
  tarifas:          'padel_tarifas',
  finanzas:         'padel_finanzas'   // ← NUEVO
}