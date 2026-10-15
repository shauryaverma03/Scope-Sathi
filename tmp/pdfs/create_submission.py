from pathlib import Path
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image, Table, TableStyle, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.utils import ImageReader
from pypdf import PdfReader
from xml.sax.saxutils import escape

ROOT=Path("/Users/shauryaverma/Desktop/Scope Sathi")
OUT=ROOT/"output/pdf"
OUT.mkdir(parents=True,exist_ok=True)
GREEN=colors.HexColor("#234b40")
SAGE=colors.HexColor("#829b5b")
styles=getSampleStyleSheet()
styles.add(ParagraphStyle(name="BrandTitle",fontName="Helvetica-Bold",fontSize=30,leading=35,textColor=GREEN,spaceAfter=16))
styles.add(ParagraphStyle(name="BrandHead",fontName="Helvetica-Bold",fontSize=20,leading=24,textColor=GREEN,spaceAfter=13))
styles.add(ParagraphStyle(name="BrandBody",fontName="Helvetica",fontSize=10,leading=14,textColor=GREEN,spaceAfter=9))
styles.add(ParagraphStyle(name="BrandSmall",fontName="Helvetica",fontSize=8.6,leading=11.7,textColor=GREEN,spaceAfter=7))
styles.add(ParagraphStyle(name="BrandQuote",fontName="Helvetica",fontSize=10,leading=15,textColor=GREEN,backColor=colors.HexColor("#eef2e5"),borderPadding=10,spaceBefore=8,spaceAfter=16))
def p(t,style="BrandBody"):return Paragraph(t,styles[style])
def h(t):return p(t,"BrandHead")
def quote(t):return p(escape(t),"BrandQuote")
def pic(name,width=470):
    path=ROOT/"docs/images"/name
    w,hh=ImageReader(str(path)).getSize()
    return Image(str(path),width=width,height=width*hh/w)
def table(rows,widths=(135,376)):
    t=Table([[p(str(x),"BrandSmall") for x in row] for row in rows],colWidths=widths,hAlign="LEFT")
    t.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,0),colors.HexColor("#e6ecd9")),("VALIGN",(0,0),(-1,-1),"TOP"),("TOPPADDING",(0,0),(-1,-1),7),("BOTTOMPADDING",(0,0),(-1,-1),7),("LINEBELOW",(0,0),(-1,-1),.4,colors.HexColor("#d8ded4"))]))
    return t
def footer(c,d):
    c.setFillColor(GREEN);c.rect(0,0,595,28,fill=1,stroke=0)
    c.setFillColor(colors.white);c.setFont("Helvetica",8)
    c.drawString(42,11,"SCOPESATHI  /  Clarity before commitment")
    c.drawRightString(553,11,str(d.page))
def build(name,story,title):
    SimpleDocTemplate(str(OUT/name),pagesize=(595,842),rightMargin=42,leftMargin=42,topMargin=38,bottomMargin=44,title=title,author="Shaurya Verma").build(story,onFirstPage=footer,onLaterPages=footer)
def page(story,heading,body):
    if story:story.append(PageBreak())
    story.extend([h(heading),*body])

A="Please allow guest checkout alongside email-and-password sign-in. Guest customers must receive an order-tracking link that expires after 24 hours. Please include a CSV export of the signed-in customer's own order history and remove CSV exports from the excluded work."
B="Add saved delivery addresses for signed-in customers."
AMB="Make checkout easier."
COR="Fix order history so customers can see only their own orders, as originally agreed."
NO="Please keep the existing keyword search and category filters."
REJ="Build native iOS and Android apps for the first release."

