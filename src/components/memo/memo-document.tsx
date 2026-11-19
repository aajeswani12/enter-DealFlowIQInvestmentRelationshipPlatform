import type { ReactNode } from "react";
import { cleanMemoForReading } from "@/lib/memo-format";

/** Remove implementation artifacts that should never be part of the visible memo document. */

function renderInline(text: string): ReactNode[] {
  const chunks = text.split(/(\*\*[^*]+\*\*|_[^_]+_)/g);
  return chunks.filter(Boolean).map((chunk, index) => {
    if (chunk.startsWith("**") && chunk.endsWith("**")) {
      return <strong key={index} className="font-semibold text-foreground">{chunk.slice(2, -2)}</strong>;
    }
    if (chunk.startsWith("_") && chunk.endsWith("_")) {
      return <em key={index} className="text-muted-foreground">{chunk.slice(1, -1)}</em>;
    }
    return <span key={index}>{chunk}</span>;
  });
}

function isBlockStart(line: string): boolean {
  return /^\s*(#{1,6}\s+|[-*]\s+|\d+\.\s+)/.test(line);
}

export function MemoDocument({ content }: { content: string }) {
  const cleaned = cleanMemoForReading(content);
  const showAssessment = /human investment assessment|to be completed by an authorized investment professional/i.test(content);
  const lines = cleaned.split("\n");
  const blocks: ReactNode[] = [];
  let list: string[] = [];
  let paragraph: string[] = [];

  const flushList = () => {
    if (list.length > 0) {
      blocks.push(
        <ul key={`list-${blocks.length}`} className="my-2 list-disc space-y-1.5 pl-6 text-[17px] leading-[1.5]">
          {list.map((item, index) => <li key={`${item}-${index}`}>{renderInline(item)}</li>)}
        </ul>,
      );
      list = [];
    }
  };
  const flushParagraph = () => {
    if (paragraph.length > 0) {
      blocks.push(<p key={`p-${blocks.length}`} className="my-2 text-[17px] leading-[1.5]">{renderInline(paragraph.join(" "))}</p>);
      paragraph = [];
    }
  };

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!line.trim()) {
      flushList();
      flushParagraph();
      continue;
    }
    const heading = line.match(/^\s*(#{1,6})\s+(.*)$/);
    if (heading) {
      flushList();
      flushParagraph();
      const level = heading[1].length;
      const text = heading[2];
      blocks.push(
        level <= 2
          ? <h2 key={`h-${blocks.length}`} className="mt-5 mb-2 text-[21px] font-semibold tracking-tight text-foreground first:mt-0">{renderInline(text)}</h2>
          : <h3 key={`h-${blocks.length}`} className="mt-4 mb-1.5 text-[18px] font-semibold tracking-tight text-foreground">{renderInline(text)}</h3>,
      );
      continue;
    }
    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    if (bullet) {
      flushParagraph();
      list.push(bullet[1]);
      continue;
    }
    const numbered = line.match(/^\s*\d+\.\s+(.*)$/);
    if (numbered) {
      flushParagraph();
      list.push(numbered[1]);
      continue;
    }
    if (isBlockStart(line)) {
      flushList();
      flushParagraph();
    }
    paragraph.push(line.trim());
    const next = lines[index + 1] ?? "";
    if (!next.trim() || isBlockStart(next) || /^\s*#{1,6}\s+/.test(next) || /^\s*[-*]\s+/.test(next)) {
      flushParagraph();
    }
  }
  flushList();
  flushParagraph();

  if (blocks.length === 0) {
    return <p className="rounded-lg border border-dashed border-border bg-card px-4 py-6 text-[17px] text-muted-foreground">No memo text yet.</p>;
  }

  return (
    <article className="memo-document min-h-[360px] max-w-[78ch] text-[17px] leading-[1.5]" aria-label="Memo document">
      {blocks}
      {showAssessment ? (
        <section className="mt-6 rounded-lg border border-brand/25 bg-brand-soft/30 p-4">
          <h2 className="text-[21px] font-semibold tracking-tight text-foreground">Human Investment Assessment</h2>
          <p className="mt-1 text-[17px] italic leading-[1.5] text-muted-foreground">To be completed by an authorized investment professional. This section is not AI-generated.</p>
        </section>
      ) : null}
    </article>
  );
}
