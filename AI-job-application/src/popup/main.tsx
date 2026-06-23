import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import type { FillPlanItem, FormField, JobPosting, MatchReport } from "../types";
import "../styles.css";

type Status = "idle" | "loading" | "error" | "success";

const activeTab = async () => {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab.id) {
    throw new Error("Could not find the current tab.");
  }
  return tab;
};

const canInjectIntoTab = (url?: string) => {
  if (!url) {
    return false;
  }

  return /^(https?:|file:)/.test(url);
};

const ensureContentScript = async (tab: chrome.tabs.Tab) => {
  if (!tab.id || !canInjectIntoTab(tab.url)) {
    throw new Error("This page cannot be read. Open a job posting page such as LinkedIn, a company career site, or a job board page.");
  }

  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ["assets/content.js"]
  });
};

const sendToTab = async <T,>(message: unknown): Promise<T> => {
  const tab = await activeTab();

  try {
    return await chrome.tabs.sendMessage(tab.id!, message);
  } catch (error) {
    const messageText = error instanceof Error ? error.message : String(error);
    if (!messageText.includes("Receiving end does not exist")) {
      throw error;
    }

    await ensureContentScript(tab);
    return chrome.tabs.sendMessage(tab.id!, message);
  }
};

const sendToBackground = async <T,>(message: unknown): Promise<T> => chrome.runtime.sendMessage(message);

const recommendationText: Record<MatchReport["recommendation"], string> = {
  strong_apply: "Strong match",
  apply: "Apply",
  maybe: "Review carefully",
  skip: "Skip"
};

