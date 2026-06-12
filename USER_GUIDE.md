# User Guide — Innsaeit Client Dashboard

## What this app is for

This is one shared place to follow every product's packaging artwork from the day the
files arrive to the day it goes to print. Instead of chasing briefs across WhatsApp,
drafts across email, and approvals across phone calls, everyone sees the same live
status — and the right people get a short daily summary instead of a noisy inbox.

---

## The roles — who sees what

**Admin (the studio — you).** Full control. You set up projects and SKUs, upload
artwork, paste briefs, tick the pipeline stages, run the internal pre-flight checklist,
assign each SKU's compliance market, and manage settings. You see every tenant and
every SKU.

**Supervisor (Neha).** Sees the whole picture without logging in much — she receives a
daily digest summarising what's pre-brief and what's in progress across all projects.
She doesn't drive the day-to-day; she watches the pipeline.

**Buyer.** Sees only the SKUs that belong to them. Their daily digest highlights new
files, recent stage changes, and — most importantly — anything **awaiting their
approval**. When artwork is ready, the buyer/client is the one who gives the final
go-ahead.

**Compliance checker (Santosh – India, or Emily – Global).** Each SKU is assigned to a
market, and that market's checker is the only client who sees that SKU's **compliance
checklist**. They review the artwork, tick their checklist, and that approval is what
clears the SKU to proceed. Santosh covers India SKUs; Emily covers global/export SKUs.
*(Emily's contact is still being confirmed — see the note at the end.)*

---

## The full workflow — an artwork's journey from arrival to print

Every SKU moves through a **15-stage pipeline**, shown as a row of dots (the "stage
rail"): filled mint dots are done, the pulsing dot is what's happening now. Here's the
journey, with who does each step. The stage names below match the app exactly.

1. **Files Received** — Artwork files arrive from the vendor/factory. The **admin**
   creates the project (the batch) and adds the SKU (the item, with its Hamleys SKU and
   vendor codes), then ticks *Files Received*.
2. **Files Checked** — The admin opens the files and confirms they're the right,
   usable artwork, then ticks *Files Checked*.
3. **Brief Received** — The brief (often a WhatsApp message) is pasted in as text or
   saved as a file/link on the SKU. Admin ticks *Brief Received*.
4. **Sub-brand Assigned** — The admin sets the SKU's sub-brand (Youreka, Ralleyz,
   etc.) and ticks *Sub-brand Assigned*.
5. **Buyer Reference Received** *(optional)* — If the buyer sent a reference, it's
   saved here.
6. **Callouts Finalized** — The key callouts on the pack are agreed and ticked.
7. **Draft 1 Uploaded** — The first draft artwork is uploaded to the SKU; admin ticks
   *Draft 1 Uploaded*.
8. **Corrections Received** — Feedback and corrections come back and are logged.
9. **Final Draft Uploaded** — The corrected, print-ready draft is uploaded.

   *Along the way, the admin runs the **internal checklist** (the amber "INTERNAL —
   only you see this" card): a pre-flight covering callouts, sub-brand lockup, codes,
   age grading, MRP block, barcode, dieline, and so on. Which items appear depends on
   the SKU's **power type** (Battery, Rechargeable USB, Non-electronic, Ride-on) and
   whether it has an **instruction manual (IM)** — for example, battery SKUs get the
   battery-diagram and bin-symbol checks. The admin also tracks the IM (present? done?)
   right on the SKU.*

10. **Compliance Check Sent** — The admin sends the SKU for compliance review and ticks
    *Compliance Check Sent*. This is what puts it on the assigned checker's plate (and
    in their daily digest).
11. **Compliance Approved** — The **compliance checker** reviews the artwork and ticks
    their **compliance checklist** (the mint card). When they tick the final item,
    *"Compliance approved — okay to proceed for print,"* the SKU reaches *Compliance
    Approved* — and **the one live email goes out** to the studio, supervisor, buyer,
    and the approver. (An admin marking the *Compliance Approved* stage directly sends
    the same email.)
12. **Final Approved for Print** — This is the **client's single action**: the buyer/
    client ticks *Final Approved for Print* to give the green light. It's stamped with
    their name and time — the audit trail of who approved.
13. **Sent to Vendor for Printing** — The admin sends the final files to the print
    vendor and ticks *Sent to Vendor for Printing*.
14. **Mock-up Photos Received** *(optional)* — Production mock-up photos come back and
    are saved.
15. **In Production** — The pack is being produced. Journey complete.

---

## How to — quick steps

**Create a project**
1. On the Dashboard, click **New project**.
2. Enter the name (e.g. *Youreka UNA 7 SKUs*), the vendor/factory, and the buyer (name +
   email). Save.

**Add a SKU**
1. Open the project, click **Add SKU**.
2. Fill in the product name, Hamleys SKU, vendor item code, sub-brand, and the
   compliance market. Save — the 15 stage dots appear automatically.

**Set the power type & compliance market** (on the SKU page)
1. In the SKU's compliance setup, choose the **power type** (Battery / Rechargeable
   USB / Non-electronic / Ride-on).
