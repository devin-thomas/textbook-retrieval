import { useState } from "react";
import { AlertIcon, BookIcon, ChevronIcon, CloseIcon } from "../icons";
import type { Answer, AnswerStatus, Evidence } from "../types";

interface AnswerViewProps {
  status: AnswerStatus;
  answer?: Answer;
  loadingQuestion: string;
  loadingStep: string;
  onCitation: (evidence: Evidence) => void;
  onShowEvidence: () => void;
}

function evidenceForCitation(answer: Answer, citationIndex: number): Evidence | undefined {
  const citation = answer.citations[citationIndex];
  return citation ? answer.evidence.find((item) => item.id === citation.evidenceId) ?? answer.evidence.find((item) => item.sourceId === citation.sourceId && item.page === citation.page) ?? answer.evidence[citationIndex] : answer.evidence[citationIndex];
}

function AnswerText({ answer, onCitation }: { answer: Answer; onCitation: (evidence: Evidence) => void }) {
  const parts = answer.text.split(/(\[\d+\])/g);
  return <>{parts.map((part, index) => {
    const match = part.match(/^\[(\d+)\]$/);
    if (!match) return <span key={index}>{part}</span>;
    const citationIndex = Number(match[1]) - 1;
    const evidence = evidenceForCitation(answer, citationIndex);
    return evidence ? <button key={index} className="citation" onClick={() => onCitation(evidence)} aria-label={`Open inline citation ${match[1]}, ${evidence.sourceTitle}, page ${evidence.page}`}>{part}</button> : <span key={index}>{part}</span>;
  })}</>;
}

function CitationControls({ answer, onCitation }: { answer: Answer; onCitation: (evidence: Evidence) => void }) {
  if (!answer.citations.length) return null;
  return (
    <nav className="citation-controls" aria-label="Answer citations">
      {answer.citations.map((citation, index) => {
        const evidence = evidenceForCitation(answer, index);
        if (!evidence) return null;
        const page = citation.pageLabel ?? evidence.pageLabel ?? citation.page;
        return <button key={`${citation.evidenceId}-${index}`} onClick={() => onCitation(evidence)} aria-label={`Open citation ${index + 1}, ${citation.sourceTitle}, page ${page}`}><span>[{index + 1}]</span> {citation.sourceTitle} · p. {page}</button>;
      })}
    </nav>
  );
}

/** Long questions get a smaller heading so they do not fill a phone screen. */
function questionSize(question: string): string | undefined {
  if (question.length > 320) return "question-very-long";
  if (question.length > 180) return "question-long";
  if (question.length > 90) return "question-medium";
  return undefined;
}

export function AnswerView({ status, answer, loadingQuestion, loadingStep, onCitation, onShowEvidence }: AnswerViewProps) {
  const [dismissedFallbackKey, setDismissedFallbackKey] = useState<string>();
  const fallbackKey = answer?.fallback ? answer.messageId ?? `${answer.conversationId ?? ""}:${answer.question}:${answer.text}` : "";

  if (status === "idle") return (
    <div className="welcome-state">
      <div className="welcome-mark" aria-hidden="true"><BookIcon /></div>
      <h1>Ask your textbooks</h1>
      <p>Search your course textbooks and get a concise answer tied to the exact pages that support it.</p>
      <p className="prompt-ideas">Try asking “What makes a professional commitment?” or “How does virtual memory work?”</p>
    </div>
  );

  if (status === "loading") return (
    <article className="answer-article" aria-live="polite">
      <h1 className={questionSize(loadingQuestion)}>{loadingQuestion}</h1><hr />
      <div className="loading-answer">
        <div className="loading-symbol" aria-hidden="true"><span /><span /><span /></div>
        <h2>{loadingStep}</h2>
        <div className="skeleton long" /><div className="skeleton" /><div className="skeleton short" />
      </div>
    </article>
  );

  if (!answer) return null;

  return (
    <>
      {answer.fallback && dismissedFallbackKey !== fallbackKey && <div className="fallback-banner" role="status"><AlertIcon /><span><strong>NVIDIA unavailable</strong> — answered by Ollama</span><button type="button" className="icon-button fallback-dismiss" onClick={() => setDismissedFallbackKey(fallbackKey)} aria-label="Dismiss fallback notice"><CloseIcon /></button></div>}
      {answer.retrievalFallback && <div className="retrieval-fallback-banner" role="status"><AlertIcon /><span><strong>Local model unavailable</strong> — using textbook keyword search for this request.</span></div>}
      <article className="answer-article">
        <h1 className={questionSize(answer.question)}>{answer.question}</h1>
        {answer.selectAllThatApply && <p className="answer-mode-note" role="status"><strong>Select all that apply mode</strong><span>Multiple correct answers may be included.</span></p>}
        <hr />
        {answer.status === "insufficient_evidence" ? (
          <div className="insufficient-state">
            <span className="insufficient-mark" aria-hidden="true">?</span>
            <h2>I couldn’t find support for that in the selected textbooks.</h2>
            <p>Try rephrasing the question or widening the selected course and textbook scope. No generation provider was called.</p>
          </div>
        ) : answer.status === "provider_abstention" ? (
          <div className="insufficient-state provider-abstention">
            <span className="insufficient-mark" aria-hidden="true">!</span>
            <h2>{answer.actualProvider?.toUpperCase() ?? "The selected provider"} could not produce a grounded answer from the retrieved passages.</h2>
            <p>The provider was called, but its response was an abstention. Try rephrasing the question or inspect the retrieved textbook evidence.</p>
            {answer.evidence.length > 0 && <button type="button" className="show-evidence" onClick={onShowEvidence}><BookIcon /> Inspect retrieved evidence ({answer.evidence.length}) <ChevronIcon className="chevron-down" /></button>}
          </div>
        ) : answer.status === "error" ? (
          <div className="error-state" role="alert"><AlertIcon /><div><h2>Couldn’t answer</h2><p className="error-message">{answer.error}</p><p>Your question is still here. Check the provider or try again.</p></div></div>
        ) : (
          <>
            <h2 className="sr-only">Answer</h2>
            <div className="answer-copy"><AnswerText answer={answer} onCitation={onCitation} /></div>
            <CitationControls answer={answer} onCitation={onCitation} />
            <div className="provider-result"><span className={`provider-dot ${answer.actualProvider ?? "unknown"}`} /> Answered by <strong>{answer.actualProvider?.toUpperCase() ?? "the selected provider"}</strong>{answer.fallback && <span className="fallback-note"> after automatic fallback</span>}</div>
            <button type="button" className="show-evidence" onClick={onShowEvidence}><BookIcon /> Show textbook evidence ({answer.evidence.length}) <ChevronIcon className="chevron-down" /></button>
          </>
        )}
      </article>
    </>
  );
}
