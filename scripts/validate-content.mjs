import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(".");
const read = (file) => readFile(resolve(root, file), "utf8");

const [indexHtml, readme, manifest, vercel] = await Promise.all([
  read("index.html"),
  read("README.md"),
  read("manifest.json"),
  read("vercel.json"),
]);

const checks = [
  {
    name: "home safety banner exists",
    pass: indexHtml.includes("Wellness guidance, not medical or financial advice"),
  },
  {
    name: "privacy and safety modal exists",
    pass: indexHtml.includes('id="privacySafetyModal"'),
  },
  {
    name: "gemini local-storage note exists",
    pass: indexHtml.includes("held only for the current tab") && indexHtml.includes("sent in an API header"),
  },
  {
    name: "about copy avoids personal sound healing application phrasing",
    pass: !indexHtml.includes("personal sound healing application"),
  },
  {
    name: "readme describes safety boundary",
    pass: readme.includes("not medical treatment") && readme.includes("financial advice"),
  },
  {
    name: "manifest description avoids healing claim phrasing",
    pass: manifest.includes("wellness routines") && !manifest.includes("healing frequencies"),
  },
  {
    name: "security headers are present",
    pass: vercel.includes("Content-Security-Policy")
      && vercel.includes("Strict-Transport-Security")
      && vercel.includes("object-src 'none'"),
  },
  {
    name: "unsupported efficacy claims are absent",
    pass: !/repairs your DNA|reduces cortisol|activates your pineal gland|scientifically proven to reduce|remarkably accurate|most powerful manifestation portal|universe (?:is listening|starts cooperating)|wiring into permanent patterns|higher consciousness baseline|fundamentally different frequency/i.test(indexHtml),
  },
  {
    name: "tones are not assigned biological or guaranteed effects",
    pass: !/\b\d{2,3}\s*Hz (?:clears|releases|opens|sharpens|grounds|tunes|connects|repairs|heals)|nervous system (?:shifts|baseline|says)|your body (?:recognizes|responds)|frequencies work fastest/i.test(indexHtml),
  },
  {
    name: "historical model is not presented as financial instruction",
    pass: !/optimal time to reduce exposure|optimal entry point|optimal buying opportunity|current bull market expected to peak/i.test(indexHtml),
  },
];

const failed = checks.filter((check) => !check.pass);

if (failed.length > 0) {
  console.error(JSON.stringify({ ok: false, failed: failed.map((check) => check.name) }, null, 2));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, passed: checks.map((check) => check.name) }, null, 2));
