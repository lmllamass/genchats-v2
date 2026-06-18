import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import Stripe from 'npm:stripe@17.4.0';

const stripe = new Stripe(Deno.env.get("STRIPE_API_KEY"));
const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

// Reverse map: Price ID -> plan name
const PRICE_TO_PLAN = {};
if (Deno.env.get("STRIPE_PRICE_PRO")) PRICE_TO_PLAN[Deno.env.get("STRIPE_PRICE_PRO")] = "pro";
if (Deno.env.get("STRIPE_PRICE_AGENCIA")) PRICE_TO_PLAN[Deno.env.get("STRIPE_PRICE_AGENCIA")] = "agencia";

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const body = await req.text();
    const signature = req.headers.get("stripe-signature");

    let event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    } catch (err) {
      console.error("Webhook signature verification failed:", err.message);
      return Response.json({ error: "Invalid signature" }, { status: 400 });
    }

    console.log("Stripe event:", event.type);

    if (event.type === "checkout.session.completed") {
      const session = event.data.object;
      const userId = session.metadata?.base44_user_id;
      const plan = session.metadata?.plan;
      if (userId && plan) {
        const user = await base44.asServiceRole.entities.User.get(userId);
        await base44.asServiceRole.entities.User.update(userId, {
          plan,
          stripe_customer_id: session.customer,
          stripe_subscription_id: session.subscription,
        });
        console.log(`User ${userId} upgraded to ${plan}`);

        // If upgrading to pro or agencia, notify admin to set up channels for user's projects
        if (plan === "pro" || plan === "agencia") {
          try {
            const proyectos = await base44.asServiceRole.entities.Proyecto.filter({ created_by: user.email });
            for (const p of proyectos) {
              if (p.chatbot_config && !p.agent_name) {
                // Mark as pending and send notification
                await base44.asServiceRole.entities.Proyecto.update(p.id, { agent_name: "pending" });
                await base44.asServiceRole.integrations.Core.SendEmail({
                  to: "info@konkabeza.es",
                  subject: `🚀 Nuevo Pro: Activar canales para "${p.nombre}"`,
                  body: `<h2>Activación automática por suscripción Pro</h2>
<p><strong>Usuario:</strong> ${user.full_name || user.email}</p>
<p><strong>Proyecto:</strong> ${p.nombre} (ID: ${p.id})</p>
<p><strong>Negocio:</strong> ${p.chatbot_config?.nombre_negocio || 'N/A'}</p>
<p><strong>URL:</strong> ${p.url_origen}</p>
<p><strong>Nombre agente sugerido:</strong> chatbot_${p.id}</p>`,
                });
                console.log(`Channel activation requested for project ${p.nombre}`);
              }
            }
          } catch (notifyErr) {
            console.error("Error notifying for channel activation:", notifyErr.message);
          }
        }
      }
    }

    if (event.type === "customer.subscription.updated") {
      const subscription = event.data.object;
      const customerId = subscription.customer;

      // Find user by stripe_customer_id
      const users = await base44.asServiceRole.entities.User.filter({ stripe_customer_id: customerId });
      if (users.length > 0) {
        const user = users[0];
        const priceId = subscription.items?.data?.[0]?.price?.id;
        const newPlan = PRICE_TO_PLAN[priceId] || user.plan;
        const isActive = subscription.status === "active" || subscription.status === "trialing";

        await base44.asServiceRole.entities.User.update(user.id, {
          plan: isActive ? newPlan : "free",
          stripe_subscription_id: subscription.id,
        });
        console.log(`User ${user.id} subscription updated to ${newPlan}, active: ${isActive}`);
      }
    }

    if (event.type === "customer.subscription.deleted") {
      const subscription = event.data.object;
      const customerId = subscription.customer;

      const users = await base44.asServiceRole.entities.User.filter({ stripe_customer_id: customerId });
      if (users.length > 0) {
        await base44.asServiceRole.entities.User.update(users[0].id, {
          plan: "free",
          stripe_subscription_id: null,
        });
        console.log(`User ${users[0].id} subscription cancelled, reverted to free`);
      }
    }

    return Response.json({ received: true });
  } catch (error) {
    console.error("Webhook error:", error.message);
    return Response.json({ error: error.message }, { status: 500 });
  }
});