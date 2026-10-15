# Documentation image generation

Generated on 16 October 2026 using the built-in image_gen tool. These are explanatory illustrations, not screenshots, benchmarks or proof of live configuration. Reviewed for labels, relationships and pending-mail status. Source captions and adjacent prose are the accessible technical explanation.

## cloud-architecture.png

```text
Use case: infographic-diagram
Asset type: landscape architecture image for ScopeSathi repository documentation.
Create a polished, extremely legible technical architecture infographic, wide 3:2 layout, warm off-white background, forest green headings, sage green service cards, restrained amber dashed outlines for pending setup. Flat vector-like illustration with subtle depth, crisp dark text, ample whitespace, no decorative fake logos. Title exactly "ScopeSathi • Cloud architecture".
Three clearly separated horizontal zones:
Top "Source to deployment": four cards connected left-to-right by arrows: "GitHub / main", "Cloud Build", "Artifact Registry", "Cloud Run". Small note "Build → publish → deploy".
Middle "Application": Browser card left; Cloud Run central prominent card containing text "React frontend + Express API" and "europe-west1 • scopesathi-api". Browser to Cloud Run arrow labeled "HTTPS + Firebase ID token". Firebase Authentication card above Browser connected only to Browser, label "Google sign-in". Right of Cloud Run two cards "Firestore" with subtitle "Projects • decisions • mail outbox", and "Vertex AI / Gemini" with subtitle "Validated proposals • human approval". Cloud Run connected to each; Firestore arrow bidirectional. Under Cloud Run note "Attached runtime identity • ADC". Below middle zone a clear strip "Min 0 • Max 1 • Concurrency 20 • Request-based billing".
Bottom amber dashed zone headed "Hosted mail • owner setup required": cards "Cloud Scheduler" arrow to "OIDC mail endpoint" arrow to "Gmail SMTP"; "Secret Manager" card with arrow to OIDC endpoint labeled "SMTP credentials". Small note "One outbox job per scheduled request".
Constraints: No Browser→Firestore arrow. No direct GitHub→runtime arrow. No service account key file. Do not imply hosted mail verified. Add bottom small caption "Design illustration • configuration is not proof of live execution". Prioritize accurate spellings and arrow endpoints; no extra technical elements or text.
```

## cloud-architecture.png — correction

```text
Edit this architecture image. Change only the small subtitle inside the bottom-left Cloud Scheduler card from 'Trigger outbox job (e.g. hourly)' to exactly 'Every 5 minutes (proposed)'. Preserve every other label, all arrows, all layout, colors and shapes unchanged.
```

## cloud-scaling.png

```text
Use case: infographic-diagram
Asset type: documentation explainer, 3:2 landscape raster image.
Create a highly readable ScopeSathi infographic titled "How scaling works". Warm off-white background, forest-green typography, sage green panels, simple flat pictograms, generous whitespace, no logos, no tiny text.
Three large numbered panels from left to right connected by arrows:
1 title "Idle", subtitle "Minimum 0", illustration empty container outline, text "Can scale to zero".
2 title "Request arrives", subtitle "Cold start", illustration one container awakening, text "Startup may add latency".
3 title "Serving requests", subtitle "Maximum 1 instance", illustration exactly ONE container with several request dots entering it, text "Up to 20 in-flight requests".
Below a full-width amber panel title "When capacity is full" text "Extra requests may wait or fail." and "Maximum 1 restricts scale-out."
Bottom two separate short green captions "Concurrency ≠ users per minute" and "Instance limits ≠ spending caps".
Footer small "Prototype settings • capacity has not been load tested".
All text exact, no graphs claiming measured performance, no extra containers in active panel. Crisp typography, professional technical documentation aesthetic.
```

## release-workflow.png

```text
Use case: infographic-diagram
Asset type: ScopeSathi technical documentation image, landscape 3:2.
Create a clear editorial infographic titled "From commit to live update", off-white background, forest green type, sage rounded panels, restrained amber warning panel, clean flat pictograms, ample whitespace. No brand logos needed.
Five numbered steps arranged along ONE continuous reading path: top row 1→2→3, then a clearly routed arrow down from step3 to step4 on bottom left, then step4→step5 bottom right.
Exact step labels and text:
"1 • Check locally" / "Run relevant tests and build"
"2 • Push main" / "Send the intended commit to GitHub"
"3 • Cloud Build" / "Build image → publish → deploy"
"4 • Verify revision" / "Check build result and commit SHA"
"5 • Test live app" / "Sign-in • project access • AI workflow"
Below all steps one amber box headed "Settings remain separate", body "Git pushes do not upload .env files, create secrets, grant IAM roles, or configure Scheduler."
Footer "Failed build? Inspect logs and retry the build after fixing the cause."
Constraints: large readable exact typography, no claim tests run automatically inside Cloud Build, no claim SMTP already configured, no automatic rollback or measured performance. Technical guide quality, avoid clutter.
```

