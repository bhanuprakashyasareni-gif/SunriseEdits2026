# SunriseEdits2026 — Google Orders + Photo Upload

This version keeps the existing SunriseEdits2026 website/catalog design and sends customer order details to Google Sheets. After an order is saved, the customer is redirected to a Google Form where the Order ID is automatically pre-filled and the customer uploads photos.

## Current flow
Website → Google Apps Script → Google Sheet → pre-filled Google Form → Google Drive

## Google Apps Script Web App
The website is configured to use this Web App endpoint:
https://script.google.com/macros/s/AKfycbyKO-QEMcJ3ji3cX4WMoxfvDSlP9ljZijCCIAWKUK5rlcysGr6G8oaeY2GNIDKafVYB/exec

The same Apps Script source is included in `google-apps-script.gs` for reference.

## Google Form
The website opens the Photo Upload form with the Order ID pre-filled using the Order ID entry field.

Form:
https://docs.google.com/forms/d/e/1FAIpQLSfaYHfDHedAgOYEK6fRBfCxOSbHSTzM8zDraG8NEjGgsweBrg/viewform

Order ID entry field:
`entry.1397652216`

## Google Sheet columns
Create the first row as:
Order ID | Date | Name | Mobile | Email | Instagram | Template | Plan | Song | Requirements

## Important
- Google Forms file upload requires the responder to sign in to a Google Account.
- Do not share customer Drive files publicly.
- The Apps Script endpoint is intentionally used with a browser `no-cors` POST, so the website cannot inspect the response. After a successful-looking submission it opens the upload form; verify the first test order appears in the Sheet before going live.
- The website still uses Supabase for the template catalogue/admin template management. This change replaces the customer order-record and photo-upload backend only.