report=[
 p("PROJECT SUBMISSION REPORT / 15 OCTOBER 2026","BrandSmall"),
 p("ScopeSathi","BrandTitle"),
 h("Clarity before commitment."),
 p("A client-requirements and scope-change workspace for freelancers and small software teams."),
 pic("home.jpg"),Spacer(1,10),
 p("<b>Current status:</b> manual review workflows, revision pricing and real Firestore persistence are implemented and tested. Automatic Gemini analysis and public deployment remain pending."),
 p("This report explains the implementation and evidence boundaries. Historical UI captures show demonstration data; they are not proof of current cloud or AI connectivity.","BrandSmall"),
 p("Author: Shaurya Verma<br/>Repository: https://github.com/shauryaverma03/Scope-Sathi","BrandSmall")
]
page(report,"01 / What ScopeSathi does",[
 p("A client agrees to a specific project, then changes requirements near delivery. ScopeSathi keeps the original agreement, identifies proposed changes, records a human decision and makes the impact on work and revision allowance visible."),
 table([["Stage","User action and result"],["Client brief","Record structured intake or upload a selectable-text PDF/TXT. Retain the original brief text."],["Reviewed baseline","Edit requirement wording and exact source quotes. A reviewer approves version 1."],["Incoming request","Save the client message, source and revision round. Compare it against the latest approved scope."],["Requirement comparison","Review IDs, original wording, exact request quotes, proposed wording, questions and linked tasks."],["Human approval","Approve, reject or ask for clarification. Evidence, open questions, permissions and stale versions gate approval."],["Task and cost impact","Preserve old versions, flag affected tasks, count approved rounds and obtain client consent for priced extra work."]]),
 p("<b>ScopeSathi manages agreements about work.</b> The demo online-store brief is test input; ScopeSathi does not build the store, implement its checkout or send its order-confirmation emails."),
 p("The accompanying manual guide provides copyable messages, expected outcomes and checks for the current manual-analysis mode.")
])
page(report,"02 / Intake, documents and approved scope",[
 table([["Feature","How it works"],["Structured client intake","Capture project goal, intended users, required features, deliverables, constraints, acceptance criteria and excluded work. Save separately or convert the intake into a brief."],["Pasted brief / TXT / PDF","The backend reads selectable text. The current limits are 2 MB for uploads and 16,000 characters for a brief. Uploaded PDF bytes are not retained after extraction."],["Scanned documents","Image-only PDF pages require OCR outside this application. OCR is not implemented."],["Requirement editor","Review and edit extracted entries. Each requirement has a stable ID, editable wording and an exact source passage. Up to 30 requirement sections are supported."],["Initial approval","Only a reviewer/owner approves the first baseline. Intake and original approved evidence are preserved."],["Versions and comparison","Later approved scope changes create new snapshots. Stable IDs make additions, edits and removals visible."]]),
 p("<b>Important limitation:</b> with no Gemini key/model configured, extraction splits text lines rather than understanding requirements. Headings, metadata and wrapped lines may become entries. Review and consolidate them before approval."),
 p("Exact passages and reference checks prevent fabricated evidence from being accepted. They do not prove that a proposal is semantically correct; the human reviewer remains responsible."),
 p("The supplied brief has seven labelled feature/boundary clauses. The PDF labels R1-R7 are test references; use the actual IDs in your reviewed baseline.")
])
page(report,"03 / Requests, decisions and task impact",[
 table([["Feature","Behavior"],["Request list","Submit a client message, title and source. Search and filter by status. Group related requests into a named round."],["Finding types","Addition, modification, removal, clarification or no change. Multiple findings may belong to one request."],["Affected requirements","A modification/removal must reference an approved requirement. Show original wording and exact new-request evidence."],["Ambiguous matches","Keep clarification questions open until resolved. Approval is blocked while clarification findings/questions remain."],["Manual / configured AI","Current mode creates a clearly labelled manual proposal. Configured Gemini can propose findings, which still need validation and human review."],["Review outcomes","Approve, reject or request clarification with a reason. A clarification decision stays in history; clarified details become a follow-up request."],["Version and concurrency checks","Old-baseline analysis and outdated project revisions are rejected. Refresh/reconcile rather than overwriting another edit."],["Task impact","Tasks link to requirement IDs. Changed requirements flag linked tasks; explicitly selected impact links also flag work. Humans update task status after review."]]),
 p("Conflicting edits to the same requirement in one approval are blocked. Combine the intended replacement into one finding or split the work for review."),
 p("Scope/history export as JSON; tasks export as spreadsheet-friendly CSV. These are snapshots, not a complete database backup/restore mechanism.")
])
page(report,"04 / Workspace and onboarding",[
 pic("overview.jpg",455),
 p("Historical application screenshot with demonstration data. Pricing controls were added later and are described on the next page.","BrandSmall"),
 table([["Section","Purpose"],["Overview","Project summary, setup checklist, pending decisions, revision/cost meter and affected-task counts."],["Approved scope","Client intake, documents, requirement review, baseline approval and version comparison."],["Change requests","Search/status filters, proposals, review actions and cost consent."],["Tasks / Decision history","Requirement-linked board; chronological reasons, reviewers, versions and exports."],["Settings","Account, actual connection status, access, revision allowance, price and designated client. Account/connection settings also work before a project exists."]]),
 p("The public home page explains the workflow and offers Google sign-in/sign-up entry points and a tour. Google manages authentication; a new verified account becomes a first-time user. Each empty section has its own next action."),
 p("Session preferences, optional tour remembrance, profile/sign-out controls and branded loading transitions are implemented. Reduced-motion behavior is supported. A fresh full mobile/browser walkthrough was not completed in this run.","BrandSmall")
])
page(report,"05 / Revision allowance and cost meter",[
 p("The owner defines a revision <b>round</b>: related client requests reviewed together. Each approved new-scope round counts once. Corrections to meet the original agreement, rejected requests, clarification and no-change decisions do not consume allowance."),
 table([["Example configuration","Illustrative values - not a live customer invoice"],["Included allowance","5 rounds"],["Additional round rate","INR 500 per extra round"],["Two additional rounds proposed","INR 1,000 estimated"],["One additional round accepted","INR 500 client accepted"],["Invoice reference","Owner records an existing invoice after quoted requests are approved. No money is collected."]]),
 table([["Workflow","Required action"],["1. Set policy","Invite a separate client; after access acceptance select their account, currency, allowance and price. Viewer access is sufficient for quote consent."],["2. Propose extra work","Reviewer proposes a fixed quote covering exact request IDs, comparison wording and round scope."],["3. Client response","The designated client accepts or declines from their signed-in account. Other accounts cannot consent on their behalf."],["4. Scope approval","Reviewer approves separately. Current accepted quote supplies the separate agreement; a free-text note alone cannot bypass priced consent."],["5. Changed scope","Request/proposal/group changes require a refreshed quote and renewed consent. Accepted prices stay fixed for that round."],["6. Record invoice","Owner adds an invoice reference only after all quoted requests are approved. Invoiced rounds close to further expansion."]]),
 p("The meter separates unquoted estimates, current proposed quotes, client-accepted amounts and invoiced records. Currencies total separately. Accepted and invoiced totals overlap; do not add them. Pricing does not generate invoices, calculate tax, charge cards or send quote emails.","BrandSmall")
])
page(report,"06 / Access, invitations and email",[
 table([["Role / capability","What the implementation allows"],["Owner","Controls project membership, deletion, revision pricing/policy, designated client and invoice references. Also reviews scope."],["Reviewer","Approves baseline and scope decisions, edits proposals and proposes extra-round quotes."],["Editor","Submits requests and manages tasks; cannot approve scope."],["Viewer / client","Reads shared data and exports. A designated client with active access can accept/decline their own quote."],["Invitation","Seven-day invite tied to the matching verified account. Pending invites grant no project access. Wrong-account acceptance is rejected; owner may revoke."],["Unknown recipient","Owner gets an explicit confirmation option before inviting an account that has not signed up."],["Address checks","Invalid syntax is rejected. A valid-looking address cannot be guaranteed to exist or belong to the intended person."],["Welcome and access mail","Branded HTML with plain-text alternatives; welcome deduplication, invitations and delivery states are implemented. Mail is queued in persisted storage."]]),
 p("<b>Current sender status:</b> configured. This run tested mail/invitation logic, but did not send a fresh welcome or invitation email. A previously received styled preview proves only that earlier message's delivery."),
 p("The current mail worker uses a backend polling timer. A reliable hosted worker/scheduler is still needed for scale-to-zero deployment. SMTP acceptance does not guarantee inbox delivery."),
 p("Another person's localhost points to their computer. Remote collaboration requires the same reachable backend; a public deployment is still pending.")
])
page(report,"07 / Architecture and protections",[
 table([["Layer","Implementation and reason"],["Frontend","React, TypeScript and Vite provide the public site, workspace forms, comparisons, tour and task board."],["Identity","Firebase Authentication supplies Google identity; backend token and verified-account checks enforce trust."],["API / domain","Express + Zod validate inputs; backend membership/roles, evidence and decision rules enforce actions."],["Persistence","Firebase Admin accesses scopesathi's default Firestore. Project aggregates include intake, brief, requirements, versions, requests, tasks, members, policy, quotes and history."],["Analysis","Google Gen AI SDK supports Gemini Developer API in firebase mode and Vertex AI in google mode. Current installation is manual."],["Mail","Nodemailer/Gmail SMTP and a persisted outbox support branded transactional messages."],["Hosting","Local backend and Vite preview are running. Google public hosting configuration exists but is not deployed/verified."]]),
 p("<b>Save path:</b> browser ID token / API authentication / membership and workflow checks / Firestore transaction / confirmed response. A write failure is shown; there is no silent local fallback."),
 p("Revision checks prevent lost updates. Model calls occur outside transactions; their eventual save rechecks the original revision. Private Admin and mail/model credentials stay on the backend."),
 p("Rate limits, ingress budgets, request IDs, security headers, upload/JSON limits, HTTP timeouts and graceful shutdown are implemented. Rate counters are in-memory per instance; distributed limits, pagination and recovery operations remain scale work."),
 p("Projects are capped at 700 KB. Direct browser access is denied by repository Firestore rules; the deployed rule source was not inspected in this run. Backend outsider denial was tested.")
])
page(report,"08 / Validation results",[
 p("Verification: 15 October 2026. Service checks used isolated or disposable fixtures; the live Firestore fixture was removed after verification."),
 table([["Check","Result and boundary"],["Automated suite","46 of 46 tests passed. Covers baseline/quote evidence, multi-change review, ambiguity, roles, rejected access, concurrency, corrections, allowance, client quote consent, fixed rates, invoice prerequisites, invitation logic and API validation."],["Build","TypeScript and Vite production build passed."],["Real Firestore","Create project, baseline, request, quote, client acceptance, scope approval, invoice reference, task update, outsider denial and fresh-process reload passed."],["Current runtime","Firebase mode; Firestore read connection verified; AI manual; mail sender configured. Both local web/API health checks passed."],["Supplied PDF","Generated brief uploaded successfully: 1,381 text characters and 21 draft line entries. Seven reviewed requirements, three approved findings, baseline v2, linked task Needs Review and API reload passed in an isolated local fixture; no AI call occurred."],["Fresh browser / mobile","Not verified in this run. Automatic browser security review blocked reloading the existing tab. Historical screenshots are labelled as such."],["Real Google login / inbox","No fresh two-account Google login or new welcome/invitation delivery was executed. Unit/service evidence is not proof of these browser/inbox outcomes."],["Live AI / public hosting","No live Gemini response or public deployment was verified."]]),
 p("Passing tests does not establish load capacity, model accuracy, legal agreement validity or production availability. The manual guide includes observations you should record rather than assume."),
 p("Evidence files: .data/submission-tests.log, .data/submission-build.log and .data/submission-firestore.log. These local logs are supporting records, not submission secrets.","BrandSmall")
])
page(report,"09 / Pending work and submission readiness",[
 table([["Priority","What remains and how to verify"],["1. Live Gemini analysis","Configure private GEMINI_API_KEY and GEMINI_MODEL on the local backend, restart, then test genuinely unseen briefs and multi-change requests. Verify semantic matches and exact evidence; preserve human approval. No model accuracy results exist yet."],["2. Public Google deployment","Resolve eligible hosting/billing/credits separately. Deploy the actual backend/frontend, authorize the hostname and verify sign-in, saves and reloads. GitHub source hosting alone does not run this API."],["3. Two-account acceptance","Manually test Google sign-in, invitation, viewer restrictions, quote acceptance and reviewer approval using the guide."],["4. Email delivery / worker","Check first-time welcome once, invite receipt and acceptance. Establish reliable hosted queue processing; verify failures/retry behavior and visible delivery states."],["5. Browser regression","Complete desktop/mobile layout, loading, all sections, profile, tour, exports and unsaved-input failure checks."],["6. Scale / operations","Add shared rate counters for replicas, pagination/subcollections, backup/restore, monitoring and retention policy before larger production use."]]),
 p("<b>Not included:</b> scanned-PDF OCR, automatic invoices/tax/payment collection, quote notification emails, third-party task integrations or general idempotency keys."),
 p("The core API is already implemented. The missing analysis dependency is the live model configuration and verification, not an absent request-management API."),
 p("Never paste a private key into chat or include it in frontend code. Use backend-only local environment configuration. Do not enable billing or migrate projects as part of these manual tests."),
 p("Submit this report with your source and evidence as appropriate. It does not replace a working deployed prototype if the event requires one. Documentation: README.md and docs/README.md link the architecture, data model, API, setup, security and revision-pricing guides.")
])
build("ScopeSathi-Submission-Report.pdf",report,"ScopeSathi - Project and Validation Report")

