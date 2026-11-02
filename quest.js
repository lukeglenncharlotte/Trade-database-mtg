/* Collector Box Quest. Data: collector_boxes.json. Owned is a field on each box. */
(function () {
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  const usd = (n) => n == null || n === "" ? "n/a" : "$" + Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const pretty = (iso) => {
    const [y, m, d] = String(iso || "").split("-").map(Number);
    if (!y || !m || !d) return iso || "";
    return MONTHS[m - 1] + " " + d + ", " + y;
  };
  const money = (n) => (n >= 0 ? "+" : "−") + usd(Math.abs(n));

  let boxes = [];
  let filter = "all";
  let sort = "release";
  let q = "";
  let unlockCfg = { kdf: "PBKDF2-SHA256", iterations: 100000, salt: null, hash: null };
  const sessionProof = new Map();
  const TOKEN_KEY = "cbq-github-token";
  const GH = "https://api.github.com/repos/lukeglenncharlotte/Trade-database-mtg/contents/";

  const trade = $("#trade");
  const quest = $("#quest");
  const tabTrade = $("#tabTrade");
  const tabQuest = $("#tabQuest");
  const tradeStats = $("#tradeStats");

  function show(which, push) {
    const onQuest = which === "quest";
    trade.hidden = onQuest;
    quest.hidden = !onQuest;
    if (tradeStats) tradeStats.hidden = onQuest;
    tabTrade.classList.toggle("on", !onQuest);
    tabQuest.classList.toggle("on", onQuest);
    tabTrade.setAttribute("aria-selected", String(!onQuest));
    tabQuest.setAttribute("aria-selected", String(onQuest));
    document.title = onQuest ? "Collector Box Quest · Luke's Trade Database" : "Luke's Trade Database";
    if (!push) return;
    const next = onQuest ? "#quest" : location.pathname + location.search;
    if ((onQuest && location.hash !== "#quest") || (!onQuest && location.hash)) history.pushState(null, "", next);
  }
  tabTrade.addEventListener("click", () => show("trade", true));
  tabQuest.addEventListener("click", () => show("quest", true));
  window.addEventListener("hashchange", () => show(location.hash === "#quest" ? "quest" : "trade", false));
  show(location.hash === "#quest" ? "quest" : "trade", false);

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

  const LOCK = `<span class="lock" aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22"><path fill="currentColor" d="M8 10V7a4 4 0 0 1 8 0v3h1.2A1.8 1.8 0 0 1 19 11.8v7.4A1.8 1.8 0 0 1 17.2 21H6.8A1.8 1.8 0 0 1 5 19.2v-7.4A1.8 1.8 0 0 1 6.8 10H8zm2 0h4V7a2 2 0 0 0-4 0v3z"/></svg></span>`;
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function art(b, eager) {
    if (!b.imageUrl) return "";
    const delay = reduceMotion ? "" : ` style="animation-delay:${(-(b.tcgplayerProductId % 7) * 0.45).toFixed(2)}s"`;
    return `<div class="qstage">
      <div class="qfigure"${delay}>
        <img class="boxart" alt="${esc(b.name)} sealed Collector Booster display" width="1000" height="1000" ${eager ? "" : 'loading="lazy"'} decoding="async" src="${esc(b.imageUrl)}">
        <span class="sheen" aria-hidden="true"></span>
        ${b.owned ? '<span class="foil" aria-hidden="true"></span>' : LOCK}
      </div>
    </div>`;
  }

  function bindTilt(root) {
    if (reduceMotion || !root) return;
    root.querySelectorAll(".qstage").forEach((stage) => {
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
    const proof = b.owned && (b.verificationPhoto || sessionProof.has(b.id));
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
          ${b.owned ? "" : `<button type="button" class="btn ghost" data-unlock="${esc(b.id)}">Unlock this box</button>`}
          ${proof ? `<button type="button" class="btn ghost" data-proof="${esc(b.id)}">View proof</button>` : ""}
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
    $("#questOwned").innerHTML = ownedHtml;
    $("#questList").innerHTML = missHtml;
    bindTilt($("#questOwned"));
    bindTilt($("#questList"));
    const ownedVisible = showOwned && owned.length > 0;
    const missVisible = showMissing && missing.length > 0;
    $("#ownedHead").hidden = !ownedVisible;
    $("#missHead").hidden = !missVisible;
    $("#questEmpty").hidden = ownedVisible || missVisible;
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
    $("#questDash").innerHTML = `<div class="progress">
      <div class="prow"><strong>${owned.length} / ${n}</strong><span>${pct}%</span></div>
      <div class="bar" role="progressbar" aria-valuenow="${owned.length}" aria-valuemin="0" aria-valuemax="${n}" aria-label="Owned collector displays"><span style="width:${n ? (owned.length / n * 100) : 0}%"></span></div>
    </div>
    <div class="dash">
      <div><b>${owned.length}</b><small>unlocked</small></div>
      <div><b>${miss.length}</b><small>still locked</small></div>
      <div><b>${usd(owned.length ? shelf : 0)}</b><small>shelf value · market</small></div>
      <div><b>${usd(miss.length ? cost : 0)}</b><small>to complete · lowest listing</small></div>
    </div>
    ${withMsrp.length ? `<p class="gainline">Owned boxes are <strong class="${gain >= 0 ? "up" : "down"}">${money(gain)}</strong> versus MSRP.</p>` : ""}`;

    const goals = [
      { n: 1, name: "First Box", blurb: "The shelf isn't empty" },
      { n: 5, name: "Five Boxes", blurb: "A real start" },
      { n: 10, name: "Ten Boxes", blurb: "Double digits" },
      { n: 25, name: "Twenty-five", blurb: "The vault takes shape" },
      { n: n, name: "Complete", blurb: "Every display, sealed" },
    ];
    const seen = new Set();
    $("#questMedals").innerHTML = goals.filter((g) => g.n > 0 && !seen.has(g.n) && seen.add(g.n)).map((g) => {
      const on = owned.length >= g.n;
      return `<div class="medal ${on ? "on" : "off"}"><b>${esc(g.name)}</b><small>${on ? esc(g.blurb) : "Reach " + g.n}</small></div>`;
    }).join("");

    const cheapest = miss.filter((b) => b.lowestListed != null).sort((a, b) => a.lowestListed - b.lowestListed || a.releaseDate.localeCompare(b.releaseDate))[0];
    $("#questNext").innerHTML = cheapest ? `<aside class="callout">
      ${cheapest.imageUrl ? `<img class="callout-art" alt="" width="84" height="84" src="${esc(cheapest.imageUrl)}">` : `<img class="set-icon" alt="" width="48" height="48" src="${esc(cheapest.icon)}">`}
      <div><p class="kicker">Next cheapest to grab</p><p class="qname">${esc(cheapest.name)}</p>
      <p class="qmeta">${usd(cheapest.lowestListed)} lowest listing · ${usd(cheapest.market)} market${cheapest.msrp != null ? " · MSRP " + usd(cheapest.msrp) : ""}</p></div>
      <a class="btn" href="${esc(cheapest.tcgplayerUrl)}" target="_blank" rel="noopener">View on TCGplayer ↗</a>
    </aside>` : `<aside class="callout"><div><p class="kicker">Quest complete</p><p class="qname">Every display is on the shelf.</p></div></aside>`;
  }

  document.querySelectorAll(".seg button").forEach((btn) => btn.addEventListener("click", () => {
    filter = btn.dataset.filter;
    document.querySelectorAll(".seg button").forEach((b) => b.classList.toggle("on", b === btn));
    render();
  }));
  $("#questSort").addEventListener("input", () => { sort = $("#questSort").value; render(); });
  $("#questQ").addEventListener("input", () => { q = $("#questQ").value; render(); });

  function milestones(total) {
    const goals = [
      { n: 1, name: "First Box", blurb: "The shelf isn't empty" },
      { n: 5, name: "Five Boxes", blurb: "A real start" },
      { n: 10, name: "Ten Boxes", blurb: "Double digits" },
      { n: 25, name: "Twenty-five", blurb: "The vault takes shape" },
      { n: total, name: "Complete", blurb: "Every display, sealed" },
    ];
    const seen = new Set();
    return goals.filter((g) => g.n > 0 && !seen.has(g.n) && seen.add(g.n));
  }

  function hexToBytes(hex) {
    const out = new Uint8Array(hex.length / 2);
    for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.substr(i * 2, 2), 16);
    return out;
  }
  function bytesToHex(buf) {
    return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  }
  function bytesToB64(bytes) {
    let s = "";
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }
  function b64ToBytes(b64) {
    const bin = atob(b64.replace(/\s/g, ""));
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }
  async function derivePassphrase(phrase, saltHex, iterations) {
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(phrase), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits({
      name: "PBKDF2",
      salt: hexToBytes(saltHex),
      iterations: iterations || 100000,
      hash: "SHA-256",
    }, key, 256);
    return bytesToHex(bits);
  }
  async function freshSalt() {
    return bytesToHex(crypto.getRandomValues(new Uint8Array(16)));
  }

  function token() { return localStorage.getItem(TOKEN_KEY) || ""; }
  function ghError(status, message) {
    const err = new Error(message || ("GitHub error " + status));
    err.status = status;
    return err;
  }
  async function gh(path, opts) {
    const key = token();
    if (!key) throw ghError(0, "No GitHub token is saved on this device.");
    const res = await fetch(GH + path.split("/").map(encodeURIComponent).join("/"), {
      method: (opts && opts.method) || "GET",
      headers: {
        Authorization: "Bearer " + key,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        ...(opts && opts.body ? { "Content-Type": "application/json" } : {}),
      },
      body: opts && opts.body,
    });
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (e) { data = { message: text }; }
    if (res.status === 401) throw ghError(401, "GitHub rejected that token. It needs contents read and write on this repository only.");
    if (res.status === 403) throw ghError(403, "GitHub refused the token (" + ((data && data.message) || "forbidden") + "). Contents read and write on Trade-database-mtg is required.");
    if (res.status === 404 && opts && opts.allow404) return null;
    if (!res.ok) throw ghError(res.status, (data && data.message) || ("GitHub error " + res.status));
    return data;
  }
  async function readRepoJson(path) {
    const cur = await gh(path);
    const text = new TextDecoder().decode(b64ToBytes(cur.content));
    return { sha: cur.sha, doc: JSON.parse(text) };
  }
  async function putContent(path, b64, message) {
    let last = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const cur = await gh(path, { allow404: true });
      const body = { message, content: b64 };
      if (cur && cur.sha) body.sha = cur.sha;
      try {
        return await gh(path, { method: "PUT", body: JSON.stringify(body) });
      } catch (e) {
        last = e;
        if (e.status !== 409 || attempt === 2) throw e;
      }
    }
    throw last;
  }
  function todayISO() {
    const d = new Date();
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }
  async function commitUnlock(box, paid, photoBytes) {
    const photoPath = "images/verified/" + box.id + ".jpg";
    await putContent(photoPath, bytesToB64(photoBytes), "Add verification photo for " + box.name);
    let last = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const { sha, doc } = await readRepoJson("collector_boxes.json");
      const target = (doc.boxes || []).find((b) => b.id === box.id);
      if (!target) throw new Error("That box is no longer in collector_boxes.json.");
      target.owned = true;
      target.paid = paid;
      target.unlockedAt = todayISO();
      target.verificationPhoto = photoPath;
      doc.updated = todayISO();
      const text = JSON.stringify(doc, null, 2) + "\n";
      try {
        await gh("collector_boxes.json", {
          method: "PUT",
          body: JSON.stringify({
            message: "Unlock " + box.name + " collector display",
            content: bytesToB64(new TextEncoder().encode(text)),
            sha,
          }),
        });
        return { doc, photoPath, unlockedAt: target.unlockedAt };
      } catch (e) {
        last = e;
        if (e.status !== 409 || attempt === 2) throw e;
      }
    }
    throw last;
  }
  async function commitPassphrase(salt, hash) {
    let last = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const { sha, doc } = await readRepoJson("collector_boxes.json");
      doc.unlock = { kdf: "PBKDF2-SHA256", iterations: 100000, salt, hash };
      const text = JSON.stringify(doc, null, 2) + "\n";
      try {
        await gh("collector_boxes.json", {
          method: "PUT",
          body: JSON.stringify({
            message: "Set Collector Box Quest passphrase hash",
            content: bytesToB64(new TextEncoder().encode(text)),
            sha,
          }),
        });
        return doc.unlock;
      } catch (e) {
        last = e;
        if (e.status !== 409 || attempt === 2) throw e;
      }
    }
    throw last;
  }

  function burst(origin) {
    if (reduceMotion) return;
    const host = $("#confetti");
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
    const pop = $("#badgePop");
    pop.innerHTML = list.map((g) => `<div class="badge-pop"><p class="kicker">Milestone</p><h3>${esc(g.name)}</h3><p>${esc(g.blurb)}</p></div>`).join("");
    pop.hidden = false;
    setTimeout(() => { pop.hidden = true; }, reduceMotion ? 2200 : 3200);
  }
  function celebrate(box, badges) {
    dashboard();
    render();
    const el = document.querySelector('.qbox[data-id="' + (window.CSS && CSS.escape ? CSS.escape(box.id) : box.id) + '"]');
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
    if (ritual && ritual.photoUrl) URL.revokeObjectURL(ritual.photoUrl);
    ritual = null;
    $("#ritual").hidden = true;
    $("#ritual").innerHTML = "";
  }
  function paintRitual() {
    const r = ritual;
    const box = r.box;
    const title = {
      pick: "Choose a sealed box",
      token: "Keeper key",
      setphrase: "Set the passphrase",
      phrase: "The words",
      photo: "The proof",
      price: "The price",
      saving: "Writing the archive",
    }[r.step] || "Unlock ritual";
    const body = {
      pick: `<p class="qnote">Which display did you bring home?</p>
        <label>Locked box<select id="ritualPick">${boxes.filter((b) => !b.owned).map((b) => `<option value="${esc(b.id)}">${esc(b.name)}${b.variant ? " · " + esc(b.variant) : ""}</option>`).join("")}</select></label>`,
      token: `<p class="qnote">A fine-grained GitHub token with contents read and write on this repo is saved only in this browser. It is the real key. The passphrase is a light gate in front of the ritual.</p>
        <label>Token<input id="ritualToken" type="password" autocomplete="off" placeholder="github_pat_…"></label>
        ${token() ? `<p class="qnote">A token is already saved on this device.</p><button type="button" class="btn ghost" id="ritualForget">Forget token</button>` : ""}`,
      setphrase: `<p class="qnote">No passphrase is set yet, so the ritual stays closed. Choose one here, or run <code>python3 set_passphrase.py</code> and push the hash. The passphrase itself is never stored.</p>
        <label>New passphrase<input id="phrase1" type="password" autocomplete="new-password"></label>
        <label>Repeat<input id="phrase2" type="password" autocomplete="new-password"></label>
        ${r.hashPreview ? `<p class="qnote hashline">Salt <code>${esc(r.hashPreview.salt)}</code><br>Hash <code>${esc(r.hashPreview.hash)}</code></p>` : ""}`,
      phrase: `<p class="qnote">${box ? esc(box.name) : "This box"} stays locked until the passphrase matches the hash in the repo.</p>
        <label>Passphrase<input id="ritualPhrase" type="password" autocomplete="current-password"></label>`,
      photo: `<p class="qnote">Photograph the sealed display. On a phone this opens the camera.</p>
        <label class="capture">Take or upload a photo
          <input id="ritualPhoto" type="file" accept="image/*" capture="environment">
        </label>
        ${r.photoUrl ? `<img class="proof-preview" alt="Chosen verification photo" src="${esc(r.photoUrl)}">` : ""}`,
      price: `<p class="qnote">What did you pay for ${box ? esc(box.name) : "this box"}?</p>
        <label>Amount paid, USD<input id="ritualPaid" inputmode="decimal" autocomplete="off" placeholder="0.00"></label>`,
      saving: `<p class="qnote">${esc(r.status || "Sealing the proof into the repository…")}</p>`,
    }[r.step] || "";
    const actions = {
      pick: `<button type="button" class="btn" id="ritualNext">Continue</button>`,
      token: `<button type="button" class="btn" id="ritualSaveToken">Save on this device</button>`,
      setphrase: `${r.hashPreview && token() ? `<button type="button" class="btn" id="ritualSaveHash">Save hash to the repo</button>` : `<button type="button" class="btn" id="ritualMakeHash">Create hash</button>`}`,
      phrase: `<button type="button" class="btn" id="ritualNext">Continue</button>`,
      photo: `<button type="button" class="btn" id="ritualNext">Continue</button>`,
      price: `<button type="button" class="btn" id="ritualCommit">Break the seal</button>`,
      saving: "",
    }[r.step] || "";
    $("#ritual").innerHTML = `<div class="ritual-card" role="dialog" aria-modal="true" aria-labelledby="ritualTitle">
      <button type="button" class="ritual-x" id="ritualClose" aria-label="Close">×</button>
      <p class="kicker">Unlock ritual</p>
      <h2 id="ritualTitle">${esc(title)}</h2>
      ${r.error ? `<p class="ritual-err">${esc(r.error)}</p>` : ""}
      ${body}
      <div class="ritual-actions">${actions}<button type="button" class="btn ghost" id="ritualCancel">Close</button></div>
    </div>`;
    $("#ritual").hidden = false;
    const focus = $("#ritual").querySelector("input, select, button");
    if (focus) focus.focus();
  }
  function openRitual(box) {
    ritual = { box: box || null, step: "phrase", error: "", photoUrl: "", photoBytes: null, hashPreview: null, status: "" };
    if (!unlockCfg.hash || !unlockCfg.salt) ritual.step = "setphrase";
    else if (!box) ritual.step = "pick";
    paintRitual();
  }
  async function compressPhoto(file) {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1200 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bmp.width * scale));
    canvas.height = Math.max(1, Math.round(bmp.height * scale));
    canvas.getContext("2d").drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
    if (!blob) throw new Error("Could not compress that photo.");
    return new Uint8Array(await blob.arrayBuffer());
  }
  async function onRitualClick(e) {
    const id = e.target.id;
    if ((id === "ritualClose" || id === "ritualCancel") && ritual.step !== "saving") { closeRitual(); return; }
    if (id === "ritualForget") { localStorage.removeItem(TOKEN_KEY); ritual.error = ""; paintRitual(); return; }
    if (id === "ritualSaveToken") {
      const value = ($("#ritualToken") && $("#ritualToken").value || "").trim();
      if (!value) { ritual.error = "Paste the token first."; paintRitual(); return; }
      localStorage.setItem(TOKEN_KEY, value);
      ritual.error = "";
      if (ritual.passed && ritual.box) ritual.step = "photo";
      else if (!unlockCfg.hash || !unlockCfg.salt) ritual.step = "setphrase";
      else ritual.step = ritual.box ? "phrase" : "pick";
      paintRitual();
      return;
    }
    if (id === "ritualMakeHash") {
      const a = $("#phrase1").value, b = $("#phrase2").value;
      if (!a || a !== b) { ritual.error = a ? "The two entries did not match." : "Enter a passphrase."; paintRitual(); return; }
      const salt = await freshSalt();
      ritual.hashPreview = { salt, hash: await derivePassphrase(a, salt, 100000) };
      ritual.error = token() ? "" : "Hash ready. Save a keeper key to write it to the repo, or run python3 set_passphrase.py and push.";
      paintRitual();
      return;
    }
    if (id === "ritualSaveHash") {
      ritual.error = ""; ritual.step = "saving"; ritual.status = "Writing the passphrase hash…"; paintRitual();
      try {
        unlockCfg = Object.assign(unlockCfg, await commitPassphrase(ritual.hashPreview.salt, ritual.hashPreview.hash));
        ritual.step = ritual.box ? "phrase" : "pick";
        ritual.hashPreview = null;
        ritual.error = "";
      } catch (err) {
        ritual.step = "setphrase";
        ritual.error = err.message || "Could not save the hash.";
      }
      paintRitual();
      return;
    }
    if (id === "ritualNext" && ritual.step === "pick") {
      ritual.box = boxes.find((b) => b.id === $("#ritualPick").value) || null;
      if (!ritual.box) { ritual.error = "Choose a box."; paintRitual(); return; }
      ritual.step = "phrase"; ritual.error = ""; paintRitual(); return;
    }
    if (id === "ritualNext" && ritual.step === "phrase") {
      const phrase = $("#ritualPhrase").value;
      ritual.error = "";
      const got = await derivePassphrase(phrase, unlockCfg.salt, unlockCfg.iterations || 100000);
      if (got !== unlockCfg.hash) { ritual.error = "That passphrase does not match."; paintRitual(); return; }
      ritual.passed = true;
      ritual.step = token() ? "photo" : "token";
      paintRitual();
      return;
    }
    if (id === "ritualNext" && ritual.step === "photo") {
      if (!ritual.photoBytes) { ritual.error = "Add a photo of the sealed box."; paintRitual(); return; }
      ritual.step = "price"; ritual.error = ""; paintRitual(); return;
    }
    if (id === "ritualCommit") {
      const raw = $("#ritualPaid").value.trim().replace(/[$,]/g, "");
      const paid = Math.round(Number(raw) * 100) / 100;
      if (!raw || !Number.isFinite(paid) || paid < 0) { ritual.error = "Enter the amount you paid."; paintRitual(); return; }
      const before = boxes.filter((b) => b.owned).length;
      ritual.step = "saving"; ritual.status = "Uploading the photo and marking the box owned…"; ritual.error = ""; paintRitual();
      try {
        const saved = await commitUnlock(ritual.box, paid, ritual.photoBytes);
        const id = ritual.box.id;
        const local = boxes.find((b) => b.id === id);
        if (local) {
          local.owned = true;
          local.paid = paid;
          local.unlockedAt = saved.unlockedAt;
          local.verificationPhoto = saved.photoPath;
        }
        if (ritual.photoUrl) sessionProof.set(id, ritual.photoUrl);
        const after = before + 1;
        const had = new Set(milestones(boxes.length).filter((g) => before >= g.n).map((g) => g.n));
        const badges = milestones(boxes.length).filter((g) => after >= g.n && !had.has(g.n));
        const box = local || ritual.box;
        ritual.photoUrl = "";
        closeRitual();
        celebrate(box, badges);
      } catch (err) {
        ritual.step = "price";
        ritual.error = err.status === 409
          ? "The collection file changed while saving. The latest copy was fetched and the save was retried. " + (err.message || "Try the ritual again.")
          : (err.message || "The save failed.");
        paintRitual();
      }
    }
  }
  $("#ritual").addEventListener("click", onRitualClick);
  $("#ritual").addEventListener("change", async (e) => {
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
  $("#unlockAny").addEventListener("click", () => openRitual(null));
  $("#keeperKey").addEventListener("click", () => {
    ritual = { box: null, step: "token", error: "", photoUrl: "", photoBytes: null, hashPreview: null, status: "" };
    paintRitual();
  });
  $("#proof").addEventListener("click", (e) => { if (e.target.id === "proof" || e.target.id === "proofClose") $("#proof").hidden = true; });
  document.getElementById("quest").addEventListener("click", (e) => {
    const unlock = e.target.closest("[data-unlock]");
    if (unlock) { openRitual(boxes.find((b) => b.id === unlock.dataset.unlock) || null); return; }
    const proof = e.target.closest("[data-proof]");
    if (!proof) return;
    const box = boxes.find((b) => b.id === proof.dataset.proof);
    if (!box) return;
    const src = sessionProof.get(box.id) || box.verificationPhoto;
    $("#proof").innerHTML = `<div class="proof-card"><button type="button" id="proofClose" class="ritual-x" aria-label="Close">×</button><p class="kicker">Proof</p><h2>${esc(box.name)}</h2><img alt="Verification photo of ${esc(box.name)}" src="${esc(src)}"><p class="qnote">${box.unlockedAt ? "Unlocked " + esc(box.unlockedAt) : ""}${box.paid != null ? " · paid " + usd(box.paid) : ""}</p></div>`;
    $("#proof").hidden = false;
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && ritual && ritual.step !== "saving") closeRitual();
  });

  document.getElementById("quest").addEventListener("error", (e) => {
    const img = e.target;
    if (!img.classList || !img.classList.contains("boxart")) return;
    const fig = img.closest(".qfigure");
    if (fig) fig.classList.add("no-art");
  }, true);

  fetch("collector_boxes.json", { cache: "no-store" }).then((r) => r.json()).then((d) => {
    boxes = d.boxes || [];
    unlockCfg = Object.assign(unlockCfg, d.unlock || {});
    dashboard();
    render();
  }).catch(() => {
    $("#questDash").innerHTML = "<p class='qnote'>Couldn't load collector box data.</p>";
  });
})();
