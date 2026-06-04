(function () {
  var analyticsKey = "eventschemastatusqa_analytics_events";
  var intentKey = "eventschemastatusqa_purchase_intents";
  var state = {
    latestBriefText: "",
    latestRequestText: "",
    pricingTracked: false
  };

  function qs(selector) {
    return document.querySelector(selector);
  }

  function qsa(selector) {
    return Array.prototype.slice.call(document.querySelectorAll(selector));
  }

  function clean(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function getAtType(value) {
    var type = value && value["@type"];
    if (Array.isArray(type)) return type.join(" ");
    return String(type || "");
  }

  function includesAny(value, terms) {
    var haystack = String(value || "").toLowerCase();
    return terms.some(function (term) {
      return haystack.indexOf(term.toLowerCase()) !== -1;
    });
  }

  function toArray(value) {
    if (value === undefined || value === null || value === "") return [];
    return Array.isArray(value) ? value : [value];
  }

  function hasValue(value) {
    if (Array.isArray(value)) return value.length > 0;
    return value !== undefined && value !== null && String(value).trim() !== "";
  }

  function valueText(value) {
    if (Array.isArray(value)) return value.map(valueText).join(", ");
    if (value && typeof value === "object") return JSON.stringify(value);
    return String(value || "");
  }

  function storeJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      return false;
    }
    return true;
  }

  function readJson(key) {
    try {
      return JSON.parse(localStorage.getItem(key) || "[]");
    } catch (error) {
      return [];
    }
  }

  function acquisition() {
    var params = new URLSearchParams(window.location.search);
    return {
      utmSource: params.get("utm_source") || "",
      utmMedium: params.get("utm_medium") || "",
      utmCampaign: params.get("utm_campaign") || ""
    };
  }

  function track(eventName, detail) {
    var events = readJson(analyticsKey);
    events.push(Object.assign({
      event: eventName,
      at: new Date().toISOString(),
      path: window.location.pathname
    }, acquisition(), detail || {}));
    storeJson(analyticsKey, events.slice(-100));
  }

  function pulseClass(element, className, delay) {
    if (!element) return;
    element.classList.add(className);
    window.setTimeout(function () {
      element.classList.remove(className);
    }, delay || 600);
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      return navigator.clipboard.writeText(text).catch(function () {
        return fallbackCopy(text);
      });
    }
    return fallbackCopy(text);
  }

  function fallbackCopy(text) {
    var textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.left = "-999px";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    document.body.removeChild(textarea);
    return Promise.resolve();
  }

  function sampleJson() {
    return JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Event",
      "name": "Growth Summit 2026",
      "startDate": "2026-08-12T09:00",
      "endDate": "2026-08-12T18:00",
      "eventStatus": "https://schema.org/EventScheduled",
      "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
      "offers": {
        "@type": "Offer",
        "price": "299",
        "priceCurrency": "USD"
      }
    }, null, 2);
  }

  function loadSample() {
    qs("#jsonld-input").value = sampleJson();
    qs("#visible-notes").value = "Visible page banner says POSTPONED and now hybrid. The public page still shows old venue copy and the session page is the canonical event detail.";
    qs("#status-notes").value = "Event was postponed from August 12 to September 3. The visible update says new time is 10:00 America/New_York, but JSON-LD has no timezone offset and still says EventScheduled.";
    qs("#location-notes").value = "Hybrid event. Venue address should be 100 Harbor Ave, Boston, MA, and online stream URL is not documented in schema.";
    qs("#offer-notes").value = "Ticket URL should point to /tickets/growth-summit-2026-new-date. Current listing URL is stale. Availability is limited and refund note changed after postponement.";
    qs("#organizer-notes").value = "Organizer is GrowthConf LLC, keynote performer is not assigned in markup, and speaker owner is TBD.";
    qs("#owner-notes").value = "Owner TBD across event marketing, ticketing, venue, content, frontend, and SEO cleanup.";
    qs("#page-type").value = "Hybrid or online event page";
    track("sample_event_schema_data_loaded", { triggerSource: "sample_button" });
  }

  function parseJsonInput(input) {
    var trimmed = input.trim();
    if (!trimmed) throw new Error("Paste Event JSON-LD before generating a brief.");
    try {
      return JSON.parse(trimmed);
    } catch (error) {
      throw new Error("JSON-LD could not be parsed. Paste one valid JSON object or array.");
    }
  }

  function walk(value, visitor) {
    if (!value || typeof value !== "object") return;
    visitor(value);
    if (Array.isArray(value)) {
      value.forEach(function (item) { walk(item, visitor); });
      return;
    }
    Object.keys(value).forEach(function (key) {
      var child = value[key];
      if (child && typeof child === "object") walk(child, visitor);
    });
  }

  function collectEvents(data) {
    var events = [];
    walk(data, function (node) {
      if (!node || typeof node !== "object" || Array.isArray(node)) return;
      if (includesAny(getAtType(node), ["Event"])) events.push(node);
    });
    return events;
  }

  function addFinding(sections, key, text) {
    sections[key].push(text);
  }

  function hasTimezone(value) {
    return /z$/i.test(String(value || "")) || /[+-]\d\d:\d\d$/.test(String(value || ""));
  }

  function analyzeEvent(input) {
    var data = parseJsonInput(input.jsonld);
    var events = collectEvents(data);
    var event = events[0] || {};
    var notes = [
      input.visibleNotes,
      input.statusNotes,
      input.locationNotes,
      input.offerNotes,
      input.organizerNotes,
      input.ownerNotes,
      input.pageType
    ].join(" ");
    var sections = {
      required: [],
      status: [],
      date: [],
      location: [],
      offer: [],
      parity: [],
      organizer: [],
      owner: [],
      handoff: []
    };

    if (!events.length) {
      addFinding(sections, "required", "missing Event markup or required event field: no Event item was found in the pasted JSON-LD.");
    } else {
      ["name", "startDate", "location"].forEach(function (field) {
        if (!hasValue(event[field])) {
          addFinding(sections, "required", "missing Event markup or required event field: " + field + " is missing.");
        }
      });
    }

    var status = valueText(event.eventStatus);
    if (!hasValue(event.eventStatus) && includesAny(notes, ["cancel", "postpone", "reschedule", "sold out"])) {
      addFinding(sections, "status", "eventStatus, cancellation, or postponement handoff risk: visible notes mention a status change but eventStatus is missing.");
    }
    if (includesAny(notes, ["cancel"]) && !includesAny(status, ["EventCancelled"])) {
      addFinding(sections, "status", "eventStatus, cancellation, or postponement handoff risk: visible notes mention cancellation but markup is not EventCancelled.");
    }
    if (includesAny(notes, ["postpone", "reschedule"]) && !includesAny(status, ["EventPostponed", "EventRescheduled"])) {
      addFinding(sections, "status", "eventStatus, cancellation, or postponement handoff risk: visible notes mention postponed or rescheduled status but markup does not reflect it.");
    }

    if (hasValue(event.startDate) && !hasTimezone(event.startDate)) {
      addFinding(sections, "date", "start/end date and timezone risk: startDate has no timezone offset.");
    }
    if (hasValue(event.endDate) && !hasTimezone(event.endDate)) {
      addFinding(sections, "date", "start/end date and timezone risk: endDate has no timezone offset.");
    }
    if (includesAny(notes, ["September", "new date", "postponed from"]) && !includesAny(valueText(event.startDate), ["09", "September"])) {
      addFinding(sections, "date", "start/end date and timezone risk: visible notes mention a new date but Event startDate still appears stale.");
    }

    var attendanceMode = valueText(event.eventAttendanceMode);
    var locationText = valueText(event.location);
    if (includesAny(notes, ["online", "hybrid", "stream"]) && !includesAny(attendanceMode + " " + locationText, ["OnlineEventAttendanceMode", "MixedEventAttendanceMode", "VirtualLocation", "stream", "http"])) {
      addFinding(sections, "location", "venue, online, or hybrid location mismatch: visible notes mention online or hybrid attendance but markup lacks online attendance or VirtualLocation details.");
    }
    if (includesAny(notes, ["venue", "address", "Boston"]) && !includesAny(locationText, ["streetAddress", "addressLocality", "PostalAddress", "Boston"])) {
      addFinding(sections, "location", "venue, online, or hybrid location mismatch: visible venue/address notes are not represented in Event location markup.");
    }

    var offers = toArray(event.offers);
    var offerText = valueText(offers);
    if (!offers.length || !includesAny(offerText, ["url"])) {
      addFinding(sections, "offer", "offer, ticket URL, availability, or price ambiguity: offers.url is missing or not documented.");
    }
    if (!includesAny(offerText, ["availability"])) {
      addFinding(sections, "offer", "offer, ticket URL, availability, or price ambiguity: ticket availability is missing.");
    }
    if (includesAny(input.offerNotes, ["stale", "old", "new-date", "changed"]) && !includesAny(offerText, ["new-date"])) {
      addFinding(sections, "offer", "offer, ticket URL, availability, or price ambiguity: visible ticket notes mention a changed ticket URL but markup does not show the new offer URL.");
    }

    if (includesAny(notes, ["postponed", "cancelled", "hybrid", "online", "sold out", "limited"]) && !includesAny(status + " " + attendanceMode + " " + offerText, ["EventPostponed", "EventRescheduled", "EventCancelled", "MixedEventAttendanceMode", "OnlineEventAttendanceMode", "LimitedAvailability", "SoldOut"])) {
      addFinding(sections, "parity", "visible event/schema mismatch: visible status, attendance, or ticket state differs from the pasted Event JSON-LD.");
    }

    if (!hasValue(event.organizer) && !hasValue(event.performer)) {
      addFinding(sections, "organizer", "performer/organizer handoff gap: organizer and performer are both missing.");
    } else if (!hasValue(event.organizer) || !hasValue(event.performer)) {
      addFinding(sections, "organizer", "performer/organizer handoff gap: one of organizer or performer is missing and should be assigned if relevant.");
    }
    if (includesAny(input.organizerNotes, ["TBD", "not assigned", "owner"])) {
      addFinding(sections, "organizer", "performer/organizer handoff gap: visible notes indicate an unassigned performer, organizer, speaker, or fact owner.");
    }

    if (!clean(input.ownerNotes) || includesAny(input.ownerNotes, ["TBD", "unknown", "not assigned"])) {
      addFinding(sections, "owner", "missing owner remediation decision across event marketing, ticketing, venue, content, frontend, or SEO owners.");
    }

    addFinding(sections, "handoff", "Confirm visible event copy, Event JSON-LD, ticketing page, venue/online location, organizer notes, and owner decision before publishing.");
    addFinding(sections, "handoff", "Do not treat this QA brief as ticketing, legal, compliance, rich-result eligibility, ranking, indexing, event operations, or attendee-support advice.");

    return {
      eventCount: events.length,
      sections: sections
    };
  }

  function sectionHtml(title, findings) {
    if (!findings.length) {
      return [
        "<section class=\"brief-section\">",
        "<h3>", escapeHtml(title), "</h3>",
        "<p>No issue flagged from the pasted sample. Confirm manually before launch.</p>",
        "</section>"
      ].join("");
    }
    return [
      "<section class=\"brief-section\">",
      "<h3>", escapeHtml(title), "</h3>",
      "<ul>",
      findings.map(function (item) { return "<li>" + escapeHtml(item) + "</li>"; }).join(""),
      "</ul>",
      "</section>"
    ].join("");
  }

  function briefText(result, input) {
    function lines(title, items) {
      return [title].concat(items.length ? items.map(function (item) { return "- " + item; }) : ["- No issue flagged from the pasted sample."]).join("\n");
    }
    return [
      "Event schema status QA brief",
      "",
      "Page type: " + input.pageType,
      "Event items found: " + result.eventCount,
      "",
      lines("Required event field warnings", result.sections.required),
      "",
      lines("Event status warnings", result.sections.status),
      "",
      lines("Date and timezone warnings", result.sections.date),
      "",
      lines("Location and online event warnings", result.sections.location),
      "",
      lines("Offer and ticket warnings", result.sections.offer),
      "",
      lines("Visible event parity warnings", result.sections.parity),
      "",
      lines("Performer and organizer warnings", result.sections.organizer),
      "",
      lines("Owner remediation reminders", result.sections.owner),
      "",
      lines("Handoff reminders", result.sections.handoff)
    ].join("\n");
  }

  function renderBrief(result, input) {
    var output = qs("#brief-output");
    var title = qs("#output-title");
    var status = qs("#status-pill");
    var copy = qs("#copy-brief");
    var html = [
      sectionHtml("Parse summary", [
        result.eventCount + " Event item(s) found.",
        "Selected page type: " + input.pageType
      ]),
      sectionHtml("Required event field warnings", result.sections.required),
      sectionHtml("Event status warnings", result.sections.status),
      sectionHtml("Date and timezone warnings", result.sections.date),
      sectionHtml("Location and online event warnings", result.sections.location),
      sectionHtml("Offer and ticket warnings", result.sections.offer),
      sectionHtml("Visible event parity warnings", result.sections.parity),
      sectionHtml("Performer and organizer warnings", result.sections.organizer),
      sectionHtml("Owner remediation reminders", result.sections.owner),
      sectionHtml("Handoff reminders", result.sections.handoff)
    ].join("");
    output.classList.remove("empty");
    output.innerHTML = html;
    title.textContent = "Event schema QA brief ready";
    status.textContent = "Ready";
    status.classList.add("is-ready");
    copy.disabled = false;
    state.latestBriefText = briefText(result, input);
    track("core_action_completed", {
      eventCount: result.eventCount,
      findingCount: Object.keys(result.sections).reduce(function (count, key) {
        return count + result.sections[key].length;
      }, 0)
    });
  }

  function setupAuditor() {
    var form = qs("#auditor-form");
    var error = qs("#workflow-error");
    qs("#load-sample").addEventListener("click", loadSample);
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      error.textContent = "";
      track("core_action_started", { triggerSource: "generate_button" });
      try {
        var input = {
          jsonld: qs("#jsonld-input").value,
          visibleNotes: qs("#visible-notes").value,
          statusNotes: qs("#status-notes").value,
          locationNotes: qs("#location-notes").value,
          offerNotes: qs("#offer-notes").value,
          organizerNotes: qs("#organizer-notes").value,
          ownerNotes: qs("#owner-notes").value,
          pageType: qs("#page-type").value
        };
        renderBrief(analyzeEvent(input), input);
        pulseClass(qs("#generate-brief"), "is-confirmed", 500);
      } catch (err) {
        error.textContent = err.message;
        track("core_action_failed", { reason: err.message });
      }
    });
    qs("#copy-brief").addEventListener("click", function () {
      if (!state.latestBriefText) return;
      copyText(state.latestBriefText).then(function () {
        track("brief_copied", { triggerSource: "copy_button" });
        qs("#copy-brief").textContent = "Copied";
        window.setTimeout(function () { qs("#copy-brief").textContent = "Copy brief"; }, 1400);
      });
    });
  }

  function buildPublicRequest(payload) {
    return [
      "## Role",
      payload.role,
      "",
      "## Event page type",
      payload.eventPageType,
      "",
      "## Event cadence",
      payload.eventCadence,
      "",
      "## Plan interest",
      payload.plan,
      "",
      "## Willingness to pay",
      payload.budget,
      "",
      "## Biggest Event schema QA pain",
      payload.pain,
      "",
      "## Purchase intent",
      payload.purchaseIntent ? "- [x] This is a real purchase-intent or pilot request if the tool catches event schema launch risks." : "- [ ] Purchase intent not confirmed yet.",
      "",
      "## Public safety note",
      "Do not paste private client snippets, credentials, email addresses, attendee data, ticket order data, or legal documents into this public issue."
    ].join("\n");
  }

  function setupWaitlist() {
    var form = qs("#waitlist-form");
    var status = qs("#waitlist-status");
    var handoff = qs("#handoff-panel");
    var remoteLink = qs("#remote-intent-link");
    var copyRequest = qs("#copy-request");
    form.addEventListener("submit", function (event) {
      event.preventDefault();
      track("signup_started", { triggerSource: "waitlist_form" });
      var payload = {
        email: qs("#email").value,
        role: qs("#role").value,
        eventPageType: qs("#event-page-type").value,
        eventCadence: qs("#event-cadence").value,
        plan: qs("#plan").value,
        budget: qs("#budget").value,
        pain: clean(qs("#pain").value),
        purchaseIntent: qs("#purchase-intent").checked,
        createdAt: new Date().toISOString()
      };
      var intents = readJson(intentKey);
      intents.push(payload);
      storeJson(intentKey, intents.slice(-50));
      track("waitlist_submitted", { role: payload.role, plan: payload.plan, purchaseIntent: payload.purchaseIntent });
      track("feedback_submitted", { triggerSource: "waitlist_form" });
      track("checkout_intent", { plan: payload.plan, budget: payload.budget, purchaseIntent: payload.purchaseIntent });
      state.latestRequestText = buildPublicRequest(payload);
      var issueUrl = "https://github.com/ert93333-ops/event-schema-status-qa-briefs/issues/new"
        + "?template=demo_request.md"
        + "&labels=early-access%2Cpurchase-intent%2Cdemo-request"
        + "&title=" + encodeURIComponent("Event Schema Status QA Briefs demo request")
        + "&body=" + encodeURIComponent(state.latestRequestText);
      remoteLink.href = issueUrl;
      handoff.hidden = false;
      status.textContent = "You are on the early access list. Open the public-safe GitHub demo request or copy the request details.";
      track("remote_intent_ready", { triggerSource: "waitlist_form" });
      pulseClass(form, "is-confirmed", 800);
    });
    copyRequest.addEventListener("click", function () {
      if (!state.latestRequestText) return;
      copyText(state.latestRequestText).then(function () {
        track("remote_intent_copied", { triggerSource: "copy_request" });
        copyRequest.textContent = "Copied request details";
        window.setTimeout(function () { copyRequest.textContent = "Copy request details"; }, 1500);
      });
    });
  }

  function setupPlanButtons() {
    var waitlist = qs("#waitlist");
    var planSelect = qs("#plan");
    qsa(".plan-button").forEach(function (button) {
      button.addEventListener("click", function () {
        var plan = button.getAttribute("data-plan") || "";
        if (planSelect && plan) planSelect.value = plan;
        track("pricing_viewed", { triggerSource: "plan_button" });
        state.pricingTracked = true;
        track("checkout_started", { plan: plan, triggerSource: "pricing_button" });
        pulseClass(button, "is-confirmed", 500);
        if (waitlist) waitlist.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }

  function setupTracking() {
    track("landing_viewed", { product: "Event Schema Status QA Briefs" });
    qsa("[data-track-cta]").forEach(function (element) {
      element.addEventListener("click", function () {
        track("cta_clicked", { cta: element.getAttribute("data-track-cta") || clean(element.textContent) });
      });
    });
    var pricing = qs("#pricing");
    if (pricing && "IntersectionObserver" in window) {
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting && !state.pricingTracked) {
            state.pricingTracked = true;
            track("pricing_viewed", { triggerSource: "scroll" });
            observer.disconnect();
          }
        });
      }, { threshold: 0.35 });
      observer.observe(pricing);
    }
  }

  function setupChrome() {
    var header = qs("[data-header]");
    if (!header) return;
    function updateHeader() {
      header.classList.toggle("is-scrolled", window.scrollY > 8);
    }
    updateHeader();
    window.addEventListener("scroll", updateHeader, { passive: true });
  }

  function setupReveal() {
    var elements = qsa(".reveal");
    if (!("IntersectionObserver" in window)) {
      elements.forEach(function (element) { element.classList.add("is-visible"); });
      return;
    }
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    elements.forEach(function (element) { observer.observe(element); });
  }

  document.addEventListener("DOMContentLoaded", function () {
    setupTracking();
    setupChrome();
    setupReveal();
    setupAuditor();
    setupWaitlist();
    setupPlanButtons();
  });
}());
