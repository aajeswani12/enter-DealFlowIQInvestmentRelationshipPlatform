export function cleanMemoForReading(content: string): string {
  return content
    .replace(/```[\s\S]*?```/g, (block) => block.replace(/```(?:json|markdown)?/gi, ""))
    .replace(/\bclaims?\s*(?:`?[0-9a-f]{8}-[0-9a-f-]{27,}`?)(?:\s*and\s*`?[0-9a-f]{8}-[0-9a-f-]{27,}`?)?\s*;?\s*/gi, "")
    .replace(/`[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}`/gi, "")
    .replace(/`[0-9a-f-]{36}`/gi, "")
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/gi, "")
    .replace(/[`*]+/g, (marker) => (marker === "**" ? marker : ""))
    .replace(/\(\s*;\s*/g, "(")
    .replace(/\(\s*\)/g, "")
    .replace(/^.*(?:synthetic case|fictional|demo data|test data).*$/gim, "")
    .replace(/\s*\((?:synthetic|fictional)\)/gi, "")
    .replace(/^\[?To be completed by an authorized investment professional[^\]]*\]?\s*$/gim, "")
    .replace(/^.*human investment assessment.*$/gim, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

