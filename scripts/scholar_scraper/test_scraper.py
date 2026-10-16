"""Offline smoke test suite: no live network connections are made."""
from importlib import util
from pathlib import Path
import csv
import json
import os
import sys
import tempfile
from unittest.mock import patch, MagicMock

# 1. Test scholar_scraper.py
module_path = Path(__file__).with_name("scholar_scraper.py")
spec = util.spec_from_file_location("scholar_scraper", module_path)
s = util.module_from_spec(spec)
spec.loader.exec_module(s)

assert s.get_scholar_id("https://scholar.google.com/citations?hl=en&user=Smr99uEAAAAJ&view_op=list_works") == "Smr99uEAAAAJ"
assert s.get_scholar_id("https://example.com/citations?user=Smr99uEAAAAJ") is None
assert s.get_scholar_id("some fake nonprofile url") is None
assert s.find_column(["Full Name", "Google Scholar Profile URL (verified)"], s.URL_COLUMN_NAMES) == "Google Scholar Profile URL (verified)"
assert s.find_column(["Full Name", "Google Scholar Profile URL (verified)"], s.NAME_COLUMN_NAMES) == "Full Name"

with tempfile.TemporaryDirectory() as tmp:
    tmp = Path(tmp)
    inp = tmp / "academics.csv"
    with inp.open('w', encoding='utf-8', newline='') as f:
        w = csv.DictWriter(f, fieldnames=['Full Name', 'University', 'Google Scholar Profile URL (verified)'])
        w.writeheader()
        w.writerows([
            {'Full Name': 'Dr Example One', 'University': 'University A', 'Google Scholar Profile URL (verified)': 'https://scholar.google.com/citations?user=Smr99uEAAAAJ'},
            {'Full Name': 'Dr Example Two', 'University': 'University B', 'Google Scholar Profile URL (verified)': 'https://scholar.google.com/citations?user=Smr99uEAAAAJ&hl=en'},
            {'Full Name': 'Another Academic', 'University': 'University C', 'Google Scholar Profile URL (verified)': ''},
            {'Full Name': 'Bad Link', 'University': 'University D', 'Google Scholar Profile URL (verified)': 'https://example.com/fake'},
        ])
    fake = {'scholar_id':'Smr99uEAAAAJ', 'name':'Example One', 'affiliation':'University A', 'email_domain':'@example.edu', 'interests':['AI'], 'total_citations':123, 'citations_5y':55, 'hindex':9,'hindex_5y':6,'i10index':4,'i10index_5y':3,'citations_by_year':{'2021':8,'2022':9,'2023':10,'2024':11,'2025':12},'publications_fetched':True,'publication_limit':100,'publications':[{'author_pub_id':'abc', 'title':'Paper','publication_year':'2025','citations':2,'citation_text':'Some authors, Journal','venue':'Journal','pub_url':''}], 'retrieved_at':'2026-10-16T00:00:00+00:00'}
    with patch.object(s, 'fetch_profile', return_value=fake) as fetch, patch.object(sys, 'argv', ['scholar_scraper.py', str(inp), '--out', str(tmp / 'out'), '--limit', '10', '--with-publications']):
        assert s.main() == 0
        assert fetch.call_count == 1
    with (tmp/'out'/'academics_enriched.csv').open(encoding='utf-8-sig',newline='') as f:
        rows=list(csv.DictReader(f))
    assert len(rows)==4
    assert rows[0]['gs_total_citations']=='123'
    assert rows[0]['gs_total_publications']=='1'
    assert rows[0]['gs_publications_5y']=='1'
    assert rows[0]['gs_publications_complete']=='yes'
    assert rows[0]['gs_citations_in_complete_years']=='50'
    assert rows[1]['gs_total_citations']=='123'
    assert rows[2]['gs_status']=='no_link'
    assert rows[3]['gs_status']=='invalid_link'
    with (tmp/'out'/'publications.csv').open(encoding='utf-8-sig',newline='') as f:
        pubs=list(csv.DictReader(f))
    assert len(pubs)==2
    with patch.object(s, 'fetch_profile') as fetch2, patch.object(sys, 'argv', ['scholar_scraper.py', str(inp), '--out', str(tmp / 'out'), '--limit', '10', '--with-publications']):
        assert s.main()==0
        fetch2.assert_not_called()

