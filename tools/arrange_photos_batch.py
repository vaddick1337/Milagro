# -*- coding: utf-8 -*-
"""Раскладка второй партии фото: 18 кадров из карточки Milagro.

1) переименовывает src-NN.webp в ключи, которые понимает apply_photos.py;
2) добавляет три новые позиции (композиции в коробке) в mock/catalog.json;
3) правит описания и состав у товаров, которым досталось фото.
Запускать из корня репозитория: python tools/arrange_photos_batch.py
"""
import json
import os
import shutil

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
INCOMING = os.path.join(ROOT, "frontend", "assets", "photos", "incoming")
MOCK = os.path.join(ROOT, "frontend", "mock")

# файл → ключ для apply_photos.py
RENAME = {
    "src-02": "p-01",          # пастельный букет с голубой гортензией
    "src-11": "p-03",          # бело-розовый букет
    "src-08": "p-04",          # жёлтые розы и гвоздики
    "src-03": "p-05",          # крупная композиция в коробке, розовый фон
    "src-07": "p-06",          # белая композиция в коробке
    "src-05": "p-07",          # компактный букет пионовидных роз
    "src-06": "p-08",          # пучок кустовых роз
    "src-01": "p-13",          # белые хризантемы
    "src-04": "p-18",          # белая коробка с жемчугом
    "src-12": "p-19",          # розовая коробка-сумочка
    "src-15": "p-20",          # белая коробка с гортензией и хлопком
    "src-13": "cat-bouquets",  # обложка «Букеты»
    "src-16": "hero-1",        # две коробки на мраморе
    "src-10": "hero-2",        # мягкий розовый букет
    "src-09": "hero-3",        # коробка с гортензией
}

TEXTS = {
    "p-01": {
        "description": "Состав: гортензия, гвоздика, кустовая роза, эвкалипт. Сборка в холодной пастельной гамме.",
        "flower_types": ["гортензия", "гвоздика", "роза", "эвкалипт"],
        "image_alt": "Букет «Северный шёлк» с голубой гортензией и гвоздиками",
    },
    "p-03": {
        "description": "Состав: хризантема, гвоздика, гортензия. Плотный букет в бело-розовой гамме.",
        "flower_types": ["хризантема", "гвоздика", "гортензия"],
        "image_alt": "Букет «Обь» с белыми хризантемами и розовой гортензией",
    },
    "p-04": {
        "description": "Состав: кустовая роза, хризантема, гвоздика, эвкалипт. Тёплая сборка с жёлтыми акцентами.",
        "flower_types": ["роза", "хризантема", "гвоздика", "эвкалипт"],
        "image_alt": "Букет «Морошка» с жёлтыми розами и белыми хризантемами",
    },
    "p-05": {
        "description": "Состав: роза, гортензия, хризантема, ромашка, эвкалипт. Крупная композиция в шляпной коробке.",
        "flower_types": ["роза", "гортензия", "хризантема", "ромашка"],
        "image_alt": "Композиция «Тайга» в белой шляпной коробке с розами и гортензией",
    },
    "p-06": {
        "description": "Состав: белая роза, хризантема, гвоздика. Светлая композиция в шляпной коробке.",
        "flower_types": ["роза", "хризантема", "гвоздика"],
        "image_alt": "Композиция «Первый снег» в белой коробке с белыми розами",
    },
    "p-07": {
        "description": "Состав: пионовидная роза, гвоздика. Компактный букет для подарка.",
        "flower_types": ["роза", "гвоздика"],
        "image_alt": "Букет «Набережный» с пионовидными розами",
    },
    "p-08": {
        "image_alt": "Кустовые розы, 15 стеблей",
    },
    "p-13": {
        "description": "Состав: белая хризантема, 5 стеблей в упаковке.",
        "flower_types": ["хризантема"],
        "image_alt": "Белые хризантемы в упаковке",
    },
}

