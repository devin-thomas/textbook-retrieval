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

async function installApiMocks(page, { history = historicalConversations, answer = selectedAnswer } = {}) {
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
      await request.respond(jsonResponse(answer));
      return;
    }
    if (pathName === "/textbooks/api/conversations/history-virtual" || pathName === "/textbooks/api/conversations/history-html") {
      await request.respond(jsonResponse(pathName.endsWith("history-html") ? historyHtmlDetail : historyDetail));
      return;
    }
    if (/^\/textbooks\/api\/sources\/[^/]+\/pdf$/.test(pathName)) {
      await request.respond({ status: 200, contentType: "application/pdf", body: "%PDF-1.4\n% textbook test fixture\n" });
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
  await page.screenshot({ path: path.join(artifactDir, `${viewportName}-history-filtered.png`), fullPage: false });
  await page.select('select[aria-label="Filter history by course"]', "OS-101");
  await page.waitForSelector(".empty-history");
  assert.match(await page.$eval(".empty-history p", (element) => element.textContent ?? ""), /Clear filters or choose a different course/);
  await page.screenshot({ path: path.join(artifactDir, `${viewportName}-history-empty.png`), fullPage: false });
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
    const pane = document.querySelector(".answer-pane");
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
    await page.screenshot({ path: path.join(artifactDir, `${label}-layout-answer-end.png`), fullPage: false });
    // The picker also has to stay on top of the evidence sheet once an answer is showing.
    await assertScopeSheetFlow(page, `${label} after an answer`);
    assert.deepEqual(problems, [], `${label}: layout flow console and HTTP health`);
  } finally {
    await page.close();
  }
}

function windowIsMobile(page) {
  return page.viewport().isMobile === true;
}

async function main() {
  await mkdir(artifactDir, { recursive: true });
  const server = startVite();
  let browser;
  try {
    await waitForVite(server);
    browser = await puppeteer.launch({ headless: true, userDataDir: path.join(artifactDir, "browser-profile") });
    for (const { name, viewport } of viewports) {
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
        await page.screenshot({ path: path.join(artifactDir, `${name}-initial.png`), fullPage: false });
        await runHistoryFlow(page, name, viewport.isMobile === true);
        await runScopeFlow(page, name);
        await runSelectAllFlow(page, name, mockState);
        await page.screenshot({ path: path.join(artifactDir, `${name}-select-all.png`), fullPage: false });
        if (viewport.isMobile === true) await runPhoneLayoutFlow(browser, name, viewport);
        assert.deepEqual(httpErrors, [], `${name}: HTTP health`);
        assert.deepEqual(consoleErrors, [], `${name}: console health`);
        process.stdout.write(`PASS ${name}\n`);
      } finally {
        await page.close();
      }
    }
    process.stdout.write(`Puppeteer artifacts: ${artifactDir}\n`);
  } finally {
    if (browser) await browser.close();
    if (server.exitCode === null) server.kill();
  }
}

main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  process.exitCode = 1;
});