# Publication counts must not be mistaken for actual totals when truncated.
partial = {'publications_fetched': True, 'publication_limit': 2, 'publications': [
    {'publication_year': '2025'}, {'publication_year': '2024'}
]}
ps = s.summarize_publications(partial, ['2021','2022','2023','2024','2025'])
assert ps['complete'] is False and ps['exported'] == 2
assert ps['total'] == '' and ps['recent'] == ''
complete = dict(partial, publication_limit=0)
ps = s.summarize_publications(complete, ['2021','2022','2023','2024','2025'])
assert ps['complete'] is True and ps['total'] == 2 and ps['recent'] == 2
assert json.loads(ps['by_year']) == {'2024': 1, '2025': 1}
assert s.summarize_publications({'publications_fetched': False}, ['2021'])['total'] == ''

# 2. Test openalex_scraper.py
oa_path = Path(__file__).with_name("openalex_scraper.py")
spec_oa = util.spec_from_file_location("openalex_scraper", oa_path)
oa = util.module_from_spec(spec_oa)
spec_oa.loader.exec_module(oa)

parsed_p = oa.parse_name("Prof. Samantha Herath")
assert parsed_p["surname"] == "herath"
assert "samantha" in parsed_p["given"]

parsed_initials = oa.parse_name("Dr. H.L. De Silva")
assert parsed_initials["surname"] == "de silva"
assert parsed_initials["given"] == ["h", "l"]

assert oa.is_compatible(parsed_initials, "H. L. De Silva")
assert oa.is_compatible(parsed_initials, "Hemal Lal De Silva")
assert not oa.is_compatible(parsed_initials, "K. P. De Silva")

mock_author_data = {
    "id": "https://openalex.org/A12345678",
    "display_name": "Samantha Herath",
    "works_count": 42,
    "cited_by_count": 350,
    "summary_stats": {"h_index": 8, "i10_index": 5},
    "counts_by_year": [
        {"year": 2021, "cited_by_count": 20},
        {"year": 2022, "cited_by_count": 25},
        {"year": 2023, "cited_by_count": 30},
        {"year": 2024, "cited_by_count": 35},
        {"year": 2025, "cited_by_count": 40},
    ]
}
formatted_oa = oa.format_openalex_profile(mock_author_data, "approved_high_confidence", "test_match")
assert formatted_oa["oa_works_count"] == 42
assert formatted_oa["oa_cited_by_count"] == 350
assert formatted_oa["oa_h_index"] == 8
assert formatted_oa["oa_citations_2021_2025"] == 150
assert formatted_oa["oa_y2025"] == 40

# 3. Test enrich_academics.py
ea_path = Path(__file__).with_name("enrich_academics.py")
spec_ea = util.spec_from_file_location("enrich_academics", ea_path)
ea = util.module_from_spec(spec_ea)
spec_ea.loader.exec_module(ea)

mock_oa_client = MagicMock()
mock_oa_client.search_and_disambiguate.return_value = (mock_author_data, "approved_high_confidence", 85, "test")

with patch.object(ea.gs, "fetch_profile", return_value=fake):
    res_scholar = ea.enrich_record({
        "academic_id": "SL-TEST-01",
        "full_name": "Dr Example One",
        "university": "University of Colombo",
        "google_scholar_url": "https://scholar.google.com/citations?user=Smr99uEAAAAJ",
        "total_citations": "",
        "h_index": "",
        "total_publications": "",
        "citations_2021_2025": ""
    }, mock_oa_client)

assert res_scholar["total_citations"] == "123"
assert res_scholar["h_index"] == "9"
assert res_scholar["platform"] == "Google Scholar"

res_oa = ea.enrich_record({
    "academic_id": "SL-TEST-02",
    "full_name": "Samantha Herath",
    "university": "University of Colombo",
    "google_scholar_url": "",
    "total_citations": "",
    "h_index": "",
    "total_publications": "",
    "citations_2021_2025": ""
}, mock_oa_client)

assert res_oa["total_citations"] == "350"
assert res_oa["total_publications"] == "42"
assert res_oa["h_index"] == "8"
assert res_oa["platform"] == "OpenAlex"

print("ALL OFFLINE SMOKE TESTS PASSED (scholar_scraper, openalex_scraper, enrich_academics)!")