NEW_PRODUCTS = [
    {
        "id": "p-18",
        "slug": "shlyapnaya-korobka-zhemchug",
        "title": "Шляпная коробка «Жемчуг»",
        "category": "bouquets",
        "price": 8900,
        "price_prefix": None,
        "description": "Состав: роза, гвоздика, хризантема, ромашка, эвкалипт. Композиция в белой шляпной коробке.",
        "image_url": "assets/photos/p-18.svg",
        "image_thumb_url": "assets/photos/p-18-thumb.svg",
        "image_alt": "Шляпная коробка «Жемчуг» с розами и хризантемами",
        "is_new": True,
        "badge": "Новинка",
        "flower_types": ["роза", "гвоздика", "хризантема", "ромашка"],
        "size": "XL",
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
        "seo_title": "Шляпная коробка «Жемчуг» — купить в Сургуте | Milagro",
        "seo_description": "Композиция в белой шляпной коробке: розы, гвоздики, хризантемы. Цветочная студия Milagro, Сургут, пр-т Набережный, 2.",
        "created_at": "2026-11-24",
    },
    {
        "id": "p-19",
        "slug": "korobka-sumochka-ranetka",
        "title": "Коробка-сумочка «Ранетка»",
        "category": "bouquets",
        "price": 6500,
        "price_prefix": None,
        "description": "Состав: роза, гвоздика, хризантема. Композиция в розовой коробке-сумочке с лентами.",
        "image_url": "assets/photos/p-19.svg",
        "image_thumb_url": "assets/photos/p-19-thumb.svg",
        "image_alt": "Композиция в розовой коробке-сумочке с розами",
        "is_new": True,
        "badge": "Новинка",
        "flower_types": ["роза", "гвоздика", "хризантема"],
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
        "seo_title": "Коробка-сумочка «Ранетка» — купить в Сургуте | Milagro",
        "seo_description": "Композиция в розовой коробке-сумочке: розы, гвоздики, хризантемы. Студия Milagro, Сургут.",
        "created_at": "2026-11-24",
    },
    {
        "id": "p-20",
        "slug": "shlyapnaya-korobka-pudra",
        "title": "Шляпная коробка «Пудра»",
        "category": "bouquets",
        "price": 7800,
        "price_prefix": None,
        "description": "Состав: гортензия, гвоздика, хризантема, хлопок. Композиция в белой шляпной коробке.",
        "image_url": "assets/photos/p-20.svg",
        "image_thumb_url": "assets/photos/p-20-thumb.svg",
        "image_alt": "Шляпная коробка «Пудра» с розовой гортензией и хлопком",
        "is_new": False,
        "badge": None,
        "flower_types": ["гортензия", "гвоздика", "хризантема", "хлопок"],
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
        "seo_title": "Шляпная коробка «Пудра» — купить в Сургуте | Milagro",
        "seo_description": "Композиция в шляпной коробке: гортензия, гвоздика, хризантема, хлопок. Цветочная студия Milagro.",
        "created_at": "2026-11-24",
    },
]


def main():
    for src, key in RENAME.items():
        source = os.path.join(INCOMING, src + ".webp")
        if not os.path.exists(source):
            print("нет файла:", src)
            continue
        shutil.move(source, os.path.join(INCOMING, key + ".webp"))

    # обложка «Свежие цветы» — тот же кадр с белыми хризантемами
    fresh = os.path.join(INCOMING, "cat-fresh.webp")
    source = os.path.join(INCOMING, "p-13.webp")
    if os.path.exists(source) and not os.path.exists(fresh):
        shutil.copyfile(source, fresh)

    path = os.path.join(MOCK, "catalog.json")
    with open(path, "r", encoding="utf-8") as fh:
        catalog = json.load(fh)

    known = {product["id"] for product in catalog["products"]}
    for product in catalog["products"]:
        patch = TEXTS.get(product["id"])
        if patch:
            product.update(patch)

    added = 0
    for product in NEW_PRODUCTS:
        if product["id"] not in known:
            catalog["products"].append(product)
            added += 1

    with open(path, "w", encoding="utf-8", newline="\n") as fh:
        json.dump(catalog, fh, ensure_ascii=False, indent=2)
        fh.write("\n")

    print("переименовано:", len(RENAME), "добавлено товаров:", added, "всего:", len(catalog["products"]))


if __name__ == "__main__":
    main()
