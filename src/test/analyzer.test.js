import { describe, it, expect } from "vitest";
import { computeRisk, computeQDS, analyze } from "@/lib/analyzer";
import { SAMPLES } from "@/lib/samples";
describe("formulas", () => {
    it("risk weights", () => expect(computeRisk({ S: 1, C: 0, I: 0, D: 0 })).toBe(35));
    it("risk full", () => expect(computeRisk({ S: 1, C: 1, I: 1, D: 1 })).toBe(100));
    it("qds weights", () => expect(computeQDS(1, 0, 0)).toBe(50));
    it("high-debt sample scores worse than clean", () => {
        const c = analyze(SAMPLES[0].files), d = analyze(SAMPLES[1].files);
        expect(d.qds.score).toBeGreaterThan(c.qds.score);
        expect(d.functions.map(f => f.name)).toContain("parse_record");
    });
});
