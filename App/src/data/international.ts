import Papa from "papaparse";
import type { Academic } from "../types";

export const benchmarkFields = ["Computer Science", "Physics", "Medicine", "Engineering", "Law", "Management", "Business"] as const;
export const defaultBenchmarkFields: readonly string[] = ["Computer Science", "Physics"];
export type BenchmarkField = (typeof benchmarkFields)[number];

export type Tier = "elite" | "middle" | "lower";
export const tierLabels: Record<Tier, string> = {
  elite: "Elite (QS top 150)",
  middle: "Middle (QS ~420–560)",
  lower: "Lower (QS ~800–1200)",
};
export const tierColors: Record<Tier | "sri-lanka", string> = {
  elite: "#9a5b08",
  middle: "#d99a2b",
  lower: "#f0cc85",
  "sri-lanka": "#5d6cf0",
};
export type BenchmarkAcademic = {
  id: string;
  name: string;
  universityId: string;
  university: string;
  universityShort: string;
  country: string;
  tier: Tier;
  qsRank: string;
  type: string;
  faculty: string;
  department: string;
  field: string;
  /** "department", "research-lab" or "proxy" (stand-in for a missing discipline). */
  unitType: string;
  position: string;
  employmentStatus: string;
  includedInBenchmarks: string;
  rank: string;
  careerStage: string;
  doctorateStatus: string;
  qualification: string;
  qualifications: string;
  interests: string;
  scholarUrl: string;
  researchgateUrl: string;
  researchProfileUrl: string;
  orcidUrl: string;
  listedPublicationCount: number | null;
  publicationScope: string;
  profileCheckedAt: string;
  phdYear: number | null;
  phdStatus: string;
  collectionDate: string;
  phdUniversity: string;
  phdCountry: string;
  publications: number | null;
  citations: number | null;
  recentCitations: number | null;
  hIndex: number | null;
  metricsSource: string;
  metricsUrl: string;
  lookupStatus: string;
  sourceUrl: string;
};
export type BenchmarkUniversity = {
  id: string;
  name: string;
  short: string;
  country: string;
  type: string;
  qsRank: string;
  tier: Tier;
  records: number;
  substitution: string;
};
export type SlOpenAlex = {
  id: string;
  publications: number | null;
  citations: number | null;
  recentCitations: number | null;
  hIndex: number | null;
  status: string;
};
export type Benchmarks = {
  academics: BenchmarkAcademic[];
  slOpenAlex: Map<string, SlOpenAlex>;
  universities: BenchmarkUniversity[];
  metadata: {
    qsEdition: string;
    collectionDate: string;
    sriLankaQs: Record<string, string>;
    metricSource: string;
  };
};

let cache: Promise<Benchmarks> | null = null;
export function loadBenchmarks(): Promise<Benchmarks> {
  cache ??= (async () => {
    const dir = import.meta.env.BASE_URL + "data/international/";
    const text = async (n: string) => {
      const r = await fetch(dir + n + "?v=" + import.meta.env.VITE_DATA_REVISION, { cache: "no-store" });
      if (!r.ok) throw Error(`Cannot load international ${n} (${r.status}).`);
      return r.text();
    };
    const parse = (s: string) =>
      Papa.parse<Record<string, string>>(s, {
        header: true,
        skipEmptyLines: true,
      }).data;
    const [a, u, m, sl] = await Promise.all([
      text("academics.csv"),
      text("universities.csv"),
      text("metadata.json"),
      text("sri_lanka_openalex.csv").catch(() => ""),
    ]);
    const num = (v: string) => (v?.trim() ? Number(v) : null);
    return {
      academics: parse(a).filter((r) => r.includedInBenchmarks !== "false").map((r) => ({
        ...(r as any),
        listedPublicationCount: num(r.listedPublicationCount),
        phdYear: num(r.phdYear),
        publications: num(r.publications),
        citations: num(r.citations),
        recentCitations: num(r.recentCitations),
        hIndex: num(r.hIndex),
      })),
      slOpenAlex: new Map(
        (sl ? parse(sl) : []).map((r) => [
          r.id,
          {
            id: r.id,
            status: r.status,
            publications: num(r.publications),
            citations: num(r.citations),
            recentCitations: num(r.recentCitations),
            hIndex: num(r.hIndex),
          },
        ]),
      ),
      universities: parse(u).map((r) => ({
        ...(r as any),
        records: Number(r.records),
      })),
      metadata: JSON.parse(m),
    };
  })();
  cache.catch(() => (cache = null));
  return cache;
}