brief=[
 p("SYNTHETIC CLIENT BRIEF / INITIAL SCOPE ONLY","BrandSmall"),
 p("Sunday Store","BrandTitle"),
 p("Goal: launch a small online store. Users: customers and store administrators."),
 p("Deliverable: responsive web app. Constraint: use the client's selected payment provider."),
 h("Requirements and boundaries"),
 p("R1. Customers must sign in with email and password before checkout. Guest checkout is excluded."),
 p("R2. The catalogue must support keyword search and category filters."),
 p("R3. Signed-in customers must see their own order history, never another customer's orders."),
 p("R4. Payments must use the payment provider selected by the client."),
 p("R5. Administrators must update product prices and availability."),
 p("R6. Customers must receive an email confirmation after a successful order."),
 p("R7. Native mobile applications, CSV exports and inventory integrations are excluded."),
 h("Acceptance and revision policy"),
 p("Acceptance: a customer signs in, searches, completes checkout and views their own order. An administrator changes a price. Core pages work on mobile."),
 p("One approved new-scope revision round is included. Related requests share a round. Corrections to this agreement are free. Additional rounds cost INR 500 only after client consent and reviewer approval."),
 p("Client labels R1-R7 aid review; ScopeSathi assigns its own requirement IDs. This brief contains no later change requests or test instructions.","BrandSmall")
]
build("ScopeSathi-Demo-Client-Brief.pdf",brief,"Sunday Store - Initial Client Brief")

