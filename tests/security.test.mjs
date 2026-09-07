import test from "node:test";
import assert from "node:assert/strict";
import { createCsrfToken, isSameOriginMutation, verifyCsrfToken } from "../lib/security-core.ts";
import { hashPassword, verifyPassword } from "../lib/password.ts";

const secret = "test-secret-with-at-least-thirty-two-characters";

test("token CSRF é válido apenas para o usuário e janela assinados", async () => {
  const token = await createCsrfToken("user-a", secret, 3600, 1_000);
  assert.equal(await verifyCsrfToken(token, "user-a", secret, 1_001), true);
  assert.equal(await verifyCsrfToken(token, "user-b", secret, 1_001), false);
  assert.equal(await verifyCsrfToken(`${token.slice(0, -1)}x`, "user-a", secret, 1_001), false);
  assert.equal(await verifyCsrfToken(token, "user-a", secret, 4_601), false);
});

test("mutações rejeitam origem cruzada", () => {
  assert.equal(isSameOriginMutation("https://nobre.example/api/profile", "https://nobre.example"), true);
  assert.equal(isSameOriginMutation("https://nobre.example/api/profile", "https://evil.example"), false);
  assert.equal(isSameOriginMutation("https://nobre.example/api/profile", "not-a-url"), false);
});

test("senha é derivada com salt e não pode ser validada por aproximação", async () => {
  const first = await hashPassword("uma-senha-forte-e-unica");
  const second = await hashPassword("uma-senha-forte-e-unica");
  assert.notEqual(first, second);
  assert.doesNotMatch(first, /uma-senha-forte-e-unica/);
  assert.equal(await verifyPassword("uma-senha-forte-e-unica", first), true);
  assert.equal(await verifyPassword("senha-errada", first), false);
});
