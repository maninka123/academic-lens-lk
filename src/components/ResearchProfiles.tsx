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
      url: find((host) => /^scholar\.google\.[a-z.]+$/i.test(host)),
    },
    {
      label: "ResearchGate",
      url: find((host) => /^(www\.)?researchgate\.net$/i.test(host)),
    },
  ];
}

export function ResearchProfiles({ academic }: { academic: Academic }) {
  return (
    <Card title="Research profiles">
      <p className="muted">
        Open the recorded profiles to check affiliation, publications and
        metrics. Each platform may report different counts.
      </p>
      <div className="research-profile-links">
        {researchProfileLinks(academic).map(({ label, url }) => (
          <div key={label}>
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
                {label} <span className="muted">· Not recorded</span>
              </span>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}
