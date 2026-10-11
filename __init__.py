import json
import os

import folder_paths
import nodes
from aiohttp import web
from server import PromptServer

WEB_DIRECTORY = "./js"

# پسوندهای عکس پریویو؛ به ترتیب اولویت
PREVIEW_SUFFIXES = [
    ".preview.png", ".preview.jpg", ".preview.jpeg", ".preview.webp",
    ".png", ".jpg", ".jpeg", ".webp",
]


def find_preview(lora_name):
    """مسیر عکس پریویو لورا را پیدا می‌کند (یا None)."""
    full_path = folder_paths.get_full_path("loras", lora_name)
    if not full_path:
        return None
    base = os.path.splitext(full_path)[0]
    for suffix in PREVIEW_SUFFIXES:
        candidate = base + suffix
        if os.path.isfile(candidate):
            return candidate
    return None


@PromptServer.instance.routes.get("/lora_preview")
async def lora_preview(request):
    name = request.rel_url.query.get("name", "")
    path = find_preview(name)
    if path is None:
        return web.Response(status=404)
    return web.FileResponse(path, headers={"Cache-Control": "no-cache"})


@PromptServer.instance.routes.get("/lora_preview_list")
async def lora_preview_list(request):
    return web.json_response(folder_paths.get_filename_list("loras"))


class LoraLoaderPreview:
    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "model": ("MODEL",),
                "clip": ("CLIP",),
                "lora_name": (folder_paths.get_filename_list("loras"),),
                "strength_model": ("FLOAT", {"default": 1.0, "min": -100.0, "max": 100.0, "step": 0.01}),
                "strength_clip": ("FLOAT", {"default": 1.0, "min": -100.0, "max": 100.0, "step": 0.01}),
            }
        }

    RETURN_TYPES = ("MODEL", "CLIP")
    FUNCTION = "load"
    CATEGORY = "loaders"

    def load(self, model, clip, lora_name, strength_model, strength_clip):
        return nodes.LoraLoader().load_lora(model, clip, lora_name, strength_model, strength_clip)


class LoraStackPreview:
    """Power-LoRA-Loader style node: the LoRA list lives in a JSON string
    that the JS side edits (rows with on/off, lora name, strength)."""

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "model": ("MODEL",),
                "clip": ("CLIP",),
                "loras_json": ("STRING", {"default": "[]", "multiline": False}),
            }
        }

    RETURN_TYPES = ("MODEL", "CLIP")
    FUNCTION = "load"
    CATEGORY = "loaders"

    def load(self, model, clip, loras_json):
        try:
            items = json.loads(loras_json or "[]")
        except Exception:
            items = []
        loader = nodes.LoraLoader()
        for it in items:
            if not isinstance(it, dict) or not it.get("on", True):
                continue
            name = it.get("lora")
            if not name or name == "None":
                continue
            strength = float(it.get("strength", 1.0))
            if strength == 0:
                continue
            model, clip = loader.load_lora(model, clip, name, strength, strength)
        return (model, clip)


NODE_CLASS_MAPPINGS = {
    "LoraLoaderPreview": LoraLoaderPreview,
    "LoraStackPreview": LoraStackPreview,
}
NODE_DISPLAY_NAME_MAPPINGS = {
    "LoraLoaderPreview": "Load LoRA (with Preview)",
    "LoraStackPreview": "Power LoRA Loader (with Preview)",
}

__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]
