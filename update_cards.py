#!/usr/bin/env python3
"""Add/refresh cards in cards.json. See README.md."""
import argparse, csv, json, os, re, sys, time, urllib.request, datetime

HERE = os.path.dirname(os.path.abspath(__file__))
DB = os.path.join(HERE, "cards.json")
UA = {"User-Agent": "LukeCardShowcase/1.0", "Accept": "application/json"}
FOIL_NAMES = {
 "surgefoil":"Surge foil","galaxyfoil":"Galaxy foil","textured":"Textured foil",
 "stepandcompleat":"Step-and-Compleat foil","confettifoil":"Confetti foil",
 "doublerainbow":"Double rainbow foil","halofoil":"Halo foil","ripplefoil":"Ripple foil",
 "fracturefoil":"Fracture foil","raisedfoil":"Raised foil","serialized":"Serialized foil",
 "oilslick":"Oil slick raised foil","neonink":"Neon ink foil","gilded":"Gilded foil",
 "rainbowfoil":"Rainbow foil","silverfoil":"Silver foil","dossier":"Dossier foil",
 "invisibleink":"Invisible ink foil","manafoil":"Mana foil","cosmicfoil":"Cosmic foil",
 "chocobotrackfoil":"Chocobo track foil","singularityfoil":"Singularity foil",
 "firstplacefoil":"First-place foil","dragonscalefoil":"Dragonscale foil",
 "sunfoil":"Sun foil","headliner":"Headliner foil","shatteredglass":"Shattered glass foil",
}

def get(url):
    time.sleep(0.1)
    with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=30) as r:
        return json.load(r)

TCG_H = {"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) Chrome/130", "Origin": "https://www.tcgplayer.com",
         "Referer": "https://www.tcgplayer.com/", "Content-Type": "application/json", "Accept": "application/json"}

def tcg(url, body=None):
    try:
        req = urllib.request.Request(url, headers=TCG_H, data=json.dumps(body).encode() if body else None)
        with urllib.request.urlopen(req, timeout=20) as r: return json.load(r)
    except Exception as ex:
        print("  tcgplayer fail", url, ex, file=sys.stderr); return None

def tcg_data(pid, finish):
    """Market price for this printing + last 5 sales (matching variant when possible)."""
    want = "Normal" if finish == "nonfoil" else "Foil"
    out = {"market": None, "sales": None}
    pp = tcg(f"https://mpapi.tcgplayer.com/v2/product/{pid}/pricepoints")
    if isinstance(pp, list):
        for p in pp:
            if p.get("printingType") == want and p.get("marketPrice"): out["market"] = p["marketPrice"]
    ls = tcg(f"https://mpapi.tcgplayer.com/v2/product/{pid}/latestsales", {"listingType": "All", "offset": 0, "limit": 25})
    if ls and "data" in ls:
        d = ls["data"]; m = [x for x in d if x.get("variant") == want]
        out["sales"] = [{"date": x["orderDate"][:10], "condition": x.get("condition"), "variant": x.get("variant"),
                         "price": x.get("purchasePrice"), "shipping": x.get("shippingPrice"), "qty": x.get("quantity")}
                        for x in (m or d)[:5]]
        out["salesMatchedVariant"] = bool(m)
    return out

def norm_finish(f):
    f = (f or "").strip().lower()
    if f.startswith("etch"): return "etched"
    if f in ("foil", "f", "yes", "true"): return "foil"
    return "nonfoil"

