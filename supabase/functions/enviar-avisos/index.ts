import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// 1. Importamos los encabezados CORS directamente desde el SDK.
//    Esto es lo más seguro para que estén siempre actualizados.
import { corsHeaders } from "npm:@supabase/supabase-js@^2/cors";

const RESEND_API_KEY = Deno.env.get("sb_publishable_C8wBfWO_rnKjffPtc4DOQA_tkVY7xVo")!;
const SUPABASE_URL   = Deno.env.get("https://mwzhyozqmsqmfpgtzeek.supabase.co/functions/v1/resend-email")!;
const SERVICE_ROLE   = Deno.env.get("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im13emh5b3pxbXNxbWZwZ3R6ZWVrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MDIyMTc4MSwiZXhwIjoyMTA1Nzk3NzgxfQ.3fHK0fq9tRbg__uhtSFs-RrmvZv7bQ5fhdMTfXDtdzU")!;

const sb = createClient(SUPABASE_URL, SERVICE_ROLE);

const FROM_EMAIL = "Mi Garaje <avisos@tudominio.com>";

function diasHasta(fecha: string | null): number | null {
  if (!fecha) return null;
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const f = new Date(fecha + "T00:00:00");
  if (isNaN(f.getTime())) return null;
  return Math.round((f.getTime() - hoy.getTime()) / 86400000);
}

async function enviarEmail(to: string, subject: string, html: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({ from: FROM_EMAIL, to, subject, html }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error("Resend: " + err);
  }
  return res.json();
}

serve(async (req) => {
  // 2. Manejamos la petición preflight (OPTIONS) al principio.
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    let soloUsuario: string | null = null;
    let esPrueba = false;

    if (token && token !== SERVICE_ROLE) {
      const { data: { user }, error } = await sb.auth.getUser(token);
      if (error || !user) {
        // 3. Aseguramos que incluso los errores lleven los encabezados CORS.
        return new Response(JSON.stringify({ error: "No autenticado" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      soloUsuario = user.id;
      esPrueba = true;
    }

    let body: any = {};
    try { body = await req.json(); } catch (_) {}

    const emailDelUsuario = soloUsuario
      ? (await sb.auth.admin.getUserById(soloUsuario)).data?.user?.email
      : null;

    // --- MODO PING ---
    if (body.ping === true && emailDelUsuario) {
      try {
        await enviarEmail(
          emailDelUsuario,
          "🔔 Mi Garaje — Prueba de conexión",
          `<div style="font-family:system-ui,Arial,sans-serif;max-width:560px;margin:auto;padding:24px">
             <h2 style="color:#2563eb">🔔 Prueba de conexión correcta</h2>
             <p>Este es un email de prueba enviado desde <b>Mi Garaje</b>.</p>
             <p style="color:#68738a;font-size:13px;margin-top:24px">
               Enviado el ${new Date().toLocaleString('es-ES')}.
             </p>
           </div>`
        );
        return new Response(JSON.stringify({
          ok: true, modo: "ping", email: emailDelUsuario,
          mensaje: "Email de prueba enviado correctamente.",
        }), {
          status: 200,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (e) {
        return new Response(JSON.stringify({ ok: false, error: e.message }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // --- MODO AVISOS ---
    let query = sb.from("vehicles").select("*, mantenimientos(*)");
    if (soloUsuario) query = query.eq("user_id", soloUsuario);

    const { data: vehicles, error: vErr } = await query;
    if (vErr) throw vErr;

    const hoy = new Date().toISOString().slice(0, 10);
    const yaEnviado = new Set<string>();
    if (!esPrueba) {
      const { data: enviadas } = await sb
        .from("notificaciones_enviadas")
        .select("vehicle_id, tipo")
        .eq("fecha_aviso", hoy);
      (enviadas || []).forEach(e => yaEnviado.add(`${e.vehicle_id}|${e.tipo}`));
    }

    const resultados: any[] = [];

    for (const v of vehicles || []) {
      // ... (Tu lógica de generación de 'avisos' se mantiene intacta)
      // ...
    }

    return new Response(JSON.stringify({
      ok: true, modo: esPrueba ? "prueba" : "cron", resultados,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});