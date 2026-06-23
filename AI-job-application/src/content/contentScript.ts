import type { ExtensionRequest, FillPlanItem, FormField, JobPosting } from "../types";

const text = (value: string | null | undefined) => (value ?? "").replace(/\s+/g, " ").trim();

const textMatches = (value: string | null | undefined, pattern: RegExp) => pattern.test(text(value));

const firstText = (selectors: string[], root: ParentNode = document) => {
  for (const selector of selectors) {
    const value = text(root.querySelector(selector)?.textContent);
    if (value) {
      return value;
    }
  }

  return "";
};

const findJobDetailRoot = () => {
  const applyControl = Array.from(document.querySelectorAll("a, button")).find((element) =>
    textMatches(element.textContent, /\b(quick apply|apply|apply now)\b/i)
  );

  if (!applyControl) {
    return null;
  }

  let current: Element | null = applyControl;
  let best: Element | null = null;

  while (current && current !== document.body) {
    const content = text(current.textContent);
    const hasHeading = Boolean(current.querySelector("h1, h2, h3"));

    if (hasHeading && content.length > 250 && content.length < 30000) {
      best = current;
    }

    current = current.parentElement;
  }

  return best;
};

const meaningfulTextBlocks = (root: ParentNode) => {
  const seen = new Set<string>();

  return Array.from(root.querySelectorAll("h1, h2, h3, p, a, span, li"))
    .map((element) => text(element.textContent))
    .filter((value) => value.length > 1 && value.length < 180)
    .filter((value) => {
      if (seen.has(value)) {
        return false;
      }

      seen.add(value);
      return true;
    });
};

const isSearchResultsTitle = (value: string) => /\b\d+\s+.+\s+jobs?\s+in\b/i.test(value);

const badTitlePattern = /^(home|search|jobs?|careers?|why join|what we do|search by keyword|search by location)$/i;

const cleanTitleFromUrl = () => {
  const segments = location.pathname.split("/").filter(Boolean);
  const jobSegment = segments.find((segment) => /developer|engineer|manager|analyst|designer|consultant|specialist|permanent|contract|full|stack|front|back/i.test(segment));
  if (!jobSegment) {
    return "";
  }

  return decodeURIComponent(jobSegment)
    .replace(/[-_]+/g, " ")
    .replace(/\b(auckland|wellington|christchurch|hamilton|dunedin|permanent|contract|fixed term|full time|part time)\b/gi, "")
    .replace(/\s+/g, " ")
    .trim();
};

const cleanJobTitle = (value: string) => {
  if (value.includes("|")) {
    return value.split("|")[0]?.trim() || value;
  }

  return value;
};

const labeledValue = (label: string, root: ParentNode = document) => {
  const labelElement = Array.from(root.querySelectorAll("strong, b, dt, span, p, div, li")).find((element) =>
    textMatches(element.textContent, new RegExp(`^${label}\\s*:?`, "i"))
  );

  if (!labelElement) {
    return "";
  }

  const parent = labelElement.parentElement;
  if (!parent) {
    return "";
  }

  const parentText = text(parent.textContent);
  const inlineValue = parentText
    .replace(new RegExp(`^${label}\\s*:?\\s*`, "i"), "")
    .replace(/\s+(Date|Location|Company|Apply|About)\s*:.*/i, "")
    .trim();
  if (inlineValue && inlineValue.length < 140) {
    return inlineValue;
  }

  return text(labelElement.nextElementSibling?.textContent);
};

const findStructuredJobRoot = () => {
  const companyLabel = Array.from(document.querySelectorAll("strong, b, dt, span, p, div")).find((element) =>
    textMatches(element.textContent, /^company\s*:?$/i)
  );

  if (!companyLabel) {
    return null;
  }

  let current: Element | null = companyLabel;
  while (current && current !== document.body) {
    const content = text(current.textContent);
    if (/location\s*:/i.test(content) && /company\s*:/i.test(content) && content.length > 200) {
      return current;
    }

    current = current.parentElement;
  }

  return null;
};

