# ShopFlow Pro

Shop Invoice & Job Management App

Overview

Build a mobile-responsive web application for a small business (job-work/fabrication shop in Tamil Nadu, India) to manage customers, track jobs, generate GST-compliant tax invoices, record payments/advances, and view financial analytics. No dedicated backend server — Firebase (Firestore + Authentication) is the entire backend. The app must be deployable as a static site on GitHub Pages.

Tech Stack Requirements

Frontend: React (or Next.js configured for static export)

Backend: Firebase Firestore (database) + Firebase Authentication (login)

Hosting target: GitHub Pages (must work as a static export — no server-only features)

PDF generation: client-side only (e.g., jsPDF or react-to-print) — no server-side PDF rendering

No use of Firebase Cloud Functions (not on the free Spark plan)

Fully responsive — must work well on mobile browsers, not just desktop

Authentication

Firebase Authentication with Email/Password and Google Sign-In

Single shop owner login (not multi-tenant, not multi-company) — this is for one business only

Firestore Security Rules must ensure only the authenticated shop owner can read/write data (no public access to any collection)

Data Model

1. shopProfile (single document)

businessName, address, GSTIN, state, stateCode

bankName, accountNumber, branch, IFSC code

authorisedSignatoryName

2. customers (collection)

name, address, GSTIN (optional), state, stateCode, phone, email

runningBalance (computed/maintained field — amount customer owes)

3. jobs (collection)

description, customerId (reference to customers)

dateCreated, dateCompleted

status: "In Progress" | "Completed"

invoiceId: reference to an invoice, or null/empty if not yet invoiced

This enables a query/view: "jobs where status = Completed AND invoiceId is empty" = jobs pending invoicing

4. invoices (collection)

Fields based on a real Indian GST tax invoice format:

invoiceNo, invoiceDate

customerId (reference to customers)

deliveryNote, paymentTerms, supplierRef, otherRef

buyerOrderNo, buyerOrderDate

despatchDocNo, despatchThrough, destination, deliveryTerms

lineItems: array of { slNo, description, hsnSacCode, quantity, unit, ratePerUnit, amount }

taxableValue (sum of line item amounts)

taxType: "CGST_SGST" | "IGST" — auto-determined by comparing shop's state to customer's state (same state = CGST+SGST, different state = IGST)

cgstRate, cgstAmount, sgstRate, sgstAmount (used when taxType = CGST_SGST)

igstRate, igstAmount (used when taxType = IGST)

roundOff (calculated field)

totalAmount (calculated field, final amount after tax and round-off)

amountInWords — generate dynamically from totalAmount using a number-to-words function; do NOT store as static text

status: "Draft" | "Sent" | "Paid"

createdAt

5. payments (collection)

customerId (reference to customers)

amount, date

type: "Advance" | "Full Payment" | "Balance Payment"

linkedInvoiceId (reference to invoices, optional — advances may not be linked to a specific invoice yet)

Feature Requirements

Invoice Management

Create, view, edit, delete invoices

Line items support (add/remove multiple rows, auto-calculate amount = quantity × rate)

Auto-calculate CGST/SGST or IGST based on comparing shop state vs. customer state

Auto-calculate round-off and final total

Generate amount-in-words automatically from the total

Generate a print-ready PDF matching a standard Indian GST tax invoice layout (reference layout: seller details with GSTIN at top, buyer details below, itemized table with HSN/SAC codes, tax breakdown table, amount in words, bank details and signatory at the bottom)

Invoice status lifecycle: Draft → Sent → Paid

No share-link or link-expiry feature needed — this is explicitly NOT required

Customer Management

Add, view, edit, delete customers

Show each customer's running balance (total owed based on invoices minus payments)

View a customer's full invoice and payment history

Job Tracking

Add, view, edit jobs, independent from invoices

Mark a job "Completed"

Dashboard view specifically showing: jobs marked Completed that do NOT yet have an invoice created — this is a critical feature, not optional

Ability to generate an invoice directly from a completed job (pre-fills customer and description)

Payments / Advances

Record a payment against a customer, with type (Advance / Full Payment / Balance Payment)

Ability to link a payment to a specific invoice, or leave unlinked (for advances taken before an invoice exists)

Customer balance must correctly reflect invoices raised minus payments received

Analytics Dashboard

Total pending (unpaid) amount for the current month

Count/list of jobs completed but not yet invoiced

Total advances received and not yet adjusted against an invoice

Month-on-month balance sheet view: for each month, show total invoiced, total received, and outstanding balance

All calculations should be done client-side by fetching relevant documents (Firestore is not used for SQL-style aggregation) — this is fine at small-business scale

Manual Data Import (Handwritten Bills Workflow)

Include a simple "Import from JSON" feature: a text box where the user can paste a JSON object (generated externally by pasting a photo of a handwritten bill into an AI chat tool) representing an invoice, which the app parses and pre-fills into the invoice creation form

Define and document the expected JSON shape clearly, e.g.:

{
  "customerName": "string",
  "date": "YYYY-MM-DD",
  "items": [{ "description": "string", "quantity": 0, "rate": 0 }],
  "notes": "string (optional)"
}


This is a manual paste-in workflow only — do NOT build any direct image upload, OCR, or AI vision API integration into the app itself (avoids exposing API keys in a serverless/static frontend)

Google Sheets Migration

Not a feature of the app itself, but the data model above should be clean enough to support a one-time import script (CSV or JSON) to bring in existing invoice/customer history from Google Sheets

Explicit Non-Requirements (do not build these)

No share-links or expiring links for clients

No direct AI/OCR image-to-invoice feature inside the app

No multi-company or multi-tenant support — single business only

No Firebase Cloud Functions or any paid-tier Firebase feature

No native mobile app — a responsive website is sufficient

Deployment Notes

Must be buildable as a static site compatible with GitHub Pages hosting via GitHub Actions

Firebase config values should be handled via environment variables / GitHub Secrets, not hardcoded

Provide Firestore Security Rules ensuring only the authenticated owner can access data, and structure rules to scope access per-collection appropriately

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://biz-billing-master.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/07099275-4cfb-4174-9421-178c7847cda7).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
