# -*- coding: utf-8 -*-
"""Вторая партия фото: заменяет шесть позиций без снимков на реальные
композиции и добавляет два кадра в баннер главной.

Запускать из корня: python tools/arrange_photos_batch2.py
"""
import json
import os
import shutil

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INCOMING = os.path.join(ROOT, "frontend", "assets", "photos", "incoming")
MOCK = os.path.join(ROOT, "frontend", "mock")

RENAME = {
    "n23": "p-09",   # голубая гортензия с белой хризантемой
    "n20": "p-10",   # кремовый букет
    "n30": "p-11",   # белая хризантема и пионовидные розы
    "n25": "p-12",   # белая коробка с кремовыми цветами
    "n26": "p-16",   # белая коробка с жемчугом
    "n19": "p-17",   # розовая коробка
    "n36": "hero-4", # розовый букет
    "n34": "hero-5", # бело-розовый букет
}

REPLACE = {
    "p-09": {
        "slug": "buket-golubaya-volna",
        "title": "Букет «Голубая волна»",
        "category": "bouquets",
        "price": 6500,
        "price_prefix": None,
        "description": "Состав: голубая гортензия, белая хризантема. Плотная сборка в голубой упаковке.",
        "image_alt": "Букет «Голубая волна» с голубой гортензией и белой хризантемой",
        "flower_types": ["гортензия", "хризантема"],
        "size": "L",
        "featured": True,
        "showcase": False,
        "hidden": False,
        "no_delivery": False,
        "is_new": False,
        "badge": None,
        "discount_enabled": False,
        "discount_type": None,
        "discount_value": None,
        "discount_start": None,
        "discount_end": None,
        "sale_price": None,
        "discount_active": False,
        "discount_label": None,
        "seo_title": "Букет «Голубая волна» — купить в Сургуте | Milagro",
        "seo_description": "Букет с голубой гортензией и белой хризантемой. Цветочная студия Milagro, Сургут.",
    },
    "p-10": {
        "slug": "buket-krem",
        "title": "Букет «Крем»",
        "category": "bouquets",
        "price": 5400,
        "price_prefix": None,
        "description": "Состав: кремовая роза, белая хризантема. Сборка в кремовой упаковке.",
        "image_alt": "Букет «Крем» с кремовой розой и белыми хризантемами",
        "flower_types": ["роза", "хризантема"],
        "size": "M",
        "featured": False,
        "showcase": True,
        "hidden": False,
        "no_delivery": False,
        "is_new": True,
        "badge": "Новинка",
        "discount_enabled": False,
        "discount_type": None,
        "discount_value": None,
        "discount_start": None,
        "discount_end": None,
        "sale_price": None,
        "discount_active": False,
        "discount_label": None,
        "seo_title": "Букет «Крем» — купить в Сургуте | Milagro",
        "seo_description": "Букет с кремовой розой и белыми хризантемами. Студия Milagro, Сургут.",
    },
    "p-11": {
        "slug": "buket-pudrovyy-sad",
        "title": "Букет «Пудровый сад»",
        "category": "bouquets",
        "price": 7900,
        "price_prefix": None,
        "description": "Состав: пионовидная роза, хризантема, эвкалипт. Крупный букет в белой упаковке.",
        "image_alt": "Букет «Пудровый сад» с пионовидными розами и белыми хризантемами",
        "flower_types": ["роза", "хризантема", "эвкалипт"],
        "size": "L",
        "featured": False,
        "showcase": False,
        "hidden": False,
        "no_delivery": False,
        "is_new": False,
        "badge": None,
        "discount_enabled": True,
        "discount_type": "amount",
        "discount_value": 300,
        "discount_start": "2026-11-15",
        "discount_end": "2026-12-15",
        "sale_price": 7600,
        "discount_active": True,
        "discount_label": "−300 ₽",
        "seo_title": "Букет «Пудровый сад» — купить в Сургуте | Milagro",
        "seo_description": "Крупный букет с пионовидными розами и хризантемами. Цветочная студия Milagro.",
    },
    "p-12": {
        "slug": "korobka-nezhnost",
        "title": "Коробка «Нежность»",
        "category": "bouquets",
        "price": 8600,
        "price_prefix": None,
        "description": "Состав: кремовая роза, хризантема, гвоздика. Композиция в белой коробке.",
        "image_alt": "Композиция «Нежность» в белой коробке с кремовыми розами",
        "flower_types": ["роза", "хризантема", "гвоздика"],
        "size": "L",
        "featured": False,
        "showcase": True,
        "hidden": False,
        "no_delivery": False,
        "is_new": False,
        "badge": None,
        "discount_enabled": False,
        "discount_type": None,
        "discount_value": None,
        "discount_start": None,
        "discount_end": None,
        "sale_price": None,
        "discount_active": False,
        "discount_label": None,
        "seo_title": "Коробка «Нежность» — купить в Сургуте | Milagro",
        "seo_description": "Композиция в белой коробке: кремовые розы, хризантемы, гвоздики. Студия Milagro.",
    },
    "p-16": {
        "slug": "shlyapnaya-korobka-mramor",
        "title": "Шляпная коробка «Мрамор»",
        "category": "bouquets",
        "price": 9200,
        "price_prefix": None,
        "description": "Состав: роза, хризантема, гвоздика, ромашка. Крупная композиция в белой коробке — только самовывоз из студии.",
        "image_alt": "Шляпная коробка «Мрамор» с розами, хризантемами и ромашками",
        "flower_types": ["роза", "хризантема", "гвоздика", "ромашка"],
        "size": "XL",
        "featured": False,
        "showcase": False,
        "hidden": False,
        "no_delivery": True,
        "is_new": False,
        "badge": None,
        "discount_enabled": False,
        "discount_type": None,
        "discount_value": None,
        "discount_start": None,
        "discount_end": None,
        "sale_price": None,
        "discount_active": False,
        "discount_label": None,
        "seo_title": "Шляпная коробка «Мрамор» — купить в Сургуте | Milagro",
        "seo_description": "Крупная композиция в шляпной коробке: розы, хризантемы, гвоздики, ромашки. Студия Milagro.",
    },
    "p-17": {
        "slug": "korobka-rozovyy-sad",
        "title": "Коробка «Розовый сад»",
        "category": "bouquets",
        "price": 7200,
        "price_prefix": None,
        "description": "Состав: хризантема, гвоздика, роза. Композиция в розовой коробке. Скрытая позиция для проверки админки.",
        "image_alt": "Композиция «Розовый сад» в розовой коробке",
        "flower_types": ["хризантема", "гвоздика", "роза"],
        "size": "L",
        "featured": False,
        "showcase": False,
        "hidden": True,
        "no_delivery": False,
        "is_new": False,
        "badge": None,
        "discount_enabled": False,
        "discount_type": None,
        "discount_value": None,
        "discount_start": None,
        "discount_end": None,
        "sale_price": None,
        "discount_active": False,
        "discount_label": None,
        "seo_title": "Коробка «Розовый сад» — Milagro",
        "seo_description": "Композиция в розовой коробке. Цветочная студия Milagro, Сургут.",
    },
}

HERO_ALTS = {
    4: "Розовый букет с розами и хризантемами",
    5: "Бело-розовый букет с хризантемами",
}


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

    replaced = 0
    for product in catalog["products"]:
        patch = REPLACE.get(product["id"])
        if patch:
            product.update(patch)
            replaced += 1

    catalog["products"].sort(key=lambda item: item["id"])

    with open(path, "w", encoding="utf-8", newline="\n") as fh:
        json.dump(catalog, fh, ensure_ascii=False, indent=2)
        fh.write("\n")

    site_path = os.path.join(MOCK, "site.json")
    with open(site_path, "r", encoding="utf-8") as fh:
        site = json.load(fh)
    for index, alt in HERO_ALTS.items():
        while len(site["hero_slides"]) < index:
            site["hero_slides"].append({"image_url": "", "mobile_image_url": "", "alt": ""})
        site["hero_slides"][index - 1]["alt"] = alt
    with open(site_path, "w", encoding="utf-8", newline="\n") as fh:
        json.dump(site, fh, ensure_ascii=False, indent=2)
        fh.write("\n")

    print("переименовано:", len(RENAME), "заменено позиций:", replaced, "всего:", len(catalog["products"]))


if __name__ == "__main__":
    main()
