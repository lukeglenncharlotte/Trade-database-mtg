/* Collector Box Quest and Collector Commander Quest.
   Data: collector_boxes.json and collector_precons.json. Owned is a field on each item.
   Foil and sheen stay inside .qfigure so they do not cover the trade grid. */
(function () {
  const trade = document.getElementById("trade");
  const tradeStats = document.getElementById("tradeStats");
  const panels = {
    trade: { el: trade, tab: document.getElementById("tabTrade"), title: "Luke's Trade Database" },
    quest: { el: document.getElementById("quest"), tab: document.getElementById("tabQuest"), title: "Collector Box Quest · Luke's Trade Database" },
    precon: { el: document.getElementById("precon"), tab: document.getElementById("tabPrecon"), title: "Collector Commander Quest · Luke's Trade Database" },
  };
  function show(which, push) {
    if (!panels[which]) which = "trade";
    Object.keys(panels).forEach((key) => {
      const on = key === which;
      panels[key].el.hidden = !on;
      panels[key].tab.classList.toggle("on", on);
      panels[key].tab.setAttribute("aria-selected", String(on));
    });
    if (tradeStats) tradeStats.hidden = which !== "trade";
    document.title = panels[which].title;
    if (!push) return;
    const next = which === "trade" ? location.pathname + location.search : "#" + which;
    const here = which === "trade" ? !location.hash : location.hash === "#" + which;
    if (!here) history.pushState(null, "", next);
  }
  Object.keys(panels).forEach((key) => panels[key].tab.addEventListener("click", () => show(key, true)));
  window.addEventListener("hashchange", () => show(location.hash.slice(1), false));
  show(location.hash.slice(1), false);

  try { localStorage.removeItem("cbq-github-token"); } catch (e) { /* old device copy */ }
  try {
    sessionStorage.removeItem("cbq-vault-token");
    sessionStorage.removeItem("cbq-vault-tag");
  } catch (e) { /* old sealed token */ }

  const NTFY_URL = "https://ntfy.sh/r1q-ff7fbe21564bbd7038b8995a";
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const usd = (n) => n == null || n === "" ? "n/a" : "$" + Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const pretty = (iso) => {
    const [y, m, d] = String(iso || "").split("-").map(Number);
    if (!y || !m || !d) return iso || "";
    return MONTHS[m - 1] + " " + d + ", " + y;
  };
  const money = (n) => (n >= 0 ? "+" : "−") + usd(Math.abs(n));
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const LOCK = `<span class="lock" aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M8 10V7a4 4 0 0 1 8 0v3h1.2A1.8 1.8 0 0 1 19 11.8v7.4A1.8 1.8 0 0 1 17.2 21H6.8A1.8 1.8 0 0 1 5 19.2v-7.4A1.8 1.8 0 0 1 6.8 10H8zm2 0h4V7a2 2 0 0 0-4 0v3z"/></svg></span>`;

  function mountShelf(cfg) {
    const root = document.querySelector(cfg.root);
    const $ = (s) => root.querySelector(s);
    let boxes = [];
    let baseBoxes = [];
    let filter = "all";
    let sort = "release";
    let q = "";

    function cmpNum(av, bv, dir) {
      const an = av == null, bn = bv == null;
      if (an && bn) return 0;
      if (an) return 1;
      if (bn) return -1;
      return dir === "asc" ? av - bv : bv - av;
    }
    function compare(a, b) {
      if (sort === "low-asc" || sort === "low-desc") {
        const c = cmpNum(a.lowestListed, b.lowestListed, sort.endsWith("asc") ? "asc" : "desc");
        if (c) return c;
      } else if (sort === "mkt-asc" || sort === "mkt-desc") {
        const c = cmpNum(a.market, b.market, sort.endsWith("asc") ? "asc" : "desc");
        if (c) return c;
      }
      return a.releaseDate.localeCompare(b.releaseDate) || a.name.localeCompare(b.name);
    }

    function prices(b) {
      const gain = b.owned && b.msrp != null && b.market != null ? b.market - b.msrp : null;
      const paidGain = b.owned && b.paid != null && b.market != null && b.paid !== b.msrp ? b.market - b.paid : null;
      return `<div class="qprices">
        <div><span>MSRP</span><strong class="${b.msrp == null ? "na" : ""}" title="${esc(b.msrpSource || "")}">${usd(b.msrp)}</strong></div>
        <div><span>TCGplayer</span><strong>${usd(b.lowestListed)}</strong><small>lowest listing</small><em>${usd(b.market)} market</em></div>
      </div>
      ${gain == null ? "" : `<p class="gain ${gain >= 0 ? "up" : "down"}">${money(gain)} vs MSRP</p>`}
      ${b.owned && b.paid != null ? `<p class="paid">Paid ${usd(b.paid)}</p>` : ""}
      ${paidGain == null ? "" : `<p class="gain ${paidGain >= 0 ? "up" : "down"}">${money(paidGain)} vs paid</p>`}`;
    }

    function artSrc(b) { return b.imageUrl || ""; }
    function art(b, eager) {
      const src = artSrc(b);
      if (!src) return "";
      const delay = reduceMotion ? "" : ` style="animation-delay:${(-(b.tcgplayerProductId % 7) * 0.45).toFixed(2)}s"`;
      return `<div class="qstage">
        <div class="qfigure"${delay}>
          <img class="boxart" alt="${esc(cfg.artAlt(b))}" width="1000" height="1000" ${eager ? "" : 'loading="lazy"'} decoding="async" src="${esc(src)}">
          <span class="sheen" aria-hidden="true"></span>
          ${b.owned ? '<span class="foil" aria-hidden="true"></span>' : LOCK}
        </div>
      </div>`;
    }

    function bindTilt(host) {
      if (reduceMotion || !host) return;
      host.querySelectorAll(".qstage").forEach((stage) => {
        const fig = stage.querySelector(".qfigure");
        if (!fig) return;
        stage.addEventListener("pointermove", (e) => {
          const r = stage.getBoundingClientRect();
          if (!r.width || !r.height) return;
          const px = (e.clientX - r.left) / r.width - 0.5;
          const py = (e.clientY - r.top) / r.height - 0.5;
          fig.style.transform = `rotateX(${(-py * 8).toFixed(2)}deg) rotateY(${(px * 11).toFixed(2)}deg) translateZ(10px)`;
        });
        const reset = () => { fig.style.transform = ""; };
        stage.addEventListener("pointerleave", reset);
        stage.addEventListener("pointercancel", reset);
      });
    }

    function card(b, cheapestId) {
      const bits = [b.setCode, pretty(b.releaseDate), b.variant].filter(Boolean).join(" · ");
      return `<article class="qbox ${b.owned ? "unlocked" : "locked"}${b.id === cheapestId ? " next" : ""}" data-id="${esc(b.id)}">
        <div class="qbody">
          ${art(b)}
          <div class="qtop">
            <img class="set-icon" alt="" width="36" height="36" loading="lazy" src="${esc(b.icon)}">
            <div><h3 class="qname">${esc(b.name)}</h3><p class="qmeta">${esc(bits)}</p></div>
            <span class="stamp">${b.owned ? "Unlocked" : "Locked"}</span>
          </div>
          ${b.id === cheapestId ? '<span class="tag">Cheapest missing</span>' : ""}
          ${b.note ? `<p class="qnote">${esc(b.note)}</p>` : ""}
          ${prices(b)}
          <div class="qactions">
            <a class="btn" href="${esc(b.tcgplayerUrl)}" target="_blank" rel="noopener">View on TCGplayer ↗</a>
          </div>
        </div>
      </article>`;
    }

    function render() {
      const needle = q.trim().toLowerCase();
      const match = (b) => !needle || [b.name, b.setCode, b.variant, b.product, b.note].join(" ").toLowerCase().includes(needle);
      const owned = boxes.filter((b) => b.owned && match(b)).sort(compare);
      const missing = boxes.filter((b) => !b.owned && match(b)).sort(compare);
      const showOwned = filter !== "missing";
      const showMissing = filter !== "owned";
      const cheapest = boxes.filter((b) => !b.owned && b.lowestListed != null).sort((a, b) => a.lowestListed - b.lowestListed || a.releaseDate.localeCompare(b.releaseDate))[0];
      const cheapestId = cheapest ? cheapest.id : null;

      const ownedHtml = showOwned ? owned.map((b) => card(b, null)).join("") : "";
      let missHtml = "";
      if (showMissing) {
        if (sort === "release") {
          let year = null;
          missing.forEach((b) => {
            const y = (b.releaseDate || "").slice(0, 4) || "Undated";
            if (y !== year) {
              year = y;
              const n = missing.filter((x) => (x.releaseDate || "").slice(0, 4) === y).length;
              missHtml += `<h3 class="year">${esc(y)} <small>${n} locked</small></h3>`;
            }
            missHtml += card(b, cheapestId);
          });
        } else missHtml = missing.map((b) => card(b, cheapestId)).join("");
      }
      $(".qowned").innerHTML = ownedHtml;
      $(".qmiss").innerHTML = missHtml;
      bindTilt($(".qowned"));
      bindTilt($(".qmiss"));
      const ownedVisible = showOwned && owned.length > 0;
      const missVisible = showMissing && missing.length > 0;
      $(".qowned-head").hidden = !ownedVisible;
      $(".qmiss-head").hidden = !missVisible;
      $(".qempty").hidden = ownedVisible || missVisible;
    }

    function goals(total) {
      const seen = new Set();
      return cfg.goals(total).filter((g) => g.n > 0 && g.n <= total && !seen.has(g.n) && seen.add(g.n));
    }

    function dashboard() {
      const n = boxes.length;
      const owned = boxes.filter((b) => b.owned);
      const miss = boxes.filter((b) => !b.owned);
      const pct = n ? Math.round(owned.length / n * 1000) / 10 : 0;
      const shelf = owned.reduce((s, b) => s + (b.market || 0), 0);
      const cost = miss.reduce((s, b) => s + (b.lowestListed || 0), 0);
      const withMsrp = owned.filter((b) => b.msrp != null && b.market != null);
      const gain = withMsrp.reduce((s, b) => s + (b.market - b.msrp), 0);
      $(".qdash").innerHTML = `<div class="progress">
        <div class="prow"><strong>${owned.length} / ${n}</strong><span>${pct}%</span></div>
        <div class="bar" role="progressbar" aria-valuenow="${owned.length}" aria-valuemin="0" aria-valuemax="${n}" aria-label="${esc(cfg.progressLabel)}"><span style="width:${n ? (owned.length / n * 100) : 0}%"></span></div>
      </div>
      <div class="dash">
        <div><b>${owned.length}</b><small>unlocked</small></div>
        <div><b>${miss.length}</b><small>still locked</small></div>
        <div><b>${usd(owned.length ? shelf : 0)}</b><small>shelf value · market</small></div>
        <div><b>${usd(miss.length ? cost : 0)}</b><small>to complete · lowest listing</small></div>
      </div>
      ${withMsrp.length ? `<p class="gainline">Owned ${esc(cfg.plural)} are <strong class="${gain >= 0 ? "up" : "down"}">${money(gain)}</strong> versus MSRP.</p>` : ""}`;

      $(".qmedals").innerHTML = goals(n).map((g) => {
        const on = owned.length >= g.n;
        return `<div class="medal ${on ? "on" : "off"}"><b>${esc(g.name)}</b><small>${on ? esc(g.blurb) : "Reach " + g.n}</small></div>`;
      }).join("");

      const cheapest = miss.filter((b) => b.lowestListed != null).sort((a, b) => a.lowestListed - b.lowestListed || a.releaseDate.localeCompare(b.releaseDate))[0];
      $(".qnext").innerHTML = cheapest ? `<aside class="callout">
        ${artSrc(cheapest) ? `<img class="callout-art" alt="" width="84" height="84" src="${esc(artSrc(cheapest))}">` : `<img class="set-icon" alt="" width="48" height="48" src="${esc(cheapest.icon)}">`}
        <div><p class="kicker">Next cheapest to grab</p><p class="qname">${esc(cheapest.name)}</p>
        <p class="qmeta">${usd(cheapest.lowestListed)} lowest listing · ${usd(cheapest.market)} market${cheapest.msrp != null ? " · MSRP " + usd(cheapest.msrp) : ""}</p></div>
        <a class="btn" href="${esc(cheapest.tcgplayerUrl)}" target="_blank" rel="noopener">View on TCGplayer ↗</a>
      </aside>` : `<aside class="callout"><div><p class="kicker">Quest complete</p><p class="qname">${esc(cfg.completeText)}</p></div></aside>`;
    }

    root.querySelectorAll(".seg button").forEach((btn) => btn.addEventListener("click", () => {
      filter = btn.dataset.filter;
      root.querySelectorAll(".seg button").forEach((b) => b.classList.toggle("on", b === btn));
      render();
    }));
    $(".qsort").addEventListener("input", () => { sort = $(".qsort").value; render(); });
    $(".qsearch").addEventListener("input", () => { q = $(".qsearch").value; render(); });

    function bytesToB64(bytes) {
      let s = "";
      for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
      return btoa(s);
    }
    function b64ToBytes(b64) {
      const bin = atob(String(b64 || "").replace(/\s/g, ""));
      const out = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
      return out;
    }
    function utf8ToB64(str) {
      return bytesToB64(new TextEncoder().encode(str));
    }
    function yieldPaint() {
      return new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(resolve, 0)));
      });
    }
    function readLocal() {
      try {
        const raw = localStorage.getItem(cfg.localKey);
        const data = raw ? JSON.parse(raw) : {};
        return data && typeof data === "object" && !Array.isArray(data) ? data : {};
      } catch (e) {
        return {};
      }
    }
    function writeLocal(map) {
      localStorage.setItem(cfg.localKey, JSON.stringify(map));
    }
    function saveLocal(id, record) {
      const map = readLocal();
      map[id] = record;
      try {
        writeLocal(map);
        return true;
      } catch (e) {
        const slim = Object.assign({}, record);
        delete slim.photo;
        map[id] = slim;
        writeLocal(map);
        return false;
      }
    }
    function mergeBoxes() {
      const local = readLocal();
      boxes = baseBoxes.map((box) => {
        if (box.owned) return box;
        const extra = local[box.id];
        if (!extra || typeof extra !== "object") return box;
        return Object.assign({}, box, {
          owned: true,
          localOnly: true,
          ntfySent: !!extra.ntfySent,
          paid: extra.paid,
          msrpPurchase: !!extra.msrpPurchase,
          vendor: extra.vendor || null,
          location: extra.location || null,
          notes: extra.notes || null,
          purchasedAt: extra.purchasedAt || null,
          submittedAt: extra.submittedAt || null,
          unlockedAt: extra.unlockedAt || null,
          verificationPhoto: extra.photo || null,
        });
      });
    }
    function submissionObject(p) {
      const body = {
        id: p.id,
        paid: p.paid,
        msrpPurchase: !!p.msrpPurchase,
        vendor: p.vendor || "",
        location: p.location || "",
        purchasedAt: p.purchasedAt,
        submittedAt: p.submittedAt,
        notes: p.notes || "",
      };
      if (!cfg.kind) return body;
      return {
        kind: cfg.kind,
        id: body.id,
        paid: body.paid,
        msrpPurchase: body.msrpPurchase,
        vendor: body.vendor,
        location: body.location,
        purchasedAt: body.purchasedAt,
        submittedAt: body.submittedAt,
        notes: body.notes,
      };
    }
    function encodeSubmission(p) {
      const full = submissionObject(p);
      let encoded = utf8ToB64(JSON.stringify(full));
      if (encoded.length <= 4000) return encoded;
      const trimmed = submissionObject(p);
      while (trimmed.notes && encoded.length > 4000) {
        trimmed.notes = trimmed.notes.slice(0, Math.max(0, Math.floor(trimmed.notes.length * 0.6)));
        encoded = utf8ToB64(JSON.stringify(trimmed));
      }
      if (encoded.length > 4000) throw new Error("Those details are too long to send.");
      return encoded;
    }
    async function publishUnlock(boxId, photoBytes, encoded) {
      let res;
      try {
        res = await fetch(NTFY_URL, {
          method: "PUT",
          headers: {
            "Content-Type": "image/jpeg",
            Filename: boxId + ".jpg",
            Title: cfg.ntfyTitle(boxId),
            "X-Message": encoded,
          },
          body: new Blob([photoBytes], { type: "image/jpeg" }),
        });
      } catch (e) {
        throw new Error("The photo did not send. Check the connection and retry.");
      }
      if (!res.ok) {
        let detail = "";
        try { detail = (await res.text()).trim().slice(0, 180); } catch (err) { detail = ""; }
        throw new Error(detail || ("The photo did not send (" + res.status + ")."));
      }
    }

    function localNowValue() {
      const d = new Date();
      const p = (n) => String(n).padStart(2, "0");
      return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + "T" + p(d.getHours()) + ":" + p(d.getMinutes());
    }
    function localToISO(value) {
      const d = new Date(value);
      if (!value || Number.isNaN(d.getTime())) return null;
      return d.toISOString();
    }
    function stampText(iso) {
      if (!iso) return "n/a";
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return iso;
      return d.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
    }
    function signedPct(n) {
      if (n == null || !Number.isFinite(n)) return "n/a";
      if (Math.abs(n) < 0.05) return "0%";
      return (n > 0 ? "+" : "−") + Math.abs(n).toLocaleString(undefined, { maximumFractionDigits: 1 }) + "%";
    }
    function daysOwned(b) {
      if (!b.purchasedAt) return null;
      const t = new Date(b.purchasedAt);
      if (Number.isNaN(t.getTime())) return null;
      return Math.max(0, Math.floor((Date.now() - t.getTime()) / 86400000));
    }
    function shelfOrder() {
      return boxes.filter((b) => b.owned).slice().sort((a, b) => {
        const ka = a.submittedAt || a.unlockedAt || "9999";
        const kb = b.submittedAt || b.unlockedAt || "9999";
        if (ka !== kb) return ka.localeCompare(kb);
        return (a.releaseDate || "").localeCompare(b.releaseDate || "") || a.name.localeCompare(b.name);
      });
    }
    function burst(origin) {
      if (reduceMotion) return;
      const host = $(".confetti");
      const rect = origin ? origin.getBoundingClientRect() : { left: innerWidth / 2, top: innerHeight / 3, width: 0, height: 0 };
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + Math.min(rect.height, 180) / 2;
      for (let i = 0; i < 42; i++) {
        const bit = document.createElement("i");
        bit.className = "bit";
        const ang = Math.random() * Math.PI * 2;
        const dist = 70 + Math.random() * 180;
        bit.style.left = cx + "px";
        bit.style.top = cy + "px";
        bit.style.setProperty("--dx", (Math.cos(ang) * dist).toFixed(1) + "px");
        bit.style.setProperty("--dy", (Math.sin(ang) * dist - 30).toFixed(1) + "px");
        bit.style.background = ["#f3dc95", "#d8b45a", "#fff7a8", "#9bf3ff", "#ff9be8"][i % 5];
        host.appendChild(bit);
        setTimeout(() => bit.remove(), 1500);
      }
    }
    function showBadge(list) {
      if (!list.length) return;
      const pop = $(".badge-host");
      pop.innerHTML = list.map((g) => `<div class="badge-pop"><p class="kicker">Milestone</p><h3>${esc(g.name)}</h3><p>${esc(g.blurb)}</p></div>`).join("");
      pop.hidden = false;
      setTimeout(() => { pop.hidden = true; }, reduceMotion ? 2200 : 3200);
    }
    function celebrate(box, badges) {
      dashboard();
      render();
      const el = root.querySelector('.qbox[data-id="' + (window.CSS && CSS.escape ? CSS.escape(box.id) : box.id) + '"]');
      if (el) el.scrollIntoView({ block: "center", behavior: "auto" });
      if (!reduceMotion && el) {
        el.classList.add("just-unlocked");
        const fig = el.querySelector(".qfigure");
        if (fig) fig.insertAdjacentHTML("beforeend", `<span class="lock breaking" aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M8 10V7a4 4 0 0 1 8 0v3h1.2A1.8 1.8 0 0 1 19 11.8v7.4A1.8 1.8 0 0 1 17.2 21H6.8A1.8 1.8 0 0 1 5 19.2v-7.4A1.8 1.8 0 0 1 6.8 10H8zm2 0h4V7a2 2 0 0 0-4 0v3z"/></svg></span>`);
        burst(el);
        setTimeout(() => { const lock = el.querySelector(".lock.breaking"); if (lock) lock.remove(); el.classList.remove("just-unlocked"); }, 1100);
      } else burst(el);
      if (badges.length) setTimeout(() => showBadge(badges), reduceMotion ? 0 : 700);
    }

    let ritual = null;
    function closeRitual() {
      if (ritual && ritual.timer) clearTimeout(ritual.timer);
      if (ritual && ritual.photoUrl) URL.revokeObjectURL(ritual.photoUrl);
      ritual = null;
      document.body.classList.remove("ritual-open");
      $(".ritual").hidden = true;
      $(".ritual").innerHTML = "";
    }
    function paintRitual() {
      const r = ritual;
      const box = r.box;
      const title = {
        pick: cfg.pickTitle,
        photo: "The proof",
        place: "The purchase",
        price: "The price",
        saving: "Sending the proof",
        sent: "On its way",
        sendfail: "Not sent yet",
      }[r.step] || "Unlock ritual";
      const body = {
        pick: `<p class="qnote">${esc(cfg.pickNote)}</p>
          <label>Locked ${esc(cfg.item)}<select id="ritualPick">${boxes.filter((b) => !b.owned).map((b) => `<option value="${esc(b.id)}">${esc(b.name)}${b.variant ? " · " + esc(b.variant) : ""}</option>`).join("")}</select></label>`,
        photo: `<p class="qnote">${esc(cfg.photoNote)}</p>
          <label class="capture">Take or upload a photo
            <input id="ritualPhoto" type="file" accept="image/*" capture="environment">
          </label>
          ${r.photoUrl ? `<img class="proof-preview" alt="Chosen verification photo" src="${esc(r.photoUrl)}">` : ""}`,
        place: `<p class="qnote">Who sold it, where, and when you bought it. The log time is recorded automatically when you break the seal.</p>
          <label>Vendor or seller<input id="ritualVendor" autocomplete="organization" value="${esc(r.vendor || "")}" placeholder="Micro Center, a person, a shop…"></label>
          <label>Location<input id="ritualLocation" autocomplete="off" value="${esc(r.location || "")}" placeholder="City, or online"></label>
          <button type="button" class="btn ghost" id="ritualLocate">${r.locating ? "Finding city…" : "Use my location"}</button>
          <label>Purchased<input id="ritualWhen" type="datetime-local" value="${esc(r.purchasedLocal == null ? localNowValue() : r.purchasedLocal)}"></label>
          <label>Notes, optional<textarea id="ritualNotes" rows="3" placeholder="Anything you want to remember">${esc(r.notes || "")}</textarea></label>`,
        price: `<p class="qnote">What did you pay for ${box ? esc(box.name) : "this " + esc(cfg.item)}?</p>
          ${box && box.msrp != null
            ? `<label class="check"><input type="checkbox" id="ritualMsrp" ${r.msrpPurchase ? "checked" : ""}> I purchased this for MSRP</label>`
            : `<p class="qnote">No MSRP is on file for this ${esc(cfg.item)}, so it can't be marked as an MSRP purchase.</p>`}
          <label>Amount paid, USD<input id="ritualPaid" inputmode="decimal" autocomplete="off" placeholder="0.00" value="${esc(r.msrpPurchase && box && box.msrp != null ? Number(box.msrp).toFixed(2) : (r.paidText || ""))}" ${r.msrpPurchase && box && box.msrp != null ? "disabled" : ""}></label>`,
        saving: `<p class="qnote" role="status">${esc(r.status || "Saving on this device…")}</p>`,
        sent: `<p class="qnote" role="status">Sent ✓, it'll be permanent shortly</p>`,
        sendfail: `<p class="qnote">The unlock is saved on this device, but the photo did not send.</p>`,
      }[r.step] || "";
      const actions = {
        pick: `<button type="button" class="btn" id="ritualNext">Continue</button>`,
        photo: `<button type="button" class="btn" id="ritualNext">Continue</button>`,
        place: `<button type="button" class="btn" id="ritualNext">Continue</button>`,
        price: `<button type="button" class="btn" id="ritualCommit">Break the seal</button>`,
        saving: "",
        sent: "",
        sendfail: `<button type="button" class="btn" id="ritualRetry">Retry</button>`,
      }[r.step] || "";
      $(".ritual").innerHTML = `<div class="ritual-card" role="dialog" aria-modal="true" aria-labelledby="ritualTitle">
        <button type="button" class="ritual-x" id="ritualClose" aria-label="Close">×</button>
        <p class="kicker">Unlock ritual</p>
        <h2 id="ritualTitle">${esc(title)}</h2>
        ${r.error ? `<p class="ritual-err">${esc(r.error)}</p>` : ""}
        ${body}
        <div class="ritual-actions">${actions}<button type="button" class="btn ghost" id="ritualCancel">Close</button></div>
      </div>`;
      $(".ritual").hidden = false;
      document.body.classList.add("ritual-open");
      const field = $(".ritual").querySelector("input:not([disabled]), textarea, select");
      if (field) field.focus();
    }
    function openRitual(box) {
      if (ritual && ritual.timer) clearTimeout(ritual.timer);
      ritual = { box: box || null, step: box ? "photo" : "pick", error: "", photoUrl: "", photoBytes: null, status: "", timer: 0, celebrated: false };
      paintRitual();
    }
    function finishSent() {
      if (!ritual || ritual.celebrated || ritual.step !== "sent") return;
      ritual.celebrated = true;
      if (ritual.timer) { clearTimeout(ritual.timer); ritual.timer = 0; }
      const send = ritual.send || {};
      const badges = ritual.badges || [];
      const photoUrl = ritual.photoUrl;
      ritual.photoUrl = "";
      if (photoUrl) URL.revokeObjectURL(photoUrl);
      const box = boxes.find((b) => b.id === send.id) || ritual.box;
      closeRitual();
      celebrate(box, badges);
    }
    async function compressPhoto(file) {
      const bmp = await createImageBitmap(file);
      const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bmp.width * scale));
      canvas.height = Math.max(1, Math.round(bmp.height * scale));
      canvas.getContext("2d").drawImage(bmp, 0, 0, canvas.width, canvas.height);
      if (bmp.close) bmp.close();
      const limit = 1900000;
      let quality = 0.82;
      let bytes = null;
      while (quality >= 0.42) {
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
        if (!blob) throw new Error("Could not compress that photo.");
        bytes = new Uint8Array(await blob.arrayBuffer());
        if (bytes.length < limit) return bytes;
        quality = Math.round((quality - 0.08) * 100) / 100;
      }
      throw new Error("That photo is still over 2MB after compressing. Try another picture.");
    }
    function stashRitualFields() {
      if (!ritual) return;
      const v = $("#ritualVendor"); if (v) ritual.vendor = v.value;
      const l = $("#ritualLocation"); if (l) ritual.location = l.value;
      const n = $("#ritualNotes"); if (n) ritual.notes = n.value;
      const d = $("#ritualWhen"); if (d) ritual.purchasedLocal = d.value;
      const p = $("#ritualPaid"); if (p && !p.disabled) ritual.paidText = p.value;
      const m = $("#ritualMsrp"); if (m) ritual.msrpPurchase = m.checked;
    }
    async function deliverUnlock(send, badges) {
      ritual.send = send;
      ritual.badges = badges;
      ritual.step = "saving";
      ritual.status = "Saving on this device…";
      ritual.error = "";
      paintRitual();
      await yieldPaint();
      const record = {
        paid: send.paid,
        msrpPurchase: !!send.msrpPurchase,
        vendor: send.vendor,
        location: send.location || null,
        notes: send.notes || null,
        purchasedAt: send.purchasedAt,
        submittedAt: send.submittedAt,
        unlockedAt: send.submittedAt.slice(0, 10),
        photo: "data:image/jpeg;base64," + bytesToB64(send.photoBytes),
        ntfySent: false,
      };
      try {
        saveLocal(send.id, record);
      } catch (err) {
        ritual.step = "price";
        ritual.error = "This browser couldn't save the unlock on the device.";
        paintRitual();
        return;
      }
      mergeBoxes();
      dashboard();
      render();
      ritual.status = "Sending the photo…";
      paintRitual();
      await yieldPaint();
      try {
        const encoded = encodeSubmission(send);
        await publishUnlock(send.id, send.photoBytes, encoded);
        const map = readLocal();
        if (map[send.id]) {
          map[send.id].ntfySent = true;
          try { writeLocal(map); } catch (e) { /* the photo already went out */ }
        }
        mergeBoxes();
        dashboard();
        render();
        ritual.step = "sent";
        ritual.error = "";
        paintRitual();
        ritual.timer = setTimeout(finishSent, 2200);
      } catch (err) {
        ritual.step = "sendfail";
        ritual.error = err.message || "The photo did not send.";
        paintRitual();
      }
    }
    async function onRitualClick(e) {
      stashRitualFields();
      const id = e.target.id;
      if ((id === "ritualClose" || id === "ritualCancel") && ritual.step !== "saving") {
        if (ritual.step === "sent") finishSent();
        else closeRitual();
        return;
      }
      if (id === "ritualNext" && ritual.step === "pick") {
        ritual.box = boxes.find((b) => b.id === $("#ritualPick").value) || null;
        if (!ritual.box) { ritual.error = cfg.pickError; paintRitual(); return; }
        ritual.step = "photo"; ritual.error = ""; paintRitual(); return;
      }
      if (id === "ritualLocate") {
        stashRitualFields();
        if (!navigator.geolocation) { ritual.error = "This browser cannot share a location. Type the city or online."; paintRitual(); return; }
        ritual.locating = true; ritual.error = ""; paintRitual();
        navigator.geolocation.getCurrentPosition(async (pos) => {
          try {
            const url = "https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=" + pos.coords.latitude + "&longitude=" + pos.coords.longitude + "&localityLanguage=en";
            const j = await (await fetch(url)).json();
            const city = j.city || j.locality || "";
            ritual.location = [city, j.principalSubdivision].filter(Boolean).join(", ") || j.countryName || "";
            ritual.error = ritual.location ? "" : "No city came back. Type it instead.";
          } catch (err) {
            ritual.error = "Could not look up a city from that location.";
          }
          ritual.locating = false;
          paintRitual();
        }, () => {
          ritual.locating = false;
          ritual.error = "Location permission was denied. Type the city or online.";
          paintRitual();
        }, { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 });
        return;
      }
      if (id === "ritualNext" && ritual.step === "photo") {
        if (!ritual.photoBytes) { ritual.error = cfg.photoError; paintRitual(); return; }
        if (!ritual.purchasedLocal) ritual.purchasedLocal = localNowValue();
        ritual.step = "place"; ritual.error = ""; paintRitual(); return;
      }
      if (id === "ritualNext" && ritual.step === "place") {
        stashRitualFields();
        if (!(ritual.vendor || "").trim()) { ritual.error = "Enter the vendor or seller."; paintRitual(); return; }
        if (!localToISO(ritual.purchasedLocal)) { ritual.error = "Enter the date and time you bought it."; paintRitual(); return; }
        ritual.step = "price"; ritual.error = ""; paintRitual(); return;
      }
      if (id === "ritualRetry") {
        if (ritual.step !== "sendfail" || !ritual.send) return;
        await deliverUnlock(ritual.send, ritual.badges || []);
        return;
      }
      if (id === "ritualCommit") {
        if (ritual.step !== "price") return;
        const msrpPurchase = !!(ritual.msrpPurchase && ritual.box && ritual.box.msrp != null);
        const raw = msrpPurchase ? String(ritual.box.msrp) : $("#ritualPaid").value.trim().replace(/[$,]/g, "");
        if (!msrpPurchase) ritual.paidText = $("#ritualPaid").value;
        const paid = Math.round(Number(raw) * 100) / 100;
        if (!raw || !Number.isFinite(paid) || paid < 0) { ritual.error = "Enter the amount you paid."; paintRitual(); return; }
        const purchasedAt = localToISO(ritual.purchasedLocal);
        if (!purchasedAt) { ritual.step = "place"; ritual.error = "Enter the date and time you bought it."; paintRitual(); return; }
        const before = boxes.filter((b) => b.owned).length;
        const already = boxes.some((b) => b.id === ritual.box.id && b.owned);
        const after = before + (already ? 0 : 1);
        const had = new Set(goals(boxes.length).filter((g) => before >= g.n).map((g) => g.n));
        const badges = goals(boxes.length).filter((g) => after >= g.n && !had.has(g.n));
        const submittedAt = new Date().toISOString();
        await deliverUnlock({
          id: ritual.box.id,
          paid,
          msrpPurchase,
          vendor: (ritual.vendor || "").trim(),
          location: (ritual.location || "").trim(),
          notes: (ritual.notes || "").trim(),
          purchasedAt,
          submittedAt,
          photoBytes: ritual.photoBytes,
        }, badges);
      }
    }
    $(".ritual").addEventListener("click", (e) => {
      if (e.target.closest("input, textarea, select")) return;
      onRitualClick(e);
    });
    $(".ritual").addEventListener("change", async (e) => {
      if (e.target.id === "ritualMsrp") {
        ritual.msrpPurchase = e.target.checked;
        if (ritual.msrpPurchase && ritual.box && ritual.box.msrp != null) ritual.paidText = Number(ritual.box.msrp).toFixed(2);
        paintRitual();
        return;
      }
      if (e.target.id !== "ritualPhoto" || !e.target.files || !e.target.files[0]) return;
      try {
        ritual.photoBytes = await compressPhoto(e.target.files[0]);
        if (ritual.photoUrl) URL.revokeObjectURL(ritual.photoUrl);
        ritual.photoUrl = URL.createObjectURL(new Blob([ritual.photoBytes], { type: "image/jpeg" }));
        ritual.error = "";
      } catch (err) {
        ritual.error = err.message || "Could not read that photo.";
        ritual.photoBytes = null;
      }
      paintRitual();
    });
    $(".qunlock").addEventListener("click", () => openRitual(null));
    $(".proof").addEventListener("click", async (e) => {
      if (e.target === e.currentTarget || e.target.id === "proofClose") { $(".proof").hidden = true; return; }
      if (e.target.id !== "retrySend") return;
      const button = e.target;
      const id = button.dataset.id;
      button.disabled = true;
      button.textContent = "Sending…";
      try {
        const rec = readLocal()[id];
        if (!rec || !rec.photo) throw new Error("The photo is no longer on this device.");
        const bytes = b64ToBytes(rec.photo.slice(rec.photo.indexOf(",") + 1));
        await publishUnlock(id, bytes, encodeSubmission({
          id,
          paid: rec.paid,
          msrpPurchase: !!rec.msrpPurchase,
          vendor: rec.vendor || "",
          location: rec.location || "",
          purchasedAt: rec.purchasedAt,
          submittedAt: rec.submittedAt,
          notes: rec.notes || "",
        }));
        const map = readLocal();
        if (map[id]) map[id].ntfySent = true;
        writeLocal(map);
        mergeBoxes();
        dashboard();
        render();
        openProfile(boxes.find((b) => b.id === id));
      } catch (err) {
        button.disabled = false;
        button.textContent = "Retry";
        button.insertAdjacentHTML("beforebegin", `<p class="ritual-err">${esc(err.message || "The photo did not send.")}</p>`);
      }
    });
    function openProfile(box) {
      if (!box) return;
      const artUrl = artSrc(box);
      const order = shelfOrder();
      const num = order.findIndex((b) => b.id === box.id) + 1;
      const mile = goals(boxes.length).find((g) => g.n === num);
      const paidVs = box.msrpPurchase ? 0 : (box.paid != null && box.msrp ? ((box.paid - box.msrp) / box.msrp) * 100 : null);
      const gain = box.paid != null && box.market != null ? box.market - box.paid : null;
      const gainPct = gain != null && box.paid ? (gain / box.paid) * 100 : null;
      const days = daysOwned(box);
      const proofSrc = box.verificationPhoto;
      const rows = box.owned ? [
        ["Purchased", stampText(box.purchasedAt)],
        ["Logged", stampText(box.submittedAt)],
        ["Vendor", box.vendor || "n/a"],
        ["Location", box.location || "n/a"],
        ["Paid", box.msrpPurchase ? usd(box.paid) + " · MSRP" : usd(box.paid)],
        ["MSRP", usd(box.msrp)],
        ["Vs MSRP", paidVs == null ? "n/a" : (Math.abs(paidVs) < 0.05 ? "0% over MSRP" : signedPct(paidVs) + " vs MSRP")],
        ["Lowest listing", usd(box.lowestListed)],
        ["Market", usd(box.market)],
        ["Vs paid", gain == null ? "n/a" : money(gain) + (gainPct == null ? "" : " (" + signedPct(gainPct) + ")")],
        ["Days owned", days == null ? "n/a" : String(days)],
        ["Milestone", num ? (cfg.unit + " #" + num + (mile ? " · " + mile.name : "")) : "n/a"],
        ["Notes", box.notes || "n/a"],
      ] : [
        ["MSRP", usd(box.msrp)],
        ["Lowest listing", usd(box.lowestListed)],
        ["Market", usd(box.market)],
      ];
      $(".proof").innerHTML = `<div class="proof-card profile" role="dialog" aria-modal="true">
        <button type="button" id="proofClose" class="ritual-x" aria-label="Close">×</button>
        <p class="kicker">${box.owned ? "Purchase profile" : "Still sealed"}</p>
        <h2>${esc(box.name)}</h2>
        ${artUrl ? `<img class="profile-art" alt="" src="${esc(artUrl)}">` : ""}
        ${box.owned ? (proofSrc ? `<img class="profile-proof" alt="Verification photo of ${esc(box.name)}" src="${esc(proofSrc)}">` : `<p class="placeholder">No proof photo</p>`) : `<p class="qnote">This ${esc(cfg.item)} is still locked.</p>`}
        <dl>${rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join("")}</dl>
        ${box.localOnly ? `<p class="qnote">${box.ntfySent ? "Sent ✓, it'll be permanent shortly" : "Saved on this device. The photo has not been sent yet."}</p>` : ""}
        ${box.localOnly && !box.ntfySent ? `<button type="button" class="btn" id="retrySend" data-id="${esc(box.id)}">Retry</button>` : ""}
        ${box.owned ? "" : `<button type="button" class="btn" data-unlock="${esc(box.id)}">${esc(cfg.unlockLabel)}</button>`}
      </div>`;
      $(".proof").hidden = false;
    }
    root.addEventListener("click", (e) => {
      if (e.target.closest(".ritual")) return;
      const unlock = e.target.closest("[data-unlock]");
      if (unlock) { $(".proof").hidden = true; openRitual(boxes.find((b) => b.id === unlock.dataset.unlock) || null); return; }
      if (e.target.closest(".proof")) return;
      if (e.target.closest("a")) return;
      const tile = e.target.closest(".qbox");
      if (!tile) return;
      openProfile(boxes.find((b) => b.id === tile.dataset.id));
    });
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape" || root.hidden) return;
      if (ritual && ritual.step === "saving") return;
      if (ritual && ritual.step === "sent") { finishSent(); return; }
      if (ritual) { closeRitual(); return; }
      const proof = $(".proof");
      if (proof && !proof.hidden) proof.hidden = true;
    });

    root.addEventListener("error", (e) => {
      const img = e.target;
      if (!img.classList || !img.classList.contains("boxart")) return;
      const fig = img.closest(".qfigure");
      if (fig) fig.classList.add("no-art");
    }, true);

    fetch(cfg.url, { cache: "no-store" }).then((r) => r.json()).then((d) => {
      baseBoxes = d[cfg.listKey] || [];
      mergeBoxes();
      dashboard();
      render();
    }).catch(() => {
      $(".qdash").innerHTML = "<p class='qnote'>" + esc(cfg.loadError) + "</p>";
    });
  }

  function boxGoals(total) {
    return [
      { n: 1, name: "First Box", blurb: "The shelf isn't empty" },
      { n: 5, name: "Five Boxes", blurb: "A real start" },
      { n: 10, name: "Ten Boxes", blurb: "Double digits" },
      { n: 25, name: "Twenty-five", blurb: "The vault takes shape" },
      { n: total, name: "Complete", blurb: "Every display, sealed" },
    ];
  }
  mountShelf({
    root: "#quest",
    url: "collector_boxes.json",
    listKey: "boxes",
    localKey: "cbq-local-unlocks",
    kind: null,
    item: "box",
    plural: "boxes",
    unit: "Box",
    ntfyTitle: (id) => "Collector box " + id,
    artAlt: (b) => b.name + " sealed Collector Booster display",
    loadError: "Couldn't load collector box data.",
    progressLabel: "Owned collector displays",
    completeText: "Every display is on the shelf.",
    pickTitle: "Choose a sealed box",
    pickNote: "Which display did you bring home?",
    pickError: "Choose a box.",
    photoNote: "Photograph the sealed display. On a phone this opens the camera.",
    photoError: "Add a photo of the sealed box.",
    unlockLabel: "Unlock this box",
    goals: boxGoals,
  });
  mountShelf({
    root: "#precon",
    url: "collector_precons.json",
    listKey: "decks",
    localKey: "ccq-local-unlocks",
    kind: "precon",
    item: "deck",
    plural: "decks",
    unit: "Deck",
    ntfyTitle: (id) => "Collector precon " + id,
    artAlt: (b) => b.name + " sealed Collector's Edition Commander deck",
    loadError: "Couldn't load collector deck data.",
    progressLabel: "Owned collector commander decks",
    completeText: "Every deck is on the shelf.",
    pickTitle: "Choose a sealed deck",
    pickNote: "Which Collector's Edition deck did you bring home?",
    pickError: "Choose a deck.",
    photoNote: "Photograph the sealed deck. On a phone this opens the camera.",
    photoError: "Add a photo of the sealed deck.",
    unlockLabel: "Unlock this deck",
    goals(total) {
      return [
        { n: 1, name: "First Deck", blurb: "The shelf isn't empty" },
        { n: 5, name: "Five Decks", blurb: "A real start" },
        { n: 10, name: "Ten Decks", blurb: "Double digits" },
        { n: 25, name: "Twenty-five", blurb: "The vault takes shape" },
        { n: total, name: "Complete", blurb: "Every deck, sealed" },
      ];
    },
  });
})();
