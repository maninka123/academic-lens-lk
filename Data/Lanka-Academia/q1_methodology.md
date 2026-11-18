# Q1 journal article methodology

Declared 11 October 2026. Window: complete calendar years 2021–2025.

Provider: SCImago Journal & Country Rank (SJR). Use each article publication year's journal ranking, identified by journal title and ISSN. The chosen quartile is the best quartile across the journal's subject categories for that ranking year; retain all category results in journal_quartile_evidence.csv. This convention does not equate disciplines or faculty curricula.

Eligible types: verified research articles and review articles published in journals. Exclude conference proceedings/papers, books, chapters, editorials, letters, corrections, preprints and unknown types. Retain evidence for publication type and publication year. Do not infer eligibility from a Scholar or ResearchGate item total.

Deduplicate within an academic by normalised DOI, then conservative normalised title plus year where DOI is absent. A coauthored article may have one legitimate link to each verified academic author. Do not deduplicate across people.

Missing publication-year or category evidence stays unresolved. Never substitute the current quartile, an institutional ranking, or another provider. Keep provider-specific evidence separate.

Populate total_q1_journal_publications only when the person's journal-article list is demonstrably complete and historical quartile evidence covers every eligible article. Apply the same standard within 2021–2025 for q1_publications_2021_2025. Otherwise both complete-total fields stay blank as appropriate. Verified partial counts belong in q1_partial_counts.csv with the known denominator and coverage limitations. Blank partial counts mean not assessed; zero requires an assessed eligible set. No Q1 percentages without a valid journal-article denominator.

Citations received during 2021–2025 are a different metric from citations to articles published in those years. The citation window requires all five annual citation values; rolling since values are ineligible.
