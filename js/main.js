(function () {
  // Widow fix: glue the last two words of every paragraph together
  document.querySelectorAll("p, .quote__who").forEach(function (el) {
    if (el.querySelector(".flow")) return;
    el.innerHTML = el.innerHTML.replace(/\s+([^\s<>]+)\s*$/, "&nbsp;$1");
  });

  var reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // HERO: parallax on scroll (no load animation)
  var hero = document.getElementById("hero");
  var layerBg = hero.querySelector(".hero__layer--bg");
  var layerTitle = hero.querySelector(".hero__layer--title");
  var layerPeople = hero.querySelector(".hero__layer--people");
  var shade = hero.querySelector(".hero__shade");

  function heroParallax() {
    var h = window.innerHeight;
    var y = Math.min(h, Math.max(0, window.scrollY));
    // bg + people move together (so the original people in the bg never peek out);
    // the title sinks faster, sliding down behind the people
    var photo = "translate3d(0," + (y * 0.3) + "px,0)";
    layerBg.style.transform = photo;
    layerPeople.style.transform = photo;
    layerTitle.style.transform = "translate3d(0," + (y * 0.75) + "px,0)";
    shade.style.opacity = 0.2 + 0.65 * Math.min(1, y / (h * 0.5));
  }

  if (!reduce) {
    var ticking = false;
    window.addEventListener("scroll", function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () { heroParallax(); ticking = false; });
    }, { passive: true });
    window.addEventListener("resize", heroParallax);
    heroParallax();
  }

  // Scenes: each pinned section switches its own bg to match the card in the middle
  if ("IntersectionObserver" in window) {
    document.querySelectorAll(".scenes").forEach(function (section) {
      var bgs = section.querySelectorAll(".scenes__bg");
      var so = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var i = parseInt(entry.target.dataset.bg, 10);
          bgs.forEach(function (img, k) {
            img.classList.toggle("is-active", k === i);
          });
        });
      }, { rootMargin: "-50% 0px -50% 0px" });
      section.querySelectorAll(".scene").forEach(function (s) { so.observe(s); });
    });
  }

  // 5 syarikat: buildings light up one by one, card swaps to that company
  var sy = document.getElementById("syarikat");
  if (sy) {
    var syCols = sy.querySelectorAll(".syarikat__col");
    var syCards = sy.querySelectorAll(".syarikat__card");
    var syStep = -1;

    function syUpdate() {
      var r = sy.getBoundingClientRect();
      var total = sy.offsetHeight - window.innerHeight;
      var p = Math.min(0.9999, Math.max(0, -r.top / total));
      var step = Math.floor(p * syCols.length);
      if (step === syStep) return;
      syStep = step;
      syCols.forEach(function (col, i) { col.classList.toggle("is-on", i <= step); });
      syCards.forEach(function (card, i) {
        card.classList.toggle("is-active", i === step);
      });
    }

    if (reduce) {
      syCols.forEach(function (col) { col.classList.add("is-on"); });
    } else {
      var syTick = false;
      window.addEventListener("scroll", function () {
        if (syTick) return;
        syTick = true;
        requestAnimationFrame(function () { syUpdate(); syTick = false; });
      }, { passive: true });
      window.addEventListener("resize", syUpdate);
      syUpdate();
    }
  }

  // Quote card: typewriter once it's on screen (photo + name stay still)
  var quoteCard = document.querySelector(".quote");
  if (quoteCard && !reduce && "IntersectionObserver" in window) {
    var qp = quoteCard.querySelector("blockquote p");
    var text = qp.textContent.replace(/\s+/g, " ").trim();
    // one span per letter; words wrapped so they never break mid-word
    qp.innerHTML = text.split(" ").map(function (w) {
      return '<span style="white-space:nowrap">' + w.split("").map(function (ch) {
        return '<span class="qc">' + ch + '</span>';
      }).join("") + '</span>';
    }).join('<span class="qc"> </span>');
    var chars = qp.querySelectorAll(".qc");
    var caret = document.createElement("span");
    caret.className = "q-caret";
    caret.setAttribute("aria-hidden", "true");
    quoteCard.classList.add("js-anim");

    // total typing time ~4s: short pause on punctuation, the rest shared by every letter
    var TOTAL = 4000, PUNCT_PAUSE = 120;
    var punct = 0;
    chars.forEach(function (c) { if (/[.,?!]/.test(c.textContent)) punct++; });
    var step = Math.max(8, (TOTAL - punct * PUNCT_PAUSE) / chars.length);

    function typeQuote() {
      var i = 0;
      chars[0].parentNode.insertBefore(caret, chars[0]);
      (function tick() {
        if (i >= chars.length) { quoteCard.classList.add("is-done"); return; }
        var ch = chars[i];
        ch.classList.add("is-typed");
        ch.parentNode.insertBefore(caret, ch.nextSibling);
        i++;
        var t = ch.textContent;
        // natural rhythm: pause a little on punctuation and spaces
        var d = (/[.,?!]/.test(t) ? PUNCT_PAUSE : 0) + step * (0.7 + Math.random() * 0.6);
        setTimeout(tick, d);
      })();
    }

    var qo = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          quoteCard.classList.add("is-play");
          qo.disconnect();
          setTimeout(typeQuote, 200);
        }
      });
    }, { threshold: 0.3 });
    qo.observe(quoteCard);
  }

  // Videos: play when near the screen, pause when out of view
  var inviewVideos = document.querySelectorAll("video.autoplay-inview");
  if ("IntersectionObserver" in window) {
    var vo = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        var v = entry.target;
        if (entry.isIntersecting) {
          var pr = v.play();
          if (pr && pr.catch) pr.catch(function () {});
        } else {
          v.pause();
        }
      });
    }, { threshold: 0.25 });
    inviewVideos.forEach(function (v) { vo.observe(v); });
  }

  // Quiz / poll: pick an option, show the answer box underneath.
  // Quiz: the correct option turns yellow.
  // Poll: the picked option turns yellow and every option shows the % of readers who picked it.
  function track(quiz, btn, isCorrect) {
    if (typeof gtag !== "function") return;
    gtag("event", "quiz_answer", {
      quiz_name: quiz.dataset.name || "quiz",
      answer: btn.querySelector(".quiz__label").textContent.trim(),
      is_correct: isCorrect
    });
  }

  // Vote storage. With data-endpoint set, votes go to the Google Sheet (Apps Script).
  // Without it (demo), votes are only kept in this browser.
  var POLL_LS = "mosti_poll_counts";
  var POLL_VOTED = "mosti_poll_voted";

  function lsGet(k) { try { return localStorage.getItem(k); } catch (err) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (err) {} }

  function pollSend(endpoint, key) {
    if (endpoint) {
      var url = endpoint + (endpoint.indexOf("?") > -1 ? "&" : "?") + (key ? "vote=" + encodeURIComponent(key) : "results=1");
      return fetch(url).then(function (r) { return r.json(); });
    }
    var counts = {};
    try { counts = JSON.parse(lsGet(POLL_LS)) || {}; } catch (err) {}
    if (key) { counts[key] = (counts[key] || 0) + 1; lsSet(POLL_LS, JSON.stringify(counts)); }
    return Promise.resolve(counts);
  }

  function showResults(quiz, counts) {
    var btns = quiz.querySelectorAll(".quiz__opt");
    var total = 0;
    btns.forEach(function (b) { total += Number(counts[b.dataset.key] || 0); });
    // round so the % always adds up to 100
    var raw = [], sum = 0;
    btns.forEach(function (b, i) {
      var v = total ? (Number(counts[b.dataset.key] || 0) / total) * 100 : 0;
      raw.push({ i: i, v: v, f: Math.floor(v) }); sum += Math.floor(v);
    });
    if (total) {
      raw.slice().sort(function (a, b) { return (b.v - b.f) - (a.v - a.f); })
        .slice(0, 100 - sum).forEach(function (r) { r.f += 1; });
    }
    quiz.classList.add("is-results");
    btns.forEach(function (b, i) {
      var pct = raw[i].f;
      b.querySelector(".quiz__fill").style.width = pct + "%";
      b.querySelector(".quiz__pct").textContent = pct + "%";
      b.setAttribute("aria-label", b.querySelector(".quiz__label").textContent.trim() + ": " + pct + "%");
    });
    var t = quiz.querySelector(".quiz__total");
    if (t) {
      t.textContent = total.toLocaleString("ms-MY") + " pembaca telah menjawab" + (quiz.dataset.endpoint ? "" : " (demo)");
      t.hidden = false;
    }
  }

  document.querySelectorAll(".quiz").forEach(function (quiz) {
    var answer = quiz.querySelector(".quiz__answer");
    var isPoll = quiz.dataset.mode === "poll";
    var endpoint = (quiz.dataset.endpoint || "").trim();

    function lock(btn) {
      quiz.classList.add("is-answered");
      btn.classList.add("is-picked", "is-correct");
      answer.hidden = false;
    }

    // came back after voting before: show results straight away
    if (isPoll) {
      var prev = lsGet(POLL_VOTED);
      var prevBtn = prev && quiz.querySelector('.quiz__opt[data-key="' + prev + '"]');
      if (prevBtn) {
        lock(prevBtn);
        pollSend(endpoint, null).then(function (c) { showResults(quiz, c); }).catch(function () {});
      }
    }

    quiz.querySelectorAll(".quiz__opt").forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (quiz.classList.contains("is-answered")) return;
        if (isPoll) {
          lock(btn);
          lsSet(POLL_VOTED, btn.dataset.key);
          track(quiz, btn, "n/a");
          pollSend(endpoint, btn.dataset.key)
            .then(function (c) { showResults(quiz, c); })
            .catch(function () { /* offline or endpoint down: keep the answer box, skip the %s */ });
          return;
        }
        quiz.classList.add("is-answered");
        btn.classList.add("is-picked");
        var win = quiz.querySelector('.quiz__opt[data-correct="true"]');
        if (win) win.classList.add("is-correct");
        answer.hidden = false;
        track(quiz, btn, String(btn === win));
      });
    });
  });

  // Drag-into-sentence poll: drag a chip into the blank, or just tap it
  document.querySelectorAll('.quiz[data-mode="drag"]').forEach(function (quiz) {
    var slot = quiz.querySelector(".drag__slot");
    var answer = quiz.querySelector(".quiz__answer");
    var chips = quiz.querySelectorAll(".drag__chips .chip");

    function choose(chip) {
      if (quiz.classList.contains("is-answered")) return;
      quiz.classList.add("is-answered");
      var copy = chip.cloneNode(true);
      copy.removeAttribute("data-key");
      copy.setAttribute("tabindex", "-1");
      slot.innerHTML = "";
      slot.appendChild(copy);
      slot.classList.add("is-filled");
      chip.classList.add("is-picked");
      answer.hidden = false;
      if (typeof gtag === "function") {
        gtag("event", "quiz_answer", {
          quiz_name: quiz.dataset.name || "poll",
          answer: chip.querySelector(".chip__label").textContent.trim(),
          is_correct: "n/a"
        });
      }
    }

    function overSlot(x, y) {
      var r = slot.getBoundingClientRect();
      var pad = 24; // forgiving drop area
      return x > r.left - pad && x < r.right + pad && y > r.top - pad && y < r.bottom + pad;
    }

    chips.forEach(function (chip) {
      var ghost = null, startX = 0, startY = 0, offX = 0, offY = 0, moved = false, pid = null;

      chip.addEventListener("pointerdown", function (e) {
        if (quiz.classList.contains("is-answered") || e.button > 0) return;
        pid = e.pointerId;
        startX = e.clientX; startY = e.clientY; moved = false;
        var r = chip.getBoundingClientRect();
        offX = e.clientX - r.left; offY = e.clientY - r.top;
        chip.setPointerCapture(pid);
      });

      chip.addEventListener("pointermove", function (e) {
        if (e.pointerId !== pid) return;
        if (!moved && Math.hypot(e.clientX - startX, e.clientY - startY) > 6) {
          moved = true;
          var r = chip.getBoundingClientRect();
          ghost = chip.cloneNode(true);
          ghost.classList.add("chip--ghost");
          ghost.style.width = r.width + "px";
          document.body.appendChild(ghost);
          chip.classList.add("is-dragging");
        }
        if (ghost) {
          ghost.style.left = (e.clientX - offX) + "px";
          ghost.style.top = (e.clientY - offY) + "px";
          slot.classList.toggle("is-over", overSlot(e.clientX, e.clientY));
        }
      });

      function end(e) {
        if (e.pointerId !== pid) return;
        pid = null;
        chip.classList.remove("is-dragging");
        slot.classList.remove("is-over");
        if (ghost) {
          var drop = overSlot(e.clientX, e.clientY);
          ghost.remove(); ghost = null;
          if (drop) choose(chip);
        } else if (e.type === "pointerup") {
          choose(chip); // plain tap / click
        }
      }
      chip.addEventListener("pointerup", end);
      chip.addEventListener("pointercancel", end);

      // keyboard: Enter / Space
      chip.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); choose(chip); }
      });
    });
  });

  // Share buttons: point at this page
  var pageUrl = encodeURIComponent(location.href);
  var pageTitle = encodeURIComponent(document.title);
  var shareLinks = {
    facebook: "https://www.facebook.com/sharer/sharer.php?u=" + pageUrl,
    whatsapp: "https://wa.me/?text=" + pageTitle + "%20" + pageUrl,
    x: "https://twitter.com/intent/tweet?text=" + pageTitle + "&url=" + pageUrl
  };
  document.querySelectorAll("[data-share]").forEach(function (a) {
    a.href = shareLinks[a.dataset.share];
    a.addEventListener("click", function () {
      if (typeof gtag === "function") gtag("event", "share", { method: a.dataset.share });
    });
  });

  // Intro paragraphs reveal on scroll
  var reveals = document.querySelectorAll(".reveal");
  if (reduce || !("IntersectionObserver" in window)) {
    reveals.forEach(function (el) { el.classList.add("is-visible"); });
    return;
  }

  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        io.unobserve(entry.target);
      }
    });
  }, { threshold: 0.3 });

  reveals.forEach(function (el) { io.observe(el); });
})();
