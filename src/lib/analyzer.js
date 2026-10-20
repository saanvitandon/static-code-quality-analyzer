export const SEVERITY_WEIGHT = { info: 1, minor: 2, major: 3, critical: 5 };
export const WEIGHTS = { S: 0.35, C: 0.25, I: 0.25, D: 0.15 };
export const QDS_WEIGHTS = { A: 0.5, F: 0.3, H: 0.2 };
export const HIGH_RISK_THRESHOLD = 60;
export function computeRisk(f) {
    return Math.round(100 * (WEIGHTS.S * f.S + WEIGHTS.C * f.C + WEIGHTS.I * f.I + WEIGHTS.D * f.D) * 10) / 10;
}
export function computeQDS(A, F, H) {
    return Math.round(100 * (QDS_WEIGHTS.A * A + QDS_WEIGHTS.F * F + QDS_WEIGHTS.H * H) * 10) / 10;
}
const KEYWORDS = new Set(["if", "for", "while", "switch", "catch", "return", "sizeof", "else", "do", "case", "new", "delete", "throw"]);
/** Replace comments and string/char literals with spaces, preserving newlines. */
export function stripCode(src) {
    let out = "";
    let i = 0;
    while (i < src.length) {
        const c = src[i], n = src[i + 1];
        if (c === "/" && n === "/") {
            while (i < src.length && src[i] !== "\n") {
                out += " ";
                i++;
            }
        }
        else if (c === "/" && n === "*") {
            out += "  ";
            i += 2;
            while (i < src.length && !(src[i] === "*" && src[i + 1] === "/")) {
                out += src[i] === "\n" ? "\n" : " ";
                i++;
            }
            out += "  ";
            i += 2;
        }
        else if (c === '"' || c === "'") {
            const q = c;
            out += q;
            i++;
            while (i < src.length && src[i] !== q && src[i] !== "\n") {
                if (src[i] === "\\") {
                    out += " ";
                    i++;
                }
                out += " ";
                i++;
            }
            out += q;
            i++;
        }
        else if (c === "#") {
            // preprocessor line
            while (i < src.length && src[i] !== "\n") {
                out += " ";
                i++;
            }
        }
        else {
            out += c;
            i++;
        }
    }
    return out;
}
const lineOf = (s, idx) => s.slice(0, idx).split("\n").length;
const RULE_INFO = {
    "high-complexity": { title: "High cyclomatic complexity", severity: "major", explanation: "Too many independent paths make the function hard to test and reason about. Split it into smaller, focused helpers." },
    "very-high-complexity": { title: "Very high cyclomatic complexity", severity: "critical", explanation: "Complexity above 20 strongly correlates with defects. Refactor urgently by extracting decision logic." },
    "long-function": { title: "Long function", severity: "minor", explanation: "Functions over 50 lines often do more than one thing. Extract cohesive blocks into named functions." },
    "deep-nesting": { title: "Deep nesting", severity: "major", explanation: "Nesting deeper than 4 levels hurts readability. Use guard clauses / early returns." },
    "too-many-params": { title: "Too many parameters", severity: "minor", explanation: "More than 5 parameters suggests a missing abstraction. Group related values into a struct." },
    "unsafe-call": { title: "Unsafe C library call", severity: "critical", explanation: "Functions like gets/strcpy/sprintf/strcat do no bounds checking and can cause buffer overflows. Use fgets/strncpy/snprintf or std::string." },
    "goto": { title: "Use of goto", severity: "major", explanation: "goto creates unstructured control flow. Prefer loops, early returns, or RAII cleanup." },
    "magic-number": { title: "Magic numbers", severity: "info", explanation: "Unnamed numeric literals hide intent. Replace them with named constants." },
    "malloc-no-free": { title: "Possible memory leak", severity: "major", explanation: "Memory is allocated in this function but never freed here. Ensure ownership is clear or use smart pointers." },
    "switch-no-default": { title: "Switch without default", severity: "minor", explanation: "Missing default case means unexpected values are silently ignored." },
    "empty-catch": { title: "Empty catch block", severity: "major", explanation: "Swallowing exceptions hides failures. Log or handle the error." },
    "todo": { title: "TODO / FIXME left in code", severity: "info", explanation: "Outstanding work markers indicate known unfinished or broken behavior." },
    "global-var": { title: "Mutable global variable", severity: "minor", explanation: "Global mutable state creates hidden coupling between functions. Pass state explicitly." },
    "missing-semicolon-brace": { title: "Unbalanced braces", severity: "critical", explanation: "The file has mismatched { } which indicates a syntax error." },
};
export function analyze(files) {
    const functions = [];
    const findings = [];
    let fid = 0;
    const add = (rule, file, line, message, fn) => {
        const info = RULE_INFO[rule];
        const f = { id: `F${++fid}`, rule, title: info.title, severity: info.severity, file, line, fn, message, explanation: info.explanation };
        findings.push(f);
        return f;
    };
    let totalLoc = 0;
    const fileStats = [];
    for (const file of files) {
        const raw = file.content.replace(/\r\n/g, "\n");
        const code = stripCode(raw);
        const loc = raw.split("\n").filter((l) => l.trim() && !/^\s*(\/\/|\/\*|\*)/.test(l)).length;
        totalLoc += loc;
        fileStats.push({ name: file.name, loc });
        // TODO markers (from raw)
        raw.split("\n").forEach((l, i) => {
            if (/\b(TODO|FIXME|HACK)\b/.test(l))
                add("todo", file.name, i + 1, l.trim().slice(0, 80));
        });
        const opens = (code.match(/{/g) || []).length, closes = (code.match(/}/g) || []).length;
        if (opens !== closes)
            add("missing-semicolon-brace", file.name, 1, `${opens} '{' vs ${closes} '}'`);
        // find functions at depth 0 (or inside namespace/class depth tracked loosely)
        const re = /([A-Za-z_~][\w:~<>]*)\s*\(([^;{}()]*(?:\([^()]*\)[^;{}()]*)*)\)\s*(?:const\s*)?(?:noexcept\s*)?(?:override\s*)?(?::[^{;]*)?\{/g;
        let m;
        const ranges = [];
        while ((m = re.exec(code))) {
            const name = m[1];
            const base = name.split("::").pop();
            if (KEYWORDS.has(base))
                continue;
            const bodyStart = code.indexOf("{", m.index + m[0].length - 1);
            if (ranges.some(([a, b]) => bodyStart > a && bodyStart < b))
                continue;
            // brace match
            let depth = 0, j = bodyStart, maxN = 0;
            for (; j < code.length; j++) {
                if (code[j] === "{") {
                    depth++;
                    maxN = Math.max(maxN, depth);
                }
                else if (code[j] === "}") {
                    depth--;
                    if (depth === 0)
                        break;
                }
            }
            ranges.push([bodyStart, j]);
            re.lastIndex = j;
            const body = code.slice(bodyStart, j + 1);
            const startLine = lineOf(code, m.index);
            const endLine = lineOf(code, j);
            const params = m[2].trim() === "" || m[2].trim() === "void" ? 0 : m[2].split(",").length;
            const decisions = (body.match(/\b(if|for|while|case|catch)\b|&&|\|\||\?/g) || []).length;
            const complexity = 1 + decisions;
            const calls = Array.from(new Set(Array.from(body.matchAll(/\b([A-Za-z_]\w*)\s*\(/g)).map((x) => x[1]).filter((x) => !KEYWORDS.has(x))));
            const fn = {
                id: `${file.name}::${name}`, name, file: file.name, startLine, endLine, loc: endLine - startLine + 1, params,
                complexity, maxNesting: Math.max(0, maxN - 1), calls, calledBy: [], findings: [], factors: { S: 0, C: 0, I: 0, D: 0 }, risk: 0, severityScore: 0,
            };
            const fadd = (rule, line, msg) => fn.findings.push(add(rule, file.name, line, msg, name));
            if (complexity > 20)
                fadd("very-high-complexity", startLine, `Cyclomatic complexity ${complexity}`);
            else if (complexity > 10)
                fadd("high-complexity", startLine, `Cyclomatic complexity ${complexity}`);
            if (fn.loc > 50)
                fadd("long-function", startLine, `${fn.loc} lines`);
            if (fn.maxNesting > 4)
                fadd("deep-nesting", startLine, `Nesting depth ${fn.maxNesting}`);
            if (params > 5)
                fadd("too-many-params", startLine, `${params} parameters`);
            for (const u of body.matchAll(/\b(gets|strcpy|strcat|sprintf|scanf|vsprintf)\s*\(/g))
                fadd("unsafe-call", lineOf(code, bodyStart + u.index), `Call to ${u[1]}()`);
            for (const g of body.matchAll(/\bgoto\s+\w+/g))
                fadd("goto", lineOf(code, bodyStart + g.index), g[0]);
            const magic = Array.from(body.matchAll(/(?<![\w.])(\d{2,}|\d+\.\d+)(?![\w.])/g)).filter((x) => !["10", "100", "0.0", "1.0"].includes(x[1]));
            if (magic.length >= 3)
                fadd("magic-number", lineOf(code, bodyStart + magic[0].index), `${magic.length} magic numbers, e.g. ${magic.slice(0, 3).map((x) => x[1]).join(", ")}`);
            const allocs = (body.match(/\b(malloc|calloc|realloc)\s*\(|\bnew\b/g) || []).length;
            const frees = (body.match(/\bfree\s*\(|\bdelete\b/g) || []).length;
            if (allocs > 0 && frees === 0 && !/\breturn\b[^;]*\w/.test(body))
                fadd("malloc-no-free", startLine, `${allocs} allocation(s), 0 frees`);
            // switch without default
            for (const s of body.matchAll(/\bswitch\s*\(/g)) {
                const after = body.slice(s.index);
                const open = after.indexOf("{");
                let d = 0, k = open;
                for (; k < after.length; k++) {
                    if (after[k] === "{")
                        d++;
                    else if (after[k] === "}") {
                        d--;
                        if (d === 0)
                            break;
                    }
                }
                if (!/\bdefault\s*:/.test(after.slice(open, k)))
                    fadd("switch-no-default", lineOf(code, bodyStart + s.index), "switch has no default case");
            }
            for (const c of body.matchAll(/\bcatch\s*\([^)]*\)\s*\{\s*\}/g))
                fadd("empty-catch", lineOf(code, bodyStart + c.index), "catch block is empty");
            functions.push(fn);
        }
        // globals: top-level non-const declarations with assignment
        const top = code.split("");
        let depth = 0;
        let topCode = "";
        for (const ch of top) {
            if (ch === "{")
                depth++;
            if (depth === 0)
                topCode += ch;
            else
                topCode += ch === "\n" ? "\n" : " ";
            if (ch === "}")
                depth--;
        }
        for (const g of topCode.matchAll(/^\s*(?!const|constexpr|static\s+const|typedef|using|return|extern)(?:static\s+)?(?:unsigned\s+)?(int|long|char|float|double|bool|size_t|std::\w+(?:<[^>]*>)?)\s*\*?\s*([A-Za-z_]\w*)\s*(=[^;]*|\[[^\]]*\])?\s*;/gm))
            add("global-var", file.name, lineOf(topCode, g.index), `Global '${g[2]}'`);
    }
    // dependency graph
    const byName = new Map();
    for (const f of functions) {
        const short = f.name.split("::").pop();
        byName.set(short, [...(byName.get(short) || []), f]);
    }
    for (const f of functions) {
        f.calls = f.calls.filter((c) => byName.has(c) && c !== f.name.split("::").pop());
        for (const c of f.calls)
            for (const t of byName.get(c))
                t.calledBy.push(f.id);
    }
    // factors
    const maxDeg = Math.max(1, ...functions.map((f) => f.calls.length + f.calledBy.length));
    for (const f of functions) {
        const sev = f.findings.reduce((a, x) => a + SEVERITY_WEIGHT[x.severity], 0);
        f.severityScore = sev;
        const kinds = new Set(f.findings.map((x) => x.rule)).size;
        f.factors = {
            S: Math.min(1, sev / 15),
            C: Math.min(1, (f.complexity - 1) / 20),
            I: Math.min(1, (kinds * (kinds - 1)) / 2 / 6),
            D: (f.calls.length + 2 * f.calledBy.length) / (maxDeg * 2) > 1 ? 1 : (f.calls.length + 2 * f.calledBy.length) / (maxDeg * 2),
        };
        f.risk = computeRisk(f.factors);
    }
    const A = functions.length ? functions.reduce((a, f) => a + f.risk, 0) / functions.length / 100 : 0;
    const density = totalLoc ? (findings.length / totalLoc) * 1000 : 0;
    const F = Math.min(1, density / 50);
    const H = functions.length ? functions.filter((f) => f.risk >= HIGH_RISK_THRESHOLD).length / functions.length : 0;
    const ids = (arr) => arr.map((f) => f.id);
    return {
        files: fileStats,
        functions,
        findings,
        totalLoc,
        qds: { score: computeQDS(A, F, H), A, F, H, density },
        rankings: {
            risk: ids([...functions].sort((a, b) => b.risk - a.risk)),
            severityOnly: ids([...functions].sort((a, b) => b.severityScore - a.severityScore)),
            complexityOnly: ids([...functions].sort((a, b) => b.complexity - a.complexity)),
        },
    };
}
export function riskBand(r) {
    return r >= HIGH_RISK_THRESHOLD ? "high" : r >= 30 ? "medium" : "low";
}
export function toMarkdown(r) {
    let md = `# Static Code Quality Report\n\n**Quality Debt Score:** ${r.qds.score}/100  \n`;
    md += `A=${r.qds.A.toFixed(2)}, F=${r.qds.F.toFixed(2)} (${r.qds.density.toFixed(1)} findings/KLOC), H=${r.qds.H.toFixed(2)}\n\n`;
    md += `Files: ${r.files.length} · LOC: ${r.totalLoc} · Functions: ${r.functions.length} · Findings: ${r.findings.length}\n\n`;
    md += `## Fix priority\n\n| # | Function | File | Risk | S | C | I | D | CC |\n|---|---|---|---|---|---|---|---|---|\n`;
    r.rankings.risk.forEach((id, i) => {
        const f = r.functions.find((x) => x.id === id);
        md += `| ${i + 1} | ${f.name} | ${f.file}:${f.startLine} | ${f.risk} | ${f.factors.S.toFixed(2)} | ${f.factors.C.toFixed(2)} | ${f.factors.I.toFixed(2)} | ${f.factors.D.toFixed(2)} | ${f.complexity} |\n`;
    });
    md += `\n## Findings\n\n`;
    for (const f of r.findings)
        md += `- **[${f.severity}] ${f.title}** — ${f.file}:${f.line}${f.fn ? ` in \`${f.fn}\`` : ""}: ${f.message}. ${f.explanation}\n`;
    return md;
}