/** Approximate numeric position of a QS rank or band, for ordering and scatter plots. */
export function qsNumeric(rank: string | undefined) {
  if (!rank) return null;
  const r = rank.replace("=", "").replace("+", "");
  const band = r.match(/^(\d+)\s*-\s*(\d+)$/);
  if (band) return (Number(band[1]) + Number(band[2])) / 2;
  return Number.isFinite(Number(r)) ? Number(r) : null;
}

/** Sri Lankan academics in the same disciplines as the sampled baseline departments. */
export function matchedField(a: Pick<Academic, "department" | "faculty">) {
  const unit = `${a.department || ""} ${a.faculty || ""}`;
  // Units that are not the discipline itself: language teaching and IT service centres stay out of every benchmark field.
  if (/english|language|linguist|services? cent(re|er)|centre for information technology|computer unit/i.test(a.department || "")) return "";
  // Every unit of a faculty of medicine is Medicine (for example Anatomy, Genetics and Biomedical Informatics), never Computer Science.
  if (/faculty of medicine|medical sciences/i.test(a.faculty || "") && !/allied health|nursing|health sciences|dental|indigenous|siddha|ayurved/i.test(a.faculty || "")) return "Medicine";
  if (/physics/i.test(a.department || "")) return "Physics";
  if (
    /comput|information technology|software|data science|\bIT\b|informatics/i.test(
      unit,
    )
  )
    return "Computer Science";
  // Medicine means a faculty of medicine; allied health, nursing, health-science and indigenous-medicine faculties are not benchmarked as Medicine.
  if (/allied health|nursing|health sciences|dental|indigenous|siddha|ayurved/i.test(a.faculty || "")) return "";
  if (/medicine|medical|clinical|surgery|paediatric|pediatric|pathology|anatomy|physiology|pharmacology|public health/i.test(unit)) return "Medicine";
  if (/\blaw\b|legal|jurisprudence/i.test(unit)) return "Law";
  if (/engineering/i.test(unit)) return "Engineering";
  if (/management|organizational behavio|organisational behavio|human resource/i.test(a.department || "")) return "Management";
  if (/business|commerce|accounting|finance|marketing|economics/i.test(unit)) return "Business";
  if (/management/i.test(unit)) return "Management";
  return "";
}

/** Load the source-listed bibliography separately from metric benchmarks. */
export async function loadBenchmarkPublications(academicId: string) {
  const response = await fetch(import.meta.env.BASE_URL + "data/international/publications.csv?v=" + import.meta.env.VITE_DATA_REVISION);
  if (!response.ok) throw Error(`Cannot load international bibliography (${response.status}).`);
  return Papa.parse<Record<string, string>>(await response.text(), { header: true, skipEmptyLines: true }).data.filter((publication) => publication.academicId === academicId);
}

/**
 * How many times lower or higher the Sri Lankan median is than a tier median.
 * Lower: tier median / Sri Lankan median. Higher: Sri Lankan median / tier median.
 * `reason` explains an unavailable ratio (a missing value, or a zero that cannot be a divisor).
 */
export function tierDifference(sri: number | null, tier: number | null) {
  const none = (reason: string) => ({ kind: "none", value: "n/a", word: "", reason, ratio: 0 });
  if (sri === null || tier === null) return none("missing");
  if (sri === tier) return { kind: "same", value: "1×", word: "equal", reason: "", ratio: 1 };
  if (sri === 0) return none("sri-zero");
  if (tier === 0) return none("zero");
  const lower = tier > sri;
  const ratio = lower ? tier / sri : sri / tier;
  const text = ratio < 1.005 ? "<1.01" : String(Number(ratio.toFixed(2)));
  return { kind: lower ? "lower" : "higher", value: `${text}×`, word: lower ? "lower" : "higher", reason: "", ratio };
}