2. Choose the **market**: *India (Santosh)* or *Global / Export (Emily)*. This assigns
   the checker.
3. Click **Load checklist** to generate the matching checklist items.

**Upload a file / paste a brief / save a link** (on the SKU page)
- **Upload file:** pick the kind (draft, reference, final print…), choose the file. It
  uploads straight to cloud storage — large `.ai` files are fine.
- **Paste brief:** choose *Paste brief text*, paste the WhatsApp message, save.
- **Save a link:** choose *Save a link*, paste a Smash/Playbook/WeTransfer URL. It
  never expires here.

**Tick a stage** — Click the dot on the stage rail (on the project list or the SKU
page). Mint = done; it stamps the date and your name.

**Use a checklist** — On the SKU page, tick items as you verify them. The amber
*internal* list is admin-only; the mint *compliance* list is for the assigned checker
(and admin). Each tick shows the date and who did it.

**Leave a comment** — On the SKU page, type in the comment box and post. Everyone in
the tenant sees it next to the work.

**Request changes** (client) — On the SKU page, click **Request changes**, describe
what's off, and submit. It flags the SKU and posts your reason as a comment. No stages
change. (Admin clears it with **Resolve**.)

**Export** — On a project, **Export CSV** downloads every SKU with its stage dates;
**Copy summary** gives a plain-text, WhatsApp-friendly status list.

**Restart the tour** — Click **Tour** in the header anytime.

---

## The daily digest

Once a day at **10:00 AM IST**, the app emails a short, personalized summary so nobody
has to dig:

- **You (admin):** what needs your action and what clients did yesterday.
- **Supervisor (Neha):** the whole pipeline — what's pre-brief and what's in progress.
- **Each buyer:** their SKUs only — new files, stage changes, and anything awaiting
  their approval.
- **Each compliance checker:** SKUs sent to them that still need their review, with
  checklist progress.

Digests are sent only when there's something to say (the admin and supervisor always
get one). The single **live** email — separate from the daily digest — fires the moment
a SKU is **Compliance Approved**.

---

## Getting started

1. **First login** — go to the app's URL and sign in with the email and password you
   were given. (There's no public sign-up; the studio creates accounts.)
2. **The guided tour starts automatically** the first time, walking you through
   projects, the stage rail, files, comments, and your key action. It runs once.
3. **Replay it anytime** with the **Tour** button in the header.
4. **Light or dark** — use the theme toggle in the header; your choice is remembered.

---

## FAQ / troubleshooting

**I didn't get an email.** A few possibilities: email may not be fully switched on yet
(the sending domain still needs to be verified — *see the note below*); the admin may
have **paused** daily digests in Settings; or **test mode** may be on, which routes all
mail to a single test inbox. Digests also only send when there's news for you that day.

**I can't see a checklist.** The compliance checklist only appears for the **assigned
checker** of that SKU, and only once a **power type** is set and the checklist is
loaded. If a SKU's power type is still *Unknown*, only the general items exist. If
you're not the assigned checker for that market, you won't see it — that's by design.

**A file won't preview.** PDFs, JPG/PNG/GIF/WebP images, and plain text preview right
in the browser. Design formats like **AI** and **CDR** (and Office files) can't be
rendered inline — use the download link to open them in the right app.

**A client can only tick one box — is that right?** Yes. Clients can comment, request
changes, and tick exactly one stage: **Final Approved for Print**, their sign-off. The
compliance checker can additionally tick their compliance checklist.

---

> **Note on email setup [VERIFY].** Real email delivery depends on the sending domain
> being verified with the email provider, and on the global checker's address being
> confirmed. Until both are done, some emails (especially to external recipients) may
> not arrive even though the app shows the work as complete. Check with the studio admin
> if you're expecting a digest or a compliance notice and it hasn't come.
