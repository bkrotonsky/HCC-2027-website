# HCC-2027-website

NAU Hydropower Collegiate Competition (HCC27) capstone site. Static HTML/CSS/JS.

## Pages
- `index.html` Home
- `team.html` Team
- `documents.html` Documents (locked behind the admin login)
- `gallery.html` Gallery (article-style posts)

## Adding a gallery post
Open `js/gallery.js` and add an entry to the `POSTS` list (date, title, excerpt, cover image path). Drop the cover image in `images/gallery/`.

## Unlocking documents
Click the invisible bubble in the bottom-left corner of any page and log in. See `js/admin.js`.
The gate is client-side only; restrict `documents/` on the server for real protection.

## Placeholder images (replace by adding a file at the same path)
- `images/home/hero-team.jpg`, `site-research.jpg`, `design-work.jpg`, `collaboration.jpg`
- `images/team/zachery-johnson.jpg`, `ben-krotonsky.jpg`, `tyler-loggins.jpg`, `zach-mills.jpg`, `robert-wanek.jpg`
- `images/gallery/k12-outreach-planning.jpg`, `industry-conversations.jpg`, `npd-screening.jpg`, `capstone-kickoff.jpg`

## Placeholder PDFs (replace by uploading a real PDF with the same name)
All 18 files in `documents/`, for example `documents/presentation-1.pdf`.
