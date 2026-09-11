// Fill in `links.orcid` for your people by cross-referencing the author metadata
// of your OWN publications. An ORCID iD is author-asserted on a paper, so if one
// of your people co-authored a paper in your `publications` collection and
// claimed their ORCID on it, Crossref and/or PubMed exposes it — a high-confidence
// way to populate the roster's ORCID links without searching for each person.
//
//   Reads:   src/content/publications/*.md   (doi / pmid)
//            src/content/people/*.md          (name + any existing links.orcid)
//   Sources: Crossref REST API (by DOI) + NCBI PubMed efetch (by PMID)
//
//   Dry run (default) — prints suggestions, writes nothing:
//     node scripts/enrich-orcid.mjs
//   Apply the high-confidence (exact name) matches into people frontmatter:
//     node scripts/enrich-orcid.mjs --write
//   Also apply lower-confidence (partial / surname-only) matches — eyeball first:
//     node scripts/enrich-orcid.mjs --write --include-partial
//
//   Options:
//     --email=you@lab.edu   contact address for the Crossref / PubMed "polite"
//                           pools (or set CONTACT_EMAIL). Recommended, not required.
//
// Safe by design: a network/API failure for any paper is skipped, never fatal.
// With --write it only fills an EMPTY orcid and never overwrites an existing one;
// a found iD that disagrees with what's already on file is reported as a conflict
// for you to resolve by hand. LinkedIn / Twitter / personal sites can't be derived
// this way — see CLAUDE.md for the Claude-assisted profile-finding workflow.

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const PUBS = join(ROOT, "src/content/publications");
const PPL = join(ROOT, "src/content/people");

const args = process.argv.slice(2);
const WRITE = args.includes("--write");
const INCLUDE_PARTIAL = args.includes("--include-partial");
const EMAIL =
  (args.find((a) => a.startsWith("--email=")) || "").split("=")[1] ||
  process.env.CONTACT_EMAIL ||
  "";
const MAILTO = EMAIL ? `?mailto=${encodeURIComponent(EMAIL)}` : "";
const UA = `lab-website-template-enrich-orcid${EMAIL ? ` (${EMAIL})` : ""}`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const norm = (s) =>
  (s || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z]/g, "");
const normOrcid = (s) => {
  const m = (s || "").match(/(\d{4})-?(\d{4})-?(\d{4})-?(\d{3}[\dxX])/);
  return m ? `https://orcid.org/${m[1]}-${m[2]}-${m[3]}-${m[4].toUpperCase()}` : null;
};

// ---- roster ----------------------------------------------------------------
const people = readdirSync(PPL)
  .filter((f) => f.endsWith(".md"))
  .map((f) => {
    const path = join(PPL, f);
    const text = readFileSync(path, "utf8");
    const name = (text.match(/^name:\s*"?(.*?)"?\s*$/m) || [])[1] || f.replace(/\.md$/, "");
    const bare = name.replace(/,.*$/, "").trim(); // drop suffixes like ", PhD"
    const toks = bare.split(/\s+/).filter(Boolean);
    const family = toks.slice(1);
    const orcid = (text.match(/^\s*orcid:\s*"?(https?:\/\/orcid\.org\/[^"\s]+)"?/m) || [])[1];
    return {
      slug: f.replace(/\.md$/, ""),
      path,
      name,
      gi: norm(toks[0]).slice(0, 1),
      givenNorm: norm(toks[0]),
      famNorm: norm(family.join("")),
      famTokens: family.map(norm).filter((t) => t.length >= 4),
      orcid: orcid ? normOrcid(orcid) : null,
    };
  });

// ---- publications ----------------------------------------------------------
const pubs = readdirSync(PUBS)
  .filter((f) => f.endsWith(".md"))
  .map((f) => {
    const text = readFileSync(join(PUBS, f), "utf8");
    return {
      slug: f.replace(/\.md$/, ""),
      doi: (text.match(/^doi:\s*"?(.*?)"?\s*$/m) || [])[1] || null,
      pmid: (text.match(/^pmid:\s*"?(.*?)"?\s*$/m) || [])[1] || null,
    };
  });

