import { ExternalLink } from "lucide-react";
import type { Academic } from "../types";
import { Card } from "./common";

export function researchProfileLinks(academic: Academic) {
  const candidates = [
    academic.scholarUrl,
    academic.researchgateUrl,
    academic.metricsUrl,
    academic.openAlexUrl,
    ...(academic.metricEvidence || []).map((e) => e.url),
  ];
  const find = (matches: (host: string) => boolean) => {
    for (const candidate of candidates) {
      if (!candidate) continue;
      try {
        const url = new URL(candidate.trim());
        if (["https:", "http:"].includes(url.protocol) && matches(url.hostname))
          return url.href;
      } catch {
        /* Missing or invalid URLs are unavailable. */
      }
    }
    return undefined;
  };
  return [
    {
      label: "Google Scholar",
      url:
        academic.scholarStatus === "rejected_different_person"
          ? undefined
          : find((host) => /^scholar\.google\.[a-z.]+$/i.test(host)),
      status: academic.scholarStatus,
    },
    {
      label: "ResearchGate",
      url:
        academic.researchgateStatus === "rejected_different_person"
          ? undefined
          : find((host) => /^(www\.)?researchgate\.net$/i.test(host)),
      status: academic.researchgateStatus,
    },
    {
      label: "OpenAlex",
      url: find((host) => /^(api\.)?openalex\.org$/i.test(host)),
      status: "openalex_source",
    },
  ];
}

const statusNote = (status?: string) =>
  status === "openalex_source"
    ? "Saved author lookup"
    : status === "verified_official_link"
      ? "Official link"
      : status === "matched_user_supplied_platform_evidence"
        ? "Identity matched"
        : status?.includes("requires_review")
          ? "Identity needs review"
          : "Unverified link";
const statusTone = (status?: string) =>
  status === "verified_official_link" ||
  status === "matched_user_supplied_platform_evidence"
    ? "verified"
    : status?.includes("requires_review")
      ? "review"
      : "recorded";

export function ResearchProfiles({ academic }: { academic: Academic }) {
  return (
    <Card title="Sources" className="sources-card">
      <div className="research-profile-links source-tiles">
        {academic.sourceUrl && (
          <div className="source-tile verified">
            <a
              className="text-link"
              href={academic.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              Official academic source <ExternalLink size={16} />
            </a>
            <p className="caption">Staff page</p>
          </div>
        )}
        {researchProfileLinks(academic).map(({ label, url, status }) => (
          <div
            key={label}
            className={"source-tile " + (url ? statusTone(status) : "missing")}
          >
            {url ? (
              <a
                className="text-link"
                href={url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {label}
                <ExternalLink size={16} />
              </a>
            ) : (
              <span>
                {label}{" "}
                <span className="muted">
                  ·{" "}
                  {status === "rejected_different_person"
                    ? "Rejected identity match"
                    : "Not recorded"}
                </span>
              </span>
            )}
            {url && <p className="caption">{statusNote(status)}</p>}
          </div>
        ))}
      </div>
    </Card>
  );
}
