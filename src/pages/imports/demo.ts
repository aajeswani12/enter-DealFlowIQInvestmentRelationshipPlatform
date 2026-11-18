import type { ImportFileType } from "@/lib/types";

export interface DemoImportFile {
  name: string;
  path: string;
  type: ImportFileType;
  mime: string;
}

/** Clearly synthetic, text-extractable fixtures served from /import-samples. */
export const MUSEFLOW_DEMO_FILES: DemoImportFile[] = [
  {
    name: "museflow-deal-memo.pdf",
    path: "/import-samples/museflow-deal-memo.pdf",
    type: "pdf",
    mime: "application/pdf",
  },
  {
    name: "museflow-financials.csv",
    path: "/import-samples/museflow-financials.csv",
    type: "csv",
    mime: "text/csv",
  },
  {
    name: "museflow-investors.csv",
    path: "/import-samples/museflow-investors.csv",
    type: "csv",
    mime: "text/csv",
  },
  {
    name: "museflow-meeting-notes.docx",
    path: "/import-samples/museflow-meeting-notes.docx",
    type: "docx",
    mime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  },
  {
    name: "museflow-historical-email.eml",
    path: "/import-samples/museflow-historical-email.eml",
    type: "email",
    mime: "message/rfc822",
  },
];

export const MUSEFLOW_FOLLOWUP_FILE: DemoImportFile = {
  name: "museflow-followup-transcript.txt",
  path: "/import-samples/museflow-followup-transcript.txt",
  type: "txt",
  mime: "text/plain",
};

export async function fetchDemoFile(definition: DemoImportFile): Promise<File> {
  const response = await fetch(definition.path);
  if (!response.ok) throw new Error(`Could not load demo file ${definition.name} (${response.status}).`);
  const blob = await response.blob();
  return new File([blob], definition.name, { type: definition.mime });
}
