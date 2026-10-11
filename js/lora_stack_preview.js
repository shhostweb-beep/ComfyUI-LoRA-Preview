import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

/*
 * Power LoRA Loader (with Preview)
 * - هر ردیف: روشن/خاموش، عکس کوچک، اسم لورا، strength، حذف
 * - کلیک روی اسم/عکس: لیست لوراها (با پریویو موقع حرکت موس روی هر آیتم)
 * - موس روی ردیف: عکس بزرگ کنار نود
 * - دکمه Add LoRA پایین نود
 */

const LG = window.LiteGraph;
const NODE_CLASS = "LoraStackPreview";
const M = 10; // حاشیه کناری
const HEADER_H = 24;
const ADD_H = 30;
const ROW_H_THUMB = 64;
const ROW_H_COMPACT = 28;
const STEP = 0.05;

const colors = () => ({
  bg: LG.WIDGET_BGCOLOR || "#222",
  outline: LG.WIDGET_OUTLINE_COLOR || "#666",
  text: LG.WIDGET_TEXT_COLOR || "#ddd",
  sub: LG.WIDGET_SECONDARY_TEXT_COLOR || "#999",
});

/* ---------------- کش عکس‌ها ---------------- */
const imgCache = new Map();
function getPreview(name) {
  if (!name) return null;
  let e = imgCache.get(name);
  if (!e) {
    e = { img: new Image(), status: "loading" };
    e.img.onload = () => {
      e.status = "ok";
      app.graph?.setDirtyCanvas(true, true);
    };
    e.img.onerror = () => {
      e.status = "fail";
      app.graph?.setDirtyCanvas(true, true);
    };
    e.img.src = api.apiURL(`/lora_preview?name=${encodeURIComponent(name)}`);
    imgCache.set(name, e);
  }
  return e;
}

/* ---------------- پریویو شناور داخل منوی انتخاب ---------------- */
let floatBox = null;
let floatImg = null;
let floatToken = 0;
const FLOAT_SIZE = 300;

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

  // موقعیت فقط به خود منو بستگی دارد (نه به سایز عکس) تا جا به جا نشود
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

async function pickLora(event, callback) {
  let list = [];
  try {
    const r = await api.fetchApi("/lora_preview_list");
    list = await r.json();
  } catch (e) {
    console.error("[LoraPreview] could not load lora list", e);
  }
  if (!list.length) list = ["(no LoRAs found)"];

  const menu = new LG.ContextMenu(list, {
    event,
    title: "Select LoRA",
    callback: (value) => {
      hideFloat();
      if (value && value !== "(no LoRAs found)") callback(value);
    },
  });

  const root = menu.root;
  root.dataset.loraPreview = "1"; // تا lora_menu_preview.js دوباره روی همین منو کاری نکند
  root.addEventListener("mouseleave", hideFloat);
  root.querySelectorAll(".litemenu-entry").forEach((el) => {
    el.addEventListener("mouseenter", () => {
      const name = el.textContent.trim();
      if (name && name !== "(no LoRAs found)") showFloat(name, root.getBoundingClientRect());
    });
  });
  const timer = setInterval(() => {
    if (!document.body.contains(root)) {
      hideFloat();
      clearInterval(timer);
    }
  }, 250);
}

/* ---------------- ابزارهای رسم ---------------- */
function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}
function fit(ctx, text, maxW) {
  if (maxW <= 0) return "";
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + "…").width > maxW) t = t.slice(0, -1);
  return t + "…";
}
const baseName = (n) => (n || "").split(/[\\/]/).pop().replace(/\.[^.]+$/, "");

function geom(W, thumbsOn, h) {
  const x0 = M;
  const x1 = W - M;
  const del = { x: x1 - 24, w: 24 };
  const str = { x: del.x - 104, w: 100 };
  const thumb = thumbsOn ? h - 8 : 0;
  const nameX = x0 + 28 + (thumbsOn ? thumb + 8 : 0);
  return { x0, x1, del, str, thumb, nameX, nameEnd: str.x - 6 };
}

