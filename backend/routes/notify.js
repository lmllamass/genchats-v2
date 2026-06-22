import express from 'express';
import { Resend } from 'resend';
import { supabase } from '../server.js';

const router = express.Router();

function getResend() {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error('RESEND_API_KEY not configured');
  return new Resend(key);
}

function getFrom() {
  const addr = process.env.RESEND_FROM_EMAIL || 'noreply@genchats.app';
  return `GenChat IA <${addr}>`;
}

// POST /api/notify/lead
router.post('/lead', async (req, res) => {
  try {
    const { notification_email, nombre_negocio, lead, proyecto_id } = req.body;
    if (!notification_email) return res.json({ ok: true });

    const resend = getResend();

    await resend.emails.send({
      from: getFrom(),
      to: notification_email,
      subject: `🎯 Nuevo lead en ${nombre_negocio}`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px">
          <div style="background:linear-gradient(135deg,#7c3aed,#2563eb);padding:24px;border-radius:12px;margin-bottom:24px">
            <h2 style="color:white;margin:0">🎯 Nuevo lead capturado</h2>
          </div>
          <p><strong>Negocio:</strong> ${nombre_negocio}</p>
          ${lead.nombre ? `<p><strong>Nombre:</strong> ${lead.nombre}</p>` : ''}
          ${lead.email ? `<p><strong>Email:</strong> ${lead.email}</p>` : ''}
          ${lead.telefono ? `<p><strong>Teléfono:</strong> ${lead.telefono}</p>` : ''}
          ${lead.empresa ? `<p><strong>Empresa:</strong> ${lead.empresa}</p>` : ''}
          ${lead.intereses ? `<p><strong>Intereses:</strong> ${lead.intereses}</p>` : ''}
          <p><strong>Canal:</strong> ${lead.canal || 'web'}</p>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
          <p style="color:#9ca3af;font-size:12px">Notificación automática de GenChat IA</p>
        </div>
      `,
    });

    res.json({ ok: true });
  } catch (err) {
    console.error('notify/lead error:', err.message);
    res.json({ ok: false, error: err.message });
  }
});

// POST /api/notify/pro-activation
router.post('/pro-activation', async (req, res) => {
  try {
    const { email, nombre_negocio, proyecto_id } = req.body;
    if (!email) return res.json({ ok: true });

    const resend = getResend();

    await resend.emails.send({
      from: getFrom(),
      to: email,
      subject: `🚀 Tu chatbot Pro está activado — ${nombre_negocio}`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px">
          <div style="background:linear-gradient(135deg,#7c3aed,#2563eb);padding:24px;border-radius:12px;margin-bottom:24px">
            <h2 style="color:white;margin:0">🎉 ¡Tu chatbot Pro está activado!</h2>
          </div>
          <p>El chatbot de <strong>${nombre_negocio}</strong> ya está funcionando en modo Pro.</p>
          <p>Ahora tienes acceso a:</p>
          <ul style="line-height:2">
            <li>✅ Chatbot WhatsApp Business ilimitado</li>
            <li>✅ Captura automática de leads</li>
            <li>✅ Integración con tu catálogo de productos</li>
          </ul>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
          <p style="color:#9ca3af;font-size:12px">GenChat IA — genchats.app</p>
        </div>
      `,
    });

    res.json({ ok: true });
  } catch (err) {
    console.error('notify/pro-activation error:', err.message);
    res.json({ ok: false, error: err.message });
  }
});

