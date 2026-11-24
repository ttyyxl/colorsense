import test, { type TestContext } from "node:test";
import assert from "node:assert/strict";
import {
  clearUploadedImage,
  readUploadedImage,
  saveUploadedImage,
} from "../src/lib/client/uploaded-image.ts";

function installLocalStorage(t: TestContext, overrides: Partial<Storage> = {}) {
  const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const values = new Map<string, string>();
  const storage: Storage = {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => Array.from(values.keys())[index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, String(value)),
    ...overrides,
  };
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });
  t.after(() => {
    if (original) {
      Object.defineProperty(globalThis, "localStorage", original);
    } else {
      Reflect.deleteProperty(globalThis, "localStorage");
    }
  });
  return values;
}

test("uploaded reference images are saved, read and cleared by diagnosis ID", (t) => {
  const values = installLocalStorage(t);
  saveUploadedImage("diagnosis-a", "data:image/jpeg;base64,AAAA");
  saveUploadedImage("diagnosis-b", "data:image/png;base64,BBBB");

  assert.equal(readUploadedImage("diagnosis-a"), "data:image/jpeg;base64,AAAA");
  assert.equal(readUploadedImage("missing"), null);
  assert.equal(values.get("colorsense:uploaded-image:diagnosis-a"), "data:image/jpeg;base64,AAAA");

  clearUploadedImage("diagnosis-a");
  assert.equal(readUploadedImage("diagnosis-a"), null);
  assert.equal(readUploadedImage("diagnosis-b"), "data:image/png;base64,BBBB");
});

test("localStorage failures safely fall back to text-to-image", (t) => {
  installLocalStorage(t, {
    setItem: () => {
      throw new Error("quota exceeded");
    },
    getItem: () => {
      throw new Error("storage denied");
    },
    removeItem: () => {
      throw new Error("storage denied");
    },
  });

  assert.doesNotThrow(() => saveUploadedImage("diagnosis-a", "data:image/jpeg;base64,AAAA"));
  assert.equal(readUploadedImage("diagnosis-a"), null);
  assert.doesNotThrow(() => clearUploadedImage("diagnosis-a"));
});
