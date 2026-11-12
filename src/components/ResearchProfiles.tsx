import { ExternalLink } from "lucide-react";
import type { Academic } from "../types";

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
  const links = researchProfileLinks(academic);
  return (
    <section className="dossier-sources" aria-label="Sources">
      <h2>Sources</h2>
      <div className="source-chips">
        {academic.sourceUrl && (
          <span className="source-chip verified">
            <i className="source-dot" aria-hidden="true" />
            <a href={academic.sourceUrl} target="_blank" rel="noopener noreferrer">
              Official academic source <ExternalLink size={13} aria-hidden="true" />
            </a>
            <span className="source-note">Staff page</span>
          </span>
        )}
        {links.map(({ label, url, status }) =>
          url ? (
            <span key={label} className={"source-chip " + statusTone(status)}>
              <i className="source-dot" aria-hidden="true" />
              <a href={url} target="_blank" rel="noopener noreferrer">
                {label}
                <ExternalLink size={13} aria-hidden="true" />
              </a>
              <span className="source-note">{statusNote(status)}</span>
            </span>
          ) : (
            <span key={label} className="source-chip is-missing">
              <i className="source-dot" aria-hidden="true" />
              {label}{" "}
              <span className="source-note">
                {status === "rejected_different_person" ? "Rejected identity match" : "Not recorded"}
              </span>
            </span>
          ),
        )}
      </div>
    </section>
  );
}
