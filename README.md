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

## TCGplayer data
For each card the script uses Scryfall's `tcgplayer_id` (or `tcgplayer_etched_id`) to call
`mpapi.tcgplayer.com/v2/product/{id}/pricepoints` (market price for Foil/Normal) and
`POST .../latestsales` (last 5 sales, matching the finish when possible). Results are stored in cards.json
(`priceSource`, `recentSales`, `salesFetched`) because browsers can't call these endpoints from a static site (CORS).
If TCGplayer fails, the Scryfall price is used and labelled. These are unofficial endpoints and may change.
Run `--refresh` to update prices and sales.
