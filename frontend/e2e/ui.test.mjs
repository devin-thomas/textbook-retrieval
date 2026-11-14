import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import puppeteer from "puppeteer";

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appUrl = "http://127.0.0.1:5173/textbooks/";
const artifactDir = process.env.PUPPETEER_ARTIFACT_DIR
  ? path.resolve(process.env.PUPPETEER_ARTIFACT_DIR)
  : path.join(os.tmpdir(), "textbook-retrieval-puppeteer");
const viewports = [
  {
    name: "phone-390x844",
    viewport: { width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  },
  {
    name: "phone-402x681",
    viewport: { width: 402, height: 681, deviceScaleFactor: 3, isMobile: true, hasTouch: true },
  },
  {
    name: "phone-384x854",
    viewport: { width: 384, height: 854, deviceScaleFactor: 3.75, isMobile: true, hasTouch: true },
  },
  {
    name: "desktop-1280x960",
    viewport: { width: 1280, height: 960, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
  },
  {
    name: "desktop-3840x2160",
    viewport: { width: 3840, height: 2160, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
  },
  {
    name: "desktop-1920x2160",
    viewport: { width: 1920, height: 2160, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
  },
  {
    name: "laptop-1680x1050",
    viewport: { width: 1680, height: 1050, deviceScaleFactor: 2, isMobile: false, hasTouch: false },
  },
];

const sources = {
  sources: [
    { id: "os-concepts", title: "Operating Systems Concepts", course_ids: ["OS-101"] },
    { id: "computer-hardware", title: "Computer Hardware Basics", course_ids: ["OS-101"] },
    { id: "web-development", title: "Introduction to Web Development", course_ids: ["WEB-110", "WEB-210"] },
    { id: "professional-practice", title: "Professional Software Practice", course_ids: ["SE-200"] },
  ],
};

const historicalConversations = [
  { id: "history-virtual", title: "What is virtual memory?", updated_at: "2026-09-02T15:04:00Z", course_ids: ["OS-101"], provider_choice: "auto", actual_provider: "nvidia", select_all_that_apply: false },
  { id: "history-html", title: "Why use semantic HTML?", updated_at: "2026-09-01T16:15:00Z", course_ids: ["WEB-110"], provider_choice: "ollama", actual_provider: "ollama", select_all_that_apply: true },
  { id: "history-commitment", title: "What distinguishes an estimate from a commitment?", updated_at: "2026-08-30T11:03:00Z", course_ids: ["SE-200"], provider_choice: "nvidia", actual_provider: "nvidia", select_all_that_apply: false },
];

const evidence = [
  {
    id: "chunk-mode-1",
    source_id: "web-development",
    source_title: "Introduction to Web Development",
    physical_page: 64,
    page_label: "64",
    excerpt: "Semantic elements describe meaning and structure, which improves accessibility and maintainability.",
    rank: 1,
    fused_score: 0.82,
  },
  {
    id: "chunk-mode-2",
    source_id: "professional-practice",
    source_title: "Professional Software Practice",
    physical_page: 138,
    page_label: "138",
    excerpt: "A commitment is a promise that should be honored, while an estimate expresses probability.",
    rank: 2,
    fused_score: 0.61,
  },
];

const selectedAnswer = {
  status: "ok",
  answer: "Choose each supported principle. [1]",
  actual_provider: "nvidia",
  fallback_used: false,
  retrieval_fallback_used: false,
  select_all_that_apply: true,
  conversation_id: "new-select-all",
  assistant_message_id: "assistant-select-all",
  citations: [{ id: "1", evidence_id: "chunk-mode-1", source_id: "web-development", source_title: "Introduction to Web Development", physical_page: 64, page_label: "64" }],
  evidence,
};

const historyDetail = {
  id: "history-virtual",
  title: "What is virtual memory?",
  messages: [
    { id: "history-user", role: "user", text: "What is virtual memory?", provider_choice: "auto", select_all_that_apply: false },
    {
      id: "history-assistant",
      role: "assistant",
      text: "Virtual memory uses disk storage as an extension of physical memory.",
      provider_choice: "auto",
      actual_provider: "nvidia",
      fallback_used: false,
      retrieval_fallback_used: false,
      select_all_that_apply: false,
      status: "ok",
      citations: [{ id: "1", evidence_id: "chunk-mode-1" }],
      evidence: [evidence[0]],
    },
  ],
};

const historyHtmlDetail = {
  id: "history-html",
  title: "Why use semantic HTML?",
  messages: [
    { id: "history-html-user", role: "user", text: "Why use semantic HTML?", provider_choice: "ollama", select_all_that_apply: true },
    {
      id: "history-html-assistant",
      role: "assistant",
      text: "Semantic elements describe meaning and structure.",
      provider_choice: "ollama",
      actual_provider: "ollama",
      fallback_used: false,
      retrieval_fallback_used: false,
      select_all_that_apply: true,
      status: "ok",
      citations: [{ id: "1", evidence_id: "chunk-mode-1" }],
      evidence: [evidence[0]],
    },
  ],
};

// A longer history and a multi-paragraph answer, so the phone layout checks have
// something to scroll in the history drawer and in the answer area.
const phoneLayoutHistory = [
  ...historicalConversations,
  ...Array.from({ length: 12 }, (_, index) => ({
    id: `history-extra-${index + 1}`,
    title: `Generic practice question ${index + 1}`,
    updated_at: new Date(Date.UTC(2026, 7, 28 - Math.floor(index / 3), 14, 30 + index)).toISOString(),
    course_ids: ["OS-101"],
    provider_choice: "auto",
    actual_provider: "nvidia",
    select_all_that_apply: false,
  })),
];

const longAnswer = {
  ...selectedAnswer,
  answer: [
    "Virtual memory gives each process its own address space and keeps only the active pages in physical memory. [1]",
    "When a process touches a page that is not resident, the hardware raises a page fault and the operating system loads the page from disk. [2]",
    "This lets programs be larger than physical memory, at the cost of slower access when pages must be fetched. A working set that fits in memory keeps faults rare.",
  ].join("\n\n"),
  select_all_that_apply: false,
  conversation_id: "new-long-answer",
  citations: [
    { id: "1", evidence_id: "chunk-mode-1", source_id: "web-development", source_title: "Introduction to Web Development", physical_page: 64, page_label: "64" },
    { id: "2", evidence_id: "chunk-mode-2", source_id: "professional-practice", source_title: "Professional Software Practice", physical_page: 138, page_label: "138" },
  ],
};

function jsonResponse(body) {
  return { status: 200, contentType: "application/json", body: JSON.stringify(body) };
}

async function installApiMocks(page, { history = historicalConversations, answer = selectedAnswer, query } = {}) {
  let lastQueryBody;
  let queryCount = 0;
  await page.setRequestInterception(true);
  page.on("request", async (request) => {
    if (request.isInterceptResolutionHandled()) return;
    const requestUrl = new URL(request.url());
    if (!requestUrl.pathname.startsWith("/textbooks/api/")) {
      await request.continue();
      return;
    }

    const pathName = requestUrl.pathname;
    if (pathName === "/textbooks/api/health") {
      await request.respond(jsonResponse({ status: "ok", ollama: { configured: true } }));
      return;
    }
    if (pathName === "/textbooks/api/sources") {
      await request.respond(jsonResponse(sources));
      return;
    }
    if (pathName === "/textbooks/api/conversations" && request.method() === "GET") {
      const conversations = queryCount > 0
        ? [{ id: "new-select-all", title: "Which principles apply?", updated_at: "2026-09-03T12:00:00Z" }, ...history]
        : history;
      await request.respond(jsonResponse({ conversations }));
      return;
    }
    if (pathName === "/textbooks/api/query" && request.method() === "POST") {
      queryCount += 1;
      lastQueryBody = JSON.parse(request.postData() ?? "{}");
      if (query) {
        const result = await query(lastQueryBody);
        await request.respond({ status: result.status ?? 200, contentType: "application/json", body: JSON.stringify(result.body) }).catch(() => undefined);
        return;
      }
      await request.respond(jsonResponse(answer));
      return;
    }
    if (pathName === "/textbooks/api/conversations/history-virtual" || pathName === "/textbooks/api/conversations/history-html") {
      await request.respond(jsonResponse(pathName.endsWith("history-html") ? historyHtmlDetail : historyDetail));
      return;
    }
    if (/^\/textbooks\/api\/sources\/[^/]+\/pdf$/.test(pathName)) {
      await request.respond({ status: 200, contentType: "application/pdf", body: "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 400]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n4 0 obj<</Length 42>>stream\nBT /F1 18 Tf 30 350 Td (Sample page) Tj ET\nendstream endobj\n5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\ntrailer<</Root 1 0 R/Size 6>>\n%%EOF\n" });
      return;
    }
    await request.continue();
  });
  return {
    get lastQueryBody() {
      return lastQueryBody;
    },
  };
}

function startVite() {
  const viteBin = path.join(frontendRoot, "node_modules", "vite", "bin", "vite.js");
  const server = spawn(process.execPath, [viteBin, "--host", "127.0.0.1", "--port", "5173"], {
    cwd: frontendRoot,
    env: { ...process.env, BROWSER: "none" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let output = "";
  server.stdout.on("data", (chunk) => { output += chunk.toString(); });
  server.stderr.on("data", (chunk) => { output += chunk.toString(); });
  server.__output = () => output;
  return server;
}

async function waitForVite(server) {
  const deadline = Date.now() + 20000;
  let lastError = "";
  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`Vite exited with code ${server.exitCode}.\n${server.__output()}`);
    }
    try {
      const response = await fetch(appUrl);
      if (response.ok) return;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }
    await delay(200);
  }
  throw new Error(`Vite did not become ready: ${lastError}\n${server.__output()}`);
}

// Wait until every finite CSS transition and animation has finished and two frames
// have been painted, so a saved image always shows the final state.
async function settle(page) {
  await page.evaluate(async () => {
    const finite = () => document.getAnimations().filter((animation) => {
      const timing = animation.effect?.getComputedTiming?.();
      return timing && Number.isFinite(timing.endTime) && animation.playState !== "finished";
    });
    for (let round = 0; round < 20 && finite().length; round += 1) {
      await Promise.all(finite().map((animation) => animation.finished.catch(() => undefined)));
    }
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  });
  // An embedded page (the PDF viewer) renders after the frame loads.
  if (await page.$("iframe")) {
    for (const frame of page.frames().slice(1)) await frame.waitForSelector("body", { timeout: 5000 }).catch(() => undefined);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}

async function shot(page, file) {
  await settle(page);
  await page.screenshot({ path: path.join(artifactDir, file), fullPage: false });
}

async function assertPageHealth(page, viewportName) {
  assert.equal(await page.title(), "Textbook Desk", `${viewportName}: page title`);
  assert.equal(await page.url(), appUrl, `${viewportName}: page URL`);
  const bodyText = await page.$eval("body", (element) => element.innerText);
  assert.match(bodyText, /Textbook Desk/);
  assert.doesNotMatch(bodyText, /Internal Server Error|Vite Error|Failed to compile/i);

  const layout = await page.evaluate(() => {
    const root = document.documentElement;
    const body = document.body;
    const bodyStyle = getComputedStyle(body);
    const target = document.querySelector(".mode-toggle");
    const targetRect = target?.getBoundingClientRect();
    const interactive = [...document.querySelectorAll("button, select, textarea, a")]
      .filter((element) => {
        const rect = element.getBoundingClientRect();
        const style = getComputedStyle(element);
        return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden";
      })
      .map((element) => ({ tag: element.tagName, label: element.getAttribute("aria-label") ?? element.textContent?.trim(), width: element.getBoundingClientRect().width, height: element.getBoundingClientRect().height }));
    return {
      scrollWidth: Math.max(root.scrollWidth, body.scrollWidth),
      viewportWidth: window.innerWidth,
      fontFamily: bodyStyle.fontFamily,
      modeTarget: targetRect ? { width: targetRect.width, height: targetRect.height } : null,
      interactive,
    };
  });
  assert.ok(layout.scrollWidth <= layout.viewportWidth + 1, `${viewportName}: horizontal overflow ${layout.scrollWidth} > ${layout.viewportWidth}`);
  assert.match(layout.fontFamily, /IBM Plex Sans|Segoe UI|Arial/i, `${viewportName}: sans-serif body font`);
  assert.doesNotMatch(layout.fontFamily, /Newsreader|Georgia|Times New Roman/i, `${viewportName}: serif body font`);
  assert.ok(layout.modeTarget && layout.modeTarget.height >= 44, `${viewportName}: checkbox row is a 44px touch target`);
  const undersized = layout.interactive.filter((item) => item.height < 44 && item.tag !== "A");
  assert.deepEqual(undersized, [], `${viewportName}: undersized interactive controls`);
  assert.ok(await page.$('input[aria-label="Select all that apply"]'), `${viewportName}: select-all checkbox exists`);
  await assertNoDecorativeLabels(page, viewportName);
}

async function assertNoDecorativeLabels(page, viewportName) {
  const offenders = await page.evaluate(() => [...document.querySelectorAll("body *")]
    .filter((element) => {
      const style = getComputedStyle(element);
      if (style.display === "none" || style.visibility === "hidden") return false;
      const hasOwnText = [...element.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim());
      if (!hasOwnText) return false;
      return element.classList.contains("eyebrow") || style.textTransform === "uppercase" || parseFloat(style.letterSpacing) > 0;
    })
    .map((element) => `${element.tagName.toLowerCase()}.${element.className}: ${element.textContent.trim().slice(0, 40)}`));
  assert.deepEqual(offenders, [], `${viewportName}: uppercase, letter-spaced or eyebrow labels`);
}

async function loadApp(page, viewportName, viewport) {
  await page.setViewport(viewport);
  await page.goto(appUrl, { waitUntil: "domcontentloaded" });
  await page.waitForSelector('textarea[placeholder="Ask your textbooks…"]');
  await page.waitForSelector('input[aria-label="Select all that apply"]');
  await page.waitForFunction(() => document.querySelectorAll(".history-select").length >= 3);
  await page.evaluate(() => document.fonts?.ready);
  await assertPageHealth(page, viewportName);
}

async function assertHistoryList(page, viewportName) {
  const titles = await page.$$eval(".history-select span", (items) => items.map((item) => item.textContent?.trim()));
  assert.deepEqual(titles, historicalConversations.map((item) => item.title), `${viewportName}: historical question list is preserved`);
}

async function setDateInput(page, selector, value) {
  await page.$eval(selector, (element, nextValue) => {
    const input = element;
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    if (!setter) throw new Error("Date input value setter is unavailable");
    setter.call(input, nextValue);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
  }, value);
}

async function runHistoryFlow(page, viewportName, isMobile) {
  await assertHistoryList(page, viewportName);
  if (isMobile) {
    await page.click('button[aria-label="Open history"]');
    await page.waitForSelector(".history-rail.mobile-open");
    assert.ok(await page.$eval(".history-rail.mobile-open", (element) => getComputedStyle(element).transform !== "none"));
  } else {
    const search = page.locator('input[aria-label="Find a question"]');
    await search.fill("semantic");
    assert.equal(await page.$$eval(".history-select", (items) => items.length), 1, `${viewportName}: history search filters results`);
    await search.click();
    await page.$eval('input[aria-label="Find a question"]', (element) => element.select());
    await page.keyboard.press("Backspace");
    await page.waitForFunction(() => document.querySelector('input[aria-label="Find a question"]')?.value === "");
    await page.waitForFunction(() => document.querySelectorAll(".history-select").length === 3);
  }

  await page.locator("button.history-filter-toggle").click();
  await page.select('select[aria-label="Filter history by course"]', "WEB-110");
  await page.select('select[aria-label="Filter history by provider"]', "ollama");
  await page.select('select[aria-label="Filter history by answer mode"]', "select_all");
  await setDateInput(page, 'input[aria-label="Filter history from date"]', "2026-09-01");
  await setDateInput(page, 'input[aria-label="Filter history to date"]', "2026-09-01");
  assert.equal(await page.$eval('input[aria-label="Filter history from date"]', (element) => element.value), "2026-09-01", `${viewportName}: from-date filter is applied`);
  assert.equal(await page.$eval('input[aria-label="Filter history to date"]', (element) => element.value), "2026-09-01", `${viewportName}: to-date filter is applied`);
  const filterLayout = await page.evaluate(() => {
    const panelRect = document.querySelector(".history-filters")?.getBoundingClientRect();
    const panel = panelRect ? { left: panelRect.left, right: panelRect.right } : null;
    const dates = [...document.querySelectorAll('.history-filter-dates input')].map((element) => {
      const rect = element.getBoundingClientRect();
      return { left: rect.left, right: rect.right, width: rect.width };
    });
    return { panel, dates };
  });
  assert.ok(filterLayout.panel && filterLayout.dates.every((date) => date.left >= filterLayout.panel.left - 1 && date.right <= filterLayout.panel.right + 1), `${viewportName}: date controls stay inside the history filter panel`);
  await page.waitForFunction(() => document.querySelectorAll(".history-select").length === 1);
  assert.equal(await page.$eval(".history-count", (element) => element.textContent?.trim()), "1 matching question", `${viewportName}: combined history filters narrow results`);
  await page.click('button.history-select');
  if (isMobile) {
    await page.waitForSelector(".history-rail.mobile-open", { hidden: true });
    await page.waitForFunction(() => (document.querySelector(".history-rail")?.getBoundingClientRect().right ?? 1) <= 0);
    await page.locator('button[aria-label="Open history"]').click();
    await page.waitForSelector(".history-rail.mobile-open");
  }
  assert.equal(await page.$eval('button.history-select[aria-current="page"] span', (element) => element.textContent?.trim()), "Why use semantic HTML?", `${viewportName}: filtered selection stays active`);
  await shot(page, `${viewportName}-history-filtered.png`);
  await page.select('select[aria-label="Filter history by course"]', "OS-101");
  await page.waitForSelector(".empty-history");
  assert.match(await page.$eval(".empty-history p", (element) => element.textContent ?? ""), /Clear filters or choose a different course/);
  await shot(page, `${viewportName}-history-empty.png`);
  await page.locator(".history-filters .history-filter-clear").click();
  await page.waitForFunction(() => document.querySelectorAll(".history-select").length === 3);
  assert.equal(await page.$eval('button.history-select[aria-current="page"] span', (element) => element.textContent?.trim()), "Why use semantic HTML?", `${viewportName}: clearing filters preserves selected question`);

  const historyButton = await page.$('button.history-select');
  assert.ok(historyButton, `${viewportName}: historical question button exists`);
  await historyButton.evaluate((element) => element.scrollIntoView({ block: "center", inline: "nearest" }));
  await historyButton.click();
  await page.waitForFunction(() => document.querySelector(".answer-article h1")?.textContent?.includes("What is virtual memory?") === true);
  assert.equal(await page.$eval(".history-select[aria-current='page'] span", (element) => element.textContent?.trim()), "What is virtual memory?");
  if (isMobile) assert.equal(await page.$(".history-rail.mobile-open"), null, `${viewportName}: history drawer closes after selection`);
}

async function runScopeFlow(page, viewportName) {
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector('button.scope-button');
  await page.click('button.scope-button');
  await page.waitForSelector('[role="dialog"][aria-label="Choose textbook scope"]');
  const scopeCount = await page.$$eval('[role="dialog"] input[type="checkbox"]', (items) => items.length);
  assert.ok(scopeCount >= 4, `${viewportName}: scope lists the four configured textbooks`);
  await assertNoDecorativeLabels(page, viewportName);
  await page.click('button[aria-label="Close filters"]');
  assert.equal(await page.$('[role="dialog"][aria-label="Choose textbook scope"]'), null, `${viewportName}: scope dialog closes`);
}

async function runSelectAllFlow(page, viewportName, mockState) {
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector('input[aria-label="Select all that apply"]');
  const checkbox = 'input[aria-label="Select all that apply"]';
  assert.equal(await page.$eval(checkbox, (element) => element.checked), false, `${viewportName}: select-all starts unchecked`);
  await page.click(checkbox);
  assert.equal(await page.$eval(checkbox, (element) => element.checked), true, `${viewportName}: select-all toggles on`);
  await page.type('textarea[placeholder="Ask your textbooks…"]', "Which principles apply?");
  await page.click('button[aria-label="Ask question"]');
  await page.waitForSelector(".answer-mode-note");
  assert.match(await page.$eval(".answer-mode-note", (element) => element.textContent ?? ""), /Multiple correct answers/);
  assert.equal(mockState.lastQueryBody?.select_all_that_apply, true, `${viewportName}: API receives select-all mode`);
  assert.equal(await page.$eval('input[aria-label="Select all that apply"]', (element) => element.checked), true, `${viewportName}: mode remains visible after answer`);
  await page.waitForSelector(".evidence-panel");
  const postAnswerLayout = await page.evaluate(() => ({
    scrollWidth: Math.max(document.documentElement.scrollWidth, document.body.scrollWidth),
    viewportWidth: window.innerWidth,
    evidenceVisible: Boolean(document.querySelector(".evidence-panel")),
    evidenceExpanded: Boolean(document.querySelector(".evidence-panel.mobile-expanded")),
  }));
  assert.ok(postAnswerLayout.scrollWidth <= postAnswerLayout.viewportWidth + 1, `${viewportName}: no overflow after evidence opens`);
  assert.equal(postAnswerLayout.evidenceVisible, true, `${viewportName}: evidence opens after answered query`);
  await assertNoDecorativeLabels(page, viewportName);
  if (windowIsMobile(page)) {
    assert.equal(postAnswerLayout.evidenceExpanded, false, `${viewportName}: mobile evidence sheet starts collapsed`);
    await page.click('button[aria-label="Expand evidence"]');
    await page.waitForSelector('.evidence-panel.mobile-expanded');
    assert.equal(await page.$('.evidence-panel.mobile-expanded') !== null, true, `${viewportName}: mobile evidence sheet expands`);
  }
}

const scopeSheetSelector = '[role="dialog"][aria-label="Choose textbook scope"]';

// Phone layout checks. Every assertion is made from element rectangles and hit
// tests in the real browser layout, so a control that is covered, clipped or
// pushed out of the viewport fails even when it is still in the DOM.

async function measureScopeSheet(page) {
  return page.evaluate((selector) => {
    const sheet = document.querySelector(selector);
    const box = (element) => {
      const rect = element.getBoundingClientRect();
      return { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right, width: rect.width, height: rect.height };
    };
    const insideViewport = (rect) => rect.top >= -0.5 && rect.bottom <= window.innerHeight + 0.5 && rect.left >= -0.5 && rect.right <= window.innerWidth + 0.5;
    const topmost = (element) => {
      const rect = element.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return Boolean(hit && element.contains(hit));
    };
    const byText = (text) => [...sheet.querySelectorAll("button")].find((button) => button.textContent.trim() === text);
    const controls = {
      "Use this scope": byText("Use this scope"),
      "Reset to all books": byText("Reset to all books"),
      "Close filters": sheet.querySelector('button[aria-label="Close filters"]'),
    };
    const controlState = Object.fromEntries(Object.entries(controls).map(([label, element]) => {
      if (!element) return [label, { found: false }];
      const rect = box(element);
      return [label, { found: true, inViewport: insideViewport(rect), visible: topmost(element) }];
    }));
    const topbar = document.querySelector(".topbar");
    const topbarControls = [...topbar.querySelectorAll("a, button, select")].filter((element) => {
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    });
    const sheetRect = box(sheet);
    // Top bar controls whose rectangle meets the sheet but that can still be seen at their centre.
    const showingThroughSheet = topbarControls.filter((element) => {
      const rect = element.getBoundingClientRect();
      const meetsSheet = rect.bottom > sheetRect.top + 0.5 && rect.top < sheetRect.bottom - 0.5;
      const hit = document.elementFromPoint(rect.left + rect.width / 2, Math.min(Math.max(rect.top + rect.height / 2, 0), window.innerHeight - 1));
      return meetsSheet && hit && !sheet.contains(hit);
    }).map((element) => element.getAttribute("aria-label") ?? element.textContent.trim());
    const footer = sheet.querySelector(".scope-footer");
    const checkRows = [...sheet.querySelectorAll(".check-row")];
    return {
      viewportHeight: window.innerHeight,
      sheet: sheetRect,
      topbar: box(topbar),
      footer: footer ? box(footer) : null,
      lastCheckRow: checkRows.length ? box(checkRows[checkRows.length - 1]) : null,
      controls: controlState,
      showingThroughSheet,
      pageScrollTop: document.scrollingElement?.scrollTop ?? 0,
    };
  }, scopeSheetSelector);
}

function assertScopeSheetLayer(measure, label) {
  const { sheet, topbar, viewportHeight } = measure;
  const coversPage = Math.abs(sheet.top) <= 0.5 && Math.abs(sheet.bottom - viewportHeight) <= 0.5;
  const belowTopBar = sheet.top >= topbar.bottom - 0.5 && sheet.bottom <= viewportHeight + 0.5;
  assert.ok(coversPage || belowTopBar, `${label}: book picker must either cover the page or sit below the top bar (sheet ${sheet.top.toFixed(1)}..${sheet.bottom.toFixed(1)}, top bar ends at ${topbar.bottom.toFixed(1)}, viewport ${viewportHeight})`);
  assert.deepEqual(measure.showingThroughSheet, [], `${label}: top bar controls show through the book picker`);
  assert.equal(measure.pageScrollTop, 0, `${label}: the page is not scrolled`);
  for (const name of ["Use this scope", "Reset to all books", "Close filters"]) {
    const control = measure.controls[name];
    assert.ok(control.found, `${label}: book picker has "${name}"`);
    assert.ok(control.inViewport, `${label}: "${name}" is inside the viewport`);
    assert.ok(control.visible, `${label}: "${name}" is not covered by anything`);
  }
  assert.ok(measure.footer && measure.footer.bottom <= viewportHeight + 0.5 && measure.footer.top >= -0.5, `${label}: the action row is inside the viewport`);
}

async function assertScopeSheetFlow(page, label) {
  await page.click("button.scope-button");
  await page.waitForSelector(scopeSheetSelector);
  assertScopeSheetLayer(await measureScopeSheet(page), `${label} picker open`);
  await assertNoDecorativeLabels(page, `${label} picker open`);
  // When the lists are taller than the space they scroll inside the sheet and the action row stays put.
  await page.evaluate((selector) => {
    const body = document.querySelector(`${selector} .scope-body`);
    if (body) body.scrollTop = body.scrollHeight;
  }, scopeSheetSelector);
  const scrolled = await measureScopeSheet(page);
  assertScopeSheetLayer(scrolled, `${label} picker scrolled to the end`);
  assert.ok(scrolled.lastCheckRow && scrolled.footer && scrolled.lastCheckRow.bottom <= scrolled.footer.top + 0.5, `${label}: last textbook row ends above the action row`);
  await page.click('button[aria-label="Close filters"]');
  await page.waitForSelector(scopeSheetSelector, { hidden: true });
}

async function measureHistoryDrawer(page, position) {
  return page.evaluate((scrollTo) => {
    const list = document.querySelector(".history-list");
    list.scrollTop = scrollTo === "end" ? list.scrollHeight : scrollTo === "middle" ? (list.scrollHeight - list.clientHeight) / 2 : 0;
    const box = (element) => {
      const rect = element.getBoundingClientRect();
      return { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right, width: rect.width, height: rect.height };
    };
    const clear = document.querySelector(".clear-history");
    const listRect = box(list);
    const clearRect = box(clear);
    const rows = [...list.querySelectorAll(".history-row")];
    // The part of a row that can be seen is its rectangle cut to the list's own area.
    const visibleParts = rows.map((row) => {
      const rect = box(row);
      return { top: Math.max(rect.top, listRect.top), bottom: Math.min(rect.bottom, listRect.bottom) };
    }).filter((part) => part.bottom - part.top > 0.5);
    const rowsOverClear = visibleParts.filter((part) => part.bottom > clearRect.top + 0.5 && part.top < clearRect.bottom - 0.5).length;
    const hits = [0.1, 0.3, 0.5, 0.7, 0.9].map((fraction) => {
      const hit = document.elementFromPoint(clearRect.left + clearRect.width * fraction, clearRect.top + clearRect.height / 2);
      return Boolean(hit && hit.closest(".history-row, .history-list"));
    });
    const background = getComputedStyle(clear).backgroundColor;
    const channels = background.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0, 0];
    const lastRow = rows.length ? box(rows[rows.length - 1]) : null;
    return {
      viewportHeight: window.innerHeight,
      list: listRect,
      clear: clearRect,
      scrollHeight: list.scrollHeight,
      clientHeight: list.clientHeight,
      rowHeight: rows.length ? box(rows[0]).height : 0,
      rowsOverClear,
      rowShowingUnderClear: hits.some(Boolean),
      clearAlpha: channels.length === 4 ? channels[3] : 1,
      lastRow,
    };
  }, position);
}

async function assertHistoryDrawerFlow(page, label) {
  await page.click('button[aria-label="Open history"]');
  await page.waitForSelector(".history-rail.mobile-open");
  await page.waitForFunction(() => document.querySelector(".history-rail").getBoundingClientRect().left >= -0.5);
  await page.locator("button.history-filter-toggle").click();
  await page.waitForSelector("#history-filter-panel");
  for (const position of ["start", "middle", "end"]) {
    const measure = await measureHistoryDrawer(page, position);
    const where = `${label} history drawer, filters open, list at ${position}`;
    assert.ok(measure.scrollHeight > measure.clientHeight + 1, `${where}: there are enough rows to scroll`);
    assert.ok(measure.list.bottom <= measure.clear.top + 0.5, `${where}: the list ends above "Clear history" (list bottom ${measure.list.bottom.toFixed(1)}, button top ${measure.clear.top.toFixed(1)})`);
    assert.equal(measure.rowsOverClear, 0, `${where}: no list row meets the "Clear history" row`);
    assert.equal(measure.rowShowingUnderClear, false, `${where}: no list row shows through the "Clear history" row`);
    assert.equal(measure.clearAlpha, 1, `${where}: the "Clear history" row has a solid background`);
    assert.ok(measure.clear.top >= 0 && measure.clear.bottom <= measure.viewportHeight + 0.5, `${where}: "Clear history" is inside the viewport`);
    assert.ok(measure.list.height >= measure.rowHeight * 2, `${where}: the list area shows at least two rows (${measure.list.height.toFixed(1)}px for ${measure.rowHeight.toFixed(1)}px rows)`);
    if (position === "end") {
      assert.ok(measure.lastRow && measure.lastRow.bottom <= measure.list.bottom + 0.5, `${where}: the last row can be scrolled fully above the button row`);
    }
  }
  await page.click('.rail-title-row button[aria-label="Close history"]');
  await page.waitForFunction(() => document.querySelector(".history-rail").getBoundingClientRect().right <= 0);
}

async function assertAnswerClearsEvidenceSheet(page, label) {
  await page.type('textarea[placeholder="Ask your textbooks…"]', "How does virtual memory work?");
  await page.click('button[aria-label="Ask question"]');
  await page.waitForSelector(".evidence-panel");
  await page.waitForSelector(".provider-result");
  const measure = await page.evaluate(() => {
    const pane = document.querySelector(".answer-scroll");
    pane.scrollTop = pane.scrollHeight;
    const box = (element) => {
      const rect = element.getBoundingClientRect();
      return { top: rect.top, bottom: rect.bottom };
    };
    const sheet = document.querySelector(".evidence-panel");
    return {
      collapsed: !sheet.classList.contains("mobile-expanded"),
      scrollable: pane.scrollHeight > pane.clientHeight + 1,
      sheet: box(sheet),
      answerCopy: box(document.querySelector(".answer-copy")),
      provider: box(document.querySelector(".provider-result")),
      providerText: document.querySelector(".provider-result").textContent,
      showEvidence: box(document.querySelector(".answer-article .show-evidence")),
      topbar: box(document.querySelector(".topbar")),
    };
  });
  const where = `${label} answer scrolled to its end`;
  assert.ok(measure.collapsed, `${where}: the evidence sheet starts collapsed`);
  assert.ok(measure.scrollable, `${where}: the answer area scrolls`);
  assert.match(measure.providerText, /Answered by/, `${where}: provider line is present`);
  assert.ok(measure.provider.top >= measure.topbar.bottom - 0.5, `${where}: the "Answered by" line is on screen, below the top bar`);
  assert.ok(measure.provider.bottom <= measure.sheet.top + 0.5, `${where}: the "Answered by" line is fully above the collapsed evidence sheet (line bottom ${measure.provider.bottom.toFixed(1)}, sheet top ${measure.sheet.top.toFixed(1)})`);
  assert.ok(measure.answerCopy.bottom <= measure.sheet.top + 0.5, `${where}: the last answer line is above the collapsed evidence sheet`);
  assert.ok(measure.showEvidence.bottom <= measure.sheet.top + 0.5, `${where}: the evidence button is above the collapsed evidence sheet`);
}

async function runPhoneLayoutFlow(browser, label, viewport) {
  const page = await browser.newPage();
  const problems = [];
  page.on("console", (message) => { if (message.type() === "error") problems.push(message.text()); });
  page.on("pageerror", (error) => problems.push(error.message));
  page.on("response", (response) => { if (response.status() >= 400) problems.push(`${response.status()} ${response.url()}`); });
  try {
    await installApiMocks(page, { history: phoneLayoutHistory, answer: longAnswer });
    await page.setViewport(viewport);
    await page.goto(appUrl, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('textarea[placeholder="Ask your textbooks…"]');
    await page.waitForFunction((count) => document.querySelectorAll(".history-select").length >= count, {}, phoneLayoutHistory.length);
    await page.evaluate(() => document.fonts?.ready);
    await assertScopeSheetFlow(page, label);
    await assertHistoryDrawerFlow(page, label);
    await assertAnswerClearsEvidenceSheet(page, label);
    await shot(page, `${label}-layout-answer-end.png`);
    // The picker also has to stay on top of the evidence sheet once an answer is showing.
    await assertScopeSheetFlow(page, `${label} after an answer`);
    assert.deepEqual(problems, [], `${label}: layout flow console and HTTP health`);
  } finally {
    await page.close();
  }
}

// ---------------------------------------------------------------------------
// Layout audit. One general helper checks a screen state from element
// rectangles and hit tests, and is called for every state at every viewport.
//
// For the page, or for the open layer (sheet, dialog, drawer or popover) when
// the state has one, it checks that:
//  - every control and every line of text can be seen unclipped and uncovered
//    at some scroll position of its own container (so nothing sits behind the
//    top bar, composer, evidence sheet or drawer footer with no way to reach it);
//  - a layer that covers the page does so completely, with nothing of the page
//    showing through, and a dialog or drawer has a dimmed backdrop over the rest;
//  - there is no horizontal scrolling anywhere;
//  - text stays inside its own box and inside every box that clips it.
// ---------------------------------------------------------------------------

function auditInPage(spec) {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const violations = [];
  const add = (message) => { if (!violations.includes(message)) violations.push(message); };
  const label = (element) => {
    const classes = typeof element.className === "string" && element.className.trim() ? `.${element.className.trim().split(/\s+/).join(".")}` : "";
    const text = (element.getAttribute("aria-label") || element.textContent || "").replace(/\s+/g, " ").trim().slice(0, 40);
    return `${element.tagName.toLowerCase()}${classes}${text ? ` "${text}"` : ""}`;
  };
  const skippedTags = new Set(["SCRIPT", "STYLE", "OPTION", "OPTGROUP", "NOSCRIPT", "TITLE", "HEAD", "META", "LINK"]);
  const isVisible = (element) => {
    if (skippedTags.has(element.tagName)) return false;
    const style = getComputedStyle(element);
    if (style.display === "none" || style.visibility === "hidden") return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 1 && rect.height > 1;
  };
  const hitAt = (x, y) => (x >= 0 && y >= 0 && x < vw && y < vh ? document.elementFromPoint(x, y) : null);
  const alpha = (color) => {
    const channels = color.match(/[\d.]+/g)?.map(Number) ?? [0, 0, 0, 0];
    return channels.length === 4 ? channels[3] : 1;
  };

  const layer = spec.layer ? document.querySelector(spec.layer.selector) : null;
  if (spec.layer && !layer) {
    add(`the ${spec.layer.kind} ${spec.layer.selector} is not on the page`);
    return violations;
  }
  const root = layer ?? document.body;

  // ---- the open layer --------------------------------------------------
  if (layer) {
    const rect = layer.getBoundingClientRect();
    const inside = (x, y) => { const hit = hitAt(x, y); return Boolean(hit && layer.contains(hit)); };
    const grid = (box, inset) => [0, 0.5, 1].flatMap((fx) => [0, 0.25, 0.5, 0.75, 1].map((fy) => [box.left + inset + (box.width - 2 * inset) * fx, box.top + inset + (box.height - 2 * inset) * fy]));
    const backdropOf = () => spec.layer.backdrop ? document.querySelector(spec.layer.backdrop) : null;
    const backdropCovers = () => {
      const backdrop = backdropOf();
      if (!backdrop) { add(`the ${spec.layer.kind} has no backdrop (${spec.layer.backdrop})`); return; }
      const box = backdrop.getBoundingClientRect();
      if (box.left > 0.5 || box.top > 0.5 || box.right < vw - 0.5 || box.bottom < vh - 0.5) add(`the backdrop does not cover the whole viewport (${Math.round(box.left)},${Math.round(box.top)} to ${Math.round(box.right)},${Math.round(box.bottom)} in ${vw}x${vh})`);
      if (alpha(getComputedStyle(backdrop).backgroundColor) < 0.2) add("the backdrop is not dimmed");
      for (const [x, y] of [[1, 1], [vw - 2, 1], [1, vh - 2], [vw - 2, vh - 2], [vw / 2, 1], [vw / 2, vh - 2]]) {
        const hit = hitAt(x, y);
        if (!hit || !(backdrop.contains(hit) || layer.contains(hit))) add(`page content shows at the viewport edge (${Math.round(x)},${Math.round(y)}) beside the ${spec.layer.kind}: ${hit ? label(hit) : "nothing"}`);
      }
    };
    if (rect.left < -0.5 || rect.top < -0.5 || rect.right > vw + 0.5 || rect.bottom > vh + 0.5) add(`the ${spec.layer.kind} is not inside the viewport (${Math.round(rect.left)},${Math.round(rect.top)} to ${Math.round(rect.right)},${Math.round(rect.bottom)} in ${vw}x${vh})`);
    if (spec.layer.kind === "sheet") {
      if (rect.left > 0.5 || rect.top > 0.5 || rect.right < vw - 0.5 || rect.bottom < vh - 0.5) add(`the sheet does not cover the page completely (${Math.round(rect.left)},${Math.round(rect.top)} to ${Math.round(rect.right)},${Math.round(rect.bottom)} in ${vw}x${vh})`);
      for (const [x, y] of grid({ left: 0, top: 0, width: vw, height: vh }, 1)) {
        if (!inside(x, y)) { add(`page content shows through the sheet at ${Math.round(x)},${Math.round(y)}: ${(hitAt(x, y) && label(hitAt(x, y))) || "nothing"}`); break; }
      }
    } else if (spec.layer.kind === "popover") {
      for (const [x, y] of grid(rect, 2)) {
        if (!inside(x, y)) { add(`page content shows through the popover at ${Math.round(x)},${Math.round(y)}: ${(hitAt(x, y) && label(hitAt(x, y))) || "nothing"}`); break; }
      }
      if (alpha(getComputedStyle(layer).backgroundColor) < 1) add("the popover background is not solid");
    } else if (spec.layer.kind === "dialog") {
      backdropCovers();
      for (const [x, y] of grid(rect, 2)) {
        if (!inside(x, y)) { add(`something covers the dialog at ${Math.round(x)},${Math.round(y)}: ${(hitAt(x, y) && label(hitAt(x, y))) || "nothing"}`); break; }
      }
    } else if (spec.layer.kind === "drawer") {
      backdropCovers();
      if (rect.top > 0.5 || rect.bottom < vh - 0.5) add(`the drawer is not full height (${Math.round(rect.top)} to ${Math.round(rect.bottom)} in ${vh})`);
      for (const [x, y] of grid(rect, 2)) {
        if (!inside(x, y)) { add(`something covers the drawer at ${Math.round(x)},${Math.round(y)}: ${(hitAt(x, y) && label(hitAt(x, y))) || "nothing"}`); break; }
      }
    }
  }

  // ---- no horizontal scrolling ------------------------------------------
  const docWidth = Math.max(document.documentElement.scrollWidth, document.body.scrollWidth);
  if (docWidth > vw + 1) add(`the page scrolls horizontally (${docWidth} > ${vw})`);
  if (window.scrollX !== 0) add("the page is scrolled sideways");
  for (const element of document.querySelectorAll("*")) {
    if (!isVisible(element) || ["INPUT", "SELECT", "TEXTAREA", "IFRAME", "HTML", "BODY"].includes(element.tagName)) continue;
    const style = getComputedStyle(element);
    if ((style.overflowX === "auto" || style.overflowX === "scroll") && element.scrollWidth > element.clientWidth + 1) add(`${label(element)} scrolls horizontally (${element.scrollWidth} > ${element.clientWidth})`);
  }

  // ---- fixed layers over scrolling content --------------------------------
  // Content that scrolls underneath a fixed layer must be hidden cleanly by a solid
  // layer; through a translucent one it shows as text colliding with text.
  const scrollAreas = [...root.querySelectorAll("*")].filter((element) => {
    const style = getComputedStyle(element);
    return (style.overflowY === "auto" || style.overflowY === "scroll") && element.scrollHeight > element.clientHeight + 1 && isVisible(element);
  });
  for (const fixed of root.querySelectorAll("*")) {
    if (!isVisible(fixed) || !["fixed", "sticky"].includes(getComputedStyle(fixed).position)) continue;
    if (spec.layer && fixed === layer) continue;
    const solid = alpha(getComputedStyle(fixed).backgroundColor) === 1;
    const box = fixed.getBoundingClientRect();
    for (const area of scrollAreas) {
      if (fixed.contains(area)) continue;
      const areaBox = area.getBoundingClientRect();
      const overlap = Math.min(box.right, areaBox.right) - Math.max(box.left, areaBox.left) > 2 && Math.min(box.bottom, areaBox.bottom) - Math.max(box.top, areaBox.top) > 2;
      if (overlap && !solid) add(`${label(fixed)} is a ${getComputedStyle(fixed).position} layer that is not solid and sits over the scrolling area ${label(area)}`);
    }
  }

  // ---- items: controls and lines of text ---------------------------------
  const controlSelector = 'button, a[href], input, select, textarea, [role="tab"], iframe';
  const items = [];
  for (const element of root.querySelectorAll(controlSelector)) if (isVisible(element)) items.push({ element, kind: "control" });
  for (const element of root.querySelectorAll("*")) {
    if (!isVisible(element)) continue;
    if ([...element.childNodes].some((node) => node.nodeType === Node.TEXT_NODE && node.textContent.trim())) items.push({ element, kind: "text" });
  }
  const pointsOf = (item) => {
    const { element } = item;
    if (item.kind === "control") {
      const rect = element.getBoundingClientRect();
      const at = (from, size, fraction) => Math.min(Math.max(from + size * fraction, from + 2), from + size - 2);
      return [0.1, 0.5, 0.9].flatMap((fx) => [0.1, 0.5, 0.9].map((fy) => [at(rect.left, rect.width, fx), at(rect.top, rect.height, fy)]));
    }
    const points = [];
    // Text that is cut off with an ellipsis on purpose is only checked where it is shown.
    let shown = null;
    for (let ancestor = element; ancestor && ancestor !== document.body; ancestor = ancestor.parentElement) {
      if (getComputedStyle(ancestor).textOverflow === "ellipsis") { shown = ancestor.getBoundingClientRect(); break; }
    }
    for (const node of element.childNodes) {
      if (node.nodeType !== Node.TEXT_NODE || !node.textContent.trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const rect of [...range.getClientRects()].slice(0, 80)) {
        if (rect.width < 1 || rect.height < 1) continue;
        for (const fraction of [0.15, 0.5, 0.85]) {
          const x = rect.left + rect.width * fraction;
          const y = rect.top + rect.height / 2;
          points.push([x, y, Boolean(shown) && (x < shown.left || x > shown.right || y < shown.top || y > shown.bottom)]);
        }
      }
    }
    return points;
  };
  const seen = items.map(() => []);
  const sweep = () => items.forEach((item, index) => {
    pointsOf(item).forEach(([x, y, skip], pointIndex) => {
      if (skip) seen[index][pointIndex] = true;
      if (seen[index][pointIndex]) return;
      const hit = hitAt(x, y);
      if (hit && (item.element === hit || item.element.contains(hit) || hit.contains(item.element))) seen[index][pointIndex] = true;
    });
  });
  const scrollers = [...root.querySelectorAll("*"), root].filter((element) => {
    const style = getComputedStyle(element);
    return (style.overflowY === "auto" || style.overflowY === "scroll") && element.scrollHeight > element.clientHeight + 1 && isVisible(element);
  });
  const origins = scrollers.map((element) => element.scrollTop);
  sweep();
  for (const scroller of scrollers) {
    const maxTop = scroller.scrollHeight - scroller.clientHeight;
    const step = Math.max(24, Math.floor(scroller.clientHeight * 0.4));
    const stops = [];
    for (let top = 0; top < maxTop; top += step) stops.push(top);
    stops.push(maxTop);
    for (const top of stops) { scroller.scrollTop = top; sweep(); }
  }
  scrollers.forEach((scroller, index) => { scroller.scrollTop = spec.finish === "end" ? scroller.scrollHeight : origins[index]; });
  const unreachable = [];
  items.forEach((item, index) => {
    const total = pointsOf(item).length;
    const missed = Array.from({ length: total }, (_, pointIndex) => pointIndex).filter((pointIndex) => !seen[index][pointIndex]).length;
    if (missed > 0) unreachable.push(`${label(item.element)} (${missed} of ${total} sample points)`);
  });
  unreachable.slice(0, 12).forEach((entry) => add(`hidden behind another layer or clipped, with no way to scroll it into view: ${entry}`));
  if (unreachable.length > 12) add(`... and ${unreachable.length - 12} more hidden items`);

  // ---- text stays inside its boxes ---------------------------------------
  const clipsText = (style, axis) => (axis === "x" ? style.overflowX : style.overflowY) !== "visible";
  for (const item of items) {
    if (item.kind !== "text") continue;
    const { element } = item;
    let truncatesByDesign = false;
    for (let ancestor = element; ancestor && ancestor !== document.body; ancestor = ancestor.parentElement) {
      const style = getComputedStyle(ancestor);
      if (style.textOverflow === "ellipsis") { truncatesByDesign = true; break; }
    }
    if (truncatesByDesign) continue;
    let block = element;
    while (block.parentElement && getComputedStyle(block).display === "inline") block = block.parentElement;
    const blockRect = block.getBoundingClientRect();
    const limits = { x: null, y: null };
    for (const axis of ["x", "y"]) {
      for (let ancestor = element; ancestor; ancestor = ancestor.parentElement) {
        const style = getComputedStyle(ancestor);
        if (!clipsText(style, axis)) continue;
        const scrolls = (axis === "x" ? style.overflowX : style.overflowY) === "auto" || (axis === "x" ? style.overflowX : style.overflowY) === "scroll";
        if (!scrolls) {
          const whole = ancestor === document.body || ancestor === document.documentElement;
          limits[axis] = whole ? { start: 0, end: axis === "x" ? vw : vh } : { start: axis === "x" ? ancestor.getBoundingClientRect().left : ancestor.getBoundingClientRect().top, end: axis === "x" ? ancestor.getBoundingClientRect().right : ancestor.getBoundingClientRect().bottom };
        }
        break;
      }
    }
    for (const node of element.childNodes) {
      if (node.nodeType !== Node.TEXT_NODE || !node.textContent.trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const rect of range.getClientRects()) {
        if (rect.width < 1 || rect.height < 1) continue;
        if (rect.right > blockRect.right + 1.5 || rect.left < blockRect.left - 1.5) add(`text runs outside its own box: ${label(element)}`);
        const slack = Math.max(1.5, rect.height * 0.35);
        if (element.tagName !== "SPAN" && (rect.bottom > blockRect.bottom + slack || rect.top < blockRect.top - slack)) add(`text runs outside its own box (vertically): ${label(element)}`);
        if (limits.x && (rect.left < limits.x.start - 1 || rect.right > limits.x.end + 1)) add(`text is clipped sideways by its container: ${label(element)}`);
        if (limits.y && (rect.top < limits.y.start - slack || rect.bottom > limits.y.end + slack)) add(`text is clipped vertically by its container: ${label(element)}`);
      }
    }
  }
  return violations;
}

// ---- audit fixtures --------------------------------------------------------

const manyEvidence = Array.from({ length: 9 }, (_, index) => {
  const source = sources.sources[index % sources.sources.length];
  return {
    id: `chunk-many-${index + 1}`,
    source_id: source.id,
    source_title: source.title,
    physical_page: 20 + index * 7,
    page_label: String(18 + index * 7),
    excerpt: `Generic passage ${index + 1}. It explains the idea in a few plain sentences, so that the card has more than one line of body copy to wrap on a narrow screen.`,
    rank: index + 1,
    fused_score: 0.9 - index * 0.05,
  };
});

const manyCitationsAnswer = {
  ...selectedAnswer,
  answer: `Several ideas apply to this question. ${manyEvidence.map((_, index) => `[${index + 1}]`).join(" ")}`,
  select_all_that_apply: false,
  conversation_id: "new-many-citations",
  citations: manyEvidence.map((item, index) => ({ id: String(index + 1), evidence_id: item.id, source_id: item.source_id, source_title: item.source_title, physical_page: item.physical_page, page_label: item.page_label })),
  evidence: manyEvidence,
};

const veryLongAnswer = {
  ...longAnswer,
  answer: Array.from({ length: 14 }, (_, index) => `Paragraph ${index + 1}. The operating system keeps a table of pages for each process and loads a page only when the process touches it. [${(index % 2) + 1}] When memory is short it writes a rarely used page back to disk and reuses the frame.`).join("\n\n"),
  conversation_id: "new-very-long-answer",
};

const fallbackAnswer = { ...longAnswer, fallback_used: true, retrieval_fallback_used: true, conversation_id: "new-fallback" };
const abstentionAnswer = { status: "abstained", answer: "", actual_provider: "nvidia", fallback_used: false, retrieval_fallback_used: false, select_all_that_apply: false, conversation_id: "new-abstention", citations: [], evidence };
const insufficientAnswer = { status: "insufficient_evidence", answer: "", fallback_used: false, retrieval_fallback_used: false, select_all_that_apply: false, conversation_id: "new-insufficient", citations: [], evidence: [] };

const ordinaryQuestion = "How does virtual memory work?";
const longQuestion = "Explain in as much detail as you can how a modern operating system decides which pages of a running program stay in physical memory, which are written back to disk, and what happens to the program when it touches a page that is no longer resident, with a worked example of one fault from start to finish and a note on https://example.com/reference/with/a-very-long-path/that-never-breaks/0123456789/abcdefghij/klmnopqrst in case it matters.";

const gated = () => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  return { release, query: async () => { await gate; return { body: longAnswer }; } };
};

async function typeQuestion(page, value) {
  await page.$eval('textarea[placeholder="Ask your textbooks…"]', (element, next) => {
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
    setter.call(element, next);
    element.dispatchEvent(new Event("input", { bubbles: true }));
  }, value);
}

async function ask(page, question, waitFor) {
  await typeQuestion(page, question);
  await page.click('button[aria-label="Ask question"]');
  await page.waitForSelector(waitFor);
}

const isPhonePage = (page) => page.viewport().isMobile === true;

async function openHistory(page) {
  if (isPhonePage(page)) {
    await page.click('button[aria-label="Open history"]');
    await page.waitForSelector(".history-rail.mobile-open");
    await settle(page);
  }
}

async function expandEvidence(page) {
  if (isPhonePage(page)) {
    await page.click('button.sheet-handle[aria-label="Expand evidence"]');
    await page.waitForSelector(".evidence-panel.mobile-expanded");
  }
}

async function openEvidencePage(page) {
  await expandEvidence(page);
  await page.click(".open-page");
  await page.waitForSelector(".pdf-view");
}

const phoneSheet = (selector) => (phone) => (phone ? { selector, kind: "sheet" } : null);

// Every screen state the app has. `setup` leaves the page in the state;
// `layer` names the sheet, dialog, drawer or popover that is open in it.
const auditStates = [
  { name: "empty", setup: async () => {} },
  { name: "loading", gate: true, setup: async (page) => { await typeQuestion(page, ordinaryQuestion); await page.click('button[aria-label="Ask question"]'); await page.waitForSelector(".loading-answer"); } },
  { name: "answered-evidence-collapsed", setup: async (page) => ask(page, ordinaryQuestion, ".provider-result") },
  { name: "answered-evidence-expanded", setup: async (page) => { await ask(page, ordinaryQuestion, ".provider-result"); await expandEvidence(page); }, layer: phoneSheet(".evidence-panel") },
  { name: "evidence-page-view", setup: async (page) => { await ask(page, ordinaryQuestion, ".provider-result"); await openEvidencePage(page); }, layer: phoneSheet(".evidence-panel") },
  { name: "select-all-answer", answer: { ...longAnswer, select_all_that_apply: true }, setup: async (page) => ask(page, ordinaryQuestion, ".answer-mode-note") },
  { name: "fallback-banners", answer: fallbackAnswer, setup: async (page) => ask(page, ordinaryQuestion, ".retrieval-fallback-banner") },
  { name: "insufficient-evidence", answer: insufficientAnswer, setup: async (page) => ask(page, ordinaryQuestion, ".insufficient-state") },
  { name: "provider-abstention", answer: abstentionAnswer, setup: async (page) => ask(page, ordinaryQuestion, ".provider-abstention") },
  { name: "provider-abstention-evidence-expanded", answer: abstentionAnswer, setup: async (page) => { await ask(page, ordinaryQuestion, ".provider-abstention"); await expandEvidence(page); }, layer: phoneSheet(".evidence-panel") },
  { name: "error", queryStatus: 503, setup: async (page) => ask(page, ordinaryQuestion, ".error-state") },
  { name: "long-answer", answer: veryLongAnswer, setup: async (page) => ask(page, ordinaryQuestion, ".provider-result") },
  { name: "long-answer-evidence-expanded", answer: veryLongAnswer, setup: async (page) => { await ask(page, ordinaryQuestion, ".provider-result"); await expandEvidence(page); }, layer: phoneSheet(".evidence-panel") },
  { name: "long-question", setup: async (page) => ask(page, longQuestion, ".provider-result") },
  { name: "many-citations", answer: manyCitationsAnswer, setup: async (page) => ask(page, ordinaryQuestion, ".provider-result") },
  { name: "many-citations-evidence-expanded", answer: manyCitationsAnswer, setup: async (page) => { await ask(page, ordinaryQuestion, ".provider-result"); await expandEvidence(page); }, layer: phoneSheet(".evidence-panel") },
  { name: "saved-question", setup: async (page) => { await openHistory(page); await page.click("button.history-select"); await page.waitForFunction(() => document.querySelector(".answer-article h1")?.textContent?.includes("What is virtual memory?")); } },
  { name: "history-open-few-rows", history: historicalConversations, setup: openHistory, layer: (phone) => (phone ? { selector: ".history-rail.mobile-open", kind: "drawer", backdrop: ".drawer-backdrop" } : null) },
  { name: "history-open-many-rows", setup: openHistory, layer: (phone) => (phone ? { selector: ".history-rail.mobile-open", kind: "drawer", backdrop: ".drawer-backdrop" } : null) },
  { name: "history-open-filters", setup: async (page) => { await openHistory(page); await page.click("button.history-filter-toggle"); await page.waitForSelector("#history-filter-panel"); }, layer: (phone) => (phone ? { selector: ".history-rail.mobile-open", kind: "drawer", backdrop: ".drawer-backdrop" } : null) },
  { name: "history-open-no-matches", setup: async (page) => { await openHistory(page); await page.click("button.history-filter-toggle"); await page.select('select[aria-label="Filter history by course"]', "WEB-210"); await page.waitForSelector(".empty-history"); }, layer: (phone) => (phone ? { selector: ".history-rail.mobile-open", kind: "drawer", backdrop: ".drawer-backdrop" } : null) },
  { name: "book-picker", setup: async (page) => { await page.click("button.scope-button"); await page.waitForSelector(scopeSheetSelector); }, layer: (phone) => ({ selector: scopeSheetSelector, kind: phone ? "sheet" : "popover" }) },
  { name: "confirm-clear-all", setup: async (page) => { await openHistory(page); await page.click("button.clear-history"); await page.waitForSelector(".confirm-dialog"); }, layer: () => ({ selector: ".confirm-dialog", kind: "dialog", backdrop: ".dialog-backdrop" }) },
  { name: "confirm-delete-one", setup: async (page) => { await openHistory(page); await page.hover(".history-row"); await page.click(".history-row .history-delete"); await page.waitForSelector(".confirm-dialog"); }, layer: () => ({ selector: ".confirm-dialog", kind: "dialog", backdrop: ".dialog-backdrop" }) },
];

async function violationsFor(page, spec) {
  await settle(page);
  return page.evaluate(auditInPage, spec);
}

const auditReportOnly = process.env.AUDIT_REPORT === "1";
const auditShotsDir = process.env.AUDIT_SHOTS_DIR ? path.resolve(process.env.AUDIT_SHOTS_DIR) : undefined;
const auditFindings = [];

async function runAuditState(browser, viewportName, viewport, state) {
  const page = await browser.newPage();
  const problems = [];
  page.on("console", (message) => { if (message.type() === "error" && !/status of 503/.test(message.text())) problems.push(message.text()); });
  page.on("pageerror", (error) => problems.push(error.message));
  let gate;
  try {
    gate = state.gate ? gated() : undefined;
    const query = gate?.query ?? (state.queryStatus
      ? async () => ({ status: state.queryStatus, body: { error: { message: "The answer service is not responding." } } })
      : state.answer ? async () => ({ body: state.answer }) : undefined);
    await installApiMocks(page, { history: state.history ?? phoneLayoutHistory, answer: longAnswer, query });
    await page.setViewport(viewport);
    await page.goto(appUrl, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('textarea[placeholder="Ask your textbooks…"]');
    await page.waitForFunction((count) => document.querySelectorAll(".history-select").length >= count, {}, (state.history ?? phoneLayoutHistory).length);
    await page.evaluate(() => document.fonts?.ready);
    try {
      await state.setup(page);
    } catch (error) {
      if (!auditReportOnly) throw error;
      auditFindings.push(`${viewportName} / ${state.name}: could not reach the state: ${String(error.message).split("\n")[0]}`);
      return;
    }
    const phone = viewport.isMobile === true;
    const layer = state.layer ? state.layer(phone) : null;
    const found = await violationsFor(page, { layer, finish: "start" });
    const where = `${viewportName} / ${state.name}`;
    if (auditShotsDir) {
      await settle(page);
      await page.screenshot({ path: path.join(auditShotsDir, `complete-${viewportName}-${state.name}.png`), fullPage: false });
      const scrolled = await page.evaluate(() => {
        let moved = false;
        for (const element of document.querySelectorAll("*")) {
          const style = getComputedStyle(element);
          const rect = element.getBoundingClientRect();
          if ((style.overflowY === "auto" || style.overflowY === "scroll") && style.visibility !== "hidden" && rect.width > 1 && element.scrollHeight > element.clientHeight + 1) { element.scrollTop = element.scrollHeight; moved = true; }
        }
        return moved;
      });
      if (scrolled) {
        await settle(page);
        await page.screenshot({ path: path.join(auditShotsDir, `complete-${viewportName}-${state.name}-end.png`), fullPage: false });
      }
    }
    for (const message of found) auditFindings.push(`${where}: ${message}`);
    if (!auditReportOnly) assert.deepEqual(found, [], `${where}: layout audit`);
    if (!auditReportOnly) assert.deepEqual(problems, [], `${where}: console health`);
  } finally {
    gate?.release();
    await page.close();
  }
}

// Behaviour of the expanded evidence sheet on phones: focus, Escape, the close
// control, and the reader's scroll position coming back unchanged.
async function runExpandedSheetFlow(browser, label, viewport) {
  const page = await browser.newPage();
  try {
    await installApiMocks(page, { history: phoneLayoutHistory, answer: veryLongAnswer });
    await page.setViewport(viewport);
    await page.goto(appUrl, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('textarea[placeholder="Ask your textbooks…"]');
    await ask(page, ordinaryQuestion, ".provider-result");
    const state = () => page.evaluate(() => {
      const sheet = document.querySelector(".evidence-panel");
      const active = document.activeElement;
      return {
        scrollTop: document.querySelector(".answer-scroll").scrollTop,
        expanded: sheet.classList.contains("mobile-expanded"),
        focusInSheet: Boolean(active && sheet.contains(active)),
        focusLabel: active ? (active.getAttribute("aria-label") || active.textContent || active.tagName).trim().slice(0, 40) : "",
        pageInert: document.querySelector("main").inert === true && document.querySelector("header").inert === true,
      };
    });
    const collapseVisible = () => page.evaluate(() => {
      const button = [...document.querySelectorAll('.evidence-panel button[aria-label="Collapse evidence"]')].find((item) => item.getBoundingClientRect().width > 0);
      if (!button) return false;
      const rect = button.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return Boolean(hit && button.contains(hit)) && rect.top >= 0 && rect.bottom <= window.innerHeight;
    });
    // Scroll so the citation buttons and the evidence button are both on screen, then remember the position.
    await page.evaluate(() => { document.querySelector(".answer-article .show-evidence").scrollIntoView({ block: "center" }); });
    const before = (await state()).scrollTop;
    assert.ok(before > 50, `${label}: the answer was scrolled before opening the sheet (${before})`);

    // Open from a citation, close with Escape.
    await page.$eval(".citation-controls button", (button) => button.focus({ preventScroll: true }));
    await page.click(".citation-controls button");
    await page.waitForSelector(".evidence-panel.mobile-expanded");
    await settle(page);
    let now = await state();
    assert.ok(now.focusInSheet, `${label}: focus moves into the expanded sheet (focus is on "${now.focusLabel}")`);
    assert.ok(now.pageInert, `${label}: the page behind the expanded sheet is inert`);
    assert.ok(await collapseVisible(), `${label}: the close control is visible and reachable`);
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.querySelector(".evidence-panel.mobile-expanded"));
    await page.waitForFunction(() => !document.querySelector(".evidence-panel").contains(document.activeElement));
    await settle(page);
    now = await state();
    assert.equal(now.scrollTop, before, `${label}: Escape returns to the same scroll position`);
    assert.equal(now.pageInert, false, `${label}: the page is live again after closing`);
    assert.match(now.focusLabel, /Open citation 1/, `${label}: focus returns to the citation that opened the sheet`);

    // Open from the evidence button, close with the close control.
    await page.click(".answer-article .show-evidence");
    await page.waitForSelector(".evidence-panel.mobile-expanded");
    await settle(page);
    now = await state();
    assert.ok(now.focusInSheet, `${label}: focus moves into the sheet when opened from the evidence button`);
    const closeButton = await page.evaluateHandle(() => [...document.querySelectorAll('.evidence-panel button[aria-label="Collapse evidence"]')].find((item) => item.getBoundingClientRect().width > 0));
    await closeButton.asElement().click();
    await page.waitForFunction(() => !document.querySelector(".evidence-panel.mobile-expanded"));
    await page.waitForFunction(() => !document.querySelector(".evidence-panel").contains(document.activeElement));
    await settle(page);
    now = await state();
    assert.equal(now.scrollTop, before, `${label}: the close control returns to the same scroll position`);
    assert.match(now.focusLabel, /Show textbook evidence/, `${label}: focus returns to the evidence button (focus is on "${now.focusLabel}")`);

    // Inside the sheet: a page view can be left again, and the composer is not over the sheet.
    await page.click(".answer-article .show-evidence");
    await page.waitForSelector(".evidence-panel.mobile-expanded");
    await page.click('.evidence-panel [role="tab"]:first-child');
    await page.waitForSelector(".open-page");
    await page.click(".open-page");
    await page.waitForSelector(".pdf-view");
    const tabs = await page.evaluate(() => {
      const tab = [...document.querySelectorAll('.evidence-panel [role="tab"]')].find((item) => item.textContent.trim() === "Evidence");
      if (!tab || tab.getBoundingClientRect().width === 0) return false;
      const rect = tab.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return Boolean(hit && tab.contains(hit));
    });
    assert.ok(tabs, `${label}: the Evidence tab is reachable from the page view`);
    await page.click('.evidence-panel [role="tab"]:first-child');
    await page.waitForSelector(".evidence-list");
    const composerCovered = await page.evaluate(() => {
      const rect = document.querySelector(".composer textarea").getBoundingClientRect();
      const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return Boolean(hit && document.querySelector(".evidence-panel").contains(hit));
    });
    assert.ok(composerCovered, `${label}: the composer does not float over the expanded sheet`);
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => !document.querySelector(".evidence-panel.mobile-expanded"));
    await page.waitForFunction(() => !document.querySelector(".evidence-panel").contains(document.activeElement));
    assert.equal((await state()).scrollTop, before, `${label}: scroll position is still the same after viewing a page`);
  } finally {
    await page.close();
  }
}

function windowIsMobile(page) {
  return page.viewport().isMobile === true;
}

async function main() {
  await mkdir(artifactDir, { recursive: true });
  if (auditShotsDir) await mkdir(auditShotsDir, { recursive: true });
  const server = startVite();
  let browser;
  try {
    await waitForVite(server);
    browser = await puppeteer.launch({ headless: true, userDataDir: path.join(artifactDir, "browser-profile") });
    for (const { name, viewport } of viewports.filter((item) => !process.env.E2E_ONLY || item.name === process.env.E2E_ONLY)) {
      const page = await browser.newPage();
      const consoleErrors = [];
      const httpErrors = [];
      page.on("console", (message) => {
        if (message.type() === "error") consoleErrors.push(message.text());
      });
      page.on("pageerror", (error) => consoleErrors.push(error.message));
      page.on("response", (response) => {
        if (response.status() >= 400) httpErrors.push(`${response.status()} ${response.url()}`);
      });
      const mockState = await installApiMocks(page);
      try {
        await loadApp(page, name, viewport);
        await assertHistoryList(page, name);
        await shot(page, `${name}-initial.png`);
        await runHistoryFlow(page, name, viewport.isMobile === true);
        await runScopeFlow(page, name);
        await runSelectAllFlow(page, name, mockState);
        await shot(page, `${name}-select-all.png`);
        if (viewport.isMobile === true) await runPhoneLayoutFlow(browser, name, viewport);
        if (viewport.isMobile === true) {
          try {
            await runExpandedSheetFlow(browser, name, viewport);
          } catch (error) {
            if (!auditReportOnly) throw error;
            auditFindings.push(`${name} / expanded sheet behaviour: ${String(error.message).split("\n")[0]}`);
          }
        }
        for (const state of auditStates) await runAuditState(browser, name, viewport, state);
        assert.deepEqual(httpErrors, [], `${name}: HTTP health`);
        assert.deepEqual(consoleErrors, [], `${name}: console health`);
        process.stdout.write(`PASS ${name}\n`);
      } finally {
        await page.close();
      }
    }
    process.stdout.write(`Puppeteer artifacts: ${artifactDir}\n`);
    if (auditReportOnly) {
      process.stdout.write(`${auditFindings.length} layout findings\n${auditFindings.join("\n")}\n`);
    }
  } finally {
    if (browser) await browser.close();
    if (server.exitCode === null) server.kill();
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