guide=[]
page(guide,"01 / Prepare a safe manual test",[
 p("Use a new disposable project named <b>Sunday Store Manual Test</b>. Keep your real client data untouched. This guide tests ScopeSathi's management workflow; it does not test a real store implementation."),
 table([["Preparation","Action"],["Open application","Use http://127.0.0.1:5173/ while the local API is running. Sign in as the owner."],["Second account","For quote tests, use a separate verified Google account. Invite it as Viewer, accept the invitation and confirm shared access. Two sessions on this Mac can reach the same backend."],["Connection","Settings should show verified Firestore connectivity. Current analysis should be labelled manual. Do not assume AI is connected because Google sign-in works."],["Create / intake","Create the test project. Populate the seven intake fields using the supplied client brief. Save and reload; expect the saved values."],["Upload PDF","Open Approved scope and upload only the supplied initial client brief. Expect selectable text; headings/line wraps may become draft entries."],["Review extraction","The tested upload produced 21 line-based draft entries. Keep seven meaningful baseline clauses corresponding to R1-R7. Consolidate wrapped entries and remove headings/metadata. Preserve source quotes copied exactly from extracted text."],["Approve baseline","Approve once as owner/reviewer. Expect v1 and preserved original brief. Initial intake becomes locked. Read the assigned requirement IDs; do not assume R1 equals REQ-001."]]),
 p("<b>Record:</b> upload result, number of draft entries, actual checkout and exclusions IDs, baseline v1 and whether reload preserves data."),
 p("If a scanned PDF has no selectable text, expect OCR guidance; automatic OCR is not available. If there are over 30 line sections, consolidate the brief before extraction."),
 p("Result: PASS / FAIL / NOT TESTED. Notes: __________________________________","BrandSmall")
])
page(guide,"02 / Test three changes in one request",[
 p("First create a task <b>Build checkout</b> linked to the actual R1 requirement ID. Optionally create <b>Order-history work</b> linked to R3. Set the included allowance to <b>1</b> round for this short test."),
 p("Submit this message under Change requests, source 'Synthetic client message', title 'Launch review', in a new related round:"),
 quote(A),
 table([["Finding","Manual expected proposal"],["Modification: checkout","Reference the actual R1 ID. Use its exact current wording and the exact guest-checkout/24-hour sentence from the message. Proposed wording: Customers may sign in with email/password or check out as guests. Guest customers receive an order-tracking link expiring after 24 hours."],["Modification: exclusions","Reference R7. Quote 'remove CSV exports from the excluded work' exactly from the message. Proposed wording: Native mobile applications and inventory integrations are excluded."],["Addition: CSV export","No existing requirement ID/current quote needed. Quote the CSV-export passage exactly. Proposed wording: Signed-in customers may export their own order history as CSV. Link Order-history work explicitly if appropriate."]]),
 p("Without Gemini, open <b>Edit proposal &amp; resolve questions</b>, convert the manual clarification entry, add findings and clear questions only after reviewing the meaning. Save the proposal. Use only exact quotes present in the document/request."),
 p("<b>Approve:</b> note 'Client confirmed guest flow and CSV boundary update.' Expect all three findings applied in one new version, checkout task marked Needs Review, history recorded and <b>one</b> round used. Verify CSV is no longer simultaneously excluded."),
 p("Result: PASS / FAIL / NOT TESTED. Notes: __________________________________","BrandSmall")
])
page(guide,"03 / Test priced extra work",[
 p("In Settings, configure <b>1 included round, INR 500 additional round price</b>, and select the second account as designated client after it has accepted project access. One round is already used."),
 p("Submit this as a new round called 'Saved addresses':"),quote(B),
 table([["Step","Expected result"],["Manual proposal","Use addition: Signed-in customers may save delivery addresses. Request quote must match the message. No unresolved question should remain."],["Meter","Used 1, remaining 0. The new round shows estimated extra work of INR 500. Pending work does not count as an approved round."],["Try approval first","Approval should remain unavailable or fail until a current client quote is accepted. A free-text agreement cannot bypass priced consent."],["Propose quote","Reviewer uses the cost meter. Client sees exact scope, INR 500 and who proposed it."],["Decline / repropose","Client declines in their own session. Owner refreshes; approval stays blocked. Reviewer reproposes and client accepts."],["Approve scope","Owner refreshes and approves separately. Quote supplies the recorded agreement. Expect used 2, remaining 0, approved beyond 1."],["Record invoice","Only owner may record an existing reference, e.g. DEMO-INV-001, after quoted work is approved. This is a test record, not a generated invoice or collected payment."]]),
 p("<b>Rate preservation:</b> change policy to INR 700 after acceptance. The accepted quote remains INR 500. Changed scope requires another acceptance at the preserved rate for that round."),
 p("<b>Scope change check:</b> before approval/invoicing, edit a proposed requirement after acceptance. Approval must be blocked until the reviewer proposes an updated quote and client accepts again. After invoicing, put further work in a new round."),
 p("Result: PASS / FAIL / NOT TESTED. Notes: __________________________________","BrandSmall")
])
page(guide,"04 / Negative and boundary tests",[
 table([["Test input / action","Expected outcome"],["Ambiguous request: "+AMB,"Manual clarification remains unresolved; no automatic semantic match. Review questions block approval. Decide clarification; allowance unchanged. Clarified details become a follow-up request."],["Correction: "+COR,"Reviewer confirms correction category, references current order-history requirement and resolves questions. Approval flags relevant tasks but consumes no additional round or priced quote."],["No change: "+NO,"Set no_change, reference the current search requirement and exact source. Approval records the decision without a new scope version/round."],["Reject: "+REJ,"Reject with reason 'Outside launch agreement'. Baseline, tasks and used rounds remain unchanged."],["Fabricated quote / task ID","Invented evidence or nonexistent references must be rejected; approved scope stays unchanged."],["Stale review / concurrent edit","Open two sessions on the same revision; save in one, then save in the other. Expect stale-revision rejection. Do not blindly retry; refresh/reconcile."],["Viewer / editor restriction","Viewer cannot edit/approve; editor cannot approve or configure pricing. Client viewer can accept only their own quote. Owner/reviewer cannot accept for them."],["Wrong / revoked access","Pending invite grants no project access; wrong-account invite acceptance fails. Revoked member loses access and cannot accept a quote."]]),
 p("A correctly formatted but unintended email cannot be proved wrong by syntax validation. Test invalid syntax separately, and verify the intended recipient before sending an actual invite."),
 p("Avoid deleting your working projects during testing. If you remove the disposable project, use the explicit project-name confirmation."),
 p("Result: PASS / FAIL / NOT TESTED. Notes: __________________________________","BrandSmall")
])
page(guide,"05 / Final user-facing checklist",[
 table([["Manual check","Expected observation"],["Home / sign-in / tour","Workflow and capabilities described honestly. Tour opens, next/back/skip/restart work. Optional remembrance follows privacy choice."],["Distinct sections","With no project, each tab has a relevant empty state. Settings shows account and connections before project creation."],["Profile / refresh / mobile","Profile and sign-out remain accessible. Loading transition appears on refresh; reduced-motion preference is respected. Narrow layout has usable navigation and forms."],["Task board","Affected task shows Needs Review. A permitted member reviews work and updates status; reload persists it."],["Version and history","Compare v1 with later versions. Reviewers, reasons, quote consent and policy/invoice changes appear in history."],["Exports","Download scope/history JSON and tasks CSV. Open the files and confirm expected IDs and records. Quotes appear in project snapshots."],["Welcome / invite mail","Use an authorized fresh account/recipient. Check styled welcome once, meaningful invite, link, matching-account acceptance and displayed delivery state. Current sender is configured; fresh delivery remains a manual test."],["Cloud persistence","Reload/restart locally, sign in and confirm the same test project, versions, quote and invoice reference. Check Firestore records if you have console access."],["Failure / unsaved input","In a controlled test, stop the backend during a save. Expect visible failure and preserved form input. Restart/retry. Do not disable rules or revoke production credentials."]]),
 p("<b>Automatic analysis is pending.</b> Text extraction/manual review can be tested now. To evaluate Gemini later, configure private backend key/model settings and compare actual output against the expected findings in this guide. Mark AI tests NOT TESTED until a genuine model request succeeds."),
 p("Record browser/device, account role, test date and screenshots of failures. No complete fresh browser/mobile or real inbox test is claimed by the accompanying report."),
 p("Outcome summary: Passed ____ Failed ____ Not tested ____<br/>Issues / next actions: __________________________________________","BrandSmall")
])
build("ScopeSathi-Manual-Test-Guide.pdf",guide,"ScopeSathi - Manual Test Guide")
for name in ["ScopeSathi-Submission-Report.pdf","ScopeSathi-Demo-Client-Brief.pdf","ScopeSathi-Manual-Test-Guide.pdf"]:
    f=OUT/name;r=PdfReader(f)
    assert all(page.extract_text().strip() for page in r.pages)
    print(name,len(r.pages),"pages",f.stat().st_size,"bytes")
