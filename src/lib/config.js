// Public Supabase client settings. CRA inlines REACT_APP_* at build time.
// The fallbacks are the anon key and URL already shipped in the classic client
// bundle so an existing Vercel deploy keeps working before env vars are set.
// Override them in the host environment; do not put the service role key here.

export const SUPABASE_URL =
  process.env.REACT_APP_SUPABASE_URL || "https://fsvlxosbbevzyvegbqry.supabase.co";

export const SUPABASE_ANON_KEY =
  process.env.REACT_APP_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZzdmx4b3NiYmV2enl2ZWdicXJ5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0NzQ2MjgsImV4cCI6MjA4OTA1MDYyOH0.AcnnB4QecNHEu3-N_VS6aPHrpt9kq464arjNc2DNugU";

export const TRIAL_DAYS = 14;

// Where "contact us" and "subscribe" links go. Set up this mailbox (or change it) before launch.
export const SUPPORT_EMAIL = process.env.REACT_APP_SUPPORT_EMAIL || "hello@getmoe.ai";

export const DEMO_GROUPS = ["demo"];

export const PLANS = [
  { id: "starter", name: "Starter", price: 299 },
  { id: "pro", name: "Pro", price: 399 },
  { id: "enterprise", name: "Enterprise", price: 499 },
];
