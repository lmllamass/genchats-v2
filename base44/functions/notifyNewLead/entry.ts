import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { notification_email, nombre_negocio, lead, conversation, proyecto_id } = await req.json();

    if (!notification_email) {
      return Response.json({ skipped: true, reason: 'No notification email configured' });
    }

    // Resolve the target email — try notification_email first, fall back to project creator
    let targetEmail = notification_email;
    
    // Check if the notification_email belongs to a registered user, otherwise use the project creator
    if (proyecto_id) {
      try {
        const proyecto = await base44.asServiceRole.entities.Proyecto.get(proyecto_id);
        if (proyecto?.created_by) {
          // SendEmail only works for registered users, so use the project creator's email
          targetEmail = proyecto.created_by;
        }
      } catch (e) {
        console.log('Could not fetch project creator:', e.message);
      }
    }

    const leadName = lead.nombre || 'Visitante anónimo';
    const leadEmail = lead.email || 'No proporcionado';
    const leadPhone = lead.telefono || 'No proporcionado';
    const leadCompany = lead.empresa || '';
    const leadInterests = lead.intereses || '';
    const channel = lead.canal || 'web';

    // Format conversation transcript
    let transcript = '';
    if (conversation && conversation.length > 0) {
      transcript = conversation.map(m => {
        const role = m.role === 'user' ? `👤 ${leadName}` : `🤖 ${nombre_negocio || 'Chatbot'}`;
        return `${role}:\n${m.content}`;
      }).join('\n\n---\n\n');
    }

    const subject = `🔔 Nuevo contacto capturado — ${leadName}`;
    
    const body = `
<div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; background: #f8fafc; padding: 20px;">
  <div style="background: linear-gradient(135deg, #6366f1, #8b5cf6); border-radius: 12px 12px 0 0; padding: 24px; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 20px;">🔔 Nuevo contacto capturado</h1>
    <p style="color: rgba(255,255,255,0.8); margin: 8px 0 0; font-size: 14px;">${nombre_negocio || 'Tu chatbot'}</p>
  </div>
  
  <div style="background: white; padding: 24px; border: 1px solid #e2e8f0; border-top: none;">
    <h2 style="margin: 0 0 16px; font-size: 16px; color: #1e293b;">Datos del contacto</h2>
    <table style="width: 100%; border-collapse: collapse;">
      <tr>
        <td style="padding: 8px 12px; background: #f1f5f9; border-radius: 6px 0 0 0; font-weight: 600; color: #475569; font-size: 13px; width: 120px;">Nombre</td>
        <td style="padding: 8px 12px; background: #f1f5f9; border-radius: 0 6px 0 0; color: #1e293b; font-size: 13px;">${leadName}</td>
      </tr>
      <tr>
        <td style="padding: 8px 12px; font-weight: 600; color: #475569; font-size: 13px;">Email</td>
        <td style="padding: 8px 12px; color: #1e293b; font-size: 13px;">${leadEmail}</td>
      </tr>
      <tr>
        <td style="padding: 8px 12px; background: #f1f5f9; font-weight: 600; color: #475569; font-size: 13px;">Teléfono</td>
        <td style="padding: 8px 12px; background: #f1f5f9; color: #1e293b; font-size: 13px;">${leadPhone}</td>
      </tr>
      ${leadCompany ? `<tr>
        <td style="padding: 8px 12px; font-weight: 600; color: #475569; font-size: 13px;">Empresa</td>
        <td style="padding: 8px 12px; color: #1e293b; font-size: 13px;">${leadCompany}</td>
      </tr>` : ''}
      <tr>
        <td style="padding: 8px 12px; ${leadCompany ? 'background: #f1f5f9;' : ''} font-weight: 600; color: #475569; font-size: 13px;">Canal</td>
        <td style="padding: 8px 12px; ${leadCompany ? 'background: #f1f5f9;' : ''} color: #1e293b; font-size: 13px;">${channel}</td>
      </tr>
    </table>

    ${leadInterests ? `<div style="margin-top: 16px; padding: 12px; background: #eff6ff; border-radius: 8px; border-left: 3px solid #6366f1;">
      <strong style="font-size: 12px; color: #475569;">Intereses detectados:</strong>
      <p style="margin: 4px 0 0; font-size: 13px; color: #1e293b;">${leadInterests}</p>
    </div>` : ''}

    ${transcript ? `<h2 style="margin: 24px 0 12px; font-size: 16px; color: #1e293b;">Transcripción de la conversación</h2>
    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; font-size: 13px; line-height: 1.6; color: #334155; white-space: pre-wrap;">${transcript.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')}</div>` : ''}
  </div>
  
  <div style="text-align: center; padding: 16px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px; background: white;">
    <p style="margin: 0; font-size: 11px; color: #94a3b8;">Enviado automáticamente por GenChats IA</p>
  </div>
</div>`;

    await base44.asServiceRole.integrations.Core.SendEmail({
      to: targetEmail,
      subject,
      body,
      from_name: nombre_negocio ? `${nombre_negocio} (GenChats IA)` : 'GenChats IA',
    });

    return Response.json({ sent: true });
  } catch (error) {
    console.error('notifyNewLead error:', error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});