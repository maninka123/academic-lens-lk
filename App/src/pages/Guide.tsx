import { Fragment, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { Header } from "../components/common";
import guideSource from "../../docs/HOW_TO_INTERPRET_DATA.md?raw";

/** The guide lives in one Markdown file (readable on GitHub); this page renders that same file in the app. */
/** Annotated example images shown in the guide (bundled by Vite, so they need no public-data entry). */
const GUIDE_IMAGES = import.meta.glob("../../docs/guide/*.png", { eager: true, query: "?url", import: "default" }) as Record<string, string>;
const imageSrc = (path: string) => GUIDE_IMAGES["../../docs/" + path] ?? "";

/** "✓ Means", "✕ Does not mean" and "What to do" lines get their own styling. */
const itemClass = (t: string) => (t.startsWith("**✓") ? "guide-means" : t.startsWith("**✕") ? "guide-not" : t.startsWith("**What to do") ? "guide-do" : undefined);

const DOCS_URL = "https://github.com/maninka123/academic-lens-lk/blob/main/App/docs/";

/** Relative links in the Markdown point at sibling docs; in the app they open the file on GitHub. */
const hrefOf = (h: string) => (/^(https?:|#|\/)/.test(h) ? h : DOCS_URL + h);

/** Bold, italics, code and links: all this guide needs. */
function inline(text: string): ReactNode[] {
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\)|\*[^*]+\*)/g);
  return parts.map((p, i) => {
    let m: RegExpMatchArray | null;
    if ((m = p.match(/^\*\*([^*]+)\*\*$/))) return <strong key={i}>{m[1]}</strong>;
    if ((m = p.match(/^`([^`]+)`$/))) return <code key={i}>{m[1]}</code>;
    if ((m = p.match(/^\[([^\]]+)\]\(([^)]+)\)$/)))
      return (
        <a key={i} href={hrefOf(m[2])} target="_blank" rel="noopener noreferrer">
          {m[1]}
        </a>
      );
    if ((m = p.match(/^\*([^*]+)\*$/))) return <em key={i}>{m[1]}</em>;
    return <Fragment key={i}>{p}</Fragment>;
  });
}

/** Headings (## ), paragraphs, bullet lists (- ) and numbered lists (1. ); the "# " title is the page heading. */
export function renderGuide(markdown: string): ReactNode[] {
  const out: ReactNode[] = [];
  let para: string[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const flush = () => {
    if (para.length) out.push(<p key={out.length}>{inline(para.join(" "))}</p>);
    if (list) {
      const items = list.items.map((t, i) => <li key={i} className={itemClass(t)}>{inline(t)}</li>);
      out.push(list.ordered ? <ol key={out.length}>{items}</ol> : <ul key={out.length}>{items}</ul>);
    }
    para = [];
    list = null;
  };
  for (const raw of markdown.split("\n")) {
    const line = raw.trimEnd();
    let m: RegExpMatchArray | null;
    if (!line.trim()) flush();
    else if ((m = line.match(/^!\[([^\]]*)\]\(([^)]+)\)$/))) {
      flush();
      out.push(
        <figure key={out.length} className="guide-figure">
          <img src={imageSrc(m[2])} alt={m[1]} loading="lazy" />
        </figure>,
      );
    }
    else if (line.startsWith("# ")) flush();
    else if ((m = line.match(/^### (.+)$/))) {
      flush();
      out.push(<h3 key={out.length}>{m[1]}</h3>);
    } else if ((m = line.match(/^## (.+)$/))) {
      flush();
      out.push(<h2 key={out.length}>{m[1]}</h2>);
    } else if ((m = line.match(/^(?:- |(\d+)\. )(.+)$/))) {
      const ordered = Boolean(m[1]);
      if (para.length || (list && list.ordered !== ordered)) flush();
      list ??= { ordered, items: [] };
      list.items.push(m[2]);
    } else {
      if (list) flush();
      para.push(line.trim());
    }
  }
  flush();
  return out;
}

export function Guide() {
  return (
    <>
      <Header
        eyebrow="Plain-English guide"
        title="How to interpret the data"
        description="What the numbers mean, what they cannot tell you, and how to use them responsibly."
      />
      <section className="card guide-prose" aria-label="Guide to interpreting the data">
        {renderGuide(guideSource)}
        <p className="guide-more">
          <Link className="text-link" to="/methodology">Data &amp; Methodology</Link>
        </p>
      </section>
    </>
  );
}
