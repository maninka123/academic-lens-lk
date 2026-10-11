// Classify completed non-doctoral qualifications; doctorate evidence is handled
// separately by doctorateStatus. Match punctuation/spacing variants explicitly.
const DEGREE = /\b(?:ph\s*\.?\s*d|d\s*\.?\s*phil|doctor\s+of\s+philosophy|master(?:s|['’]s)?(?:\s+of\s+[a-z]+)?|bachelor(?:s|['’]s)?(?:\s+of\s+[a-z]+)?|m\s*\.?\s*(?:sc|phil|tech|pharm|com|eng|ba|ed|a|s|d)|ll\s*\.?\s*m|b\s*\.?\s*(?:sc(?:eng)?|b\s*\.?\s*mgt|tech|pharm|com|eng|ba|ed|arch|des|fa|a)|ll\s*\.?\s*b|mbbs)\b/gi;
const ONGOING = /\b(?:reading|candidate|candidature|pursuing|ongoing|registered|in progress|submitted|undergoing|following|student|trainee)\b/i;
const PLACEHOLDER = /^(?:education|contact details|academic qualifications?|not (?:available|published)|unknown|n\/?a|[-|;\s]+)$/i;

export function lowerQualification(value = "") {
  const text = String(value).trim();
  if (!text || PLACEHOLDER.test(text) || /sample position|sample location/i.test(text)) return "Unknown";
  const matches = [...text.matchAll(DEGREE)];
  let bachelors = false;
  for (let i = 0; i < matches.length; i++) {
    const match = matches[i];
    const token = match[0].replace(/[.\s]/g, "").toLowerCase();
    if (/^(?:phd|dphil|doctorofphilosophy)$/.test(token)) continue;
    const end = matches[i + 1]?.index ?? text.length;
    const clause = text.slice(match.index, end);
    // "Reading" can be the awarding university, rather than study status.
    const statusText = clause
      .replace(/University of Reading|Reading University/gi, "")
      .replace(/(?:reading|pursuing|studying|registered)\s+(?:for\s+)?$/i, "");
    const prefix = text.slice(Math.max(0, match.index - 24), match.index);
    if (ONGOING.test(statusText) || /(?:reading|pursuing|studying|registered)\s+(?:for\s+)?$/i.test(prefix)) continue;
    if (token.startsWith("master") && /master\s+mariner/i.test(clause)) continue;
    if ((token.startsWith("m") && token !== "mbbs") || token === "llm") return "Masters / MPhil";
    if (token.startsWith("b") || token === "llb" || token === "mbbs") bachelors = true;
  }
  if (bachelors) return "Bachelors";
  // A heading or institution name alone does not document a qualification.
  return /\b(?:diploma|certificate|certification|coc|competency|chartered|fellow|attorney|licen[cs]e|master mariner)\b/i.test(text)
    ? "Other documented" : "Unknown";
}
