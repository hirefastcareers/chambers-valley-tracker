"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toWhatsAppInternational, formatDateDDMMYYYY } from "@/lib/format";

type DropdownCustomer = { id: number; name: string; phone?: string | null; address?: string | null; email?: string | null };

type LineItemDraft = { id: string; description: string; price: string };

export default function QuoteSheet() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();

  const open = searchParams.get("quote") === "1";
  const editCustomerId = searchParams.get("customerId");

  const [customers, setCustomers] = useState<DropdownCustomer[]>([]);
  const [customerId, setCustomerId] = useState<string>("");
  const [jobDescription, setJobDescription] = useState("");
  // Stable id for SSR + first paint — random UUIDs in useState break hydration (server vs client differ).
  const [lineItems, setLineItems] = useState<LineItemDraft[]>([
    { id: "quote-line-draft-1", description: "", price: "" },
  ]);
  const [notes, setNotes] = useState("");
  const [validUntil, setValidUntil] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quoteCreated, setQuoteCreated] = useState(false);

  const selectedCustomer = useMemo(() => {
    const idNum = Number(customerId);
    if (!Number.isFinite(idNum)) return null;
    return customers.find((c) => c.id === idNum) ?? null;
  }, [customerId, customers]);

  const totalAmount = useMemo(() => {
    return lineItems.reduce((sum, li) => {
      const p = Number(li.price);
      return sum + (Number.isFinite(p) ? p : 0);
    }, 0);
  }, [lineItems]);

  useEffect(() => {
    if (!open) return;

    setError(null);
    setBusy(false);
    setQuoteCreated(false);
    setJobDescription("");
    setLineItems([{ id: crypto.randomUUID(), description: "", price: "" }]);
    setNotes("");
    setValidUntil("");
    setCustomerId(editCustomerId ?? "");

    async function loadCustomers() {
      try {
        const res = await fetch("/api/customers?forDropdown=1");
        if (!res.ok) return;
        const data = await res.json();
        if (!Array.isArray(data?.customers)) return;
        setCustomers(
          data.customers.map((c: { id: unknown; name?: unknown; phone?: unknown; address?: unknown; email?: unknown }) => ({
            id: Number(c.id),
            name: String(c.name ?? ""),
            phone: c.phone ?? null,
            address: c.address ?? null,
            email: c.email ?? null,
          }))
        );
      } catch {
        // ignore
      }
    }

    loadCustomers();
  }, [open, editCustomerId]);

  useEffect(() => {
    if (!open) return;
    setQuoteCreated(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId, jobDescription, lineItems, notes, validUntil]);

  function closeSheet() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("quote");
    params.delete("customerId");
    router.replace(`${pathname}?${params.toString()}`);
  }

  function addLineItem() {
    setLineItems((prev) => [...prev, { id: crypto.randomUUID(), description: "", price: "" }]);
  }

  function removeLineItem(id: string) {
    setLineItems((prev) => prev.filter((li) => li.id !== id));
  }

  async function createQuote() {
    if (busy) return;
    setBusy(true);
    setError(null);

    try {
      const customerIdNum = Number(customerId);
      if (!Number.isFinite(customerIdNum)) {
        setError("Select a customer");
        return;
      }
      if (!jobDescription.trim()) {
        setError("Job description is required");
        return;
      }

      const normalisedLineItems = lineItems
        .map((li) => ({
          description: li.description.trim(),
          price: Number(li.price),
        }))
        .filter((li) => li.description.length > 0 && Number.isFinite(li.price));

      if (normalisedLineItems.length === 0) {
        setError("Add at least one line item");
        return;
      }

      const lineTotal = normalisedLineItems.reduce((sum, li) => sum + li.price, 0);

      const res = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: customerIdNum,
          description: jobDescription.trim(),
          lineItems: normalisedLineItems,
          totalAmount: lineTotal,
          notes: notes.trim().length ? notes.trim() : null,
          validUntil: validUntil.trim().length ? validUntil.trim() : null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(typeof data?.error === "string" ? data.error : "Could not save quote");
        return;
      }

      setQuoteCreated(true);
    } catch {
      setError("Could not save quote");
    } finally {
      setBusy(false);
    }
  }

  function buildWhatsAppMessage() {
    if (!selectedCustomer) return "";

    const lineText = lineItems
      .map((li) => {
        const desc = li.description.trim();
        const p = Number(li.price);
        if (!desc || !Number.isFinite(p)) return null;
        return `- ${desc}: £${p.toFixed(2)}`;
      })
      .filter(Boolean)
      .join("\n");

    const total = totalAmount;
    const dateToday = formatDateDDMMYYYY(new Date());

    const address = selectedCustomer.address ? `Address: ${selectedCustomer.address}` : "";

    return [
      "Patch",
      `Customer: ${selectedCustomer.name}`,
      address,
      "",
      `Job description:`,
      jobDescription.trim(),
      "",
      "Line items:",
      lineText || "- (none)",
      "",
      `Total: £${total.toFixed(2)}`,
      notes.trim() ? `Notes: ${notes.trim()}` : "",
      validUntil.trim() ? `Valid until: ${validUntil}` : "",
      `Date: ${dateToday}`,
    ]
      .filter(Boolean)
      .join("\n");
  }

  async function sendViaWhatsApp() {
    if (!selectedCustomer) return;
    const phone = selectedCustomer.phone;
    if (!phone) {
      setError("Selected customer has no phone number");
      return;
    }
    const whatsapp = toWhatsAppInternational(phone);
    if (!whatsapp) {
      setError("Could not format WhatsApp number");
      return;
    }
    const message = buildWhatsAppMessage();
    const url = `https://wa.me/${whatsapp}?text=${encodeURIComponent(message)}`;
    window.open(url, "_blank", "noreferrer");
  }

  async function downloadAsPdf() {
    if (!selectedCustomer) return;
    const { jsPDF } = await import("jspdf");

    const doc = new jsPDF({ unit: "pt", format: "a4" });
    const margin = 36;
    let y = 54;

    const customerAddress = selectedCustomer.address ? selectedCustomer.address : "";

    doc.setFontSize(16);
    doc.text("Patch", margin, y);
    y += 20;

    doc.setFontSize(11);
    doc.text(`Customer: ${selectedCustomer.name}`, margin, y);
    y += 14;
    if (customerAddress) {
      doc.text(`Address: ${customerAddress}`, margin, y);
      y += 14;
    }

    y += 8;
    doc.setFontSize(12);
    doc.text("Job description", margin, y);
    y += 16;

    const jobDescLines = doc.splitTextToSize(jobDescription.trim(), 520);
    doc.setFontSize(11);
    for (const line of jobDescLines) {
      doc.text(String(line), margin, y);
      y += 14;
      if (y > 740) break;
    }

    y += 12;
    doc.setFontSize(12);
    doc.text("Line items", margin, y);
    y += 16;

    doc.setFontSize(11);
    const items = lineItems
      .map((li) => ({
        description: li.description.trim(),
        price: Number(li.price),
      }))
      .filter((li) => li.description.length > 0 && Number.isFinite(li.price));

    for (const li of items) {
      const line = `- ${li.description}: £${li.price.toFixed(2)}`;
      const lines = doc.splitTextToSize(line, 520);
      for (const sub of lines) {
        doc.text(String(sub), margin, y);
        y += 14;
        if (y > 760) break;
      }
      if (y > 760) break;
    }

    y += 12;
    const total = totalAmount;
    doc.setFontSize(12);
    doc.text(`Total: £${total.toFixed(2)}`, margin, y);
    y += 14;

    if (notes.trim()) {
      doc.setFontSize(11);
      doc.text("Notes", margin, y);
      y += 14;
      const noteLines = doc.splitTextToSize(notes.trim(), 520);
      for (const line of noteLines) {
        doc.text(String(line), margin, y);
        y += 14;
      }
      y += 6;
    }

    if (validUntil.trim()) {
      doc.setFontSize(11);
      doc.text(`Valid until: ${validUntil.trim()}`, margin, y);
      y += 14;
    }

    doc.setFontSize(10);
    doc.text(`Date: ${formatDateDDMMYYYY(new Date())}`, margin, y);

    doc.save("quote.pdf");
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Quote generator">
      <button type="button" onClick={closeSheet} className="absolute inset-0 bg-black/40" aria-label="Close" />

      <div className="absolute left-0 right-0 bottom-0 rounded-t-3xl bg-white border border-[var(--c-border)] w-full max-w-full md:max-w-md mx-auto">
        <div className="p-4 border-b border-[var(--c-border)] flex items-center justify-between">
          <div>
            <div className="text-lg font-semibold text-[var(--c-text)]">Quote</div>
            <div className="text-[13px] text-[var(--c-text-muted)]">Create a quote & share it</div>
          </div>
          <button
            type="button"
            onClick={closeSheet}
            className="px-3 py-2 rounded-[10px] border border-[var(--c-border-strong)] text-[var(--c-text)] font-semibold text-[14px] btn-outline-interactive"
          >
            Close
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            createQuote();
          }}
          className="p-4 pb-[var(--nav-padding-bottom)] overflow-y-auto max-h-[85vh] scrollbar-none"
        >
          <div className="flex flex-col gap-4">
            {error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">{error}</div>
            ) : null}

            <div>
              <label className="text-sm font-normal text-[var(--c-text)]">Customer</label>
              <select
                value={customerId}
                onChange={(e) => setCustomerId(e.target.value)}
                className="mt-2 w-full sheet-field-input sheet-select-native"
              >
                <option value="" disabled>
                  Select customer
                </option>
                {customers.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-normal text-[var(--c-text)]">Job description</label>
              <textarea
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                rows={4}
                className="mt-2 sheet-field-input min-h-[104px] resize-y"
                placeholder="Describe the job..."
              />
            </div>

            <div>
              <div className="flex items-center justify-between gap-3">
                <label className="text-sm font-normal text-[var(--c-text)]">Line items</label>
                <div className="text-sm font-semibold text-[var(--c-text)] font-currency">Total: £{totalAmount.toFixed(2)}</div>
              </div>

              <div className="mt-3 flex flex-col gap-3">
                {lineItems.map((li, idx) => (
                  <div key={li.id} className="rounded-[12px] border border-[var(--c-border)] p-3 bg-[var(--c-surface)]">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <label className="text-[13px] font-normal text-[var(--c-text-muted)] block">
                          Description
                          <textarea
                            rows={2}
                            value={li.description}
                            onChange={(e) =>
                              setLineItems((prev) => prev.map((x) => (x.id === li.id ? { ...x, description: e.target.value } : x)))
                            }
                            className="mt-2 sheet-field-input min-h-[72px] resize-y"
                            placeholder={`Item ${idx + 1}`}
                          />
                        </label>
                      </div>
                      <div className="w-[120px]">
                        <label className="text-[13px] font-normal text-[var(--c-text-muted)] block">
                          £
                          <input
                            inputMode="decimal"
                            value={li.price}
                            onChange={(e) =>
                              setLineItems((prev) => prev.map((x) => (x.id === li.id ? { ...x, price: e.target.value } : x)))
                            }
                            className="mt-2 sheet-field-input"
                            placeholder="0.00"
                          />
                        </label>
                      </div>
                    </div>

                    {lineItems.length > 1 ? (
                      <div className="mt-3 flex justify-end">
                        <button
                          type="button"
                          onClick={() => removeLineItem(li.id)}
                          className="px-3 py-2 rounded-[10px] border border-[#fca5a5] bg-[var(--c-surface)] text-[var(--c-danger)] text-[13px] font-semibold btn-outline-interactive"
                        >
                          Remove
                        </button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={addLineItem}
                className="mt-3 w-full rounded-[10px] bg-[#fafafa] border-[1.5px] border-[var(--c-border-strong)] text-[var(--c-primary)] py-3 text-sm font-semibold active:scale-[0.99]"
              >
                Add line item
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2">
              <label className="text-sm font-normal text-[var(--c-text)]">
                Notes (optional)
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="mt-2 sheet-field-input min-h-[88px] resize-y"
                  placeholder="Any extra info..."
                />
              </label>

              <label className="text-sm font-normal text-[var(--c-text)]">
                Valid until date (optional)
                <input
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                  className="mt-2 sheet-field-input"
                />
              </label>
            </div>

            {!quoteCreated ? (
              <button
                type="submit"
                disabled={busy}
                className="w-full btn-primary-solid disabled:opacity-60"
              >
                {busy ? "Saving..." : "Save quote"}
              </button>
            ) : (
              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  onClick={sendViaWhatsApp}
                  disabled={!selectedCustomer?.phone}
                  className="w-full rounded-[12px] bg-[#25D366] text-white py-[13px] text-[15px] font-semibold disabled:opacity-60 btn-primary-interactive"
                >
                  Send via WhatsApp
                </button>
                <button
                  type="button"
                  onClick={downloadAsPdf}
                  className="w-full rounded-[12px] bg-[var(--c-primary)] text-white py-[13px] text-[15px] font-semibold btn-primary-interactive"
                >
                  Download as PDF
                </button>
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

