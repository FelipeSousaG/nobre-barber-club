import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

test("a política HTTP inclui as defesas de navegador esperadas", () => {
  const proxy = readFileSync(new URL("../proxy.ts", import.meta.url), "utf8");
  for (const directive of ["script-src", "frame-ancestors 'none'", "object-src 'none'", "base-uri 'self'", "form-action 'self'"]) {
    assert.match(proxy, new RegExp(directive.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  for (const header of ["X-Content-Type-Options", "Referrer-Policy", "Permissions-Policy", "Strict-Transport-Security"]) {
    assert.match(proxy, new RegExp(header));
  }
  assert.doesNotMatch(proxy, /Access-Control-Allow-Origin/);
});
