import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';
import Stripe from 'npm:stripe@17.4.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { plan } = await req.json();

    const apiKey = Deno.env.get("STRIPE_API_KEY");
    console.log("STRIPE_API_KEY starts with:", apiKey?.substring(0, 8));
    
    const stripe = new Stripe(apiKey);

    const PRICE_MAP = {
      pro: Deno.env.get("STRIPE_PRICE_PRO") || "",
      agencia: Deno.env.get("STRIPE_PRICE_AGENCIA") || "",
    };
    
    console.log("Plan requested:", plan);
    console.log("Price ID:", PRICE_MAP[plan]);

    const priceId = PRICE_MAP[plan];
    if (!priceId) {
      return Response.json({ error: "Plan no válido o Price ID no configurado" }, { status: 400 });
    }

    // Check if user already has a Stripe customer ID
    let customerId = user.stripe_customer_id;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: user.email,
        name: user.full_name || undefined,
        metadata: { base44_user_id: user.id },
      });
      customerId = customer.id;
      await base44.asServiceRole.entities.User.update(user.id, { stripe_customer_id: customerId });
    }

    // Get the app's base URL from the request origin
    const origin = req.headers.get("origin") || req.headers.get("referer")?.replace(/\/$/, "") || "";

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "subscription",
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${origin}/planes?success=true`,
      cancel_url: `${origin}/planes?canceled=true`,
      metadata: { base44_user_id: user.id, plan },
    });

    return Response.json({ url: session.url });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});