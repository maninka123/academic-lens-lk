import { expect, it } from "vitest";
import { qualificationLines } from "./qualification-lines";

it("puts each degree on its own line", () => {
  expect(
    qualificationLines("MBBS 1994 Bachelor of Medicine, Bachelor of Surgery Kasturba Medical College, Manipal, India."),
  ).toEqual(["MBBS 1994 Bachelor of Medicine", "Bachelor of Surgery Kasturba Medical College, Manipal, India"]);
  expect(qualificationLines("MBBS (Peradeniya) MD Forensic Medicine (Colombo) DipRCPath (UK)")).toEqual([
    "MBBS (Peradeniya)",
    "MD Forensic Medicine (Colombo)",
    "DipRCPath (UK)",
  ]);
});
it("keeps commas inside brackets and institution names together", () => {
  expect(qualificationLines("PhD (Reading, Ruhuna), BScEng (Hons) (Ruhuna)")).toEqual([
    "PhD (Reading, Ruhuna)",
    "BScEng (Hons) (Ruhuna)",
  ]);
  expect(qualificationLines("PhD, University of Colombo, Sri Lanka")).toEqual(["PhD, University of Colombo, Sri Lanka"]);
});
it("splits on semicolons and shortens very long entries", () => {
  const lines = qualificationLines("BSc (Hons); MSc " + "Advanced Studies ".repeat(12));
  expect(lines[0]).toBe("BSc (Hons)");
  expect(lines[1].length).toBeLessThanOrEqual(97);
  expect(lines[1].endsWith("…")).toBe(true);
});
it("returns nothing for empty text", () => {
  expect(qualificationLines("")).toEqual([]);
  expect(qualificationLines(null)).toEqual([]);
});

it("joins pipe-separated details and drops trailing research-interest text", () => {
  expect(qualificationLines("PhD | University of Pittsburgh | 1991; MSc | University of Pittsburgh | 1989")).toEqual([
    "PhD, University of Pittsburgh, 1991",
    "MSc, University of Pittsburgh, 1989",
  ]);
  expect(qualificationLines("MBBS (Peradeniya, 2006) PhD (CUHK, 2015) Research interests Main research interests are x")).toEqual([
    "MBBS (Peradeniya, 2006)",
    "PhD (CUHK, 2015)",
  ]);
  expect(qualificationLines("BA (Hons) in English (Peradeniya), Reading for PhD (Kings College, London)")).toEqual([
    "BA (Hons) in English (Peradeniya)",
    "Reading for PhD (Kings College, London)",
  ]);
});

it("splits entries that run together without any separator", () => {
  expect(
    qualificationLines("PhD in Civil Engineering from Saitama University, Japan (2008) M. Eng in Structural Engineering from Saitama University, Japan (2005)"),
  ).toEqual([
    "PhD in Civil Engineering from Saitama University, Japan (2008)",
    "M. Eng in Structural Engineering from Saitama University, Japan (2005)",
  ]);
  expect(qualificationLines("Ph.D. in Structural Engineering, Ehime University, Japan M.Sc. in Earthquake Engineering, ROSE School, Italy")).toEqual([
    "Ph.D. in Structural Engineering, Ehime University, Japan",
    "M.Sc. in Earthquake Engineering, ROSE School, Italy",
  ]);
  expect(qualificationLines("BA (Hons), Reading for PhD (Kings College, London)")).toEqual(["BA (Hons)", "Reading for PhD (Kings College, London)"]);
});