const bestHeadingTitle = (root: ParentNode) => {
  const headings = Array.from(root.querySelectorAll("h1, h2, h3, a"))
    .map((element) => text(element.textContent))
    .filter((value) => value.length > 2 && value.length < 120)
    .filter((value) => !badTitlePattern.test(value))
    .filter((value) => !textMatches(value, /search by|create alert|show more|about our team/i));

  const structuredTitle = headings.find((value) => value.includes("|"));
  return structuredTitle ?? headings[0] ?? "";
};

const inferJobMetaFromBlocks = (blocks: string[], title: string) => {
  const titleIndex = blocks.findIndex((block) => block === title || block.includes(title));
  const following = blocks.slice(Math.max(titleIndex + 1, 0), Math.max(titleIndex + 8, 8));
  const locationPattern =
    /\b(remote|hybrid|onsite|auckland|wellington|christchurch|hamilton|dunedin|new zealand|australia|sydney|melbourne|brisbane|perth|cbd)\b/i;

  const company = following.find((block) => !textMatches(block, /view all jobs|posted|application volume|salary|full time|part time/i) && !locationPattern.test(block)) ?? "";
  const locationValue = following.find((block) => locationPattern.test(block)) ?? "";

  return { company, location: locationValue };
};

const cssPath = (element: Element) => {
  if (element.id) {
    return `#${CSS.escape(element.id)}`;
  }

  const field = element as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
  const name = field.getAttribute("name");
  if (name) {
    return `${field.tagName.toLowerCase()}[name="${CSS.escape(name)}"]`;
  }

  const ariaLabel = field.getAttribute("aria-label");
  if (ariaLabel) {
    return `${field.tagName.toLowerCase()}[aria-label="${CSS.escape(ariaLabel)}"]`;
  }

  const autocomplete = field.getAttribute("autocomplete");
  if (autocomplete) {
    return `${field.tagName.toLowerCase()}[autocomplete="${CSS.escape(autocomplete)}"]`;
  }

  const parts: string[] = [];
  let current: Element | null = element;

  while (current && current !== document.body && parts.length < 5) {
    const tag = current.tagName.toLowerCase();
    const parent: HTMLElement | null = current.parentElement;
    if (!parent) {
      break;
    }

    const siblings = Array.from(parent.children).filter((child: Element) => child.tagName === current?.tagName);
    const index = siblings.indexOf(current) + 1;
    parts.unshift(`${tag}:nth-of-type(${index})`);
    current = parent;
  }

  return parts.join(" > ");
};

const findLabel = (element: HTMLElement) => {
  if (element.id) {
    const label = document.querySelector(`label[for="${CSS.escape(element.id)}"]`);
    if (label) {
      return text(label.textContent);
    }
  }

  const wrappingLabel = element.closest("label");
  if (wrappingLabel) {
    return text(wrappingLabel.textContent);
  }

  const parent = element.closest("div, p, li, section, fieldset");
  return text(parent?.textContent).slice(0, 180);
};

const extractJob = (): JobPosting => {
  const structuredRoot = findStructuredJobRoot();
  const detailRoot = structuredRoot ?? findJobDetailRoot();
  const root = detailRoot ?? document;
  const rawTitle =
    bestHeadingTitle(root) ||
    firstText(
      [
        "[data-automation='job-detail-title']",
        "[data-automation*='job-title']",
        "[data-testid*='job-title']",
        "h1",
        "h2"
      ],
      root
    ) || text(document.querySelector("h1")?.textContent || document.title);
  const title = cleanJobTitle(badTitlePattern.test(rawTitle) ? cleanTitleFromUrl() || rawTitle : rawTitle);
  const blocks = meaningfulTextBlocks(root);
  const inferredMeta = inferJobMetaFromBlocks(blocks, title);
  const metaDescription = document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content ?? "";
  const candidates = detailRoot
    ? [detailRoot]
    : Array.from(document.querySelectorAll("main, article, [role='main'], section, body"));
  const largest = candidates
    .map((node) => text(node.textContent))
    .sort((a, b) => b.length - a.length)[0];

  return {
    title: isSearchResultsTitle(title) ? blocks.find((block) => !isSearchResultsTitle(block)) ?? title : title,
    company:
      labeledValue("Company", root) ||
      firstText(
        [
          "[data-automation='advertiser-name']",
          "[data-automation*='advertiser']",
          "[data-automation*='company']",
          "[data-testid*='company']",
          "[data-company]",
          ".company",
          "[class*='company']"
        ],
        root
      ) || inferredMeta.company,
    location:
      labeledValue("Location", root) ||
      firstText(
        [
          "[data-automation='job-detail-location']",
          "[data-automation*='location']",
          "[data-testid*='location']",
          "[data-location]",
          ".location",
          "[class*='location']"
        ],
        root
      ) || inferredMeta.location,
    description: (largest || metaDescription).slice(0, 18000),
    url: location.href
  };
};

