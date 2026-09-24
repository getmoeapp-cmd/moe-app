const PAGES = {
  privacy: {
    title: "Privacy",
    body: [
      "MOE stores what a restaurant enters so the same kitchen can sign back in and keep counting.",
      "That includes the account (name, email, phone, and password), the restaurant name, suppliers, inventory items, on-hand counts, and supplier orders. The password is saved with the restaurant account. There is no separate login provider.",
      "Those records live in the Supabase project this app is configured to use. The browser uses that project's public anon key. Quiz answers stay on this device for the visit and are not saved as an account.",
      "Choosing a plan records the plan on the restaurant. This version does not collect a card number.",
      "MOE does not sell kitchen data.",
    ],
  },
  terms: {
    title: "Terms",
    body: [
      "MOE (Make Ordering Easy) is a kitchen inventory and supplier-order list. You count what is on hand, see what is low, and build an order for a supplier.",
      "The savings quiz is an estimate from the ranges you pick. The monthly lines add up to the monthly total, and the yearly figure is that monthly total times 12. It is not a promise of savings.",
      "A new restaurant can start a 14-day trial from the quiz. Selecting a plan marks the account active. This version does not charge a card.",
      "Placing an order saves it for the kitchen and can print it. You still send that order to your supplier. You are responsible for the counts and the order you place.",
    ],
  },
  contact: {
    title: "Contact",
    body: [
      "This site does not publish a support inbox.",
      "Create a restaurant account to start a trial, or sign in if you already have one. The kitchen is stock, low items, and a supplier order.",
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
