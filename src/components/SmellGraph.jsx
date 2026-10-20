import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useEffect, useMemo, useRef, useState } from "react";
const W = 900, H = 600;
export function SmellGraph({ result }) {
    const { nodes0, links } = useMemo(() => {
        const nodes = [];
        const links = [];
        const rnd = () => (Math.random() - 0.5) * 300;
        for (const f of result.files)
            nodes.push({ id: "file:" + f.name, label: f.name, kind: "file", x: W / 2 + rnd(), y: H / 2 + rnd(), vx: 0, vy: 0, detail: `${f.loc} LOC` });
        for (const fn of result.functions) {
            nodes.push({ id: fn.id, label: fn.name, kind: "fn", x: W / 2 + rnd(), y: H / 2 + rnd(), vx: 0, vy: 0, risk: fn.risk, detail: `Risk ${fn.risk} · CC ${fn.complexity} · ${fn.findings.length} findings` });
            links.push({ s: "file:" + fn.file, t: fn.id, kind: "contains" });
            for (const c of fn.calls)
                for (const t of result.functions.filter((x) => x.name.split("::").pop() === c))
                    links.push({ s: fn.id, t: t.id, kind: "calls" });
            fn.findings.forEach((a, i) => fn.findings.slice(i + 1).forEach((b) => a.rule !== b.rule && links.push({ s: a.id, t: b.id, kind: "cooccur" })));
        }
        for (const f of result.findings) {
            nodes.push({ id: f.id, label: f.title, kind: "finding", x: W / 2 + rnd(), y: H / 2 + rnd(), vx: 0, vy: 0, sev: f.severity, detail: `${f.severity} · line ${f.line} · ${f.message}` });
            links.push({ s: f.fn ? `${f.file}::${f.fn}` : "file:" + f.file, t: f.id, kind: "has" });
        }
        return { nodes0: nodes, links };
    }, [result]);
    const [nodes, setNodes] = useState(nodes0);
    const [hover, setHover] = useState(null);
    const [selected, setSelected] = useState(null);
    const drag = useRef(null);
    const svg = useRef(null);
    const live = useRef(nodes0);
    useEffect(() => {
        live.current = nodes0.map((n) => ({ ...n }));
        let frame = 0, raf = 0;
        const tick = () => {
            const ns = live.current;
            const idx = new Map(ns.map((n) => [n.id, n]));
            for (let i = 0; i < ns.length; i++)
                for (let j = i + 1; j < ns.length; j++) {
                    const a = ns[i], b = ns[j];
                    let dx = a.x - b.x, dy = a.y - b.y;
                    const d2 = dx * dx + dy * dy + 0.01;
                    const f = 1800 / d2;
                    const d = Math.sqrt(d2);
                    dx /= d;
                    dy /= d;
                    a.vx += dx * f;
                    a.vy += dy * f;
                    b.vx -= dx * f;
                    b.vy -= dy * f;
                }
            for (const l of links) {
                const a = idx.get(l.s), b = idx.get(l.t);
                if (!a || !b)
                    continue;
                const target = l.kind === "cooccur" ? 50 : l.kind === "calls" ? 140 : 80;
                const dx = b.x - a.x, dy = b.y - a.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
                const k = ((d - target) / d) * (l.kind === "cooccur" ? 0.02 : 0.04);
                a.vx += dx * k;
                a.vy += dy * k;
                b.vx -= dx * k;
                b.vy -= dy * k;
            }
            for (const n of ns) {
                if (drag.current === n.id) {
                    n.vx = n.vy = 0;
                    continue;
                }
                n.vx += (W / 2 - n.x) * 0.002;
                n.vy += (H / 2 - n.y) * 0.002;
                n.vx *= 0.82;
                n.vy *= 0.82;
                n.x += n.vx;
                n.y += n.vy;
                n.x = Math.max(20, Math.min(W - 20, n.x));
                n.y = Math.max(20, Math.min(H - 20, n.y));
            }
            setNodes(ns.map((n) => ({ ...n })));
            if (frame++ < 400 || drag.current)
                raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        svg.current.__restart = () => { frame = 300; cancelAnimationFrame(raf); raf = requestAnimationFrame(tick); };
        return () => cancelAnimationFrame(raf);
    }, [nodes0, links]);
    const pos = new Map(nodes.map((n) => [n.id, n]));
    const neighbors = useMemo(() => {
        if (!selected)
            return null;
        const s = new Set([selected]);
        links.forEach((l) => { if (l.s === selected)
            s.add(l.t); if (l.t === selected)
            s.add(l.s); });
        return s;
    }, [selected, links]);
    const onMove = (e) => {
        if (!drag.current || !svg.current)
            return;
        const r = svg.current.getBoundingClientRect();
        const n = live.current.find((x) => x.id === drag.current);
        if (n) {
            n.x = ((e.clientX - r.left) / r.width) * W;
            n.y = ((e.clientY - r.top) / r.height) * H;
        }
    };
    const color = (n) => n.kind === "file" ? "var(--chart-2)" : n.kind === "fn"
        ? (n.risk >= 60 ? "var(--destructive)" : n.risk >= 30 ? "var(--chart-4)" : "var(--chart-2)")
        : n.sev === "critical" ? "var(--destructive)" : n.sev === "major" ? "var(--chart-1)" : n.sev === "minor" ? "var(--chart-4)" : "var(--muted-foreground)";
    return (_jsxs("div", { className: "relative", children: [_jsxs("svg", { ref: svg, viewBox: `0 0 ${W} ${H}`, className: "h-[560px] w-full rounded-lg border border-border bg-card", onPointerMove: onMove, onPointerUp: () => (drag.current = null), onPointerLeave: () => (drag.current = null), children: [links.map((l, i) => {
                        const a = pos.get(l.s), b = pos.get(l.t);
                        if (!a || !b)
                            return null;
                        const dim = neighbors && !(neighbors.has(l.s) && neighbors.has(l.t));
                        return _jsx("line", { x1: a.x, y1: a.y, x2: b.x, y2: b.y, stroke: l.kind === "calls" ? "var(--primary)" : l.kind === "cooccur" ? "var(--destructive)" : "var(--border)", strokeWidth: l.kind === "calls" ? 1.6 : 1, strokeDasharray: l.kind === "cooccur" ? "3 3" : undefined, opacity: dim ? 0.08 : 0.8 }, i);
                    }), nodes.map((n) => {
                        const r = n.kind === "file" ? 14 : n.kind === "fn" ? 7 + (n.risk ?? 0) / 10 : 5;
                        const dim = neighbors && !neighbors.has(n.id);
                        return (_jsxs("g", { transform: `translate(${n.x},${n.y})`, opacity: dim ? 0.15 : 1, className: "cursor-pointer", onPointerDown: (e) => { drag.current = n.id; e.target.setPointerCapture?.(e.pointerId); svg.current.__restart?.(); }, onClick: () => setSelected(selected === n.id ? null : n.id), onMouseEnter: () => setHover(n), onMouseLeave: () => setHover(null), children: [n.kind === "file" ? _jsx("rect", { x: -r, y: -r, width: r * 2, height: r * 2, rx: 3, fill: color(n) })
                                    : n.kind === "finding" ? _jsx("polygon", { points: `0,${-r - 1} ${r + 1},${r} ${-r - 1},${r}`, fill: color(n) })
                                        : _jsx("circle", { r: r, fill: color(n), stroke: "var(--background)", strokeWidth: 2 }), n.kind !== "finding" && _jsx("text", { y: -r - 5, textAnchor: "middle", fontSize: 11, fill: "var(--foreground)", className: "font-mono pointer-events-none", children: n.label })] }, n.id));
                    })] }), hover && (_jsxs("div", { className: "pointer-events-none absolute left-3 top-3 max-w-xs rounded-md border border-border bg-popover p-3 text-xs shadow-lg", children: [_jsx("div", { className: "font-mono font-semibold text-foreground", children: hover.label }), _jsx("div", { className: "mt-1 text-muted-foreground", children: hover.detail })] })), _jsxs("div", { className: "mt-3 flex flex-wrap gap-4 text-xs text-muted-foreground", children: [_jsx("span", { children: "\u25A0 file" }), _jsx("span", { children: "\u25CF function (size = risk)" }), _jsx("span", { children: "\u25B2 finding" }), _jsx("span", { style: { color: "var(--primary)" }, children: "\u2014 caller\u2192callee" }), _jsx("span", { style: { color: "var(--destructive)" }, children: "- - co-occurring smells" }), _jsx("span", { children: "Click a node to isolate its cluster \u00B7 drag to move" })] })] }));
}
