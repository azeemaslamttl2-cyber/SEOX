import Stripe from "stripe";

export function getStripe(env) {
  if (!env.STRIPE_SECRET_KEY) {
    const error = new Error("Stripe secret key is not configured");
    error.status = 500;
    throw error;
  }

  return new Stripe(env.STRIPE_SECRET_KEY, {
    httpClient: Stripe.createFetchHttpClient(),
  });
}
