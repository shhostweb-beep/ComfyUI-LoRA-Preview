import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

const PREVIEW_H = 200;

app.registerExtension({
  name: "LoraPreview.LoraLoaderPreview",

  async nodeCreated(node) {
    if (node.comfyClass !== "LoraLoaderPreview") return;

    const loraWidget = node.widgets.find((w) => w.name === "lora_name");
    if (!loraWidget) return;

    const showPreview = () => node.properties?.preview !== false;
    const redraw = () => app.graph?.setDirtyCanvas(true, true);
    const fitHeight = () => {
      const size = node.computeSize([node.size[0]]);
      node.setSize([node.size[0], size[1]]);
      redraw();
    };

    /* ---- دکمه روشن/خاموش پریویو ---- */
    const toggle = node.addWidget(
      "toggle",
      "Previews",
      showPreview(),
      (value) => {
        node.properties = node.properties || {};
        node.properties.preview = !!value;
        applyVisibility();
        fitHeight();
      },
      { on: "ON", off: "OFF", serialize: false }
    );

    /* ---- کادر عکس ---- */
    const container = document.createElement("div");
    container.style.cssText =
      "width:100%;height:100%;display:flex;align-items:center;justify-content:center;overflow:hidden;";

    const img = document.createElement("img");
    img.style.cssText =
      "max-width:100%;max-height:100%;object-fit:contain;border-radius:6px;display:none;";

    const msg = document.createElement("div");
    msg.style.cssText = "color:#888;font-size:12px;text-align:center;padding:8px;";
    msg.textContent = "No preview";

    container.append(img, msg);

    node.addDOMWidget("lora_preview", "preview", container, {
      serialize: false,
      getMinHeight: () => (showPreview() ? PREVIEW_H : 1),
      getMaxHeight: () => (showPreview() ? undefined : 1),
    });

    const applyVisibility = () => {
      container.style.display = showPreview() ? "flex" : "none";
      if (showPreview()) update(loraWidget.value);
    };

    const update = (name) => {
      if (!showPreview()) return; // وقتی خاموش است عکسی لود نمی‌شود
      if (!name) {
        img.style.display = "none";
        msg.style.display = "block";
        return;
      }
      img.onload = () => {
        img.style.display = "block";
        msg.style.display = "none";
      };
      img.onerror = () => {
        img.style.display = "none";
        msg.style.display = "block";
        msg.textContent = "No preview image found";
      };
      img.src = api.apiURL(
        `/lora_preview?name=${encodeURIComponent(name)}&t=${Date.now()}`
      );
    };

    // وقتی لورا عوض شد
    const origCallback = loraWidget.callback;
    loraWidget.callback = function (value) {
      origCallback?.apply(this, arguments);
      update(value);
    };

    // وقتی ورکفلو لود شد
    const origConfigure = node.onConfigure;
    node.onConfigure = function () {
      origConfigure?.apply(this, arguments);
      toggle.value = showPreview();
      applyVisibility();
      update(loraWidget.value);
    };

    applyVisibility();
    update(loraWidget.value);
    node.setSize([Math.max(node.size[0], 320), Math.max(node.size[1], 480)]);
  },
});
