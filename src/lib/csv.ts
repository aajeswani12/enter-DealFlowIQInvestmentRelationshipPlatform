export interface InvestorImportRow {
  name: string;
  investor_type: string;
  thesis: string;
  sectors: string[];
  stages: string[];
  geography: string[];
  minimum_check: number | null;
  maximum_check: number | null;
  currency: string;
  status: string;
  notes: string;
  contact_name: string;
  title: string;
  email: string;
  relationship_owner: string;
  relationship_strength: string;
  outreach_permission_status: string;
}

export interface ImportRowError {
  row: number;
  message: string;
}

const HEADER_ALIASES: Record<string, string> = {
  name: "name",
  investor: "name",
  firm: "name",
  firm_name: "name",
  investor_name: "name",
  investor_type: "investor_type",
  type: "investor_type",
  thesis: "thesis",
  sectors: "sectors",
  sector: "sectors",
  stages: "stages",
  stage: "stages",
  geography: "geography",
  geographies: "geography",
  regions: "geography",
  minimum_check: "minimum_check",
  min_check: "minimum_check",
  check_min: "minimum_check",
  maximum_check: "maximum_check",
  max_check: "maximum_check",
  check_max: "maximum_check",
  currency: "currency",
  status: "status",
  notes: "notes",
  contact_name: "contact_name",
  contact: "contact_name",
  title: "title",
  email: "email",
  relationship_owner: "relationship_owner",
  relationship_strength: "relationship_strength",
  outreach_permission_status: "outreach_permission_status",
  outreach_permission: "outreach_permission_status",
};

const INVESTOR_TYPES = ["vc", "angel", "family_office", "corporate"];
const INVESTOR_STATUSES = ["active", "prospect", "watchlist", "archived"];
const STRENGTHS = ["unknown", "weak", "warm", "strong"];
const PERMISSIONS = ["unknown", "permitted", "requires_intro", "do_not_contact"];

/** Minimal RFC4180-style parser: quoted fields, escaped quotes, CRLF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (quoted) {
      if (char === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          quoted = false;
        }
      } else {
        field += char;
      }
      continue;
    }

    if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (char === "\r") {
      // ignore, handled by \n
    } else {
      field += char;
    }
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  return rows.filter((cells) => cells.some((cell) => cell.trim() !== ""));
}

function splitList(value: string): string[] {
  return value
    .split(/[;|]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseAmount(value: string): number | null {
  if (!value) return null;
  const cleaned = value.replace(/[$,\s]/g, "");
  if (!cleaned) return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

export function buildInvestorImport(text: string): {
  rows: InvestorImportRow[];
  errors: ImportRowError[];
  total: number;
} {
  const matrix = parseCsv(text.replace(/^\uFEFF/, ""));
  if (matrix.length === 0) {
    return { rows: [], errors: [{ row: 0, message: "The file is empty." }], total: 0 };
  }

  const headers = matrix[0].map((header) => {
    const normalized = header.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "");
    return HEADER_ALIASES[normalized] ?? normalized;
  });

  const nameIndex = headers.indexOf("name");
  if (nameIndex === -1) {
    return { rows: [], errors: [{ row: 1, message: "A 'name' column is required." }], total: 0 };
  }

  const rows: InvestorImportRow[] = [];
  const errors: ImportRowError[] = [];
  const seen = new Set<string>();

  matrix.slice(1).forEach((cells, index) => {
    const rowNumber = index + 2;
    const record: Record<string, string> = {};
    headers.forEach((header, columnIndex) => {
      record[header] = (cells[columnIndex] ?? "").trim();
    });

    const name = record.name ?? "";
    if (!name) {
      errors.push({ row: rowNumber, message: "Missing investor name." });
      return;
    }
    if (name.length > 200) {
      errors.push({ row: rowNumber, message: "Investor name is longer than 200 characters." });
      return;
    }
    const key = name.toLowerCase();
    if (seen.has(key)) {
      errors.push({ row: rowNumber, message: `Duplicate investor name in this file: ${name}.` });
      return;
    }
    seen.add(key);

    const investorType = (record.investor_type || "vc").toLowerCase();
    if (!INVESTOR_TYPES.includes(investorType)) {
      errors.push({ row: rowNumber, message: `Unknown investor type "${record.investor_type}". Use vc, angel, family_office or corporate.` });
      return;
    }

    const status = (record.status || "active").toLowerCase();
    if (!INVESTOR_STATUSES.includes(status)) {
      errors.push({ row: rowNumber, message: `Unknown status "${record.status}". Use active, prospect, watchlist or archived.` });
      return;
    }

    const minimum = parseAmount(record.minimum_check ?? "");
    const maximum = parseAmount(record.maximum_check ?? "");
    if ((record.minimum_check && minimum === null) || (record.maximum_check && maximum === null)) {
      errors.push({ row: rowNumber, message: "Cheque amounts must be numbers." });
      return;
    }
    if (minimum !== null && minimum < 0) {
      errors.push({ row: rowNumber, message: "Minimum cheque cannot be negative." });
      return;
    }
    if (minimum !== null && maximum !== null && minimum > maximum) {
      errors.push({ row: rowNumber, message: "Minimum cheque is greater than the maximum." });
      return;
    }

    const email = (record.email ?? "").toLowerCase();
    if (email && (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) || email.length > 254)) {
      errors.push({ row: rowNumber, message: `Invalid email address: ${record.email}.` });
      return;
    }

    const strength = (record.relationship_strength || "unknown").toLowerCase();
    if (!STRENGTHS.includes(strength)) {
      errors.push({ row: rowNumber, message: `Unknown relationship strength "${record.relationship_strength}".` });
      return;
    }

    const permission = (record.outreach_permission_status || "unknown").toLowerCase();
    if (!PERMISSIONS.includes(permission)) {
      errors.push({ row: rowNumber, message: `Unknown outreach permission "${record.outreach_permission_status}".` });
      return;
    }

    rows.push({
      name,
      investor_type: investorType,
      thesis: record.thesis ?? "",
      sectors: splitList(record.sectors ?? ""),
      stages: splitList(record.stages ?? ""),
      geography: splitList(record.geography ?? ""),
      minimum_check: minimum,
      maximum_check: maximum,
      currency: (record.currency || "USD").toUpperCase(),
      status,
      notes: record.notes ?? "",
      contact_name: record.contact_name ?? "",
      title: record.title ?? "",
      email,
      relationship_owner: record.relationship_owner ?? "",
      relationship_strength: strength,
      outreach_permission_status: permission,
    });
  });

  return { rows, errors, total: matrix.length - 1 };
}
