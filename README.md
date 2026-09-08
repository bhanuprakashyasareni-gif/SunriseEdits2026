# SunriseEdits2026 — Google Orders + Premium Razorpay

Customer flow:
- Free: Website → Google Sheet → pre-filled Google Photo Form → Google Drive
- Premium: Website → Supabase payment-tracking RPC → Razorpay Test Checkout → payment verification → Google Sheet → pre-filled Google Photo Form → Google Drive

IMPORTANT: The Supabase SECURITY DEFINER RPC `create_customer_order(...)` must exist. The corrected RPC is included in `supabase-schema.sql`.

Google Apps Script endpoint:
https://script.google.com/macros/s/AKfycbyKO-QEMcJ3ji3cX4WMoxfvDSlP9ljZijCCIAWKUK5rlcysGr6G8oaeY2GNIDKafVYB/exec

Google Form Order ID field:
entry.1397652216

The website also accepts a Supabase template preview URL or a template-previews storage path and builds a public storage URL automatically.
