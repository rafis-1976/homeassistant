import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("sb_publishable_C8wBfWO_rnKjffPtc4DOQA_tkVY7xVo")!;
const SUPABASE_URL   = Deno.env.get("https://mwzhyozqmsqmfpgtzeek.supabase.co/functions/v1/resend-email")!;
const SERVICE_ROLE   = Deno.env.get("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im13emh5b3pxbXNxbWZwZ3R6ZWVrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MDIyMTc4MSwiZXhwIjoyMTA1Nzk3NzgxfQ.3fHK0fq9tRbg__uhtSFs-RrmvZv7bQ5fhdMTfXDtdzU")!;

const sb = createClient(SUPABASE_URL, SERVICE_ROLE);

const FROM_EMAIL = "Mi Garaje <avisos@tudominio.com>";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function diasHasta(fecha: string | null): number | null {
  if (!fecha) return null;
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const f = new Date(fecha + "T00:00:00");
  if (isNaN(f.getTime())) return null;
  return Math.round((f.getTime() - hoy.getTime()) / 86400000);
}

serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS });
  }

  try {
    // Detectar si la llamada viene de un usuario autenticado
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    let soloUsuario: string | null = null;
    let esPrueba = false;

    if (token && token !== SERVICE_ROLE) {
      const { data: { user }, error } = await sb.auth.getUser(token);
      if (error || !user) {
        return new Response(JSON.stringify({ error: "No autenticado" }), {
          status: 401, headers: { ...CORS, "Content-Type": "application/json" },
        });
      }
      soloUsuario = user.id;
      esPrueba = true; // invocada desde la app → no marcar como enviado
    }

    // 1. Obtener vehículos (todos o solo los del usuario)
    let query = sb.from("vehicles").select("*, mantenimientos(*)");
    if (soloUsuario) query = query.eq("user_id", soloUsuario);

    const { data: vehicles, error: vErr } = await query;
    if (vErr) throw vErr;

    // 2. Notificaciones ya enviadas hoy (solo aplica al cron, no a las pruebas)
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

      // Revisión por km del vehículo
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

      // Email del propietario
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

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RESEND_API_KEY}`,
        },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: userData.user.email,
          subject: `Avisos de mantenimiento — ${v.matricula}`,
          html,
        }),
      });

      if (!res.ok) {
        const errTxt = await res.text();
        console.error("Error Resend:", errTxt);
        resultados.push({ vehiculo: v.matricula, error: errTxt });
        continue;
      }

      // Registrar solo si NO es prueba
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
      headers: { ...CORS, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...CORS, "Content-Type": "application/json" },
    });
  }
});