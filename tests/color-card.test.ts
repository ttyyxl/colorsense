import test from "node:test";
import assert from "node:assert/strict";
import { COLOR_CARDS, describeColorCardSeasons, summarizeColorCardSelections } from "../src/lib/color-card.ts";
import { SEASON_KEYS } from "../src/lib/vision-schema.ts";

test("color cards: four cards, each with four valid hex colors", () => {
  assert.equal(COLOR_CARDS.length, 4);
  assert.equal(new Set(COLOR_CARDS.map((card) => card.id)).size, COLOR_CARDS.length);
  for (const card of COLOR_CARDS) {
    for (const season of SEASON_KEYS) {
      assert.match(card.colors[season], /^#[0-9a-f]{6}$/i, `${card.id}.${season}`);
    }
  }
});

test("color cards: majority season wins", () => {
  const seasons = summarizeColorCardSelections([
    { cardId: "warm", season: "spring" },
    { cardId: "violet", season: "spring" },
    { cardId: "blue", season: "autumn" },
    { cardId: "green", season: "spring" },
  ]);
  assert.deepEqual(seasons, ["spring"]);
  assert.equal(describeColorCardSeasons(seasons), "春季型");
});

test("color cards: ties return every tied season in canonical order", () => {
  const seasons = summarizeColorCardSelections([
    { cardId: "warm", season: "autumn" },
    { cardId: "violet", season: "spring" },
    { cardId: "blue", season: "autumn" },
    { cardId: "green", season: "spring" },
  ]);
  assert.deepEqual(seasons, ["spring", "autumn"]);
  assert.equal(describeColorCardSeasons(seasons), "春季、秋季型");
});

test("color cards: four different choices return all seasons", () => {
  const seasons = summarizeColorCardSelections([
    { cardId: "warm", season: "spring" },
    { cardId: "violet", season: "summer" },
    { cardId: "blue", season: "autumn" },
    { cardId: "green", season: "winter" },
  ]);
  assert.deepEqual(seasons, [...SEASON_KEYS]);
});

test("color cards: no selections produces an empty summary", () => {
  assert.deepEqual(summarizeColorCardSelections([]), []);
  assert.equal(describeColorCardSeasons([]), "");
});
