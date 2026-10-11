import { ExternalLink } from "lucide-react";
import type { Academic } from "../types";
import { Card } from "./common";

export function researchProfileLinks(academic: Academic) {
  const candidates = [
    academic.scholarUrl,
    academic.researchgateUrl,
    academic.metricsUrl,
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
  ];
}

export function ResearchProfiles({ academic }: { academic: Academic }) {
  return (
    <Card title="Sources">
      <div className="research-profile-links">
        {academic.sourceUrl && (
          <a
            className="text-link"
            href={academic.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            Official academic source <ExternalLink size={18} />
          </a>
        )}
        {researchProfileLinks(academic).map(({ label, url, status }) => (
          <div key={label}>
            <div>
              {url ? (
                <a
                  className="text-link"
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {label}
                  <ExternalLink size={18} />
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
              {url && (
                <p className="caption">
                  {status === "verified_official_link"
                    ? "Linked from an official profile"
                    : status === "matched_user_supplied_platform_evidence"
                      ? "Matched using supplied platform evidence"
                      : status?.includes("requires_review")
                        ? "Identity needs review — check the recorded evidence"
                        : "Recorded link — identity not independently verified"}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
