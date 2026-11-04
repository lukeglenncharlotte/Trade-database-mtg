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

`--refresh` also updates Collector Box Quest and Collector Commander Quest prices (see below). Sealed products alone:

```
python3 update_cards.py --refresh-boxes
```

## Collector Box Quest

The second tab is a sealed Collector Booster display collection. Data is `collector_boxes.json` (no build step). The page reads that file as-is.

You can still mark a box owned by hand: set `"owned"` to `true` on that object. Optional `"paid"` is what Luke paid, in USD. Leave `"msrp"` null when you don't have a real Wizards or retailer MSRP — the page shows n/a, and a guessed number is worse than a blank. Example, the Reality Fracture display:

```json
{
  "id": "fra",
  "owned": true,
  "paid": 323.88
}
```

Commit the file and push to `main`. GitHub Pages redeploys from that push.

### Unlock ritual

On the quest tab, **Unlock a box** (or **Unlock this box** on a locked tile) asks for a photo of the sealed display, the vendor or seller, where you bought it (type a city or **online**, or **Use my location**), the purchase date and time (editable, defaults to now), optional notes, and the amount paid. On the price step, **I purchased this for MSRP** fills the paid amount with that box's MSRP, disables the price field, and stores `msrpPurchase: true`. The option is unavailable when the box has no MSRP. There is no passphrase and no token.

Break the seal saves that unlock in `localStorage` on this browser only (`cbq-local-unlocks`). The page merges those records over `collector_boxes.json` for display. A box already owned in the JSON, such as The Hobbit, is left as it is. The photo is a JPEG, longest side at most 1600 pixels, kept under 2MB.

The same moment, the browser PUTs that JPEG to `https://ntfy.sh/r1q-ff7fbe21564bbd7038b8995a` so the unlock can be written into the repo. On success the ritual says **Sent ✓, it'll be permanent shortly** and plays the unlock animation. If the send fails, **Retry** tries the same photo and details again. The shelf still shows the box on this device either way.

The request is:

- Method and URL: `PUT https://ntfy.sh/r1q-ff7fbe21564bbd7038b8995a`
- Body: the JPEG bytes (`Content-Type: image/jpeg`)
- `Filename`: `<box id>.jpg`
- `Title`: `Collector box <box id>` (a short label, not the payload; ntfy limits titles to 1 KB)
- `X-Message`: base64, standard alphabet, no line breaks, of the UTF-8 JSON below. This is the notification body. ntfy allows 4,096 bytes here, so the encoded value is kept at 4,000 characters or less. Notes are shortened only if a very long note would pass that.

```json
{"id":"fra","paid":323.88,"msrpPurchase":true,"vendor":"Micro Center","location":"Charlotte, NC","purchasedAt":"2026-08-14T14:19:00.000Z","submittedAt":"2026-11-02T16:30:00.000Z","notes":""}
```

Keys stay in that order. `paid` is a number. `msrpPurchase` is a boolean. `vendor`, `location`, and `notes` are strings (`""` when empty). `purchasedAt` and `submittedAt` are ISO-8601 timestamps. Decode `X-Message` with UTF-8 base64 to get that JSON.

To make an unlock permanent, put those fields on the box in `collector_boxes.json`, set `owned` to `true`, and push to `main`. You can still mark a box owned by editing the file directly.

Days owned are counted from `purchasedAt`. Click a tile for its purchase profile, or a teaser with MSRP and the current price if it is still locked. The profile shows the price as MSRP, 0% over MSRP, and the gain against that amount when it was an MSRP purchase. Tiles and profiles use the TCGplayer product photo in `imageUrl`. `python3 update_cards.py --refresh-boxes` updates prices and fills a missing product photo. It does not change ownership or purchase details.

`python3 update_cards.py --refresh-boxes` rewrites `lowestListed` and `market` from [tcgcsv.com](https://tcgcsv.com/) (TCGplayer low price and market price for the stored product id) for collector boxes and Collector's Edition commander decks. If `imageUrl` is missing, it fills the TCGplayer product photo (`https://tcgplayer-cdn.tcgplayer.com/product/<id>_in_1000x1000.jpg`, or the tcgcsv `imageUrl` when there is no product id). It does not change `owned`, `paid`, `msrp`, names, links, or an image URL that is already set. `--refresh` does the card reprice and this sealed reprice together. Wizards was not publishing MSRP from February 2019 until Foundations (October 2024), so displays before Foundations — and the Japanese Final Fantasy printing, which has no USD MSRP on file — stay `null`. Where a box MSRP is filled in, it is Wizards' Collector Booster pack MSRP times the 12 packs in the display, or a retailer sheet that printed the display MSRP itself.

## Collector Commander Quest

The third tab is the sealed Collector's Edition Commander decks, the all-foil versions sold as their own product. Data is `collector_precons.json`. The page uses the same shelf, progress bar, prices, photos, and unlock ritual as Collector Box Quest. Each deck is its own entry. Four-deck cases are not listed.

Mark a deck owned the same way as a box. Doom Prevails is already owned, with paid, vendor, and the purchase date left empty. Leave `"msrp"` null when there is no real Wizards or retailer price.

The unlock ritual is the same: proof photo, amount paid, **I purchased this for MSRP**, vendor, location, and an editable purchase date and time. It saves on this browser only (`ccq-local-unlocks`) and merges over the JSON. A deck already owned in the file, such as Doom Prevails, is left as it is. The photo goes to the same ntfy topic as a collector box. The JSON in `X-Message` adds `"kind":"precon"` as the first key so a precon can be told apart from a box:

```json
{"kind":"precon","id":"msh-doom","paid":159.99,"msrpPurchase":true,"vendor":"Micro Center","location":"Charlotte, NC","purchasedAt":"2026-06-26T18:00:00.000Z","submittedAt":"2026-11-04T16:30:00.000Z","notes":""}
```

The other keys stay in the box order. `Title` is `Collector precon <deck id>`. `Filename` is `<deck id>.jpg`.

`python3 update_cards.py --refresh-boxes` updates these deck prices along with the boxes.

## TCGplayer data
For each card the script uses Scryfall's `tcgplayer_id` (or `tcgplayer_etched_id`) to call
`mpapi.tcgplayer.com/v2/product/{id}/pricepoints` (market price for Foil/Normal) and
`POST .../latestsales` (last 5 sales, matching the finish when possible). Results are stored in cards.json
(`priceSource`, `recentSales`, `salesFetched`) because browsers can't call these endpoints from a static site (CORS).
If TCGplayer fails, the Scryfall price is used and labelled. These are unofficial endpoints and may change.
Run `--refresh` to update prices and sales.
