import { api } from "../../scripts/api.js";

/*
 * پریویو داخل لیست انتخاب لورا (برای نود Load LoRA (with Preview)).
 * هر منوی کشویی که اسم لوراها داخلش باشد شناسایی می‌شود و با رفتن موس روی
 * هر آیتم، عکس همان لورا کنار منو نشان داده می‌شود.
 */

const FLOAT_SIZE = 300;
let floatBox = null;
let floatImg = null;
let floatToken = 0;

function showFloat(name, anchorRect) {
  if (!floatBox) {
    floatBox = document.createElement("div");
    floatBox.style.cssText =
      `position:fixed;z-index:100000;width:${FLOAT_SIZE}px;height:${FLOAT_SIZE}px;` +
      "box-sizing:border-box;padding:4px;border:2px solid #666;border-radius:10px;" +
      "background:#111;pointer-events:none;display:none;box-shadow:0 4px 18px rgba(0,0,0,0.5);";
    floatImg = document.createElement("img");
    floatImg.style.cssText = "width:100%;height:100%;object-fit:contain;display:block;";
    floatBox.appendChild(floatImg);
    document.body.appendChild(floatBox);
  }

  const boxW = FLOAT_SIZE + 12;
  const spaceLeft = anchorRect.left;
  const spaceRight = window.innerWidth - anchorRect.right;
  let left;
  if (spaceLeft >= boxW + 8) left = anchorRect.left - boxW - 8;
  else if (spaceRight >= boxW + 8) left = anchorRect.right + 8;
  else left = Math.max(8, window.innerWidth - boxW - 8);
  const top = Math.min(
    Math.max(8, anchorRect.top),
    Math.max(8, window.innerHeight - boxW - 8)
  );
  floatBox.style.left = left + "px";
  floatBox.style.top = top + "px";

  const my = ++floatToken;
  floatBox.style.display = "none";
  floatImg.onload = () => {
    if (my === floatToken) floatBox.style.display = "block";
  };
  floatImg.onerror = () => {
    if (my === floatToken) floatBox.style.display = "none";
  };
  floatImg.src = api.apiURL(`/lora_preview?name=${encodeURIComponent(name)}`);
}

function hideFloat() {
  floatToken++;
  if (floatBox) floatBox.style.display = "none";
}

async function attach(root) {
  if (root.dataset.loraPreview) return;
  const entries = [...root.querySelectorAll(".litemenu-entry")];
  if (!entries.length) return;

  let list = [];
  try {
    const r = await api.fetchApi("/lora_preview_list");
    list = await r.json();
  } catch (e) {
    return;
  }
  if (!root.isConnected || root.dataset.loraPreview) return;

  const loraSet = new Set(list);
  const names = entries.map((el) => el.textContent.trim());
  const hits = names.filter((n) => loraSet.has(n)).length;
  if (hits < Math.max(1, names.length * 0.8)) return; // منوی لورا نیست

  root.dataset.loraPreview = "1";
  root.addEventListener("mouseleave", hideFloat);
  entries.forEach((el, i) => {
    el.addEventListener("mouseenter", () => {
      if (loraSet.has(names[i])) showFloat(names[i], root.getBoundingClientRect());
    });
  });

  const timer = setInterval(() => {
    if (!document.body.contains(root)) {
      hideFloat();
      clearInterval(timer);
    }
  }, 250);
}

new MutationObserver((mutations) => {
  for (const m of mutations) {
    for (const node of m.addedNodes) {
      if (node instanceof HTMLElement && node.classList.contains("litecontextmenu")) {
        attach(node);
      }
    }
  }
}).observe(document.body, { childList: true });
