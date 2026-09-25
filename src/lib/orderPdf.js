import { jsPDF } from "jspdf";
import { orderText } from "./orderFlow";

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

  // Table
  const colQty = W - M - 150, colUnit = W - M - 80;
  const header = () => {
    doc.setFillColor(28, 25, 23); doc.rect(M, y - 13, W - 2 * M, 20, "F");
    doc.setTextColor(255); doc.setFont("helvetica", "bold"); doc.setFontSize(10);
    doc.text("Item", M + 8, y); doc.text("Qty", colQty, y, { align: "right" }); doc.text("Unit", colUnit, y);
    doc.setTextColor(0); doc.setFont("helvetica", "normal"); y += 20;
  };
  header();
  const lines = order.lines || [];
  lines.forEach((l, n) => {
    if (y > H - M - 60) { doc.addPage(); y = M + 13; header(); }
    if (n % 2 === 1) { doc.setFillColor(245, 243, 238); doc.rect(M, y - 13, W - 2 * M, 20, "F"); }
    doc.setFontSize(11);
    const name = doc.splitTextToSize(String(l.name || ""), colQty - M - 60)[0];
    doc.text(name, M + 8, y);
    doc.setFont("helvetica", "bold"); doc.text(String(l.qty), colQty, y, { align: "right" }); doc.setFont("helvetica", "normal");
    doc.text(String(l.order_unit || ""), colUnit, y);
    y += 20;
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
  const text = orderText({ order, business, vendor });
  try {
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({ files: [file], title: `${order.vendor} order`, text });
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
