# Hero portraits — provenance

All portraits are the game's own hero card art as published on the Kingshot community
wiki (https://kingshotwiki.com/heroes/ — hero index page, fetched 2026-08-21, name →
portrait matched by each card's `title` attribute).

Each file here is a 256×256 center-crop re-encode (WebP, q82) of the wiki's uploaded
original, converted with ffmpeg. Originals are hosted by the wiki on AWS S3
(`got-global-wiki.s3.us-west-1.amazonaws.com`):

| File | Source URL (as listed on the wiki) |
|---|---|
| alcar.webp | https://got-global-wiki.s3.us-west-1.amazonaws.com/wp-content/uploads/2025/10/%E7%BB%84-15.png |
| amadeus.webp | https://got-global-wiki.s3.us-west-1.amazonaws.com/wp-content/uploads/2025/10/%E7%BB%84-25.png |
| amane.webp | https://got-global-wiki.s3.us-west-1.amazonaws.com/wp-content/uploads/2025/10/%E7%BB%84-9.png |
| ava.webp | https://got-global-wiki.s3.us-west-1.amazonaws.com/wp-content/uploads/2026/05/Ava.png |
| chenko.webp | https://got-global-wiki.s3.us-west-1.amazonaws.com/wp-content/uploads/2025/10/%E7%BB%84-7.png |
| helga.webp | https://got-global-wiki.s3.us-west-1.amazonaws.com/wp-content/uploads/2025/10/%E7%BB%84-27.png |
| hilde.webp | https://got-global-wiki.s3.us-west-1.amazonaws.com/wp-content/uploads/2025/10/%E7%BB%84-23.png |
| jabel.webp | https://got-global-wiki.s3.us-west-1.amazonaws.com/wp-content/uploads/2025/10/%E7%BB%84-24.png |
| margot.webp | https://got-global-wiki.s3.us-west-1.amazonaws.com/wp-content/uploads/2025/10/%E7%BB%84-22.png |
| marlin.webp | https://got-global-wiki.s3.us-west-1.amazonaws.com/wp-content/uploads/2025/10/%E7%BB%84-19.png |
| petra.webp | https://got-global-wiki.s3.us-west-1.amazonaws.com/wp-content/uploads/2025/10/%E7%BB%84-21.png |
| rosa.webp | https://got-global-wiki.s3.us-west-1.amazonaws.com/wp-content/uploads/2025/10/%E7%BB%84-16.png |
| saul.webp | https://got-global-wiki.s3.us-west-1.amazonaws.com/wp-content/uploads/2025/10/%E7%BB%84-20.png |
| thrud.webp | https://got-global-wiki.s3.us-west-1.amazonaws.com/wp-content/uploads/2025/10/%E7%BB%84-13.png |
| vivian.webp | https://got-global-wiki.s3.us-west-1.amazonaws.com/wp-content/uploads/2025/10/%E7%BB%84-12.png |
| weewoo.webp | https://got-global-wiki.s3.us-west-1.amazonaws.com/wp-content/uploads/2026/05/WeeWoo.png |
| yang.webp | https://got-global-wiki.s3.us-west-1.amazonaws.com/wp-content/uploads/2026/04/3-Yang.jpg |
| yeonwoo.webp | https://got-global-wiki.s3.us-west-1.amazonaws.com/wp-content/uploads/2025/10/%E7%BB%84-10.png |
| zoe.webp | https://got-global-wiki.s3.us-west-1.amazonaws.com/wp-content/uploads/2025/10/%E7%BB%84-17.png |

Served locally from this repo so the page stays fully offline-static (no hotlinks).
