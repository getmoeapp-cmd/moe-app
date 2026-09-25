import { jsPDF } from "jspdf";
import { orderText } from "./orderFlow";
import { orderPhrase } from "./costing";

const safe = (s) => String(s || "").replace(/[^\w-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");

export function orderFileName({ order, business }) {
  const d = new Date(order.date);
  const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  return `${safe(business?.name || "Order")}_${safe(order.vendor)}_${ds}.pdf`;
}

// A one-page (or more) purchase order the supplier's rep can read on a phone.
export function makeOrderPdf({ order, business, vendor }) {
  const doc = new jsPDF({ unit: "pt", format: "letter" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 48;
  let y = M;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text(String(business?.name || "Order").toUpperCase(), M, y);
  y += 18;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(10);
  const addr = [business?.address, [business?.city, business?.state, business?.zip].filter(Boolean).join(" "), business?.phone].filter(Boolean).join(" · ");
  if (addr) { doc.text(addr, M, y); y += 14; }

  y += 10;
  doc.setDrawColor(30); doc.setLineWidth(1.5); doc.line(M, y, W - M, y); y += 26;

  doc.setFont("helvetica", "bold"); doc.setFontSize(15);
  doc.text(`Purchase order — ${order.vendor}`, M, y); y += 18;
  doc.setFont("helvetica", "normal"); doc.setFontSize(10);
  const when = new Date(order.date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  doc.text(`Date: ${when}`, M, y);
  doc.text(`PO #: ${String(order.id).slice(-8).toUpperCase()}`, W - M, y, { align: "right" }); y += 14;
  if (vendor?.repName || vendor?.repEmail || vendor?.repPhone) {
    doc.text(`To: ${[vendor.repName, vendor.repPhone, vendor.repEmail].filter(Boolean).join(" · ")}`, M, y); y += 14;
  }
  doc.text(`Ordered by: ${order.approvedBy || order.orderedBy || "—"}`, M, y); y += 22;

  // How to read it — so a rep never enters pieces as cases.
  doc.setFillColor(255, 247, 214); doc.rect(M, y - 12, W - 2 * M, 30, "F");
  doc.setFontSize(9); doc.setFont("helvetica", "bold");
  doc.text("HOW TO READ THIS ORDER", M + 8, y);
  doc.setFont("helvetica", "normal");
  doc.text("CASE / BAG = one full one, packed as shown under the item.  EACH = single pieces.  \"split case\" = break a case.", M + 8, y + 12);
  y += 36;

  const lines = order.lines || [];
  const hasSku = lines.some((l) => l.vendor_sku);
  const colSku = M + 8;
  const colName = hasSku ? M + 84 : M + 8;
  const colOrder = W - M - 190;
  const header = () => {
    doc.setFillColor(28, 25, 23); doc.rect(M, y - 13, W - 2 * M, 20, "F");
    doc.setTextColor(255); doc.setFont("helvetica", "bold"); doc.setFontSize(10);
    if (hasSku) doc.text("Item #", colSku, y);
    doc.text("Item / pack size", colName, y); doc.text("ORDER", colOrder, y);
    doc.setTextColor(0); doc.setFont("helvetica", "normal"); y += 22;
  };
  header();
  lines.forEach((l, n) => {
    if (y > H - M - 70) { doc.addPage(); y = M + 13; header(); }
    const ph = orderPhrase(l, l.qty, l.each_qty);
    if (n % 2 === 1) { doc.setFillColor(245, 243, 238); doc.rect(M, y - 13, W - 2 * M, 32, "F"); }
    if (hasSku) { doc.setFontSize(9); doc.text(String(l.vendor_sku || ""), colSku, y); }
    doc.setFontSize(11);
    doc.text(doc.splitTextToSize(String(l.name || ""), colOrder - colName - 12)[0], colName, y);
    doc.setFontSize(8.5); doc.setTextColor(90);
    doc.text(doc.splitTextToSize(String(l.pack || l.order_unit || ""), colOrder - colName - 12)[0], colName, y + 12);
    doc.setTextColor(0);
    doc.setFont("helvetica", "bold"); doc.setFontSize(12);
    doc.text(ph.main, colOrder, y);
    doc.setFont("helvetica", "normal"); doc.setFontSize(8.5); doc.setTextColor(90);
    if (ph.detail) doc.text(doc.splitTextToSize(ph.detail, W - M - colOrder - 4)[0], colOrder, y + 12);
    doc.setTextColor(0);
    y += 32;
  });
  y += 6;
  doc.setDrawColor(200); doc.setLineWidth(0.5); doc.line(M, y, W - M, y); y += 18;
  doc.setFont("helvetica", "bold"); doc.text(`${lines.length} item${lines.length === 1 ? "" : "s"}`, M, y);
  doc.setFont("helvetica", "normal");
  if (order.note) {
    y += 22;
    doc.setFont("helvetica", "bold"); doc.text("Notes", M, y); doc.setFont("helvetica", "normal"); y += 14;
    doc.splitTextToSize(order.note, W - 2 * M).forEach((t) => { doc.text(t, M, y); y += 13; });
  }
  doc.setFontSize(8); doc.setTextColor(140);
  doc.text("Sent with MOE — Make Ordering Easy · getmoe.ai", M, H - 28);
  return doc.output("blob");
}

// Phone: opens the share sheet with the PDF attached (Messages, WhatsApp, Mail…).
// Computer: downloads the PDF. Returns "shared" | "downloaded" | "cancelled".
export async function sendOrderPdf({ order, business, vendor }) {
  const blob = makeOrderPdf({ order, business, vendor });
  const name = orderFileName({ order, business });
  const file = new File([blob], name, { type: "application/pdf" });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      // Share the PDF only — no text body, so the rep gets one clean attachment.
      await navigator.share({ files: [file] });
      return "shared";
    }
  } catch (e) {
    if (e && e.name === "AbortError") return "cancelled";
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return "downloaded";
}

export function emailHref({ order, business, vendor }) {
  const subject = `Order — ${business?.name || ""} — ${new Date(order.date).toLocaleDateString("en-US")}`;
  return `mailto:${encodeURIComponent(vendor?.repEmail || "")}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(orderText({ order, business, vendor }) + "\n\n(PDF attached)")}`;
}

export function textHref({ order, business, vendor }) {
  return `sms:${encodeURIComponent(vendor?.repPhone || "")}?&body=${encodeURIComponent(orderText({ order, business, vendor }))}`;
}
