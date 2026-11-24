"use strict";
/**
 * Browser side: match what is on the page to manifest entries.
 * resolveDom must stay self-contained (no imports, no outer helpers): the server sends it
 * to the browser with Function.prototype.toString().
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveDom = resolveDom;
function resolveDom(doc, manifest) {
    const norm = (s) => s.replace(/\s+/g, ' ').trim();
    const byId = new Map();
    const fileOf = new Map();
    const loose = [];
    for (const f of manifest.files) {
        for (const e of f.entries) {
            byId.set(e.id, e);
            fileOf.set(e.id, f.file);
        }
    }
    const visible = (node) => {
        const el = node.parentElement;
        if (!el || el.closest('script,style,noscript,template,head,[data-cms-ui]'))
            return false;
        return norm(node.data) !== '';
    };
    const textNodes = (root) => {
        const out = [];
        const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        for (let n = walker.nextNode(); n; n = walker.nextNode())
            if (visible(n))
                out.push(n);
        return out;
    };
    const texts = new Map();
    const claimed = new Set();
    // Tier 1: the element carries the id, so the match is exact.
    for (const el of Array.from(doc.querySelectorAll('[data-cms]'))) {
        const ids = (el.getAttribute('data-cms') || '').split(/\s+/).filter(Boolean);
        const inside = textNodes(el);
        const direct = inside.filter((n) => n.parentNode === el);
        for (const id of ids) {
            const entry = byId.get(id);
            if (!entry)
                continue;
            const want = norm(entry.text);
            const node = direct.find((n) => !texts.has(n) && norm(n.data) === want) ??
                inside.find((n) => !texts.has(n) && norm(n.data) === want);
            if (!node)
                continue;
            texts.set(node, { node, text: node.data, tier: 'id', entry, file: fileOf.get(id) });
            claimed.add(id);
        }
    }
    const links = new Map();
    for (const el of Array.from(doc.querySelectorAll('[data-cms-href]'))) {
        const id = el.getAttribute('data-cms-href');
        const entry = byId.get(id);
        const href = el.getAttribute('href');
        if (!entry || href == null || href !== entry.text)
            continue;
        links.set(el, { el, href, tier: 'id', entry, file: fileOf.get(id) });
        claimed.add(id);
    }
    // Tier 2: strings that reach the page indirectly (props, data arrays). Matched by value.
    // Text stamped on a plain HTML tag is found by id or it is not on this page at all, so it
    // never takes part in matching by value. Otherwise a "0" elsewhere in the code could claim a
    // "0" shown here.
    for (const f of manifest.files)
        for (const e of f.entries)
            if (!claimed.has(e.id) && !(e.anchored && e.host))
                loose.push(e);
    const looseByText = new Map();
    const numbers = new Map();
    for (const e of loose) {
        const k = norm(e.text);
        if (!k)
            continue;
        if (e.syntax === 'number') {
            // Numbers are too common to match by value alone; they get their own pass below.
            numbers.set(k, [...(numbers.get(k) ?? []), e]);
            continue;
        }
        const list = looseByText.get(k);
        if (list)
            list.push(e);
        else
            looseByText.set(k, [e]);
    }
    const keyOf = (id) => id.split('.')[0];
    // A component usually shows text from the modules it imports. For each file: the tail of
    // every import path, e.g. "lib/navigation" for "@/lib/navigation" or "../lib/navigation".
    const importsOf = new Map();
    for (const f of manifest.files) {
        importsOf.set(f.key, (f.imports ?? []).map((spec) => spec.replace(/^(\.\.?\/|[@~]\/)+/, '')).filter(Boolean));
    }
    const importedBy = (scope, e) => {
        const file = (fileOf.get(e.id) ?? '').replace(/\.[a-z]+$/i, '');
        return (importsOf.get(scope) ?? []).some((tail) => file === tail || file.endsWith('/' + tail) || file.endsWith('/' + tail + '/index'));
    };
    // The same sentence usually exists once per language. Keep the one for the page's language.
    const lang = (doc.documentElement.getAttribute('lang') ?? '').toLowerCase();
    const isMessages = (e) => /\.json$/i.test(fileOf.get(e.id) ?? '');
    const inLanguage = (e) => {
        const parts = (fileOf.get(e.id) ?? '').toLowerCase().replace(/\.json$/, '').split('/');
        return parts.includes(lang) || parts.includes(lang.split('-')[0]);
    };
    function preferLanguage(candidates) {
        if (!lang || candidates.filter(isMessages).length < 2)
            return candidates;
        const kept = candidates.filter((e) => !isMessages(e) || inLanguage(e));
        return kept.some(isMessages) ? kept : candidates;
    }
    function matchGroup(items, value, scopeOf, isLink) {
        let candidates = preferLanguage((looseByText.get(value) ?? []).filter((e) => isLink ? e.kind === 'href' || e.kind === 'data' || e.kind === 'prop' : e.kind !== 'href'));
        if (isLink) {
            const named = candidates.filter((e) => e.kind === 'href' || /^(href|url|link|to)$/i.test(e.name ?? ''));
            if (named.length)
                candidates = named;
        }
        const result = new Map();
        if (!candidates.length) {
            for (const item of items)
                result.set(item, { tier: 'none' });
            return result;
        }
        // Prefer strings from the file that rendered the element.
        const scopes = new Map();
        for (const item of items) {
            const scope = scopeOf(item) ?? '';
            scopes.set(scope, [...(scopes.get(scope) ?? []), item]);
        }
        const used = new Set();
        const assign = (group, pool) => {
            if (pool.length === 1) {
                for (const item of group)
                    result.set(item, { tier: 'match', entry: pool[0] });
            }
            else if (pool.length === group.length) {
                // Same string several times: pair page order with source order.
                group.forEach((item, i) => result.set(item, { tier: 'match', entry: pool[i] }));
            }
            else {
                for (const item of group)
                    result.set(item, pool.length ? { tier: 'ambiguous', candidates: pool } : { tier: 'none' });
                return;
            }
            for (const e of pool)
                used.add(e.id);
        };
        // Elements whose own file holds the string go first; what they claim is then ruled
        // out for elements that received the string from somewhere else (e.g. through a prop).
        const later = [];
        for (const [scope, group] of scopes) {
            const local = scope ? candidates.filter((e) => keyOf(e.id) === scope) : [];
            if (local.length)
                assign(group, local);
            else
                later.push([scope, group]);
        }
        for (const [scope, group] of later) {
            // Imported text may be shown in several places, so it is not ruled out by an earlier use.
            const imported = scope ? candidates.filter((e) => importedBy(scope, e)) : [];
            assign(group, imported.length ? imported : candidates.filter((e) => !used.has(e.id)));
        }
        return result;
    }
    const scopeOfNode = (n) => {
        const el = n.nodeType === 1 ? n : n.parentElement;
        return el?.closest('[data-cms-x]')?.getAttribute('data-cms-x') ?? null;
    };
    // Pairs: a link whose words and address sit in one object, such as { label: "Docs", href: "/docs" }.
    // Finding both in the same object is far stronger evidence than either value alone, so these
    // are settled first, wherever on the page the link is drawn (a header and a footer may share it).
    for (const el of Array.from(doc.querySelectorAll('a[href]'))) {
        if (links.has(el) || el.closest('[data-cms-ui]'))
            continue;
        const inner = textNodes(el).filter((n) => !texts.has(n));
        if (inner.length !== 1)
            continue;
        const href = el.getAttribute('href');
        const labels = (looseByText.get(norm(inner[0].data)) ?? []).filter((e) => e.group && e.kind !== 'href');
        const addresses = (looseByText.get(norm(href)) ?? []).filter((e) => e.group);
        const pairs = [];
        for (const label of labels) {
            for (const address of addresses)
                if (address.group === label.group && address.id !== label.id)
                    pairs.push([label, address]);
        }
        if (pairs.length !== 1)
            continue;
        const [label, address] = pairs[0];
        texts.set(inner[0], { node: inner[0], text: inner[0].data, tier: 'match', entry: label, file: fileOf.get(label.id) });
        links.set(el, { el, href, tier: 'match', entry: address, file: fileOf.get(address.id) });
    }
    const pendingText = new Map();
    for (const node of textNodes(doc.body)) {
        if (texts.has(node))
            continue;
        const k = norm(node.data);
        pendingText.set(k, [...(pendingText.get(k) ?? []), node]);
    }
    for (const [value, nodes] of pendingText) {
        for (const [node, r] of matchGroup(nodes, value, scopeOfNode, false)) {
            texts.set(node, {
                node,
                text: node.data,
                tier: r.tier,
                entry: r.entry,
                file: r.entry && fileOf.get(r.entry.id),
                candidates: r.candidates?.map((c) => `${fileOf.get(c.id)}:${c.line}`),
            });
        }
    }
    // Numbers: trusted only next to text from the same object, e.g. a price beside its plan's name.
    if (numbers.size) {
        const mates = new Map();
        for (const hit of texts.values()) {
            const group = hit.entry?.group;
            if (group)
                mates.set(group, [...(mates.get(group) ?? []), hit.node]);
        }
        const depth = (node) => {
            let d = 0;
            for (let n = node; n; n = n.parentNode)
                d++;
            return d;
        };
        /** How deep in the page two nodes still share a container; 0 when it is only the body. */
        const closeness = (a, b) => {
            const seen = new Set();
            for (let n = a.parentNode; n; n = n.parentNode)
                seen.add(n);
            for (let n = b.parentNode; n; n = n.parentNode) {
                if (seen.has(n))
                    return n === doc.body || n === doc.documentElement ? 0 : depth(n);
            }
            return 0;
        };
        for (const hit of Array.from(texts.values())) {
            if (hit.entry || !/^-?\d+(\.\d+)?$/.test(norm(hit.text)))
                continue;
            let best;
            let bestScore = 0;
            let tied = false;
            for (const candidate of numbers.get(norm(hit.text)) ?? []) {
                let score = 0;
                for (const mate of mates.get(candidate.group ?? '') ?? [])
                    score = Math.max(score, closeness(hit.node, mate));
                if (score > bestScore) {
                    best = candidate;
                    bestScore = score;
                    tied = false;
                }
                else if (score && score === bestScore) {
                    tied = true;
                }
            }
            if (best && !tied)
                texts.set(hit.node, { ...hit, tier: 'match', entry: best, file: fileOf.get(best.id) });
            else if (best)
                texts.set(hit.node, { ...hit, tier: 'ambiguous' });
        }
    }
    const pendingLinks = new Map();
    for (const el of Array.from(doc.querySelectorAll('a[href]'))) {
        if (links.has(el) || el.closest('[data-cms-ui]'))
            continue;
        const href = el.getAttribute('href');
        pendingLinks.set(href, [...(pendingLinks.get(href) ?? []), el]);
    }
    for (const [href, els] of pendingLinks) {
        for (const [el, r] of matchGroup(els, norm(href), scopeOfNode, true)) {
            links.set(el, { el, href, tier: r.tier, entry: r.entry, file: r.entry && fileOf.get(r.entry.id) });
        }
    }
    const textHits = Array.from(texts.values());
    const linkHits = Array.from(links.values());
    return { texts: textHits, links: linkHits, coverage: coverage(textHits, linkHits) };
    function coverage(texts, links) {
        const tiers = ['id', 'match', 'ambiguous', 'none'];
        const blank = () => ({ id: 0, match: 0, ambiguous: 0, none: 0 });
        const nodes = blank();
        const chars = blank();
        const linkCount = blank();
        for (const t of texts) {
            nodes[t.tier]++;
            chars[t.tier] += norm(t.text).length;
        }
        for (const l of links)
            linkCount[l.tier]++;
        const total = (r) => tiers.reduce((sum, k) => sum + r[k], 0);
        const pct = (r) => (total(r) ? Math.round(((r.id + r.match) / total(r)) * 1000) / 10 : 100);
        return {
            text: { nodes, chars, editableNodesPct: pct(nodes), editableCharsPct: pct(chars) },
            links: { count: linkCount, editablePct: pct(linkCount) },
            notEditable: texts.filter((t) => t.tier === 'none' || t.tier === 'ambiguous').map((t) => `${t.tier}: ${norm(t.text)}`),
            notEditableLinks: links.filter((l) => l.tier === 'none' || l.tier === 'ambiguous').map((l) => `${l.tier}: ${l.href}`),
        };
    }
}
