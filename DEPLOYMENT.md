# ShopLedger setup

1. Create a Firebase project and a Web app. Copy its web configuration into the matching variables in `.env.example`; use a local `.env.local` (never commit it) for local development.
2. Enable Email/Password and Google in Firebase Authentication. Create the single owner's account in the Firebase console. There is intentionally no public sign-up screen.
3. Create Firestore in production mode. Replace `REPLACE_WITH_OWNER_UID` in `firestore.rules` with that account's UID, then publish the rules in the Firebase console. Until replaced, these rules deny everybody. Do not use blanket authenticated-user rules.
4. Add your GitHub Pages hostname and preview hostname to Authentication → Authorized domains. Sign-in methods and security rules have not been deployed or verified by this project.
5. In your GitHub repository, add the six `VITE_FIREBASE_*` values as Actions secrets. These web configuration values identify the Firebase app; the deployed Firestore rules provide security.
6. Add repository Actions variable `VITE_BASE_PATH`: `/<repository>/` for a project Pages site, or `/` for a root site/custom domain. Set Pages → Source to GitHub Actions, then run the included workflow.

The workflow publishes only the generated static files, never a server. `404.html` contains the SPA shell so GitHub Pages can open deep links (GitHub will still return HTTP 404 for unknown paths). No Cloud Functions are used. The Lovable published address is separate from GitHub Pages.

## Before using real invoices

Enter the shop's legal name, GSTIN, state and bank details. Add a customer, complete a job, create an invoice, and verify taxes and the downloaded PDF. This version supports a single GST rate per invoice. Use separate invoices when different rates apply. Invoice numbering is checked against loaded records; avoid simultaneous invoice creation from multiple tabs.

Payment entry, expanded financial analytics and JSON import remain deferred. Marking an invoice Paid changes the status only; it does not create a payment. Customer balances remain based on recorded non-draft invoices minus payment records.
