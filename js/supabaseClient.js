// ============================================
// CONFIGURACIÓN DE SUPABASE
// Reemplazá con tus credenciales (Project Settings > API)
// ============================================
const SUPABASE_URL = 'https://coxtuelhlmdwwiobyhyp.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNveHR1ZWxobG1kd3dpb2J5aHlwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM0NjIxMzEsImV4cCI6MjEwOTAzODEzMX0.Xy0QW-jLTQ85kJMHYcv_qek8qPGHFkfZzX10bZNcD94';

const { createClient } = supabase;
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