// ---- collect (family, given, orcid) records from both sources --------------
const records = [];
const add = (family, given, orcidRaw, src) => {
  const orcid = normOrcid(orcidRaw);
  if (!orcid) return;
  records.push({
    famNorm: norm(family),
    famTokens: (family || "").split(/[\s-]+/).map(norm).filter((t) => t.length >= 4),
    gi: norm(given).slice(0, 1),
    givenNorm: norm(given),
    orcid,
    src,
  });
};

async function crossref() {
  const withDoi = pubs.filter((p) => p.doi);
  let ok = 0;
  for (const p of withDoi) {
    try {
      const r = await fetch(`https://api.crossref.org/works/${encodeURIComponent(p.doi)}${MAILTO}`, {
        headers: { "User-Agent": UA },
      });
      if (r.ok) {
        const j = await r.json();
        for (const a of j.message?.author || []) {
          if (a.ORCID) add(a.family || "", a.given || "", a.ORCID, p.slug);
        }
        ok++;
      }
    } catch {
      /* skip this paper */
    }
    await sleep(120); // be polite to the API
  }
  return { ok, total: withDoi.length };
}

async function pubmed() {
  const ids = pubs.map((p) => p.pmid).filter(Boolean);
  let scanned = 0;
  for (let i = 0; i < ids.length; i += 40) {
    const batch = ids.slice(i, i + 40);
    try {
      const url =
        `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/efetch.fcgi?db=pubmed` +
        `&id=${batch.join(",")}&retmode=xml` +
        (EMAIL ? `&tool=lab-website-template&email=${encodeURIComponent(EMAIL)}` : "");
      const xml = await (await fetch(url, { headers: { "User-Agent": UA } })).text();
      for (const block of xml.match(/<Author[\s>][\s\S]*?<\/Author>/g) || []) {
        const orc = block.match(/<Identifier Source="ORCID">\s*(.*?)\s*<\/Identifier>/);
        if (!orc) continue;
        const last = (block.match(/<LastName>(.*?)<\/LastName>/) || [])[1] || "";
        const fore = (block.match(/<ForeName>(.*?)<\/ForeName>/) || [])[1] || "";
        add(last, fore, orc[1], "pubmed");
      }
      scanned += batch.length;
    } catch {
      /* skip this batch */
    }
    await sleep(200);
  }
  return { scanned };
}

// ---- match records → people ------------------------------------------------
// Returns the match strength, or null if this record can't be this person.
function classify(person, rec) {
  if (person.gi && rec.gi && person.gi !== rec.gi) return null; // first initials differ
  // If both have a real given name (not just an initial), require one to prefix
  // the other — guards against same-surname, same-initial different people.
  if (
    person.givenNorm.length > 1 &&
    rec.givenNorm.length > 1 &&
    !rec.givenNorm.startsWith(person.givenNorm) &&
    !person.givenNorm.startsWith(rec.givenNorm)
  )
    return null;
  if (person.famNorm && person.famNorm === rec.famNorm) return "exact";
  if (
    person.famNorm &&
    rec.famNorm &&
    (person.famNorm.includes(rec.famNorm) || rec.famNorm.includes(person.famNorm)) &&
    Math.min(person.famNorm.length, rec.famNorm.length) >= 4
  )
    return "partial"; // e.g. compound surname split differently by the indexer
  if (person.famTokens.some((t) => rec.famTokens.includes(t))) return "surname-token";
  return null;
}

const RANK = { exact: 3, partial: 2, "surname-token": 1 };
const suggestions = new Map(); // slug -> Map(orcid -> { type, srcs:Set }); filled post-fetch
const buildSuggestions = () => {
  for (const rec of records) {
    for (const p of people) {
      const type = classify(p, rec);
      if (!type) continue;
      if (!suggestions.has(p.slug)) suggestions.set(p.slug, new Map());
      const m = suggestions.get(p.slug);
      if (!m.has(rec.orcid)) m.set(rec.orcid, { type, srcs: new Set() });
      const e = m.get(rec.orcid);
      if (RANK[type] > RANK[e.type]) e.type = type;
      e.srcs.add(rec.src);
    }
  }
};
const best = (m) => {
  let b = null;
  for (const [orcid, info] of m) {
    if (
      !b ||
      RANK[info.type] > RANK[b.info.type] ||
      (RANK[info.type] === RANK[b.info.type] && info.srcs.size > b.info.srcs.size)
    )
      b = { orcid, info };
  }
  return b;
};