def enrich(set_code, num, finish, qty=1, condition="NM/LP", collection="Unsorted"):
    c = get(f"https://api.scryfall.com/cards/{set_code.lower()}/{num}")
    finish = norm_finish(finish)
    if finish not in c.get("finishes", []) and len(c.get("finishes", [])) == 1:
        finish = c["finishes"][0]
    pt = c.get("promo_types", []) or []
    if finish == "nonfoil": foil = None
    elif finish == "etched": foil = "Etched foil"
    else:
        sp = [FOIL_NAMES[p] for p in pt if p in FOIL_NAMES]
        foil = sp[0] if sp else "Traditional foil"
    fe = c.get("frame_effects", []) or []
    tr = []
    if c.get("border_color") == "borderless": tr.append("Borderless")
    if "showcase" in fe: tr.append("Showcase")
    if "extendedart" in fe: tr.append("Extended art")
    if "etched" in fe and finish != "etched": tr.append("Etched frame")
    if c.get("frame") in ("1993", "1997"): tr.append("Retro frame" if c["set_type"] != "core" and c.get("released_at","") > "2003" else "Original frame")
    if c.get("full_art"): tr.append("Full art")
    if c.get("set") == "sld" or c.get("set_type") == "box" and "Secret Lair" in c.get("set_name",""):
        tr.append("Secret Lair")
    for p in pt:
        if p not in FOIL_NAMES and p not in ("boosterfun","playtest","universesbeyond","sourcematerial","ffxiv","ff","mediainsert","alchemy","rebalanced"):
            tr.append({"prerelease":"Prerelease promo","promopack":"Promo pack","bundle":"Bundle promo",
                       "buyabox":"Buy-a-box promo","judgegift":"Judge promo","boxtopper":"Box topper",
                       "poster":"Poster","stamped":"Stamped","datestamped":"Date-stamped"}.get(p, p.title()))
    if c.get("textless"): tr.append("Textless")
    pk = {"foil":"usd_foil","etched":"usd_etched","nonfoil":"usd"}[finish]
    price = c.get("prices", {}).get(pk)
    est = False
    if price is None:
        price = c["prices"].get("usd") or c["prices"].get("usd_foil"); est = True
    price = float(price) if price else None
    if price is not None and condition.upper().startswith("HP"):
        price = round(price * 0.65, 2); est = True
    faces = c.get("card_faces") or []
    imgs = [c["image_uris"]] if c.get("image_uris") else [f["image_uris"] for f in faces if f.get("image_uris")]
    img = imgs[0] if imgs else {}
    pid = c.get("tcgplayer_etched_id") if finish == "etched" and c.get("tcgplayer_etched_id") else c.get("tcgplayer_id")
    t = tcg_data(pid, finish) if pid else {"market": None, "sales": None}
    src = "Scryfall (TCGplayer feed)"
    if t["market"] is not None:
        nm = float(t["market"]); src = "TCGplayer market (live)"; est = False
        price = round(nm * 0.65, 2) if condition.upper().startswith("HP") else nm
        if condition.upper().startswith("HP"): est = True
    return {
      "id": f"{c['set']}-{c['collector_number']}-{finish}-{collection}".lower().replace(" ", "_"),
      "name": c["name"], "set": c["set_name"], "setCode": c["set"].upper(),
      "collectorNumber": c["collector_number"], "rarity": c["rarity"],
      "treatment": ", ".join(dict.fromkeys(tr)) or "Regular", "finish": finish,
      "foilType": foil, "condition": condition, "quantity": int(qty),
      "priceUsd": price, "priceEstimated": est,
      "priceUpdated": datetime.date.today().isoformat(),
      "priceSource": src, "tcgplayerId": pid,
      "recentSales": t["sales"], "salesMatchedVariant": t.get("salesMatchedVariant"),
      "salesFetched": datetime.datetime.now().isoformat(timespec="minutes") if t["sales"] is not None else None,
      "imageUrl": img.get("large") or img.get("normal"), "imageLarge": img.get("png") or img.get("large"),
      "faceImages": [i.get("large") for i in imgs] if len(imgs) > 1 else None,
      "scryfallUri": c["scryfall_uri"].split("?")[0],
      "tcgplayerUri": f"https://www.tcgplayer.com/product/{pid}" if pid else (c.get("purchase_uris") or {}).get("tcgplayer"),
      "artist": c.get("artist"), "collection": collection,
    }

def load():
    if os.path.exists(DB):
        with open(DB) as f: return json.load(f)
    return {"updated": None, "cards": []}

def save(db, top=None):
    seen = {}
    for c in db["cards"]: seen[c["id"]] = c   # later wins = dedupe
    cards = sorted(seen.values(), key=lambda c: -(c["priceUsd"] or 0))
    if top: cards = cards[:top]
    db["cards"] = cards; db["updated"] = datetime.datetime.now().isoformat(timespec="minutes")
    with open(DB, "w") as f: json.dump(db, f, indent=1)
    print(f"cards.json: {len(cards)} cards, total ${sum((c['priceUsd'] or 0)*c['quantity'] for c in cards):,.2f}")

def from_archidekt(url, collection):
    did = re.search(r"decks/(\d+)", url).group(1)
    d = get(f"https://archidekt.com/api/decks/{did}/")
    collection = collection or d.get("name") or f"Archidekt {did}"
    out = []
    for e in d["cards"]:
        if "Maybeboard" in (e.get("categories") or []): continue
        ed = e["card"]["edition"]["editioncode"]; num = e["card"]["collectorNumber"]
        mod = (e.get("modifier") or "Normal")
        out.append((ed, num, mod, e.get("quantity", 1)))
    return out, collection

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--archidekt", help="Archidekt deck URL")
    ap.add_argument("--list", help="CSV/text file: set,number,finish[,qty[,condition]]")
    ap.add_argument("--card", action="append", default=[], help='"set number finish" e.g. "sld 1234 foil"')
    ap.add_argument("--collection", default=None)
    ap.add_argument("--condition", default="NM/LP")
    ap.add_argument("--hp", action="append", default=[], help="card name to mark HP")
    ap.add_argument("--top", type=int, help="keep only the N most valuable cards overall")
    ap.add_argument("--refresh", action="store_true", help="re-price all existing cards")
    a = ap.parse_args()
    db = load(); rows = []; coll = a.collection or "Unsorted"
    if a.archidekt:
        rows, coll = from_archidekt(a.archidekt, a.collection)
    if a.list:
        for r in csv.reader(open(a.list)):
            if not r or r[0].startswith("#") or r[0].lower() == "set": continue
            r = [x.strip() for x in r] + ["", "1", a.condition]
            rows.append((r[0], r[1], r[2] or "nonfoil", int(r[3] or 1), r[4] or a.condition))
    for s in a.card:
        p = s.split(); rows.append((p[0], p[1], p[2] if len(p) > 2 else "nonfoil", 1))
    for r in rows:
        cond = r[4] if len(r) > 4 else a.condition
        try:
            c = enrich(r[0], r[1], r[2], r[3], cond, coll)
            if c["name"] in a.hp or any(h.lower() in c["name"].lower() for h in a.hp):
                c = enrich(r[0], r[1], r[2], r[3], "HP", coll)
            db["cards"].append(c); print("+", c["name"], c["setCode"], c["collectorNumber"], c["foilType"] or "nonfoil", c["priceUsd"])
        except Exception as ex:
            print("! failed", r, ex, file=sys.stderr)
    if a.refresh:
        db["cards"] = [enrich(c["setCode"], c["collectorNumber"], c["finish"], c["quantity"], c["condition"], c["collection"]) for c in db["cards"]]
    save(db, a.top)

if __name__ == "__main__": main()
