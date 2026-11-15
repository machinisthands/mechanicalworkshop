# Mechanical Workshop – TKMCE

Study site for TKMCE mechanical workshop jobs, grouped by semester. Each job page has an
interactive 3D model, the engineering drawing, a process guide, a machining video and
(where available) sample / model questions.

**Live site:** https://machinisthands.github.io/tkmceworkshop/

![Site preview](doc/preview.png)

## Structure (HTML5 Boilerplate layout)

Pages, styles, scripts, images, models and documents each have one place:

```
.
├── index.html                 home page – job cards grouped by semester
├── 1year/<job>/index.html     job pages (latheRook, latheBowl, latheBishop, edmScooter)
├── cncLathe/ cncMilling/ cncMillingSub/ toolAndCutterGrinding/   job pages (index.html only)
├── css/style.css              the only stylesheet
├── js/
│   ├── app.js                 menu, slideshow, ads config, lazy-loading of the 3D viewer
│   ├── viewer.js              3D viewer (renders only when something moves)
│   └── vendor/                Three.js r112 + minified loaders, draco/ decoder
├── img/
│   ├── logo.png
│   ├── og-home.jpg            social preview of the home page (1200×630)
│   ├── banner/                slideshow: NN.webp, NN-640.webp (phones), NN-light*.webp
│   └── jobs/<job>/            drawing.webp, drawing-900.webp, drawing-full.jpg, thumb.webp,
│                              thumb-light.webp, og.jpg (WhatsApp/Facebook preview, 1200×630)
├── models/<job>.glb           Draco-compressed 3D models
├── docs/<job>/                process-guide.pdf, sample-questions.pdf, model-questions.pdf
├── doc/preview.png            screenshot used in this README
├── 404.html  robots.txt  sitemap.xml  site.webmanifest  .editorconfig
└── favicon.ico  icon.png  icon-512.png  icon.svg
```

Milling Sub uses the same sample / model question PDFs as Milling, so they are stored once
(`docs/cncMilling/`) and both pages link there.

Every page uses the HTML5 Boilerplate `<head>` order: charset, viewport, title, stylesheet,
description, Open Graph, icons, manifest, theme-color – followed by canonical URL and JSON-LD.
`js/app.js` is loaded at the end of `<body>`.

## How the pages are built

- **Semantic HTML:** `header`, `nav`, `main`, `article`, `section`, `footer`; one `h1` per page,
  `h2` for each section; menu and slideshow dots are real `<button>`s.
- **Flat DOM:** no framework wrappers – a job page has about 90 elements.
- **Structured data:** JSON-LD (`WebSite`, `Person`, `ItemList` on the home page;
  `LearningResource` + `BreadcrumbList` on each job page), canonical URL and Open Graph tags.
- **Speed:** no jQuery/Bootstrap; Three.js (≈0.6 MB) loads only when the 3D model scrolls
  into view; images are lazy-loaded with fixed sizes; no full-screen loading spinner.

## Adding a new job

1. Copy an existing job folder (it only holds `index.html`) and rename it.
2. Add `models/<job>.glb`, `img/jobs/<job>/` (drawing, thumbnails, og.jpg) and `docs/<job>/` PDFs.
3. In its `index.html` update the title, description, JSON-LD block, heading, semester badge,
   menu links, model path and resource buttons.
4. Add a card on the home page, the job to the home page JSON-LD list, and a line in `sitemap.xml`.

Convert a model: `npx @gltf-transform/cli draco input.gltf models/<job>.glb`

## Ads (Google AdSense)

Every page loads the AdSense script and the `google-adsense-account` meta tag.
Ad spaces are already placed where they cannot be clicked by accident:

| Page | Ad space (`data-ad`) | Where |
|---|---|---|
| Job pages | `article` | after the Engineering Drawing (Lathe Bishop: between Operations and CNC Program) |
| Job pages | `end` | after Resources, before the footer |
| Home page | `home` | after all job cards, before the footer |

None are next to the menu, the 3D viewer, the slideshow dots or the resource buttons.
Each is labelled "Advertisement", has space reserved (no layout jump), hides itself when Google
has no ad to show, and disappears if an ad blocker stops AdSense.

### To switch the ads on

1. **Make the site eligible.** AdSense checks the domain root (`https://machinisthands.github.io/`).
   Either create a repository named `machinisthands.github.io` with a real home page and `ads.txt`,
   or connect a custom domain to this site. Then add the site in AdSense and wait for approval.
2. **Create 3 ad units** in AdSense: *Ads → By ad unit → Display ads*, type *Responsive*.
3. **Paste the slot numbers** into `js/app.js` (top of the "Google AdSense" block):
   ```js
   slots: { article: "1234567890", end: "2345678901", home: "3456789012" }
   ```
   A slot left empty means that ad space is not shown at all.
4. **Turn Auto ads off** (or exclude the menu/3D areas) in AdSense, so Google does not add extra
   ads in places that clash with the page.

### Keeping ads safe for students

The code already sends `data-tag-for-age-treatment="2"` (Google's under-18 "teen" treatment) with
every ad request. The actual content filtering is done in AdSense:

1. **Brand safety → Content → Blocking controls → All sites → Sensitive categories** – block:
   Dating, Reference to Sex, Sexual & Reproductive Health, Gambling & Betting, Alcohol,
   Get Rich Quick, Black Magic / Astrology & Esoteric, Weight Loss, Cosmetic Procedures,
   Drugs & Supplements, Sensationalism (names can differ slightly by country).
   Restricted categories (e.g. Alcohol, Gambling) are blocked by default – keep them blocked.
2. **General categories → Apparel** – block *Swimwear* and *Underwear*.
3. **Ad review center** – check the ads shown on the site now and then, and block any single ad
   or advertiser that is not suitable.
4. **Auto ads** – keep off, so ads appear only in the reserved spaces.

Google filters on a best-effort basis and does not guarantee every unsuitable ad is caught,
so step 3 is worth doing regularly, especially after the site first goes live.