// ---- insert orcid into a person's frontmatter ------------------------------
function withOrcid(text, orcid) {
  if (/^\s*orcid:/m.test(text)) return text;
  const line = `  orcid: "${orcid}"`;
  if (/^links:\s*$/m.test(text)) return text.replace(/^links:\s*$/m, (m) => `${m}\n${line}`);
  if (/^links:\s*\{\s*\}\s*$/m.test(text)) return text.replace(/^links:\s*\{\s*\}\s*$/m, `links:\n${line}`);
  const anchor = /^headshot:.*$/m.test(text) ? /^headshot:.*$/m : /^role:.*$/m;
  return text.replace(anchor, (m) => `${m}\nlinks:\n${line}`);
}

// ---- run -------------------------------------------------------------------
console.log(
  `Cross-referencing ${pubs.filter((p) => p.doi).length} DOIs + ` +
    `${pubs.filter((p) => p.pmid).length} PMIDs against ${people.length} people…`,
);
const cx = await crossref();
const pm = await pubmed();
console.log(
  `  Crossref ${cx.ok}/${cx.total} works; PubMed ${pm.scanned} ids; ` +
    `${records.length} ORCID-bearing author records found.\n`,
);
buildSuggestions();

const found = [];   // people we can fill in
const conflicts = []; // found iD disagrees with the one already on file
const confirmed = []; // found iD agrees with the one already on file
const ambiguous = []; // more than one distinct iD matched equally well

for (const p of people) {
  const m = suggestions.get(p.slug);
  const b = m && best(m);
  if (p.orcid) {
    if (b && b.orcid === p.orcid) confirmed.push(p.slug);
    else if (b && b.orcid !== p.orcid) conflicts.push({ p, found: b.orcid });
    continue;
  }
  if (!b) continue;
  const topType = b.info.type;
  const tied = [...m].filter(([, i]) => i.type === topType).map(([o]) => o);
  if (new Set(tied).size > 1) {
    ambiguous.push({ p, options: tied });
    continue;
  }
  found.push({ p, orcid: b.orcid, type: topType, srcs: [...b.info.srcs] });
}

const willWrite = (f) => WRITE && (f.type === "exact" || (INCLUDE_PARTIAL && f.type !== "exact"));

console.log(`########## SUGGESTED ORCIDs (${found.length}) ##########`);
for (const f of found.sort((a, b) => RANK[b.type] - RANK[a.type])) {
  const tag = willWrite(f) ? "WILL WRITE" : f.type === "exact" ? "ready" : "review";
  console.log(
    `  [${f.type.padEnd(13)}] ${f.p.slug.padEnd(26)} ${f.orcid}  (${tag})\n` +
      `      ${f.p.name} — via ${f.srcs.slice(0, 4).join(", ")}`,
  );
}
if (ambiguous.length) {
  console.log(`\n########## AMBIGUOUS — multiple iDs, left for you (${ambiguous.length}) ##########`);
  ambiguous.forEach(({ p, options }) => console.log(`  ${p.slug}: ${options.join("  vs  ")}`));
}
if (conflicts.length) {
  console.log(`\n########## CONFLICTS — on file ≠ found, NOT changed (${conflicts.length}) ##########`);
  conflicts.forEach(({ p, found }) => console.log(`  ${p.slug}: file ${p.orcid}  vs found ${found}`));
}
console.log(`\nConfirmed existing iDs: ${confirmed.length}.  People still without an iD: ` +
  `${people.filter((p) => !p.orcid && !found.find((f) => f.p.slug === p.slug)).length}.`);

if (!WRITE) {
  console.log(
    `\nDry run — nothing written. Re-run with --write to apply the ${found.filter((f) => f.type === "exact").length} ` +
      `exact match(es)` + (INCLUDE_PARTIAL ? "" : ", or add --include-partial for the rest") + ".",
  );
} else {
  let wrote = 0;
  for (const f of found) {
    if (!willWrite(f)) continue;
    const text = readFileSync(f.p.path, "utf8");
    const next = withOrcid(text, f.orcid);
    if (next !== text) {
      writeFileSync(f.p.path, next);
      wrote++;
      console.log(`  wrote orcid → ${f.p.slug}`);
    }
  }
  console.log(`\nWrote ${wrote} orcid field(s). Review with \`git diff\`, then \`npm run build\`.`);
}
