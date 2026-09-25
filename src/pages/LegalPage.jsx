import { SUPPORT_EMAIL } from "../lib/config";

const PAGES = {
  privacy: {
    title: "Privacy",
    body: [
      "MOE stores what a restaurant enters so the kitchen can sign back in and keep counting: the account (name, email, phone), the restaurant name, suppliers, inventory items, on-hand counts, waste, prices, recipes, and supplier orders.",
      "Sign-in is handled by Supabase Auth. Passwords are stored hashed and are never visible to MOE staff or other restaurants.",
      "Each restaurant's records can only be read by the people on that restaurant's team. Quiz answers stay on this device and are not saved as an account.",
      "If you use invoice or photo import, the image is sent to an AI provider to read the line items and is not kept by MOE.",
      "MOE does not sell kitchen data. To delete your account and data, email us.",
    ],
  },
  terms: {
    title: "Terms",
    body: [
      "MOE (Make Ordering Easy) is a kitchen inventory and supplier-order tool. You count what is on hand, see what is low, and build an order for a supplier.",
      "The savings quiz is an estimate from the ranges you pick. It is not a promise of savings.",
      "A new restaurant gets a 14-day free trial with no card. After the trial, a paid plan keeps the account active. You can cancel any time; your data stays available to export for 30 days.",
      "Placing an order saves it for the kitchen and can print it. You still send that order to your supplier. You are responsible for the counts and the order you place.",
    ],
  },
  contact: {
    title: "Contact",
    body: [
      "Questions, billing, or help setting up your kitchen — email us and a real person will answer.",
    ],
  },
};

export default function LegalPage({ page }) {
  const content = PAGES[page] || PAGES.contact;
  return (
    <main style={{ minHeight: "100vh", background: "#f4f1ea", color: "#1c1917", fontFamily: "Georgia, 'Times New Roman', serif", padding: "32px 20px 64px" }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <a href="/" style={{ color: "#0f766e", fontFamily: "system-ui, sans-serif", fontSize: 14, fontWeight: 700, textDecoration: "none" }}>MOE</a>
        <h1 style={{ fontSize: 36, letterSpacing: "-0.03em", margin: "24px 0 16px" }}>{content.title}</h1>
        {content.body.map((paragraph) => (
          <p key={paragraph} style={{ fontSize: 18, lineHeight: 1.55, margin: "0 0 16px" }}>{paragraph}</p>
        ))}
        {page === "contact" && (
          <p style={{ display: "flex", gap: 16, flexWrap: "wrap", fontFamily: "system-ui, sans-serif" }}>
            <a href={`mailto:${SUPPORT_EMAIL}`} style={{ color: "#0f766e", fontWeight: 700 }}>{SUPPORT_EMAIL}</a>
            <a href="/app?signup=1" style={{ color: "#0f766e", fontWeight: 700 }}>Create an account</a>
            <a href="/app" style={{ color: "#0f766e", fontWeight: 700 }}>Sign in</a>
          </p>
        )}
        <p style={{ marginTop: 32, fontFamily: "system-ui, sans-serif", fontSize: 14 }}>
          <a href="/privacy" style={{ color: "#57534e", marginRight: 16 }}>Privacy</a>
          <a href="/terms" style={{ color: "#57534e", marginRight: 16 }}>Terms</a>
          <a href="/contact" style={{ color: "#57534e" }}>Contact</a>
        </p>
      </div>
    </main>
  );
}
