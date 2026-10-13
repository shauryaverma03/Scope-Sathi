# Contributing and safe release

[Documentation home](README.md)

## Develop

Use Node.js 22+ and npm ci. Create .env from .env.example only when no configured .env exists. npm run dev starts Vite and the backend. Use isolated demo data for screenshots/tests; do not alter real client projects to prepare documentation.

## Verify

```sh
npm run check
npm test
npm run build
```

Live Firestore/invitation scripts require deliberately configured credentials and create temporary fixtures. Read the scripts before running. They are not part of a documentation-only change and do not establish model quality or email inbox delivery.

## Update documentation

Keep README.md as the entry point and docs/README.md as the complete index. Explain why, how and limitations alongside new features. Update Mermaid diagrams when boundaries change. Use actual app screenshots with demo data in docs/images and record provenance. Never portray a template preview as a delivered email or a prepared sample as live AI.

## Commit yourself

```sh
git status
git add README.md docs/
git diff --cached --stat
git diff --cached
git commit -m "docs: add illustrated product and architecture documentation"
git push
```

Review all staged changes, including anything staged earlier. Do not stage .env, private keys, local databases or password files. These commands are instructions for the maintainer; documentation creation does not commit, push or deploy anything.

## Release gate

Confirm intended mode, actual Firestore read/write persistence, cross-user access rejection, Google login on the deployed hostname, model access if advertised and mail behavior under the chosen hosting lifecycle. Verify secrets/roles and the supplied deny-all client rules. Obtain billing approval separately; a budget alert is not a spending cap.
