# -*- coding: utf-8 -*-
"""Третья партия фото: четыре новые композиции и новая обложка «Свежие цветы».

Запускать из корня: python tools/arrange_photos_batch3.py
"""
import json
import os
import shutil

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INCOMING = os.path.join(ROOT, "frontend", "assets", "photos", "incoming")
MOCK = os.path.join(ROOT, "frontend", "mock")

RENAME = {
    "m42": "p-21",       # красные и белые розы в белой коробке
    "m39": "p-22",       # малиновые розы и голубая гортензия
    "m40": "p-23",       # кремовые розы, голубая гортензия, ранункулюс
    "m37": "p-24",       # розы и белые хризантемы в сиреневой упаковке
    "mcham": "cat-fresh",  # ромашки в вазе у окна
}

NEW_PRODUCTS = [
    {
        "id": "p-21",
        "slug": "buket-rubin",
        "title": "Букет «Рубин»",
        "category": "bouquets",
        "price": 9800,
        "price_prefix": None,
        "description": "Состав: красная роза, белая роза, кустовая роза, эвкалипт. Композиция в белой шляпной коробке.",
        "image_url": "assets/photos/p-21.svg",
        "image_thumb_url": "assets/photos/p-21-thumb.svg",
        "image_alt": "Композиция «Рубин» с красными и белыми розами в белой коробке",
        "is_new": True,
        "badge": "Новинка",
        "flower_types": ["роза", "эвкалипт"],
        "size": "XL",
        "featured": True,
        "showcase": True,
        "hidden": False,
        "no_delivery": False,
        "pickup_branches": ["b1"],
        "discount_enabled": False,
        "discount_type": None,
        "discount_value": None,
        "discount_start": None,
        "discount_end": None,
        "sale_price": None,
        "discount_active": False,
        "discount_label": None,
        "seo_title": "Букет «Рубин» — купить в Сургуте | Milagro",
        "seo_description": "Композиция с красными и белыми розами в белой шляпной коробке. Цветочная студия Milagro, Сургут.",
        "created_at": "2026-11-25",
    },
    {
        "id": "p-22",
        "slug": "buket-magenta",
        "title": "Букет «Магента»",
        "category": "bouquets",
        "price": 7600,
        "price_prefix": None,
        "description": "Состав: малиновая роза, голубая гортензия, эвкалипт. Контрастный букет в белой упаковке.",
        "image_url": "assets/photos/p-22.svg",
        "image_thumb_url": "assets/photos/p-22-thumb.svg",
        "image_alt": "Букет «Магента» с малиновыми розами и голубой гортензией",
        "is_new": True,
        "badge": "Новинка",
        "flower_types": ["роза", "гортензия"],
        "size": "L",
        "featured": True,
        "showcase": False,
        "hidden": False,
        "no_delivery": False,
        "pickup_branches": ["b1"],
        "discount_enabled": False,
        "discount_type": None,
        "discount_value": None,
        "discount_start": None,
        "discount_end": None,
        "sale_price": None,
        "discount_active": False,
        "discount_label": None,
        "seo_title": "Букет «Магента» — купить в Сургуте | Milagro",
        "seo_description": "Букет с малиновыми розами и голубой гортензией. Цветочная студия Milagro, Сургут.",
        "created_at": "2026-11-25",
    },
    {
        "id": "p-23",
        "slug": "buket-nebo",
        "title": "Букет «Небо»",
        "category": "bouquets",
        "price": 8200,
        "price_prefix": None,
        "description": "Состав: голубая гортензия, кремовая роза, ранункулюс, хризантема. Сборка в белой упаковке.",
        "image_url": "assets/photos/p-23.svg",
        "image_thumb_url": "assets/photos/p-23-thumb.svg",
        "image_alt": "Букет «Небо» с голубой гортензией и кремовыми розами",
        "is_new": False,
        "badge": None,
        "flower_types": ["гортензия", "роза", "хризантема"],
        "size": "L",
        "featured": False,
        "showcase": True,
        "hidden": False,
        "no_delivery": False,
        "pickup_branches": ["b1"],
        "discount_enabled": False,
        "discount_type": None,
        "discount_value": None,
        "discount_start": None,
        "discount_end": None,
        "sale_price": None,
        "discount_active": False,
        "discount_label": None,
        "seo_title": "Букет «Небо» — купить в Сургуте | Milagro",
        "seo_description": "Букет с голубой гортензией, кремовыми розами и хризантемами. Студия Milagro.",
        "created_at": "2026-11-25",
    },
    {
        "id": "p-24",
        "slug": "buket-rozovyy-rassvet",
        "title": "Букет «Розовый рассвет»",
        "category": "bouquets",
        "price": 6200,
        "price_prefix": None,
        "description": "Состав: розовая роза, белая хризантема, эвкалипт. Сборка в сиреневой упаковке.",
        "image_url": "assets/photos/p-24.svg",
        "image_thumb_url": "assets/photos/p-24-thumb.svg",
        "image_alt": "Букет «Розовый рассвет» с розами и белыми хризантемами",
        "is_new": False,
        "badge": None,
        "flower_types": ["роза", "хризантема", "эвкалипт"],
        "size": "M",
        "featured": False,
        "showcase": False,
        "hidden": False,
        "no_delivery": False,
        "pickup_branches": ["b1"],
        "discount_enabled": False,
        "discount_type": None,
        "discount_value": None,
        "discount_start": None,
        "discount_end": None,
        "sale_price": None,
        "discount_active": False,
        "discount_label": None,
        "seo_title": "Букет «Розовый рассвет» — купить в Сургуте | Milagro",
        "seo_description": "Букет с розовыми розами и белыми хризантемами в сиреневой упаковке. Студия Milagro.",
        "created_at": "2026-11-25",
    },
]


def main():
    for src, key in RENAME.items():
        source = os.path.join(INCOMING, src + ".webp")
        if not os.path.exists(source):
            print("нет файла:", src)
            continue
        shutil.move(source, os.path.join(INCOMING, key + ".webp"))

    path = os.path.join(MOCK, "catalog.json")
    with open(path, "r", encoding="utf-8") as fh:
        catalog = json.load(fh)

    known = {product["id"] for product in catalog["products"]}
    added = 0
    for product in NEW_PRODUCTS:
        if product["id"] not in known:
            catalog["products"].append(product)
            added += 1
    catalog["products"].sort(key=lambda item: item["id"])

    with open(path, "w", encoding="utf-8", newline="\n") as fh:
        json.dump(catalog, fh, ensure_ascii=False, indent=2)
        fh.write("\n")

    print("переименовано:", len(RENAME), "добавлено:", added, "всего товаров:", len(catalog["products"]))


if __name__ == "__main__":
    main()
