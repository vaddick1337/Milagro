# -*- coding: utf-8 -*-
"""Structural QA for the stage-1 frontend: links, ids, mock contract, assets."""
import json
import os
import re
import sys

from lxml import html

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRONT = os.path.join(ROOT, "frontend")
PROBLEMS = []
NOTES = []

REQUIRED_PRODUCT_FIELDS = [
    "id", "slug", "title", "category", "price", "price_prefix", "description",
    "image_url", "image_thumb_url", "image_alt", "is_new", "badge",
    "flower_types", "size", "featured", "showcase", "hidden", "no_delivery",
    "pickup_branches", "discount_enabled", "discount_type", "discount_value",
    "discount_start", "discount_end", "sale_price", "discount_active",
    "discount_label", "seo_title", "seo_description", "created_at",
]
REQUIRED_CATEGORY_FIELDS = [
    "id", "slug", "name", "description", "image_url", "image_alt", "position",
    "seo_h1", "seo_title", "seo_description", "seo_text",
]


def rel(path):
    return os.path.relpath(path, ROOT)


def check_file_exists(ref, page):
    if not ref or ref.startswith(("http://", "https://", "mailto:", "tel:", "#", "data:")):
        return
    clean = ref.split("?")[0].split("#")[0]
    if clean.startswith("/"):
        clean = clean.lstrip("/")
    target = os.path.join(FRONT, clean)
    if not os.path.exists(target):
        PROBLEMS.append("{}: нет файла {}".format(rel(page), ref))


def check_html(path):
    with open(path, "r", encoding="utf-8") as fh:
        text = fh.read()
    try:
        doc = html.fromstring(text)
    except Exception as error:  # noqa: BLE001
        PROBLEMS.append("{}: не разбирается как HTML ({})".format(rel(path), error))
        return None

    ids = [node.get("id") for node in doc.iter() if node.get("id")]
    dupes = {value for value in ids if ids.count(value) > 1}
    if dupes:
        PROBLEMS.append("{}: повторяющиеся id: {}".format(rel(path), ", ".join(sorted(dupes))))

    for node in doc.iter():
        tag = node.tag if isinstance(node.tag, str) else ""
        if tag == "link" and node.get("href"):
            check_file_exists(node.get("href"), path)
        elif tag == "script" and node.get("src"):
            check_file_exists(node.get("src"), path)
        elif tag == "img" and node.get("src"):
            check_file_exists(node.get("src"), path)
            if not node.get("alt") and node.get("alt") != "":
                PROBLEMS.append("{}: img без alt ({})".format(rel(path), node.get("src")))

    for node in doc.iter("a"):
        href = node.get("href") or ""
        if href.endswith(".html") or ".html?" in href:
            check_file_exists(href, path)

    return doc


def check_css(path):
    with open(path, "r", encoding="utf-8") as fh:
        text = fh.read()
    # url(...) в комментариях — это инструкция, а не ссылка: их пропускаем.
    text = re.sub(r"/\*.*?\*/", "", text, flags=re.S)
    for match in re.finditer(r"url\(([^)]+)\)", text):
        ref = match.group(1).strip().strip('"').strip("'")
        if ref.startswith("../assets/"):
            target = os.path.normpath(os.path.join(os.path.dirname(path), ref))
            if not os.path.exists(target):
                PROBLEMS.append("{}: нет ресурса {}".format(rel(path), ref))


def check_mock_contract():
    with open(os.path.join(FRONT, "mock", "catalog.json"), "r", encoding="utf-8") as fh:
        catalog = json.load(fh)
    products = catalog["products"]
    if not 12 <= len(products) <= 30:
        PROBLEMS.append("mock/catalog.json: товаров {}, нужно 12–30".format(len(products)))

    for product in products:
        missing = [field for field in REQUIRED_PRODUCT_FIELDS if field not in product]
        if missing:
            PROBLEMS.append("товар {}: нет полей {}".format(product.get("id"), ", ".join(missing)))
        for key in ("image_url", "image_thumb_url"):
            check_file_exists(product.get(key), os.path.join(FRONT, "mock", "catalog.json"))
        if product["discount_active"] and product["sale_price"] == product["price"]:
            PROBLEMS.append("товар {}: скидка активна, но sale_price = price".format(product["id"]))

    for category in catalog["categories"]:
        missing = [field for field in REQUIRED_CATEGORY_FIELDS if field not in category]
        if missing:
            PROBLEMS.append("категория {}: нет полей {}".format(category.get("id"), ", ".join(missing)))
        check_file_exists(category["image_url"], os.path.join(FRONT, "mock", "catalog.json"))

    ids = {product["id"] for product in products}
    slugs = {product["slug"] for product in products}
    if len(ids) != len(products):
        PROBLEMS.append("повторяющиеся id товаров")
    if len(slugs) != len(products):
        PROBLEMS.append("повторяющиеся slug товаров")

    has = {
        "скидка процентом": any(p["discount_active"] and p["discount_type"] == "percent" for p in products),
        "скидка суммой": any(p["discount_active"] and p["discount_type"] == "amount" for p in products),
        "«от»": any(p["price_prefix"] == "от" for p in products),
        "новинка": any(p["is_new"] for p in products),
        "готов сейчас": any(p["showcase"] for p in products),
        "только самовывоз": any(p["no_delivery"] for p in products),
        "скрытый": any(p["hidden"] for p in products),
        "предложения": any(p["featured"] for p in products),
    }
    for label, ok in has.items():
        if not ok:
            PROBLEMS.append("в моках нет сценария: " + label)

    with open(os.path.join(FRONT, "mock", "delivery.json"), "r", encoding="utf-8") as fh:
        delivery = json.load(fh)
    if len(delivery["slots"]) != 11:
        PROBLEMS.append("delivery: слотов доставки {}, нужно 11".format(len(delivery["slots"])))
    if len(delivery["pickup_slots"]) != 11:
        PROBLEMS.append("delivery: слотов самовывоза {}, нужно 11".format(len(delivery["pickup_slots"])))
    if not delivery["slots"][0]["label"].startswith("09:30"):
        PROBLEMS.append("delivery: первый слот доставки не 09:30")
    if not delivery["pickup_slots"][0]["label"].startswith("09:00"):
        PROBLEMS.append("delivery: первый слот самовывоза не 09:00")

    with open(os.path.join(FRONT, "mock", "orders.json"), "r", encoding="utf-8") as fh:
        orders = json.load(fh)["orders"]
    statuses = {order["payment_status"] for order in orders}
    methods = {order["delivery_method"] for order in orders}
    if not {"pending", "succeeded", "canceled", "mismatch"} <= statuses:
        PROBLEMS.append("orders: не все статусы оплаты: {}".format(sorted(statuses)))
    if not {"delivery", "surprise", "pickup"} <= methods:
        PROBLEMS.append("orders: не все способы получения: {}".format(sorted(methods)))


def main():
    pages = sorted(name for name in os.listdir(FRONT) if name.endswith(".html"))
    for page in pages:
        check_html(os.path.join(FRONT, page))

    css_dir = os.path.join(FRONT, "css")
    for name in sorted(os.listdir(css_dir)):
        if name.endswith(".css"):
            check_css(os.path.join(css_dir, name))

    check_mock_contract()

    print("Страниц проверено:", len(pages))
    if PROBLEMS:
        print("\nПроблемы ({}):".format(len(PROBLEMS)))
        for problem in PROBLEMS:
            print(" -", problem)
        return 1
    print("Проблем не найдено.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