const scanForm = (): FormField[] => {
  const controls = Array.from(
    document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
      "input:not([type='hidden']), textarea, select"
    )
  );

  return controls
    .filter((element) => {
      const readonly = element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement ? element.readOnly : false;
      const unsupportedInput = element instanceof HTMLInputElement && ["file", "submit", "button", "reset", "image"].includes(element.type);
      return !element.disabled && !readonly && !unsupportedInput;
    })
    .map((element) => ({
      selector: cssPath(element),
      tagName: element.tagName.toLowerCase(),
      type: element instanceof HTMLInputElement ? element.type : element.tagName.toLowerCase(),
      label: findLabel(element),
      placeholder: "placeholder" in element ? text(element.placeholder) : "",
      name: text(element.getAttribute("name")),
      id: text(element.id),
      options:
        element instanceof HTMLSelectElement
          ? Array.from(element.options).map((option) => text(option.textContent || option.value))
          : []
    }))
    .filter((field) => field.selector);
};

const setNativeValue = (element: HTMLInputElement | HTMLTextAreaElement, value: string) => {
  const prototype = element instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  const descriptor = Object.getOwnPropertyDescriptor(prototype, "value");
  descriptor?.set?.call(element, value);
};

const applyValue = (item: FillPlanItem) => {
  const element = document.querySelector<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(item.selector);
  if (!element) {
    return { applied: false, error: `Element not found for selector: ${item.selector}` };
  }

  if (element instanceof HTMLSelectElement) {
    const normalized = item.value.toLowerCase();
    const option = Array.from(element.options).find(
      (candidate) =>
        candidate.value.toLowerCase() === normalized || text(candidate.textContent).toLowerCase().includes(normalized)
    );
    if (option) {
      element.value = option.value;
    } else {
      return { applied: false, error: `No matching option for value "${item.value}".` };
    }
  } else if (element instanceof HTMLInputElement && ["checkbox", "radio"].includes(element.type)) {
    const shouldCheck = ["yes", "true", "1", "checked"].includes(item.value.toLowerCase());
    element.checked = shouldCheck;
  } else if (element instanceof HTMLInputElement && element.type === "file") {
    return { applied: false, error: "File inputs cannot be filled by browser extensions." };
  } else {
    setNativeValue(element, item.value);
  }

  element.dispatchEvent(new Event("input", { bubbles: true }));
  element.dispatchEvent(new Event("change", { bubbles: true }));
  return { applied: true };
};

const applyFillPlan = (plan: FillPlanItem[]) => {
  const failures: string[] = [];
  let applied = 0;

  for (const item of plan) {
    try {
      const result = applyValue(item);
      if (result.applied) {
        applied += 1;
      } else if (result.error) {
        failures.push(result.error);
      }
    } catch (error) {
      failures.push(error instanceof Error ? error.message : String(error));
    }
  }

  return { applied, failed: failures.length, failures };
};

chrome.runtime.onMessage.addListener((request: ExtensionRequest, _sender, sendResponse) => {
  try {
    if (request.type === "EXTRACT_JOB") {
      sendResponse({ ok: true, job: extractJob() });
      return;
    }

    if (request.type === "SCAN_FORM") {
      sendResponse({ ok: true, fields: scanForm() });
      return;
    }

    if (request.type === "APPLY_FILL_PLAN") {
      sendResponse({ ok: true, ...applyFillPlan(request.payload.plan) });
    }
  } catch (error) {
    sendResponse({ ok: false, error: error instanceof Error ? error.message : String(error) });
  }
});
