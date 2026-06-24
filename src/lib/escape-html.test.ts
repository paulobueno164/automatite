import { test } from "node:test";
import assert from "node:assert";
import { escapeHtml } from "./email-template";

test("escapeHtml should escape sensitive HTML characters", () => {
  const input = '<script>alert("xss")</assert> & "quote"';
  const expected = '&lt;script&gt;alert(&quot;xss&quot;)&lt;/assert&gt; &amp; &quot;quote&quot;';
  assert.strictEqual(escapeHtml(input), expected);
});

test("escapeHtml should return empty string for empty input", () => {
  assert.strictEqual(escapeHtml(""), "");
});

test("escapeHtml should not change safe strings", () => {
  const safe = "Hello World 123";
  assert.strictEqual(escapeHtml(safe), safe);
});
