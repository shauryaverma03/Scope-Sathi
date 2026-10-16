"""Rebuild the dated submission draft. Uses reportlab; no cloud calls."""
from pathlib import Path
import os
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Image, PageBreak, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.colors import HexColor, white
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.utils import ImageReader

ROOT = Path(__file__).resolve().parents[1]
FONTS = Path(os.environ.get("PROPOSAL_FONT_DIR", str(Path.home() / ".cache/codex-runtimes/codex-primary-runtime/dependencies/native/poppler/poppler/fonts")))
pdfmetrics.registerFont(TTFont("Body", str(FONTS / "Ubuntu-R.ttf")))
pdfmetrics.registerFont(TTFont("Body-Bold", str(FONTS / "Ubuntu-B.ttf")))
pdfmetrics.registerFontFamily("Body", normal="Body", bold="Body-Bold", italic="Body", boldItalic="Body-Bold")
OUT = ROOT / "output/pdf/ScopeSathi-Hackathon-Proposal-2026-10-16.pdf"
OUT.parent.mkdir(parents=True, exist_ok=True)
GREEN, SAGE, PALE = map(HexColor, ["#204d40", "#718c55", "#edf3e9"])
styles = getSampleStyleSheet()
styles.add(ParagraphStyle(name="Hero", fontName="Body-Bold", fontSize=29, leading=34, textColor=GREEN, spaceAfter=15))
styles.add(ParagraphStyle(name="Deck", fontName="Body", fontSize=13, leading=19, textColor=GREEN, spaceAfter=14))
styles.add(ParagraphStyle(name="Kicker", fontName="Body-Bold", fontSize=8, leading=12, textColor=SAGE, spaceAfter=12))
styles["BodyText"].fontName="Body"
styles["BodyText"].fontSize=9
styles["BodyText"].leading=13
styles["BodyText"].spaceAfter=7
styles["Heading2"].fontName="Body-Bold"
styles["Heading2"].fontSize=13
styles["Heading2"].leading=17
styles["Heading2"].textColor=GREEN
styles["Heading2"].spaceBefore=12
styles["Heading2"].spaceAfter=8
story=[]
def p(text, style="BodyText"):
    story.append(Paragraph(text, styles[style]))
def h(text): p(text,"Heading2")
def table(rows, widths):
    content=[[Paragraph(cell, styles["BodyText"]) for cell in row] for row in rows]
    t=Table(content,colWidths=widths,hAlign="LEFT")
    t.setStyle(TableStyle([("BACKGROUND",(0,0),(-1,0),PALE),("VALIGN",(0,0),(-1,-1),"TOP"),("LEFTPADDING",(0,0),(-1,-1),9),("RIGHTPADDING",(0,0),(-1,-1),9),("TOPPADDING",(0,0),(-1,-1),7),("BOTTOMPADDING",(0,0),(-1,-1),5),("LINEBELOW",(0,0),(-1,-1),0.4,HexColor("#dce5d9"))]))
    story.append(t)

p("WORKNOVA  /  AI BUILDER CUP 2026", "Kicker")
p("Clear scope.<br/>Traceable decisions.","Hero")
p("ScopeSathi helps freelancers and small software teams review client requests after an agreement has been approved.","Deck")
p("Proposal draft - 16 October 2026. Theme: Future of Work &amp; Enterprise Productivity.")
h("The problem")
p("A short client message can add work, alter an obligation or simply clarify an existing agreement. Comparing messages manually and updating disconnected spreadsheets makes the rationale, client consent and downstream task impact difficult to recover.")
h("One decision, connected end to end")
table([ ["Stage", "What the user receives"],
 ["Establish", "Text or a text-based PDF becomes a reviewed, approved baseline."],
 ["Compare", "Gemini proposes findings against the current agreement, with exact source evidence and clarification questions."],
 ["Decide", "People resolve questions, inspect wording and obtain current client consent for applicable extra-round quotes before reviewer approval."],
 ["Follow through", "The decision creates a preserved scope version, flags affected tasks and feeds a printable client change summary."]], [85,410])
