# Red Oven Dough

A pizza dough planner in a red, navy, and cream palette. It is a static site: HTML, CSS, and JavaScript in `site/`, with no account, backend, database, or build step.

The calculator makes 1–12 dough balls at approximately 250 g each. It supports 00, bread, plain, and wholemeal flour blends, two salt types, and proof windows from 2–72 hours. Longer windows use a cold prove, with refrigeration after balling and a warm-up before baking.

Visitors can copy a plain-text recipe or a link that restores their batch size, salt, flour blend, and proof window. The link stores a relative proof window, so each visitor's schedule starts when they open it. A 1200×630 social image in `site/social-card.png` is used for link previews.

## Preview locally

With Node.js installed:

```sh
node serve-local.js
```

Open `http://127.0.0.1:8787`.

The original Docker option also works:

```sh
docker compose up -d --build
```

Open `http://localhost:8085`.

## Publish on Cloudflare Pages

For a quick public link, use **Direct Upload** in the Cloudflare dashboard:

1. Open **Workers & Pages → Create application → Get started → Drag and drop your files**.
2. Give the project the name `red-oven-dough`.
3. Drag in the **`site` folder** (or a ZIP containing its contents at the top level). Do not upload the repository root; `index.html` must be at the published root.
4. Select **Deploy site**. Cloudflare will provide a `*.pages.dev` URL.
5. Check that the actual URL is `https://red-oven-dough.pages.dev/`. The Open Graph image and canonical URL in `site/index.html` use that address because link-preview bots read the HTML without running JavaScript. If Cloudflare assigns a different address, replace both URLs in `site/index.html`, re-upload the files, and test the link preview before posting to Discord.

Cloudflare's [Direct Upload guide](https://developers.cloudflare.com/pages/get-started/direct-upload/) has the current dashboard steps. Direct Upload projects cannot later be switched to Git integration; a new Pages project would be needed for automatic deploys. If you want automatic redeploys from Git, create a Git repository first and use [Git integration](https://developers.cloudflare.com/pages/framework-guides/deploy-anything/) with build command `exit 0` and output directory `site`.

For command-line upload, Cloudflare documents `npx wrangler pages deploy site` after login and project creation.

The social image can be regenerated on Windows with `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/generate-social-card.ps1`.

## Recipe model

`site/app.js` holds the ingredient and timing rules. Flour is calculated from the target dough weight after accounting for water, salt, yeast, and olive oil (using 0.91 g/ml for the oil). Displayed quantities are rounded, so measured dough weight may vary slightly. The schedule is a planning guide; actual fermentation depends on temperature and flour.
