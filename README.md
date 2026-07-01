# Black-Scholes Option Pricing Webapp

This repository is a `Next.js` application for Black-Scholes pricing, Greeks analysis, and MongoDB-backed
persistence.

The app provides:

- Google sign-in for user accounts
- Yahoo Finance historical data refreshes for market inputs
- MongoDB-backed market snapshots per user and symbol
- User-scoped saved Black-Scholes calculations
- A profile page for account details

## Stack

- `Next.js`
- `React`
- `TypeScript`
- `MongoDB`
- `Mongoose`
- `Auth.js` with Google OAuth and JWT sessions
- Yahoo Finance chart API for daily historical prices

## Environment variables

Copy the placeholders into real values in `.env.local`:

```env
MONGODB_URI=your_mongodb_connection_string_here
MONGODB_DB_NAME=black_scholes_app
AUTH_SECRET=replace_with_a_long_random_secret
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=replace_with_a_long_random_secret
AUTH_GOOGLE_ID=replace_with_google_oauth_client_id
AUTH_GOOGLE_SECRET=replace_with_google_oauth_client_secret
```

## Google OAuth setup

1. Create OAuth credentials in Google Cloud Console.
2. Make sure the OAuth client type is `Web application`.
3. Add an authorized redirect URI for your app.
4. Put the Google client ID and client secret into `.env.local`.

For local development, the callback URL used by Auth.js will be under your app origin, for example:

```text
http://localhost:3000/api/auth/callback/google
```

If Google shows `Error 401: invalid_client`, the usual causes are:

- the client ID in `.env.local` is still a placeholder
- the client secret in `.env.local` is still a placeholder
- the OAuth client was created with the wrong app type
- the redirect URI in Google Cloud does not exactly match your callback URL

## Installation

```bash
npm install
```

## Run locally

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

## How to use the app

1. Sign in with Google.
2. Enter a Yahoo Finance symbol such as `AAPL` or `RELIANCE.NS`.
3. Click `Refresh Yahoo Data`.
4. The app pulls the latest available daily history, stores it in MongoDB, and applies the latest close and
   annualized realized volatility to the pricing inputs.
5. Adjust strike, expiry, rate, or side as needed.
6. Click `Save to MongoDB` to persist the calculation and its market-data context.

## Main routes

- `/` - pricing dashboard
- `/profile` - signed-in account summary
- `/api/auth/*` - Auth.js handlers
- `/api/calculations` - user-scoped saved calculations
- `/api/market-data` - Yahoo Finance refresh and stored market snapshots

## Available scripts

```bash
npm run dev
npm run build
npm run start
```

## Mongo setup notebook

Use the notebook at [notebooks/init_mongodb.ipynb](/Users/manishsm/Desktop/Personal/personal_projects/BlackScholesOptionPricing/notebooks/init_mongodb.ipynb) to initialize the MongoDB database structure once.

Notebook flow:

```bash
python3 -m pip install pymongo
jupyter notebook
```

Then open `notebooks/init_mongodb.ipynb` and run the cells in order.

The notebook:

- reads `MONGODB_URI` from `.env.local` by default
- uses `MONGODB_DB_NAME` when the URI does not include a database path
- creates the collections used by the app if they do not exist
- applies JSON schema validators
- creates the indexes used by the app

Editable notebook variables:

```python
URI_OVERRIDE = None
DB_NAME_OVERRIDE = None
DROP_EXISTING = False
```

## Project structure

```text
src/
  app/
    api/
    profile/
  components/
    auth/
    layout/
    pricing/
    profile/
  lib/
    db/
      models/
    finance/
    services/
  types/
  auth.ts
notebooks/
  init_mongodb.ipynb
```
