/**
 * USE MODA CLARA — CONFIGURAÇÃO DO SUPABASE
 */
const SUPABASE_URL = 'https://scqrviyzekjsignjtmmj.supabase.co';
const SUPABASE_KEY = 'sb_publishable_n51CXLDw74ccGBqBQlOhaQ_xNwjep5T';

// Inicializa o cliente do Supabase
window.sbClient = (window.supabase && window.supabase.createClient)
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
  : null;
