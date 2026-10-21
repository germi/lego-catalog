/**
 * useSnapshotStore — localStorage-backed CRUD for SuperLineChart stories.
 *
 * A **story** is `{ id, title, scenes: Scene[] }`.
 * A **scene** is a plain JSON snapshot produced by `captureScene()`.
 *
 * All mutations are immediately flushed to localStorage so the store survives
 * page reloads.
 *
 * Usage:
 *   const store = useSnapshotStore()
 *   store.saveScene("My story", snapshot)     // append to or create story
 *   store.stories.value                        // reactive Array of story objects
 *   store.deleteScene(storyId, sceneIndex)
 *   store.deleteStory(storyId)
 *   store.renameStory(storyId, newTitle)
 *   store.moveScene(storyId, fromIndex, toIndex)
 *   store.exportJSON()                         // triggers file download
 *   store.importJSON(jsonString)               // merge from JSON string
 *   store.clear()                              // wipe everything
 */

import { ref } from "vue";
import { serializeScene, deserializeScene } from "../../utils/scene/captureScene.js";

const DEFAULT_STORAGE_KEY = "sidecharts:stories:v1";

// ─── localStorage helpers (now closure-bound to a key) ────────────────────────

function readStorage(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return [];
    return JSON.parse(raw, _reviver);
  } catch {
    return [];
  }
}

function writeStorage(key, stories) {
  try {
    localStorage.setItem(key, JSON.stringify(stories, _replacer));
  } catch (e) {
    console.warn("[useSnapshotStore] localStorage write failed:", e);
  }
}

function _replacer(_k, v) {
  if (v === Infinity)  return "__Infinity__";
  if (v === -Infinity) return "__-Infinity__";
  return v;
}

function _reviver(_k, v) {
  if (v === "__Infinity__")  return Infinity;
  if (v === "__-Infinity__") return -Infinity;
  return v;
}

function makeId() {
  return `story-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// ─── Composable ───────────────────────────────────────────────────────────────

/**
 * @param {string} [storageKey="sidecharts:stories:v1"]
 *   localStorage key. Pass a chart-specific key (e.g.
 *   "sidecharts:scatter-stories:v1") to keep scatter stories from mixing
 *   with line stories. The legacy SuperLineChart page passes nothing →
 *   gets the original key, fully backwards-compatible.
 */
export function useSnapshotStore(storageKey = DEFAULT_STORAGE_KEY) {
  const stories = ref(readStorage(storageKey));

  function _flush() {
    writeStorage(storageKey, stories.value);
  }

  // ── Save a scene snapshot to a named story ──────────────────────────────────
  // If a story with `storyTitle` already exists, the scene is appended to it.
  // Otherwise a new story is created.
  function saveScene(storyTitle, sceneSnapshot) {
    const title = (storyTitle || "Untitled").trim();
    const existing = stories.value.find((s) => s.title === title);
    if (existing) {
      existing.scenes.push(sceneSnapshot);
    } else {
      stories.value.push({ id: makeId(), title, scenes: [sceneSnapshot] });
    }
    _flush();
  }

  // ── Delete a single scene ───────────────────────────────────────────────────
  // If the story becomes empty it is also removed.
  function deleteScene(storyId, sceneIndex) {
    const story = stories.value.find((s) => s.id === storyId);
    if (!story) return;
    story.scenes.splice(sceneIndex, 1);
    if (story.scenes.length === 0) {
      stories.value = stories.value.filter((s) => s.id !== storyId);
    }
    _flush();
  }

  // ── Delete an entire story ──────────────────────────────────────────────────
  function deleteStory(storyId) {
    stories.value = stories.value.filter((s) => s.id !== storyId);
    _flush();
  }

  // ── Overwrite a single scene in-place ──────────────────────────────────────
  function updateScene(storyId, sceneIndex, sceneSnapshot) {
    const story = stories.value.find((s) => s.id === storyId);
    if (!story || sceneIndex < 0 || sceneIndex >= story.scenes.length) return;
    story.scenes[sceneIndex] = sceneSnapshot;
    _flush();
  }

  // ── Rename a story ──────────────────────────────────────────────────────────
  function renameStory(storyId, newTitle) {
    const story = stories.value.find((s) => s.id === storyId);
    if (story) { story.title = (newTitle || "Untitled").trim(); _flush(); }
  }

  // ── Reorder scenes within a story ──────────────────────────────────────────
  function moveScene(storyId, fromIndex, toIndex) {
    const story = stories.value.find((s) => s.id === storyId);
    if (!story) return;
    const scenes = story.scenes;
    const [item] = scenes.splice(fromIndex, 1);
    scenes.splice(toIndex, 0, item);
    _flush();
  }

  // ── Export all stories as a downloadable JSON file ─────────────────────────
  function exportJSON() {
    const payload = JSON.stringify(
      { version: 1, exportedAt: new Date().toISOString(), stories: stories.value },
      _replacer,
      2,
    );
    const blob = new Blob([payload], { type: "application/json" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = `sidecharts-stories-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ── Import stories from a JSON string (merges, doesn't replace) ────────────
  function importJSON(json) {
    try {
      const parsed = JSON.parse(json, _reviver);
      const incoming =
        Array.isArray(parsed)           ? parsed           :  // bare array
        Array.isArray(parsed.stories)   ? parsed.stories   :  // wrapped object
        null;
      if (!incoming) throw new Error("Unrecognised format — expected stories array");
      // Avoid duplicate ids
      const existingIds = new Set(stories.value.map((s) => s.id));
      for (const s of incoming) {
        if (!s.id || existingIds.has(s.id)) s.id = makeId();
        stories.value.push(s);
        existingIds.add(s.id);
      }
      _flush();
    } catch (e) {
      console.error("[useSnapshotStore] importJSON failed:", e);
      throw e;   // re-throw so the caller can show a UI error message
    }
  }

  // ── Wipe everything ─────────────────────────────────────────────────────────
  function clear() {
    stories.value = [];
    localStorage.removeItem(STORAGE_KEY);
  }

  return {
    stories,
    saveScene,
    updateScene,
    deleteScene,
    deleteStory,
    renameStory,
    moveScene,
    exportJSON,
    importJSON,
    clear,
  };
}
