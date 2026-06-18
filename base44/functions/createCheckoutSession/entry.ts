import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import Stripe from 'npm:stripe@17.4.0';

const stripe = new Stripe(Deno.env.get("STRIPE_API_KEY"));

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { price_id, proyecto_id, plan, success_url, cancel_url } = await req.json();

    if (!price_id || !proyecto_id || !plan) {
      return Response.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const mode = plan === 'instalacion' ? 'payment' : 'subscription';

    const session = await stripe.checkout.sessions.create({
      mode,
      customer_email: user.email,
      line_items: [{ price: price_id, quantity: 1 }],
      metadata: { proyecto_id, plan, base44_user_id: user.id },
      success_url: success_url || '',
      cancel_url: cancel_url || '',
    });

    // Save session ID on the project
    await base44.asServiceRole.entities.Proyecto.update(proyecto_id, {
      stripe_session_id: session.id,
    });

    return Response.json({ url: session.url });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});