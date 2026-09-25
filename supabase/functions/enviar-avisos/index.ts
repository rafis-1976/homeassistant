import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
// 1. Importamos las cabeceras CORS directamente desde el SDK.
//    Esto asegura que siempre estén correctas y sincronizadas.
import { corsHeaders } from "npm:@supabase/supabase-js@^2/cors";

const RESEND_API_KEY = Deno.env.get("sb_publishable_C8wBfWO_rnKjffPtc4DOQA_tkVY7xVo")!;
const SUPABASE_URL   = Deno.env.get("https://mwzhyozqmsqmfpgtzeek.supabase.co/functions/v1/resend-email")!;
const SERVICE_ROLE   = Deno.env.get("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im13emh5b3pxbXNxbWZwZ3R6ZWVrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MDIyMTc4MSwiZXhwIjoyMTA1Nzk3NzgxfQ.3fHK0fq9tRbg__uhtSFs-RrmvZv7bQ5fhdMTfXDtdzU")!;

const sb = createClient(SUPABASE_URL, SERVICE_ROLE);

const FROM_EMAIL = "Mi Garaje <onboarding@resend.dev>"; // Recuerda cambiarlo por tu remitente verificado si tienes dominio propio

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
  // 2. Manejamos la petición preflight (OPTIONS) al principio de todo.
  //    Es crucial que devuelva las cabeceras CORS correctas.
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
        // 3. Aseguramos que incluso los errores de autenticación lleven las cabeceras CORS.
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

    // --- MODO PING (TEST EMAIL) ---
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
      const avisos: { tipo: string; mensaje: string }[] = [];

      // ITV (30 días)
      const dItv = diasHasta(v.itv);
      if (dItv !== null && dItv <= 30 && !yaEnviado.has(`${v.id}|itv`)) {
        avisos.push({ tipo: "itv",
          mensaje: `La ITV de ${v.matricula} ${dItv < 0 ? `venció hace ${Math.abs(dItv)} días` : `vence en ${dItv} días`} (${v.itv}).` });
      }

      // Seguro (21 días)
      const dSeguro = diasHasta(v.seguro);
      if (dSeguro !== null && dSeguro <= 21 && !yaEnviado.has(`${v.id}|seguro`)) {
        avisos.push({ tipo: "seguro",
          mensaje: `El seguro de ${v.matricula} ${dSeguro < 0 ? `venció hace ${Math.abs(dSeguro)} días` : `vence en ${dSeguro} días`} (${v.seguro}).` });
      }

      // Impuesto (30 días)
      const dImp = diasHasta(v.impuesto);
      if (dImp !== null && dImp <= 30 && !yaEnviado.has(`${v.id}|impuesto`)) {
        avisos.push({ tipo: "impuesto",
          mensaje: `El impuesto (IVTM) de ${v.matricula} ${dImp < 0 ? `venció hace ${Math.abs(dImp)} días` : `vence en ${dImp} días`} (${v.impuesto}).` });
      }

      // Revisión por km
      if (v.intervalo_revision_km && v.ultima_revision_km) {
        const proxima = Number(v.ultima_revision_km) + Number(v.intervalo_revision_km);
        const restantes = proxima - (Number(v.km) || 0);
        if (restantes <= 1000 && !yaEnviado.has(`${v.id}|revision_km`)) {
          avisos.push({ tipo: "revision_km",
            mensaje: restantes <= 0
              ? `Revisión por km de ${v.matricula} superada por ${Math.abs(restantes)} km (tocaba a los ${proxima} km).`
              : `Revisión por km de ${v.matricula}: faltan ${restantes} km (a los ${proxima} km).` });
        }
      }

      // Mantenimientos programados
      for (const m of v.mantenimientos || []) {
        if (m.proxima_fecha) {
          const d = diasHasta(m.proxima_fecha);
          if (d !== null && d <= 30 && !yaEnviado.has(`${v.id}|mant_fecha_${m.id}`)) {
            avisos.push({ tipo: `mant_fecha_${m.id}`,
              mensaje: `${m.tipo} de ${v.matricula}: ${d < 0 ? `pendiente desde hace ${Math.abs(d)} días` : `en ${d} días`} (${m.proxima_fecha}).` });
          }
        }
        if (m.proximo_km) {
          const rest = Number(m.proximo_km) - (Number(v.km) || 0);
          if (rest <= 1000 && !yaEnviado.has(`${v.id}|mant_km_${m.id}`)) {
            avisos.push({ tipo: `mant_km_${m.id}`,
              mensaje: `${m.tipo} de ${v.matricula}: ${rest <= 0 ? `superado por ${Math.abs(rest)} km` : `faltan ${rest} km`}.` });
          }
        }
      }

      if (avisos.length === 0) {
        resultados.push({ vehiculo: v.matricula, enviados: 0, avisos: [] });
        continue;
      }

      const { data: userData, error: uErr } = await sb.auth.admin.getUserById(v.user_id);
      if (uErr || !userData?.user?.email) {
        resultados.push({ vehiculo: v.matricula, error: "Sin email" });
        continue;
      }

      const html = `
        <div style="font-family:system-ui,Arial,sans-serif;max-width:560px;margin:auto;padding:20px">
          <h2 style="color:#2563eb">🚗 Avisos de mantenimiento — ${v.nombre || v.matricula}</h2>
          <ul style="line-height:1.7">
            ${avisos.map(a => `<li>${a.mensaje}</li>`).join("")}
          </ul>
          <p style="color:#68738a;font-size:13px">Enviado desde Mi Garaje.</p>
        </div>`;

      try {
        await enviarEmail(userData.user.email, `Avisos de mantenimiento — ${v.matricula}`, html);
      } catch (e) {
        resultados.push({ vehiculo: v.matricula, error: e.message });
        continue;
      }

      if (!esPrueba) {
        const registros = avisos.map(a => ({
          vehicle_id: v.id, tipo: a.tipo, fecha_aviso: hoy,
        }));
        await sb.from("notificaciones_enviadas").insert(registros);
      }

      resultados.push({
        vehiculo: v.matricula,
        email: userData.user.email,
        enviados: avisos.length,
        avisos: avisos.map(a => a.mensaje),
      });
    }

    return new Response(JSON.stringify({
      ok: true,
      modo: esPrueba ? "prueba" : "cron",
      resultados,
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