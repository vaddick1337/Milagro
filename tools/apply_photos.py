# -*- coding: utf-8 -*-
"""Разложить реальные фото студии по сайту.

Кладёте файлы в frontend/assets/photos/incoming/ — скрипт:
  1) поворачивает по EXIF, уменьшает до 2000 px по длинной стороне,
     сохраняет JPEG (качество 85) и миниатюру 640 px;
  2) по имени файла подставляет пути в mock/catalog.json и mock/site.json.

Имена файлов (расширение любое из .jpg/.jpeg/.png/.webp):

  p-01 … p-17          фото товара (id из mock/catalog.json)
  hero-1 … hero-5      кадр для баннера на главной
  hero-1-mobile        отдельный кроп того же кадра для телефона
  cat-bouquets         обложка категории «Букеты»
  cat-fresh            обложка «Свежие цветы»
  cat-dried            обложка «Сухоцветы»
  offers               плитка «Предложения» в коллекциях
  studio               фото студии (используется как запасной hero-кадр)

Пример:
  python tools/apply_photos.py --dry-run   # показать, что изменится
  python tools/apply_photos.py             # обработать и подставить
"""
import argparse
import json
import os
import shutil
import sys

from PIL import Image, ImageOps

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRONT = os.path.join(ROOT, "frontend")
PHOTOS = os.path.join(FRONT, "assets", "photos")
INCOMING = os.path.join(PHOTOS, "incoming")
MOCK = os.path.join(FRONT, "mock")

SUPPORTED = (".jpg", ".jpeg", ".png", ".webp")
MAX_SIDE = 2000
THUMB_SIDE = 640
QUALITY = 85
THUMB_QUALITY = 78

CATEGORY_KEYS = {
    "bouquets": "cat-bouquets",
    "fresh-flowers": "cat-fresh",
    "dried-flowers": "cat-dried",
}


def load_json(name):
    with open(os.path.join(MOCK, name), "r", encoding="utf-8") as fh:
        return json.load(fh)


def save_json(name, payload):
    path = os.path.join(MOCK, name)
    with open(path, "w", encoding="utf-8", newline="\n") as fh:
        json.dump(payload, fh, ensure_ascii=False, indent=2)
        fh.write("\n")
    return path


def normalize(src, key, dry_run):
    """Поворот по EXIF + ресайз + JPEG + миниатюра. Возвращает (url, thumb_url)."""
    image = Image.open(src)
    image = ImageOps.exif_transpose(image)
    if image.mode not in ("RGB", "L"):
        image = image.convert("RGB")

    big = image.copy()
    big.thumbnail((MAX_SIDE, MAX_SIDE), Image.LANCZOS)
    thumb = image.copy()
    thumb.thumbnail((THUMB_SIDE, THUMB_SIDE), Image.LANCZOS)

    main_name = key + ".jpg"
    thumb_name = key + "-thumb.jpg"
    if not dry_run:
        big.save(os.path.join(PHOTOS, main_name), "JPEG", quality=QUALITY, optimize=True, progressive=True)
        thumb.save(os.path.join(PHOTOS, thumb_name), "JPEG", quality=THUMB_QUALITY, optimize=True)
    return "assets/photos/" + main_name, "assets/photos/" + thumb_name


def collect():
    if not os.path.isdir(INCOMING):
        return []
    found = []
    for name in sorted(os.listdir(INCOMING)):
        base, ext = os.path.splitext(name)
        if ext.lower() not in SUPPORTED:
            continue
        found.append((base.lower(), os.path.join(INCOMING, name), name))
    return found


def main():
    parser = argparse.ArgumentParser(description="Разложить фото в assets/photos и моки")
    parser.add_argument("--dry-run", action="store_true", help="только показать план")
    args = parser.parse_args()

    os.makedirs(INCOMING, exist_ok=True)
    files = collect()
    if not files:
        print("В {} нет файлов .jpg/.jpeg/.png/.webp".format(os.path.relpath(INCOMING, ROOT)))
        print("Положите фото с именами p-01, hero-1, cat-bouquets … и запустите снова.")
        return 1

    keys = [key for key, _, _ in files]
    dups = {key for key in keys if keys.count(key) > 1}
    if dups:
        print("Одинаковые имена файлов: " + ", ".join(sorted(dups)))
        return 1

    catalog = load_json("catalog.json")
    site = load_json("site.json")
    product_ids = {product["id"] for product in catalog["products"]}
    category_keys = set(CATEGORY_KEYS.values())

    applied = {"products": [], "categories": [], "hero": [], "offers": None, "unknown": [], "studio": None}
    provided_hero = set()
    provided_mobile = set()

    for key, path, original in files:
        if key in product_ids or key in category_keys or key == "offers" \
                or key.startswith("hero-") or key == "studio":
            url, thumb = normalize(path, key, args.dry_run)
        else:
            applied["unknown"].append(original)
            continue

        if key in product_ids:
            for product in catalog["products"]:
                if product["id"] == key:
                    product["image_url"] = url
                    product["image_thumb_url"] = thumb
                    applied["products"].append(key)
        elif key in category_keys:
            for category in catalog["categories"]:
                if CATEGORY_KEYS.get(category["slug"]) == key:
                    category["image_url"] = url
                    applied["categories"].append(category["slug"])
        elif key == "offers":
            site["offers_image_url"] = url
            applied["offers"] = url
        elif key == "studio":
            applied["studio"] = url
        elif key.startswith("hero-"):
            if key.endswith("-mobile"):
                index = int(key.split("-")[1])
                while len(site["hero_slides"]) < index:
                    site["hero_slides"].append({"image_url": "", "mobile_image_url": "", "alt": "Фото студии Milagro"})
                site["hero_slides"][index - 1]["mobile_image_url"] = url
                provided_mobile.add(index)
            else:
                index = int(key.split("-")[1])
                while len(site["hero_slides"]) < index:
                    site["hero_slides"].append({"image_url": "", "mobile_image_url": "", "alt": "Фото студии Milagro"})
                site["hero_slides"][index - 1]["image_url"] = url
                provided_hero.add(index)
            applied["hero"].append(key)

    # Кадр баннера без отдельного мобильного кропа показываем и на телефоне —
    # но только если мобильный кроп не приложен в этом запуске.
    for index, slide in enumerate(site["hero_slides"], start=1):
        if index in provided_hero and index not in provided_mobile:
            slide["mobile_image_url"] = slide["image_url"]

    if applied["studio"] and not any(slide.get("image_url") for slide in site["hero_slides"]):
        site["hero_slides"] = [{"image_url": applied["studio"], "mobile_image_url": applied["studio"],
                                "alt": "Студия Milagro в Сургуте"}]

    if not args.dry_run:
        save_json("catalog.json", catalog)
        save_json("site.json", site)

    print(("План (dry-run):" if args.dry_run else "Готово:"))
    print("  товаров обновлено:", len(applied["products"]), ", ".join(applied["products"]) or "—")
    print("  категорий обновлено:", len(applied["categories"]), ", ".join(applied["categories"]) or "—")
    print("  кадров баннера:", len(applied["hero"]), ", ".join(applied["hero"]) or "—")
    print("  плитка «Предложения»:", applied["offers"] or "—")
    if applied["unknown"]:
        print("  не понял имена (переименуйте по инструкции):", ", ".join(applied["unknown"]))
    print("Файлы-оригиналы остаются в incoming/, их можно удалить после проверки.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