h("Try the prototype")
p('<link href="https://scopesathi-api-112358672382.europe-west1.run.app" color="#204d40">Open the deployed ScopeSathi application</link><br/><link href="https://github.com/shauryaverma03/Scope-Sathi" color="#204d40">Inspect the source repository</link>')
p("The public worked example is explicitly illustrative. It makes no model calls and saves no project data. A real demonstration recording is still to be added.")
story.append(PageBreak())
p("SYSTEM DESIGN", "Kicker")
p("AI assists. People authorize.","Hero")
image_path=str(ROOT/"docs/images/cloud-architecture.png")
image_width,image_height=ImageReader(image_path).getSize()
image=Image(image_path,width=370,height=370*image_height/image_width)
story.append(image)
p("Architecture illustration. It explains component responsibilities; it is not evidence of live configuration or successful model execution.")
h("Why these components")
table([["Component", "Purpose and boundary"],
 ["Cloud Run", "Containerized frontend/API hosting; request-based billing and scale-to-zero suit intermittent prototype traffic."],
 ["Firebase Authentication", "Identifies Google users. Server-side verification and project roles govern access."],
 ["Firestore", "Persists agreements, requests and history. Revision checks protect concurrent updates."],
 ["Vertex AI / Gemini", "Structures requirements and proposes comparisons. Schema, quote and reference validation constrain outputs; none establish semantic accuracy."],
 ["Cloud Build / GitHub CI", "Test/build gates before packaging. Attached runtime identity avoids shipping downloaded production credentials."]],[110,385])
h("Intentional prototype tradeoffs")
p("The recorded deployment uses europe-west1, request-based billing, a service minimum of 0, maximum of 1, concurrency 20 and a 60-second request timeout. Cold starts are accepted. A maximum instance count is not a monetary cap or a high-availability design. Verify the active revision's settings before submission.")
p("Before larger deployments: shared rate budgets, paginated reads, history/storage growth controls, durable mail delivery, and a chosen backup/restore and retention policy. Whole-project storage has an application size limit; scale claims are not measured.")
story.append(PageBreak())
p("VALIDATION AND DIFFERENTIATION", "Kicker")
p("Evidence before claims.","Hero")
h("What is implemented")
p("Historical evidence comparison, highlighted retained-text passages, bounded wording differences, role-aware next actions, stored relationship traceability, client quote consent, versioned approval, affected-task review and printable client summaries. Reports omit internal decision notes by default. AI execution metadata records provider/model, prompt/schema version, duration and available token usage.")
h("Verification record")
table([["Check", "Result and practical limit"],
 ["Automated tests", "91 passed, zero failed or skipped on this local update. Includes domain, HTTP and server-rendered UI checks; not browser interaction."],
 ["Production build", "TypeScript and Vite build passed."],
 ["Prior Firestore fixture", "Disposable workflow and fresh-process persistence passed in the earlier QA session. Not a real Google popup or user study."],
 ["AI evaluation", "32 labeled synthetic cases with project-level held-out split and optional baseline-prompt comparison. Model-quality results remain unavailable: local Developer API returned 402 and local ADC Vertex returned 403."],
 ["Pending release checks", "Authenticated hosted Vertex workflow; two-account desktop/mobile and print walkthrough; hosted email delivery; real-user observations and recording."]],[110,385])
p("Local ADC failures do not establish whether Cloud Run's separate runtime identity works. Configured provider/model values are not evidence of successful inference. No accuracy, savings, payment collection or production-scale claim is made.")
h("Why more than a prompt and spreadsheet")
p("ScopeSathi preserves a permissioned chain from source evidence through client consent, reviewer approval, agreement versions and task consequences. The model proposes; authorization and consistency rules remain application responsibilities. Exact quote matching proves text exists, not that the model interpreted it correctly.")
h("Next evidence to collect")
p("Verify an unfamiliar synthetic request on the hosted app. Run the held-out evaluation with authorized credentials and inspect semantic quality using the human-review worksheet. Observe consenting reviewers using comparable manual/app tasks. Record the three-minute demonstration and replace pending statuses only with actual outcomes.")
p("Supporting records: docs/HACKATHON_QA_REPORT.md, docs/AI_EVALUATION.md, docs/HUMAN_EVALUATION.md and docs/OWNER_RELEASE_STEPS.md. Rebuild this draft after updating results. Confirm current competition form requirements before submitting.")

def footer(canvas, doc):
    canvas.setStrokeColor(SAGE)
    canvas.line(50,40,A4[0]-50,40)
    canvas.setFont("Body",7)
    canvas.setFillColor(GREEN)
    canvas.drawString(50,27,"SCOPESATHI  |  WORKNOVA  |  PROPOSAL DRAFT  |  16 OCT 2026")
    canvas.drawRightString(A4[0]-50,27,str(doc.page))

doc=SimpleDocTemplate(str(OUT),pagesize=A4,rightMargin=50,leftMargin=50,topMargin=43,bottomMargin=54,title="ScopeSathi - Hackathon Proposal Draft",author="WorkNova")
doc.build(story,onFirstPage=footer,onLaterPages=footer)
print(OUT)
