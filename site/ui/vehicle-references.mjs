// Compact copies of the credited reference media load only when the viewer is opened.
import { $, state } from "./context.mjs?v=dev";

const viewer = $("vehicle-references");
const video = $("reference-video");
const picture = $("reference-image");
const tabs = [...viewer.querySelectorAll("[data-reference]")];
let selected = "payload";

function loadSelected() {
  if (!viewer.open || state.view !== "mission") return;
  if (selected === "payload" && !picture.hasAttribute("src")) {
    picture.src = "./assets/vehicle-references/payload-cutaway.webp?v=dev";
  } else if (selected === "cad" && !video.hasAttribute("src")) {
    video.preload = "metadata";
    video.poster = "./assets/vehicle-references/cad-poster.webp?v=dev";
    video.src = "./assets/vehicle-references/cad-rotation.mp4?v=dev";
  }
}

function selectReference(name) {
  selected = name;
  video.pause();
  for (const tab of tabs) {
    const active = tab.dataset.reference === name;
    tab.setAttribute("aria-selected", String(active));
    tab.tabIndex = active ? 0 : -1;
    $(tab.getAttribute("aria-controls")).hidden = !active;
  }
  loadSelected();
}

for (const tab of tabs) {
  tab.addEventListener("click", () => selectReference(tab.dataset.reference));
  tab.addEventListener("keydown", (event) => {
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next = event.key === "Home" ? tabs[0] : event.key === "End" ? tabs.at(-1) : tabs.find(item => item !== tab);
    selectReference(next.dataset.reference);
    next.focus();
  });
}

viewer.addEventListener("toggle", () => {
  if (viewer.open) loadSelected();
  else video.pause();
});
new MutationObserver(() => {
  if (state.view !== "mission") video.pause();
  else loadSelected();
}).observe(document.body, { attributes: true, attributeFilter: ["class"] });
document.addEventListener("visibilitychange", () => { if (document.hidden) video.pause(); });

function mediaStatus(kind, text) {
  const status = $(`reference-${kind}-status`);
  status.textContent = text;
  status.hidden = !text;
  $(`reference-${kind}-retry`).hidden = !text || text.startsWith("Loading");
}
picture.addEventListener("load", () => { picture.hidden = false; mediaStatus("image", ""); });
picture.addEventListener("error", () => { picture.hidden = true; mediaStatus("image", "Reference image unavailable. Open the original below or retry."); });
video.addEventListener("loadeddata", () => mediaStatus("video", ""));
video.addEventListener("error", () => mediaStatus("video", "Reference video unavailable. Open the original below or retry."));
$("reference-image-retry").addEventListener("click", () => {
  picture.removeAttribute("src");
  mediaStatus("image", "Loading APL payload cutaway...");
  loadSelected();
});
$("reference-video-retry").addEventListener("click", () => {
  video.removeAttribute("src");
  mediaStatus("video", "");
  loadSelected();
  video.load();
});
