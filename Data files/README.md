# Editable academic data

Edit CSVs under `universities/`. Each academic lives in **one authoritative file**. Keep the original header and academic ID. Blank numbers mean unknown; an explicit zero means zero.

```text
universities/
  moratuwa/
    faculties.csv                         # Convenience inventory
    faculties/
      faculty-of-engineering/
        academics.csv                     # Faculty records without a named department
        departments/
          department-of-civil-engineering/
            academics.csv                 # Records assigned to that department
      unassigned-faculty/
        academics.csv                     # Faculty not published
```

Every university uses this layout. CSV names and published faculty/department fields remain consistent; unknown groups use `unassigned-faculty`. KIU and ICBT have header-only placeholders. Saegis is excluded by the collection's revised scope.

To add a unit, create a lowercase, hyphenated folder and an `academics.csv` with the original header. The importer discovers all these CSVs recursively. Do not repeat people in university, faculty and department CSVs. Published unit names come from the CSV fields, not folder names. Faculty inventory files are informational, not academic sources.

Supporting collection logs, coverage reports, metric snapshots and the data dictionary are at this directory's root. `_archive/original-collection-2026-10-11/` preserves the supplied flat bundle and is excluded from Git.

After edits, run from the project root:

```sh
npm run data:import
npm test
npm run build
```

Generated website files are in `public/data/`; edit this directory's source CSVs instead. GitHub Actions imports them before each deployment. Duplicate IDs stop the import. Use a CSV-aware editor to preserve quoted commas and multiline fields.

Baseline: **1,173 unique records**, 12 institutions with records, 14 in scope, 47 faculty groups including unassigned groups, and 98 populated academic CSVs. The website calculates field coverage directly; older reports may contain stale counts.
