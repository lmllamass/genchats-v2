import express from 'express';
import Stripe from 'stripe';
import { supabase } from '../server.js';

const router = express.Router();

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY not configured');
  return new Stripe(key);
}

// POST /api/stripe/checkout - Create checkout session
router.post('/checkout', async (req, res) => {
  try {
    const { proyecto_id, user_id, user_email, price_id, tipo } = req.body;
    const stripe = getStripe();

    const { data: cfg } = await supabase.from('config_plataforma').select('stripe_price_id_pro, stripe_price_id_super_pro, stripe_price_id_instalacion').eq('clave', 'plataforma').single();
    const priceId = price_id || (
      tipo === 'instalacion' ? cfg?.stripe_price_id_instalacion :
      tipo === 'super-pro'   ? cfg?.stripe_price_id_super_pro :
                               cfg?.stripe_price_id_pro
    );
    if (!priceId) return res.status(400).json({ error: 'Price ID not configured' });

    const appUrl = process.env.APP_URL || 'http://localhost:5173';
    const session = await stripe.checkout.sessions.create({
      mode: tipo === 'instalacion' ? 'payment' : 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: user_email,
      metadata: {
        proyecto_id: proyecto_id || '',
        user_id: user_id || '',
        tipo: tipo || 'pro',
      },
      success_url: `${appUrl}/activacion?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/planes`,
    });

    res.json({ url: session.url, session_id: session.id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/stripe/verify-session/:session_id - Verify a completed checkout session
router.get('/verify-session/:session_id', async (req, res) => {
  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(req.params.session_id);
    if (!session) return res.status(404).json({ error: 'Session not found' });

    const paid = session.payment_status === 'paid' || session.status === 'complete';
    res.json({
      paid,
      customer_email: session.customer_email,
      session_id: session.id,
      status: session.status,
      payment_status: session.payment_status,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/stripe/portal - Customer portal
router.post('/portal', async (req, res) => {
  try {
    const { customer_id, return_url } = req.body;
    const stripe = getStripe();
    const appUrl = process.env.APP_URL || 'http://localhost:5173';
    const session = await stripe.billingPortal.sessions.create({
      customer: customer_id,
      return_url: return_url || `${appUrl}/mi-cuenta`,
    });
    res.json({ url: session.url });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/stripe/webhook - Stripe webhook
router.post('/webhook', async (req, res) => {
  try {
    const sig = req.headers['stripe-signature'];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) return res.status(500).json({ error: 'STRIPE_WEBHOOK_SECRET not configured' });

    const stripe = getStripe();
    let event;
    try {
      event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
    } catch (err) {
      return res.status(400).json({ error: `Webhook error: ${err.message}` });
    }

    console.log('Stripe event:', event.type);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const proyectoId = session.metadata?.proyecto_id;
      const userId = session.metadata?.user_id;
      const customerEmail = session.customer_email;
      const planAsignado = session.metadata?.tipo === 'super-pro' ? 'super-pro' : 'pro';

      // 1. Update user plan — by user_id or by email
      if (userId) {
        await supabase.from('user_profiles')
          .update({ plan: planAsignado, plan_activated_at: new Date().toISOString() })
          .eq('id', userId)
          .then(null, () => {});
      } else if (customerEmail) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('id')
          .eq('email', customerEmail)
          .single()
          .then(null, () => ({ data: null }));
        if (profile?.id) {
          await supabase.from('user_profiles')
            .update({ plan: planAsignado, plan_activated_at: new Date().toISOString() })
            .eq('id', profile.id)
            .then(null, () => {});
        }
      }

      // 2. Update project estado if proyecto_id was provided
      if (proyectoId) {
        await supabase.from('proyectos').update({
          estado: 'pro_activo',
          stripe_session_id: session.id,
        }).eq('id', proyectoId).then(null, () => {});
      }

      // 3. Send pro activation email
      if (customerEmail) {
        const nombre_negocio = proyectoId
          ? (await supabase.from('proyectos').select('nombre, chatbot_config').eq('id', proyectoId).single()
              .then(r => r.data?.chatbot_config?.nombre_negocio || r.data?.nombre || 'tu negocio')
              .catch(() => 'tu negocio'))
          : 'tu negocio';

        fetch(`http://localhost:${process.env.PORT || 4000}/api/notify/pro-activation`, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: customerEmail, nombre_negocio, proyecto_id: proyectoId || '' })
        }).then(null, () => {});
      }

      console.log(`✅ Plan ${planAsignado} activado para email=${customerEmail} userId=${userId} proyectoId=${proyectoId}`);
    }

    if (event.type === 'customer.subscription.deleted') {
      const sub = event.data.object;
      console.log('Subscription cancelled:', sub.id);
      // TODO: downgrade user plan to free
    }

    res.json({ received: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
