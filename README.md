# SunriseEdits2026 — Free Collab + Premium + Razorpay Test Mode (v5)

This package connects the Premium flow to Razorpay Test Mode through two Supabase Edge Functions.

## 1. Configure `config.js`
Replace only:
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

Keep all secrets out of browser files.

## 2. Supabase database
If the v4 schema is already installed, run the **Razorpay payment tracking fields + policy** section at the bottom of `supabase-schema.sql` in Supabase SQL Editor. The full file is safe to run as a migration because it uses `if not exists` and replaces the public insert policy.

## 3. Edge Functions already deployed
The website expects these exact function names:
- `create-razorpay-order`
- `verify-razorpay-payment`

In Supabase Edge Function Secrets, keep:
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`

Never put `RAZORPAY_KEY_SECRET` in this package or browser code.

## 4. Razorpay Test Mode
The frontend uses the Razorpay Checkout script and the Test Key ID. Premium price is read server-side from `templates.premium_price`; the browser cannot choose the amount.

## 5. Test flow
1. Set a Premium Price for a template in `admin.html`.
2. Open `index.html`.
3. Choose a template and Premium.
4. Fill customer details and upload the exact required files.
5. Submit; the site creates a pending order, uploads files, and opens Razorpay Test Checkout.
6. Complete a Razorpay test payment.
7. The verification Edge Function checks the signature, Razorpay order, amount, currency, payment order relationship, and captured status.
8. Only then is `orders.payment_status` changed to `paid`.

## 6. Security
- Razorpay Secret is server-side only.
- Client never sends the Premium amount to the payment function.
- Payment status cannot be inserted as `paid` by anonymous customers.
- Admin reads payment status from Supabase.

## 7. Important
This is Test Mode. Do not use the test Key ID for real customer payments. Switch to Live Mode only after the complete test flow works and your Razorpay account is approved for live payments.


## Order submission fix (v6)
Customer order creation now uses a validated Supabase SECURITY DEFINER RPC (`create_customer_order`) instead of a direct anonymous INSERT. This avoids requiring public SELECT privileges on `orders` and keeps RLS enabled. Run the appended SQL migration in Supabase SQL Editor once before deploying the updated files.

## IMPORTANT — SQL migration
Use the included `supabase-schema.sql`. The starter-template price values are explicitly cast to numeric so the migration works with the existing `templates.price` column. Run the SQL once in Supabase SQL Editor. Do not disable RLS.