// POST /api/notify/whatsapp-request
// Sent when a Pro user requests WhatsApp setup. Notifies admin to configure ycloud/Meta.
router.post('/whatsapp-request', async (req, res) => {
  try {
    const { user_name, user_email, proyecto_nombre, proyecto_id } = req.body;
    if (!user_email) return res.json({ ok: true });

    const resend = getResend();
    const adminEmail = process.env.ADMIN_EMAIL || 'info@konkabeza.es';
    const appUrl = process.env.APP_URL || 'https://v2.genchats.app';

    await resend.emails.send({
      from: getFrom(),
      to: adminEmail,
      subject: `📲 Solicitud WhatsApp — ${user_name || user_email}`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px">
          <div style="background:linear-gradient(135deg,#16a34a,#15803d);padding:24px;border-radius:12px;margin-bottom:24px">
            <h2 style="color:white;margin:0">📲 Nueva solicitud de conexión WhatsApp</h2>
          </div>
          <p>Un usuario con plan Pro solicita configuración de WhatsApp Business.</p>
          <table style="border-collapse:collapse;width:100%;margin:16px 0">
            <tr><td style="padding:8px 0;color:#6b7280;width:140px">Usuario</td><td style="padding:8px 0;font-weight:600">${user_name || '—'}</td></tr>
            <tr><td style="padding:8px 0;color:#6b7280">Email</td><td style="padding:8px 0;font-weight:600">${user_email}</td></tr>
            <tr><td style="padding:8px 0;color:#6b7280">Proyecto</td><td style="padding:8px 0;font-weight:600">${proyecto_nombre || '—'}</td></tr>
            <tr><td style="padding:8px 0;color:#6b7280">ID proyecto</td><td style="padding:8px 0;font-family:monospace;font-size:13px">${proyecto_id || '—'}</td></tr>
          </table>
          <p style="margin-top:24px">Acciones pendientes:</p>
          <ul style="line-height:2;color:#374151">
            <li>Configurar número YCloud (hasta obtener número agencia Meta)</li>
            <li>Activar WhatsApp en <a href="${appUrl}/admin/proyectos/${proyecto_id}" style="color:#7c3aed">panel admin del proyecto</a></li>
            <li>Notificar al usuario cuando esté activo</li>
          </ul>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
          <p style="color:#9ca3af;font-size:12px">GenChat IA — genchats.app</p>
        </div>
      `,
    });

    res.json({ ok: true });
  } catch (err) {
    console.error('notify/whatsapp-request error:', err.message);
    res.json({ ok: false, error: err.message });
  }
});

// POST /api/notify/retell-request
// Sent when a Super Pro user requests Retell voice agent setup.
router.post('/retell-request', async (req, res) => {
  try {
    const { user_name, user_email, proyecto_nombre, proyecto_id } = req.body;
    if (!user_email) return res.json({ ok: true });

    const resend = getResend();
    const adminEmail = process.env.ADMIN_EMAIL || 'info@konkabeza.es';
    const appUrl = process.env.APP_URL || 'https://v2.genchats.app';

    await resend.emails.send({
      from: getFrom(),
      to: adminEmail,
      subject: `🎙️ Solicitud Voz IA (Retell) — ${user_name || user_email}`,
      html: `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:32px">
          <div style="background:linear-gradient(135deg,#7c3aed,#4f46e5);padding:24px;border-radius:12px;margin-bottom:24px">
            <h2 style="color:white;margin:0">🎙️ Nueva solicitud de Voz IA (Retell)</h2>
          </div>
          <p>Un usuario con plan Super Pro solicita configuración de agente de voz con Retell.</p>
          <table style="border-collapse:collapse;width:100%;margin:16px 0">
            <tr><td style="padding:8px 0;color:#6b7280;width:140px">Usuario</td><td style="padding:8px 0;font-weight:600">${user_name || '—'}</td></tr>
            <tr><td style="padding:8px 0;color:#6b7280">Email</td><td style="padding:8px 0;font-weight:600">${user_email}</td></tr>
            <tr><td style="padding:8px 0;color:#6b7280">Proyecto</td><td style="padding:8px 0;font-weight:600">${proyecto_nombre || '—'}</td></tr>
            <tr><td style="padding:8px 0;color:#6b7280">ID proyecto</td><td style="padding:8px 0;font-family:monospace;font-size:13px">${proyecto_id || '—'}</td></tr>
          </table>
          <p style="margin-top:24px">Acciones pendientes:</p>
          <ul style="line-height:2;color:#374151">
            <li>Crear agente en <a href="https://dashboard.retellai.com" style="color:#7c3aed">Retell Dashboard</a> con el system prompt del proyecto</li>
            <li>Asignar número de teléfono Retell al agente</li>
            <li>Activar en <a href="${appUrl}/admin/proyectos/${proyecto_id}" style="color:#7c3aed">panel admin del proyecto</a> (campos retell_agent_id, retell_phone_number, retell_activo)</li>
            <li>Notificar al usuario cuando esté activo</li>
          </ul>
          <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0"/>
          <p style="color:#9ca3af;font-size:12px">GenChat IA — genchats.app</p>
        </div>
      `,
    });

    res.json({ ok: true });
  } catch (err) {
    console.error('notify/retell-request error:', err.message);
    res.json({ ok: false, error: err.message });
  }
});

export default router;