function App() {
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState("");
  const [job, setJob] = useState<JobPosting | null>(null);
  const [report, setReport] = useState<MatchReport | null>(null);
  const [fields, setFields] = useState<FormField[]>([]);
  const [plan, setPlan] = useState<FillPlanItem[]>([]);
  const [coverLetter, setCoverLetter] = useState("");

  const analyze = async () => {
    setStatus("loading");
    setMessage("Reading the job page and analyzing fit...");
    setReport(null);

    try {
      const extracted = await sendToTab<{ ok: boolean; job: JobPosting }>({ type: "EXTRACT_JOB" });
      setJob(extracted.job);
      const result = await sendToBackground<{ ok: boolean; report?: MatchReport; error?: string }>({
        type: "ANALYZE_JOB",
        payload: { job: extracted.job }
      });

      if (!result.ok || !result.report) {
        throw new Error(result.error ?? "Analysis failed.");
      }

      setReport(result.report);
      setStatus("success");
      setMessage("Analysis complete.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : String(error));
    }
  };

  const prepareAutofill = async () => {
    setStatus("loading");
    setMessage("Scanning application form fields...");
    setPlan([]);

    try {
      const scanned = await sendToTab<{ ok: boolean; fields: FormField[] }>({ type: "SCAN_FORM" });
      setFields(scanned.fields);

      if (scanned.fields.length === 0) {
        setStatus("success");
        setMessage("No fillable text, select, checkbox, or radio fields were found on this page.");
        return;
      }

      const result = await sendToBackground<{ ok: boolean; plan?: FillPlanItem[]; error?: string }>({
        type: "BUILD_FILL_PLAN",
        payload: { fields: scanned.fields }
      });

      if (!result.ok || !result.plan) {
        throw new Error(result.error ?? "Could not generate the autofill plan.");
      }

      setPlan(result.plan);
      setStatus("success");
      setMessage(`Found ${scanned.fields.length} fields and generated ${result.plan.length} autofill items.`);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : String(error));
    }
  };

  const createCoverLetter = async () => {
    setStatus("loading");
    setMessage("Reading the job page and generating a cover letter...");
    setCoverLetter("");

    try {
      const extracted = await sendToTab<{ ok: boolean; job: JobPosting }>({ type: "EXTRACT_JOB" });
      setJob(extracted.job);
      const result = await sendToBackground<{ ok: boolean; coverLetter?: string; error?: string }>({
        type: "GENERATE_COVER_LETTER",
        payload: { job: extracted.job }
      });

      if (!result.ok || !result.coverLetter) {
        throw new Error(result.error ?? "Could not generate the cover letter.");
      }

      setCoverLetter(result.coverLetter);
      setStatus("success");
      setMessage("Cover letter generated.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : String(error));
    }
  };

  const copyCoverLetter = async () => {
    await navigator.clipboard.writeText(coverLetter);
    setStatus("success");
    setMessage("Cover letter copied.");
  };

  const applyPlan = async () => {
    setStatus("loading");
    setMessage("Filling the page...");

    try {
      const result = await sendToTab<{ ok: boolean; applied: number; failed?: number; failures?: string[]; error?: string }>({
        type: "APPLY_FILL_PLAN",
        payload: { plan }
      });

      if (!result.ok) {
        throw new Error(result.error ?? "Could not fill the page.");
      }

      setStatus("success");
      setMessage(
        result.failed
          ? `Filled ${result.applied} fields. ${result.failed} fields could not be filled: ${result.failures?.[0] ?? "unknown reason"}`
          : `Filled ${result.applied} fields. Please review before submitting.`
      );
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : String(error));
    }
  };

  const openOptions = () => {
    chrome.runtime.openOptionsPage();
  };

  return (
    <main className="popup shell">
      <header className="topbar">
        <div>
          <h1>AI Job Assistant</h1>
          <p>Job fit analysis and application autofill</p>
        </div>
        <button className="iconButton" type="button" title="Settings" onClick={openOptions}>
          <span aria-hidden="true">⚙</span>
        </button>
      </header>

      <section className="actions">
        <button type="button" onClick={analyze} disabled={status === "loading"}>
          Analyze Job
        </button>
        <button type="button" className="secondary" onClick={prepareAutofill} disabled={status === "loading"}>
          Build Autofill Plan
        </button>
        <button type="button" className="secondary" onClick={createCoverLetter} disabled={status === "loading"}>
          Generate Cover Letter
        </button>
      </section>

      {message && <p className={`notice ${status}`}>{message}</p>}

      {job && (
        <section className="panel compact">
          <h2>{job.title || "Current job"}</h2>
          <p>{job.company || "Company not detected"} · {job.location || "Location not detected"}</p>
        </section>
      )}

      {report && (
        <section className="panel">
          <div className="scoreRow">
            <strong>{report.score}</strong>
            <span>{recommendationText[report.recommendation]}</span>
          </div>
          <p>{report.summary}</p>
          <h3>Strengths</h3>
          <ul>{report.strengths.map((item) => <li key={item}>{item}</li>)}</ul>
          <h3>Gaps</h3>
          <ul>{report.gaps.map((item) => <li key={item}>{item}</li>)}</ul>
          <h3>Suggested Keywords</h3>
          <div className="chips">{report.suggestedResumeKeywords.map((item) => <span key={item}>{item}</span>)}</div>
        </section>
      )}

      {fields.length > 0 && (
        <section className="panel compact">
          <h2>Detected Fields</h2>
          <p>{fields.slice(0, 4).map((field) => field.label || field.name || field.placeholder).join(" / ")}</p>
        </section>
      )}

      {plan.length > 0 && (
        <section className="panel">
          <h2>Autofill Preview</h2>
          <div className="previewList">
            {plan.map((item) => (
              <div className="previewItem" key={item.selector}>
                <strong>{item.value}</strong>
                <span>{item.reason}</span>
              </div>
            ))}
          </div>
          <button type="button" onClick={applyPlan} disabled={status === "loading"}>
            Fill Page
          </button>
        </section>
      )}

      {coverLetter && (
        <section className="panel">
          <h2>Cover Letter</h2>
          <textarea className="coverLetterBox" rows={10} value={coverLetter} onChange={(event) => setCoverLetter(event.target.value)} />
          <button type="button" onClick={copyCoverLetter}>
            Copy
          </button>
        </section>
      )}
    </main>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
