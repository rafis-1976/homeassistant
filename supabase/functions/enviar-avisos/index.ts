import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("sb_publishable_C8wBfWO_rnKjffPtc4DOQA_tkVY7xVo")!;
const SUPABASE_URL   = Deno.env.get("https://mwzhyozqmsqmfpgtzeek.supabase.co/functions/v1/resend-email")!;
const SERVICE_ROLE   = Deno.env.get("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im13emh5b3pxbXNxbWZwZ3R6ZWVrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc5MDIyMTc4MSwiZXhwIjoyMTA1Nzk3NzgxfQ.3fHK0fq9tRbg__uhtSFs-RrmvZv7bQ5fhdMTfXDtdzU")!;

const sb = createClient(SUPABASE_URL, SERVICE_ROLE);

const FROM_EMAIL = "Mi Garaje <avisos@tudominio.com>"; // Debe estar verificado en Resend

function diasHasta(fecha: string | null): number | null {
  if (!fecha) return null;
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  const f = new Date(fecha + "T00:00:00");
  if (isNaN(f.getTime())) return null;
  return Math.round((f.getTime() - hoy.getTime()) / 86400000);
}

serve(async (_req) => {
  try {
    // 1. Obtener todos los vehículos con sus mantenimientos
    const { data: vehicles, error: vErr } = await sb
      .from("vehicles")
      .select("*, mantenimientos(*)");

    if (vErr) throw vErr;

    // 2. Obtener notificaciones ya enviadas hoy (para no duplicar)
    const hoy = new Date().toISOString().slice(0, 10);
    const { data: enviadas } = await sb
      .from("notificaciones_enviadas")
      .select("vehicle_id, tipo")
      .eq("fecha_aviso", hoy);

    const yaEnviado = new Set((enviadas || []).map(e => `${e.vehicle_id}|${e.tipo}`));

    for (const v of vehicles || []) {
      const avisos: { tipo: string; mensaje: string }[] = [];

      // --- ITV (aviso a 30 días) ---
      const dItv = diasHasta(v.itv);
      if (dItv !== null && dItv <= 30 && !yaEnviado.has(`${v.id}|itv`)) {
        avisos.push({
          tipo: "itv",
          mensaje: `La ITV de ${v.matricula} vence el ${v.itv} (en ${dItv} días).`,
        });
      }

      // --- Seguro (aviso a 21 días) ---
      const dSeguro = diasHasta(v.seguro);
      if (dSeguro !== null && dSeguro <= 21 && !yaEnviado.has(`${v.id}|seguro`)) {
        avisos.push({
          tipo: "seguro",
          mensaje: `El seguro de ${v.matricula} vence el ${v.seguro} (en ${dSeguro} días).`,
        });
      }

      // --- Impuesto IVTM (aviso a 30 días) ---
      const dImp = diasHasta(v.impuesto);
      if (dImp !== null && dImp <= 30 && !yaEnviado.has(`${v.id}|impuesto`)) {
        avisos.push({
          tipo: "impuesto",
          mensaje: `El impuesto de circulación (IVTM) de ${v.matricula} vence el ${v.impuesto} (en ${dImp} días).`,
        });
      }

      // --- Revisión por km ---
      if (v.intervalo_revision_km && v.ultima_revision_km) {
        const proxima = Number(v.ultima_revision_km) + Number(v.intervalo_revision_km);
        const kmActual = Number(v.km) || 0;
        const restantes = proxima - kmActual;

        // Aviso si faltan 1000 km o menos (o ya se ha superado)
        if (restantes <= 1000 && !yaEnviado.has(`${v.id}|revision_km`)) {
          avisos.push({
            tipo: "revision_km",
            mensaje: restantes <= 0
              ? `La revisión por km de ${v.matricula} está vencida (superada por ${Math.abs(restantes)} km).`
              : `La revisión por km de ${v.matricula} se acerca: faltan ${restantes} km para la próxima revisión.`,
          });
        }
      }

      // --- Revisiones de mantenimientos con próximo aviso ---
      for (const m of v.mantenimientos || []) {
        if (m.proxima_fecha) {
          const d = diasHasta(m.proxima_fecha);
          if (d !== null && d <= 30 && !yaEnviado.has(`${v.id}|mant_fecha_${m.id}`)) {
            avisos.push({
              tipo: `mant_fecha_${m.id}`,
              mensaje: `Mantenimiento "${m.tipo}" de ${v.matricula}: próximo aviso el ${m.proxima_fecha} (en ${d} días).`,
            });
          }
        }
        if (m.proximo_km) {
          const restantes = Number(m.proximo_km) - (Number(v.km) || 0);
          if (restantes <= 1000 && !yaEnviado.has(`${v.id}|mant_km_${m.id}`)) {
            avisos.push({
              tipo: `mant_km_${m.id}`,
              mensaje: restantes <= 0
                ? `Mantenimiento "${m.tipo}" de ${v.matricula}: superado por ${Math.abs(restantes)} km.`
                : `Mantenimiento "${m.tipo}" de ${v.matricula}: faltan ${restantes} km.`,
            });
          }
        }
      }

      if (avisos.length === 0) continue;

      // 3. Obtener el email del propietario
      const { data: userData, error: uErr } = await sb.auth.admin.getUserById(v.user_id);
      if (uErr || !userData?.user?.email) {
        console.warn(`No se pudo obtener el email del usuario ${v.user_id}`);
        continue;
      }

      // 4. Enviar el email
      const html = `
        <h2>Avisos de mantenimiento — ${v.nombre || v.matricula}</h2>
        <ul>
          ${avisos.map(a => `<li>${a.mensaje}</li>`).join("")}
        </ul>
        <p><a href="https://tu-app.com">Entrar en Mi Garaje</a></p>
      `;

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
        console.error("Error Resend:", await res.text());
        continue;
      }

      // 5. Registrar los avisos enviados
      const registros = avisos.map(a => ({
        vehicle_id: v.id,
        tipo: a.tipo,
        fecha_aviso: hoy,
      }));

      await sb.from("notificaciones_enviadas").insert(registros);
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});