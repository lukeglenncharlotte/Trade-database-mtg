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

On the quest tab, **Unlock a box** (or **Unlock this box** on a locked tile) runs a short ceremony: passphrase, a photo of the sealed display, the amount paid, then a commit straight to this repo. Owned tiles with a proof photo have **View proof**.

The site is static, so the browser calls the GitHub REST API. The only thing you type on a normal unlock is the passphrase.

1. **Passphrase.** The ritual stays closed until it matches the salted PBKDF2-SHA256 hash in `unlock` (`collector_boxes.json`, 100,000 iterations). There is no default passphrase. The passphrase itself is never stored.
2. **Sealed token.** A fine-grained GitHub token is encrypted in the browser and stored as `unlock.vault` (`ciphertext`, `iv`, and its own `salt`). The key is AES-GCM, derived with PBKDF2-SHA256 at 310,000 iterations. That salt is not the passphrase-verification salt. The plaintext token is never written to the repo. After a successful unlock the decrypted token is cached in `sessionStorage` for that tab only.

**One-time device setup**

Create a fine-grained personal access token: GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens. Resource owner: your user. Repository access: **Only select repositories** → `Trade-database-mtg`. Permission: **Contents: Read and write**. Copy the `github_pat_…` value once.

Setup appears only after the passphrase matches, and only when `unlock.vault` is not there yet. The same screen is also behind the small **device setup** link on the quest tab (passphrase first, then the paste box). The browser commits the ciphertext with that token. Every device after that just enters the passphrase, decrypts the token in memory, and the submission saves.

If GitHub rejects the sealed token as invalid or expired, the ritual says so and offers **Run device setup**. Paste a new token; the passphrase stays the same.

**Set or change the passphrase**

From a checkout of this repo:

```
python3 set_passphrase.py
```

It asks twice, writes `unlock.salt` and `unlock.hash`, and does not save the words. An existing `unlock.vault` is left as-is, still sealed with the previous passphrase, so run **device setup** again after the new hash is on `main`. Commit and push `collector_boxes.json`.

Or, on the quest tab, start **Unlock a box** before a hash exists (or after you clear `unlock.hash`). Enter the passphrase twice, choose **Create hash**, then continue into device setup. That saves the hash and the sealed token together.

The ritual asks for a photo, the vendor or seller, where you bought it (type a city or **online**, or **Use my location** to fill the city), the purchase date and time (editable, defaults to now), optional notes, and the amount paid. On the price step, **I purchased this for MSRP** fills the paid amount with that box's MSRP, disables the price field, and stores `msrpPurchase: true`. The option is unavailable when the box has no MSRP. The profile then shows the price as MSRP, 0% over MSRP, and the gain against that amount. It uploads a client-resized JPEG (longest side about 1200px) to `images/verified/<box-id>.jpg` and sets `owned`, `paid`, `vendor`, `location`, `notes`, `purchasedAt`, `submittedAt` (the moment you submit, not editable), `unlockedAt`, and `verificationPhoto`. Days owned are counted from `purchasedAt`. Click a tile for its purchase profile, or a teaser with MSRP and the current price if it is still locked. Tiles and profiles use the TCGplayer product photo in `imageUrl`. A 409 from GitHub refetches the file sha, reapplies the same box, and retries. An invalid or expired token offers device setup again. `python3 update_cards.py --refresh-boxes` updates prices and fills a missing product photo. It does not change ownership, purchase details, the hash, or the sealed vault.

`python3 update_cards.py --refresh-boxes` rewrites `lowestListed` and `market` from [tcgcsv.com](https://tcgcsv.com/) (TCGplayer low price and market price for the stored product id). If `imageUrl` is missing, it fills the TCGplayer product photo (`https://tcgplayer-cdn.tcgplayer.com/product/<id>_in_1000x1000.jpg`, or the tcgcsv `imageUrl` when there is no product id). It does not change `owned`, `paid`, `msrp`, names, links, or an image URL that is already set. `--refresh` does the card reprice and this box reprice together. Wizards was not publishing MSRP from February 2019 until Foundations (October 2024), so displays before Foundations — and the Japanese Final Fantasy printing, which has no USD MSRP on file — stay `null`. Where a box MSRP is filled in, it is Wizards' Collector Booster pack MSRP times the 12 packs in the display, or a retailer sheet that printed the display MSRP itself.

## TCGplayer data
For each card the script uses Scryfall's `tcgplayer_id` (or `tcgplayer_etched_id`) to call
`mpapi.tcgplayer.com/v2/product/{id}/pricepoints` (market price for Foil/Normal) and
`POST .../latestsales` (last 5 sales, matching the finish when possible). Results are stored in cards.json
(`priceSource`, `recentSales`, `salesFetched`) because browsers can't call these endpoints from a static site (CORS).
If TCGplayer fails, the Scryfall price is used and labelled. These are unofficial endpoints and may change.
Run `--refresh` to update prices and sales.