/* ---------------- نود ---------------- */
app.registerExtension({
  name: "LoraPreview.PowerLoraLoader",

  async nodeCreated(node) {
    if (node.comfyClass !== NODE_CLASS) return;

    const jsonWidget = node.widgets.find((w) => w.name === "loras_json");
    if (!jsonWidget) return;

    // مخفی کردن ویجت JSON
    jsonWidget.hidden = true;
    jsonWidget.computeSize = () => [0, -4];
    jsonWidget.draw = () => {};
    jsonWidget.mouse = () => false;

    const rows = []; // {on, lora, strength}
    const rowWidgets = [];
    let hover = -1;

    const thumbsOn = () => node.properties?.thumbs !== false;
    const rowH = () => (thumbsOn() ? ROW_H_THUMB : ROW_H_COMPACT);
    const redraw = () => app.graph?.setDirtyCanvas(true, true);
    const commit = () => {
      jsonWidget.value = JSON.stringify(rows);
      redraw();
    };
    const fitHeight = () => {
      const size = node.computeSize([node.size[0]]);
      node.setSize([node.size[0], size[1]]);
      redraw();
    };

    /* ---- هدر ---- */
    const headerWidget = {
      name: "lora_header",
      type: "custom",
      value: null,
      options: { serialize: false },
      computeSize: (w) => [w, HEADER_H],
      draw(ctx, n, _w, y) {
        this._y = y;
        const c = colors();
        const g = geom(n.size[0], thumbsOn(), rowH());
        const allOn = rows.length > 0 && rows.every((r) => r.on);
        ctx.save();
        ctx.font = "12px Arial";
        ctx.textBaseline = "middle";
        // Toggle All
        ctx.beginPath();
        ctx.arc(g.x0 + 14, y + HEADER_H / 2, 6, 0, Math.PI * 2);
        ctx.fillStyle = allOn ? "#6c6" : "#777";
        ctx.fill();
        ctx.strokeStyle = c.outline;
        ctx.stroke();
        ctx.fillStyle = c.sub;
        ctx.textAlign = "left";
        ctx.fillText("Toggle All", g.x0 + 28, y + HEADER_H / 2);
        // Previews pill
        const px = g.x0 + 108;
        rr(ctx, px, y + 3, 104, HEADER_H - 6, 9);
        ctx.fillStyle = thumbsOn() ? "rgba(90,170,90,0.35)" : "rgba(128,128,128,0.2)";
        ctx.fill();
        ctx.strokeStyle = c.outline;
        ctx.stroke();
        ctx.fillStyle = c.text;
        ctx.textAlign = "center";
        ctx.fillText(`Previews: ${thumbsOn() ? "ON" : "OFF"}`, px + 52, y + HEADER_H / 2);
        // Strength
        ctx.fillStyle = c.sub;
        ctx.fillText("Strength", g.str.x + g.str.w / 2, y + HEADER_H / 2);
        ctx.restore();
      },
      mouse(event, pos) {
        if (event.type !== "pointerdown" && event.type !== "mousedown") return false;
        const g = geom(node.size[0], thumbsOn(), rowH());
        if (pos[0] < g.x0 + 100) {
          const allOn = rows.length > 0 && rows.every((r) => r.on);
          rows.forEach((r) => (r.on = !allOn));
          commit();
          return true;
        }
        if (pos[0] >= g.x0 + 108 && pos[0] <= g.x0 + 212) {
          node.properties = node.properties || {};
          node.properties.thumbs = !thumbsOn();
          hover = -1;
          rebuild();
          return true;
        }
        return false;
      },
    };

    /* ---- دکمه Add ---- */
    const addWidget = {
      name: "lora_add",
      type: "custom",
      value: null,
      options: { serialize: false },
      computeSize: (w) => [w, ADD_H],
      draw(ctx, n, _w, y) {
        this._y = y;
        const c = colors();
        ctx.save();
        rr(ctx, M, y + 2, n.size[0] - 2 * M, ADD_H - 4, 8);
        ctx.fillStyle = c.bg;
        ctx.fill();
        ctx.strokeStyle = c.outline;
        ctx.stroke();
        ctx.fillStyle = c.text;
        ctx.font = "13px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("＋  Add LoRA", n.size[0] / 2, y + ADD_H / 2);
        ctx.restore();
      },
      mouse(event) {
        if (event.type !== "pointerdown" && event.type !== "mousedown") return false;
        pickLora(event, (name) => {
          rows.push({ on: true, lora: name, strength: 1.0 });
          commit();
          rebuild();
        });
        return true;
      },
    };

    /* ---- ردیف لورا ---- */
    const makeRowWidget = (row) => ({
      name: "lora_row",
      type: "custom",
      value: null,
      options: { serialize: false },
      computeSize: (w) => [w, rowH()],
      draw(ctx, n, _w, y) {
        this._y = y;
        const c = colors();
        const h = rowH();
        const g = geom(n.size[0], thumbsOn(), h);
        const midY = y + h / 2;

        ctx.save();
        ctx.globalAlpha = row.on ? 1 : 0.45;
        ctx.font = "12px Arial";
        ctx.textBaseline = "middle";

        // پس‌زمینه ردیف
        rr(ctx, g.x0, y + 1, g.x1 - g.x0, h - 2, 8);
        ctx.fillStyle = c.bg;
        ctx.fill();
        ctx.strokeStyle = c.outline;
        ctx.stroke();

        // دکمه روشن/خاموش
        ctx.beginPath();
        ctx.arc(g.x0 + 14, midY, 6, 0, Math.PI * 2);
        ctx.fillStyle = row.on ? "#6c6" : "#777";
        ctx.fill();
        ctx.strokeStyle = c.outline;
        ctx.stroke();

        // عکس کوچک
        if (thumbsOn()) {
          const s = g.thumb;
          const tx = g.x0 + 28;
          const ty = y + 4;
          const e = getPreview(row.lora);
          ctx.save();
          rr(ctx, tx, ty, s, s, 6);
          ctx.clip();
          if (e && e.status === "ok") {
            const iw = e.img.naturalWidth || 1;
            const ih = e.img.naturalHeight || 1;
            const sc = Math.max(s / iw, s / ih);
            ctx.drawImage(e.img, tx + (s - iw * sc) / 2, ty + (s - ih * sc) / 2, iw * sc, ih * sc);
          } else {
            ctx.fillStyle = "rgba(128,128,128,0.25)";
            ctx.fillRect(tx, ty, s, s);
            ctx.fillStyle = c.sub;
            ctx.font = "10px Arial";
            ctx.textAlign = "center";
            ctx.fillText(e && e.status === "loading" ? "..." : "No preview", tx + s / 2, ty + s / 2);
          }
          ctx.restore();
          ctx.strokeStyle = c.outline;
          rr(ctx, tx, ty, s, s, 6);
          ctx.stroke();
        }

        // اسم لورا
        ctx.textAlign = "left";
        ctx.fillStyle = c.text;
        ctx.font = "12px Arial";
        const label = row.lora ? baseName(row.lora) : "None (click to choose)";
        ctx.fillText(fit(ctx, label, g.nameEnd - g.nameX), g.nameX, midY);

        // strength: ◀ مقدار ▶
        const sx = g.str.x;
        const sw = g.str.w;
        rr(ctx, sx, midY - 11, sw, 22, 11);
        ctx.fillStyle = "rgba(128,128,128,0.18)";
        ctx.fill();
        ctx.fillStyle = c.sub;
        ctx.textAlign = "center";
        ctx.fillText("◀", sx + 11, midY);
        ctx.fillText("▶", sx + sw - 11, midY);
        ctx.fillStyle = c.text;
        ctx.fillText(Number(row.strength).toFixed(2), sx + sw / 2, midY);

        // حذف
        ctx.fillStyle = c.sub;
        ctx.font = "13px Arial";
        ctx.fillText("✕", g.del.x + g.del.w / 2, midY);

        ctx.restore();
      },
      mouse(event, pos) {
        if (event.type !== "pointerdown" && event.type !== "mousedown") return false;
        const h = rowH();
        const g = geom(node.size[0], thumbsOn(), h);
        const mx = pos[0];

        if (mx < g.x0 + 28) {
          row.on = !row.on;
          commit();
          return true;
        }
        if (mx >= g.del.x) {
          const idx = rows.indexOf(row);
          if (idx >= 0) rows.splice(idx, 1);
          hover = -1;
          commit();
          rebuild();
          return true;
        }
        if (mx >= g.str.x && mx < g.str.x + g.str.w) {
          if (mx < g.str.x + 24) {
            row.strength = Math.round((row.strength - STEP) * 100) / 100;
            commit();
          } else if (mx > g.str.x + g.str.w - 24) {
            row.strength = Math.round((row.strength + STEP) * 100) / 100;
            commit();
          } else {
            app.canvas.prompt("Strength", row.strength, (v) => {
              const num = parseFloat(v);
              if (!Number.isNaN(num)) {
                row.strength = num;
                commit();
              }
            }, event);
          }
          return true;
        }
        // اسم یا عکس: انتخاب لورا
        pickLora(event, (name) => {
          row.lora = name;
          commit();
        });
        return true;
      },
    });

    /* ---- ساخت مجدد ویجت‌ها ---- */
    function rebuild() {
      node.widgets = node.widgets.filter((w) => w === jsonWidget);
      rowWidgets.length = 0;
      node.addCustomWidget(headerWidget);
      rows.forEach((row) => {
        const w = makeRowWidget(row);
        rowWidgets.push(w);
        node.addCustomWidget(w);
      });
      node.addCustomWidget(addWidget);
      fitHeight();
    }

    function loadRows() {
      rows.length = 0;
      try {
        const arr = JSON.parse(jsonWidget.value || "[]");
        if (Array.isArray(arr)) {
          arr.forEach((r) =>
            rows.push({
              on: r.on !== false,
              lora: String(r.lora || ""),
              strength: Number.isFinite(Number(r.strength)) ? Number(r.strength) : 1.0,
            })
          );
        }
      } catch (e) {
        /* ignore */
      }
    }

    /* ---- پریویو بزرگ هنگام حرکت موس روی ردیف ---- */
    const origMove = node.onMouseMove;
    node.onMouseMove = function (e, pos) {
      origMove?.apply(this, arguments);
      const h = rowH();
      const g = geom(node.size[0], thumbsOn(), h);
      let found = -1;
      rowWidgets.forEach((w, i) => {
        if (w._y === undefined) return;
        if (pos[1] >= w._y && pos[1] <= w._y + h && pos[0] >= g.x0 + 28 && pos[0] < g.nameEnd) found = i;
      });
      if (found !== hover) {
        hover = found;
        redraw();
      }
    };
    const origLeave = node.onMouseLeave;
    node.onMouseLeave = function () {
      origLeave?.apply(this, arguments);
      if (hover !== -1) {
        hover = -1;
        redraw();
      }
    };
    const origFg = node.onDrawForeground;
    node.onDrawForeground = function (ctx) {
      origFg?.apply(this, arguments);
      if (hover < 0 || !rows[hover]) return;
      const e = getPreview(rows[hover].lora);
      if (!e || e.status !== "ok") return;
      const iw = e.img.naturalWidth || 1;
      const ih = e.img.naturalHeight || 1;
      const sc = Math.min(300 / iw, 300 / ih, 1.5);
      const dw = iw * sc;
      const dh = ih * sc;
      const x = this.size[0] + 12;
      const y = Math.max(0, (rowWidgets[hover]?._y ?? 0) - 20);
      ctx.save();
      ctx.shadowColor = "rgba(0,0,0,0.5)";
      ctx.shadowBlur = 12;
      rr(ctx, x - 4, y - 4, dw + 8, dh + 8, 8);
      ctx.fillStyle = "#111";
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.strokeStyle = "#666";
      ctx.stroke();
      rr(ctx, x, y, dw, dh, 6);
      ctx.clip();
      ctx.drawImage(e.img, x, y, dw, dh);
      ctx.restore();
    };

    /* ---- لود ورکفلو ---- */
    const origConfigure = node.onConfigure;
    node.onConfigure = function () {
      origConfigure?.apply(this, arguments);
      loadRows();
      rebuild();
    };

    loadRows();
    node.setSize([Math.max(node.size[0], 420), node.size[1]]);
    rebuild();
  },
});
