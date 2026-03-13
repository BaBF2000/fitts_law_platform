export async function sendResultsToPC(dom, state) {
  if (!state.results.length) return { ok: false, error: "no results" };
  
  // Session-level device context (compact JSON string)
  const deviceContext = {
    ua: navigator.userAgent,
    language: navigator.language || null,
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || null,
    dpr: window.devicePixelRatio || 1,
    screen_w: window.screen?.width ?? null,
    screen_h: window.screen?.height ?? null,
    viewport_w: window.innerWidth,
    viewport_h: window.innerHeight,
    max_touch_points: navigator.maxTouchPoints ?? 0,
    touch_support: (navigator.maxTouchPoints ?? 0) > 0 || ("ontouchstart" in window),
    pointer_coarse: window.matchMedia?.("(pointer: coarse)")?.matches ?? null,
    pointer_fine: window.matchMedia?.("(pointer: fine)")?.matches ?? null,
    hover_capable: window.matchMedia?.("(hover: hover)")?.matches ?? null,
  };


  const meta = {
    participant_id: dom.participantId.value.trim() || "P",
    session_id: dom.sessionId.value.trim() || "S",
    is_demo: state.isDemoRun,

    unit: dom.distanceMode?.value,
    formula: dom.IDFormula?.value,
    timeout_ms: Number(dom.timeoutMs?.value) || 0,
    trial_count: Number(dom.trialCount?.value) || null,

    mm_per_px: state.mmPerPx,
    viewport_w: window.innerWidth,
    viewport_h: window.innerHeight,
    dpr: window.devicePixelRatio || 1,
    user_agent: navigator.userAgent,
    device_context_json: JSON.stringify(deviceContext),
  };

  const r = await fetch("/save_results", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ meta, rows: state.results }),
  });

  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || "save failed");
  return j;
}