# Product photos

Place English-edition product photos in public/products/. Files are copied into the deployment; adding files requires a new build/deploy. Existing pixelart originals stay untouched.

Use lowercase filenames. WebP is preferred; PNG, JPG and JPEG are also accepted. Keep the same stem below and use the true file extension. A pack image is shared by 1-, 2- and 3-pack rewards; the Amount column specifies the awarded quantity.

| Set                       | Pack photo                         | Booster box photo                 |
| ------------------------- | ---------------------------------- | --------------------------------- |
| #01 The First Chapter     | 01-the-first-chapter-pack.webp     | 01-the-first-chapter-box.webp     |
| #02 Rise of the Floodborn | 02-rise-of-the-floodborn-pack.webp | 02-rise-of-the-floodborn-box.webp |
| #03 Into the Inklands     | 03-into-the-inklands-pack.webp     | 03-into-the-inklands-box.webp     |
| #04 Ursula's Return       | 04-ursulas-return-pack.webp        | 04-ursulas-return-box.webp        |
| #05 Shimmering Skies      | 05-shimmering-skies-pack.webp      | 05-shimmering-skies-box.webp      |
| #06 Azurite Sea           | 06-azurite-sea-pack.webp           | 06-azurite-sea-box.webp           |
| #07 Archazia's Island     | 07-archazias-island-pack.webp      | 07-archazias-island-box.webp      |
| #08 Reign of Jafar        | 08-reign-of-jafar-pack.webp        | 08-reign-of-jafar-box.webp        |
| #09 Fabled                | 09-fabled-pack.webp                | 09-fabled-box.webp                |
| #10 Whispers in the Well  | 10-whispers-in-the-well-pack.webp  | 10-whispers-in-the-well-box.webp  |
| #11 Winterspell           | 11-winterspell-pack.webp           | 11-winterspell-box.webp           |
| #12 Wilds Unknown         | 12-wilds-unknown-pack.webp         | 12-wilds-unknown-box.webp         |
| #13 Attack of the Vine!   | 13-attack-of-the-vine-pack.webp    | 13-attack-of-the-vine-box.webp    |
| #14 Hyperia City          | 14-hyperia-city-pack.webp          | 14-hyperia-city-box.webp          |

Other filenames:

- d23-collection-2026.webp
- sample-psa-9.webp
- sample-psa-10.webp
- sample-mystery.webp

Use photos of your actual graded cards and mystery-box packaging. Generic PSA sample entries do not identify a specific real card. For additional items, edit the Image path field to point at /products/your-item.webp. Only local product files are accepted.

The shared page layout discovers available files at build time. Player stock previews, pull results, collection/history cards and the best-pull summary use the same photo lookup as admin. Missing images show NO PHOTO without issuing broken requests. Public catalog values and quantities remain fictional. Source references for official and owner-supplied images are in `product-image-sources.md`.

As of v0.1.12, all 14 booster-box photos are installed as PNG files using the stems above. Pack photos exist for sets #01–#04, and the D23 photo is also installed. Pack photos for #05–#14 and photos for the PSA/mystery entries remain to be supplied. Keep new original downloads in `images/`; copy only the matched product files into `public/products/`.
