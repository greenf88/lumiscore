"""Read-only recheck of a pre-existing list of public book URLs (lxml required)."""
import json
import re
import sys
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from urllib.parse import urlsplit
from urllib.request import Request, urlopen

from lxml import html


def get(url):
    with urlopen(Request(url, headers={"User-Agent": "Mozilla/5.0 LumiScore audit"}), timeout=25) as response:
        return response.read(), response.status, response.url, response.headers.get("X-Robots-Tag")


def clean(s):
    return " ".join(s.split())


def check(entry):
    url = entry["url"]
    path = urlsplit(url).path
    _, locale, _, work_id = path.split("/")
    row = dict(url=url, work_id=work_id, locale=locale, audit_words=entry["description_words"])
    try:
        raw, status, final_url, robots_header = get(url)
        tree = html.fromstring(raw)
        row.update(status=status, final_url=final_url, robots_header=robots_header,
                   title=clean(tree.xpath("string(//main//h1)")),
                   canonical=tree.xpath("//head/link[@rel='canonical']/@href"),
                   robots=tree.xpath("//head/meta[@name='robots']/@content"),
                   hreflang=tree.xpath("//head/link[@rel='alternate']/@hreflang"))
        main_text = clean(" ".join(tree.xpath("//main//text()")))
        row["insufficient_ratings"] = bool(re.search(r"Insufficient ratings|Onvoldoende beoordelingen", main_text, re.I))
        row["edition_language"] = clean(tree.xpath("string(//dl/div[dt='Language' or dt='Taal']/dd)"))
        row["isbn"] = clean(tree.xpath("string(//dl/div[dt='ISBN-13']/dd)"))
        row["cover"] = tree.xpath("(//*[@data-cover-presentation='detail']//img)[1]/@src")
        row["sections"] = []
        for section in tree.xpath("//section[contains(concat(' ',normalize-space(@class),' '),' book-description ')]"):
            sources = section.xpath(".//p[@class='description-source']/a/@href")
            paragraphs = [clean(p.text_content()) for p in section.xpath(".//p[not(@class='description-source')]")]
            placement = "main" if section.xpath("ancestor::main") else "stream"
            row["sections"].append(dict(placement=placement, source=sources, words=sum(
                len(re.findall(r"\b[\w’'-]+\b", p)) for p in paragraphs) if sources else 0,
                message=None if sources else " ".join(paragraphs)))
        api_raw, api_status, _, _ = get(f"{urlsplit(url).scheme}://{urlsplit(url).netloc}/api/books/{work_id}/description?locale={locale}")
        payload = json.loads(api_raw)
        desc = payload.get("description") or {}
        row["api"] = dict(status=api_status, state=payload.get("state"),
                          language=desc.get("language"), source=desc.get("sourceUrl") or desc.get("sourceKey"))
    except Exception as error:
        row["error"] = str(error)
    return row


if __name__ == "__main__":
    sample = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))["rows"]
    with ThreadPoolExecutor(max_workers=4) as pool:
        rows = list(pool.map(check, sample))
    Path(sys.argv[2]).write_text(json.dumps(rows, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
