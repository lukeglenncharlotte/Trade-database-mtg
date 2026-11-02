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
    return `<article class="qbox ${b.owned ? "unlocked" : "locked"}${b.id === cheapestId ? " next" : ""}">
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
        <a class="btn" href="${esc(b.tcgplayerUrl)}" target="_blank" rel="noopener">View on TCGplayer ↗</a>
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

  document.getElementById("quest").addEventListener("error", (e) => {
    const img = e.target;
    if (!img.classList || !img.classList.contains("boxart")) return;
    const fig = img.closest(".qfigure");
    if (fig) fig.classList.add("no-art");
  }, true);

  fetch("collector_boxes.json", { cache: "no-store" }).then((r) => r.json()).then((d) => {
    boxes = d.boxes || [];
    dashboard();
    render();
  }).catch(() => {
    $("#questDash").innerHTML = "<p class='qnote'>Couldn't load collector box data.</p>";
  });
})();
