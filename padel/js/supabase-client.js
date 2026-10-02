// ============================================
// Conexión única a Supabase (sin autenticación)
// ============================================
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm'

const SUPABASE_URL = 'https://TU-PROYECTO.supabase.co'
const SUPABASE_ANON_KEY = 'TU-ANON-KEY'

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
  tarifas:          'padel_tarifas'
}