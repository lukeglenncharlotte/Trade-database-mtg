# Luke's Trade Database

Published at https://lukeglenncharlotte.github.io/Trade-database-mtg/

Static showcase (index.html, app.js, styles.css, cards.json). No build step.
Preview: `python3 -m http.server 8000` in this folder → http://localhost:8000. Host on any static host (GitHub Pages, Netlify, Cloudflare Pages).

## update_cards.py (Python 3, stdlib only)
Enriches cards via Scryfall (name, printing, treatment, finish, specific foil type from `promo_types`, finish-matched price, images), dedupes by set+number+finish+collection, sorts by price, writes cards.json.

```
# Import an Archidekt deck (modifier Foil/Etched respected)
python3 update_cards.py --archidekt https://archidekt.com/decks/21814845 --collection "Big Marn deck" --hp Scrubland --top 50

# Cards identified from photos: CSV of set,number,finish[,qty[,condition]]
python3 update_cards.py --list binder1.csv --collection "Binder 1"
#   e.g.  sld,1591,foil,1,NM   |  mh2,479,nonfoil  |  cmm,694,etched,1,HP

# One-offs
python3 update_cards.py --card "otp 68 foil" --card "3ed 286 nonfoil" --collection "Trade binder"

# Re-price everything
python3 update_cards.py --refresh
```
`--top N` keeps only the N most valuable cards overall (omit to keep all). HP cards are priced at 65% of NM and flagged as estimated; cards lacking a price for their finish fall back to the other finish and are flagged "est.".

`--refresh` also updates Collector Box Quest prices (see below). Boxes alone:

```
python3 update_cards.py --refresh-boxes
```

## Collector Box Quest

The second tab is a sealed Collector Booster display collection. Data is `collector_boxes.json` (no build step). The page reads that file as-is.

To mark a box owned later, edit that one object and set `"owned"` to `true`. Optional `"paid"` is what Luke paid, in USD. Leave `"msrp"` null when you don't have a real Wizards or retailer MSRP — the page shows n/a, and a guessed number is worse than a blank. Example, the Reality Fracture display:

```json
{
  "id": "fra",
  "owned": true,
  "paid": 323.88
}
```

Commit the file and push to `main`. GitHub Pages redeploys from that push.

`python3 update_cards.py --refresh-boxes` rewrites `lowestListed` and `market` from [tcgcsv.com](https://tcgcsv.com/) (TCGplayer low price and market price for the stored product id). If `imageUrl` is missing, it fills the TCGplayer product photo (`https://tcgplayer-cdn.tcgplayer.com/product/<id>_in_1000x1000.jpg`, or the tcgcsv `imageUrl` when there is no product id). It does not change `owned`, `paid`, `msrp`, names, links, or an image URL that is already set. `--refresh` does the card reprice and this box reprice together. Wizards was not publishing MSRP from February 2019 until Foundations (October 2024), so displays before Foundations — and the Japanese Final Fantasy printing, which has no USD MSRP on file — stay `null`. Where a box MSRP is filled in, it is Wizards' Collector Booster pack MSRP times the 12 packs in the display, or a retailer sheet that printed the display MSRP itself.

## TCGplayer data
For each card the script uses Scryfall's `tcgplayer_id` (or `tcgplayer_etched_id`) to call
`mpapi.tcgplayer.com/v2/product/{id}/pricepoints` (market price for Foil/Normal) and
`POST .../latestsales` (last 5 sales, matching the finish when possible). Results are stored in cards.json
(`priceSource`, `recentSales`, `salesFetched`) because browsers can't call these endpoints from a static site (CORS).
If TCGplayer fails, the Scryfall price is used and labelled. These are unofficial endpoints and may change.
Run `--refresh` to update prices and sales.
