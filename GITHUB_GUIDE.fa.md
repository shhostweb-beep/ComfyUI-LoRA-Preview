# راهنمای آپلود در GitHub و انتشار در ComfyUI Registry

## ۱) جایگزین کردن مقادیر نمونه
این‌ها را در فایل‌ها عوض کن:

| فایل | مقدار | با چه چیزی عوض شود |
|---|---|---|
| `pyproject.toml` | `shhostweb-beep` | اسم کاربری گیت‌هاب |
| `pyproject.toml` | `your-publisher-id` | Publisher ID از registry.comfy.org (مرحله ۴) |
| `README.md` و `README.fa.md` | `shhostweb-beep` | اسم کاربری گیت‌هاب |
| `LICENSE` | `YOUR NAME` | اسم خودت |

## ۲) ساخت ریپو در GitHub
1. در github.com وارد شو و **New repository** بزن.
2. اسم ریپو: `ComfyUI-LoRA-Preview` (Public). گزینه‌های README و License را نزن، چون فایل‌هایشان آماده است.

## ۳) آپلود فایل‌ها
**روش آسان (بدون گیت):** در صفحه‌ی ریپوی خالی روی **uploading an existing file** کلیک کن و *محتویات* پوشه را بکش و رها کن
(نه خود پوشه را). پوشه‌ی `.github` و `js` هم باید با باشند. بعد **Commit changes** بزن.

**روش گیت:** داخل پوشه:
```bash
git init
git add .
git commit -m "Initial release"
git branch -M main
git remote add origin https://github.com/shhostweb-beep/ComfyUI-LoRA-Preview.git
git push -u origin main
```

ساختار نهایی ریپو باید این‌طور باشد:
```
__init__.py
pyproject.toml
README.md / README.fa.md / LICENSE
js/ (lora_preview.js, lora_stack_preview.js, lora_menu_preview.js)
images/preview.png
example_workflows/LoRA-Preview-Example.json
.github/workflows/publish.yml
```

با همین مرحله، کاربرها می‌توانند با `git clone` نصب کنند.

## ۴) انتشار در Registry (برای دیده شدن در ComfyUI-Manager)
1. در [registry.comfy.org](https://registry.comfy.org) یک **Publisher** بساز. Publisher ID بعداً قابل تغییر نیست.
2. ID را در `pyproject.toml` جلوی `PublisherId` بگذار.
3. یک **API Key** برای همان publisher بساز.
4. در ریپوی گیت‌هاب: Settings ← Secrets and variables ← Actions ← New repository secret با نام
   `REGISTRY_ACCESS_TOKEN` و مقدار همان API Key.
5. تب **Actions** ← workflow به اسم *Publish to Comfy registry* ← **Run workflow**.
   از این به بعد با هر تغییر `version` در `pyproject.toml` نسخه‌ی جدید خودکار منتشر می‌شود.

روش دستی: `pip install comfy-cli` و داخل پوشه `comfy node publish`.

## ۵) آپدیت‌های بعدی
فایل‌ها را تغییر بده، `version` را در `pyproject.toml` بالا ببر (مثلاً `1.0.1`) و commit کن.
