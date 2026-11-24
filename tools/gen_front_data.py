# -*- coding: utf-8 -*-
"""Generate mock JSON, SVG placeholders and the favicon set for the Milagro frontend."""
import json
import os
import random
from datetime import date

from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FRONT = os.path.join(ROOT, "frontend")
MOCK = os.path.join(FRONT, "mock")
PHOTOS = os.path.join(FRONT, "assets", "photos")
ASSETS = os.path.join(FRONT, "assets")

for path in (MOCK, PHOTOS, ASSETS):
    os.makedirs(path, exist_ok=True)

TODAY = date(2026, 11, 24)

BRANCH = {
    "id": "b1",
    "slug": "naberezhny",
    "name": "Студия на Набережном",
    "short": "пр-т Набережный, 2",
    "address": "г. Сургут, пр-т Набережный, 2, 1 этаж",
    "details": "1 этаж",
    "hours": "Ежедневно 10:00–20:00",
    "phone": "+7 922 446-10-68",
    "phone_href": "tel:+79224461068",
    "lat": 61.249210,
    "lng": 73.377869,
}


def product(pid, title, slug, category, price, description, flowers, size,
            prefix=None, is_new=False, badge=None, featured=False, showcase=False,
            hidden=False, no_delivery=False, discount=None, image_alt=None,
            seo_title=None, seo_description=None, created="2026-11-10"):
    discount = discount or {}
    enabled = bool(discount)
    sale_price = None
    active = False
    label = None
    if enabled:
        if discount["type"] == "percent":
            sale_price = int(round(price * (100 - discount["value"]) / 100))
        else:
            sale_price = int(price - discount["value"])
        start = date.fromisoformat(discount["start"])
        end = date.fromisoformat(discount["end"])
        active = start <= TODAY <= end
        if active:
            label = "-{}%".format(discount["value"]) if discount["type"] == "percent" else "−{} ₽".format(discount["value"])
        else:
            sale_price = price
    return {
        "id": pid,
        "slug": slug,
        "title": title,
        "category": category,
        "price": price,
        "price_prefix": prefix,
        "description": description,
        "image_url": "assets/photos/{}.svg".format(pid),
        "image_thumb_url": "assets/photos/{}-thumb.svg".format(pid),
        "image_alt": image_alt or title,
        "is_new": is_new,
        "badge": badge,
        "flower_types": flowers,
        "size": size,
        "featured": featured,
        "showcase": showcase,
        "hidden": hidden,
        "no_delivery": no_delivery,
        "pickup_branches": ["b1"],
        "discount_enabled": enabled,
        "discount_type": discount.get("type"),
        "discount_value": discount.get("value"),
        "discount_start": discount.get("start"),
        "discount_end": discount.get("end"),
        "sale_price": sale_price,
        "discount_active": active,
        "discount_label": label,
        "seo_title": seo_title or "{} — купить в Сургуте | Milagro".format(title),
        "seo_description": seo_description or "{}: состав, размер и цена. Цветочная студия Milagro, Сургут, пр-т Набережный, 2.".format(title),
        "created_at": created,
    }


PRODUCTS = [
    product("p-01", "Букет «Северный шёлк»", "buket-severnyy-shelk", "bouquets", 5900,
            "Состав: роза, эустома, эвкалипт. Авторская сборка флориста студии.",
            ["роза", "эустома", "эвкалипт"], "M", featured=True, showcase=True,
            image_alt="Букет «Северный шёлк» с розами и эустомой"),
    product("p-02", "Букет «Брусника»", "buket-brusnika", "bouquets", 7400,
            "Состав: роза, гортензия, гиперикум. Плотный букет на длинных стеблях.",
            ["роза", "гортензия", "гиперикум"], "L", featured=True, showcase=True,
            image_alt="Букет «Брусника» с розами и гортензией"),
    product("p-03", "Букет «Обь»", "buket-ob", "bouquets", 4300,
            "Состав: хризантема, альстромерия, зелень. Сдержанная сборка в спокойной гамме.",
            ["хризантема", "альстромерия"], "M"),
    product("p-04", "Букет «Морошка»", "buket-moroshka", "bouquets", 6200,
            "Состав: роза, рускус, эустома. Тёплые оттенки, мягкая упаковка.",
            ["роза", "рускус", "эустома"], "L",
            discount={"type": "percent", "value": 15, "start": "2026-11-01", "end": "2026-12-31"}),
    product("p-05", "Букет «Тайга»", "buket-tayga", "bouquets", 8900,
            "Состав: роза, орхидея, ветки хлопка. Крупная сборка для подарка.",
            ["роза", "орхидея", "хлопок"], "XL", featured=True),
    product("p-06", "Букет «Первый снег»", "buket-pervyy-sneg", "bouquets", 5100,
            "Состав: белая роза, эустома, зелень. Светлая монохромная сборка.",
            ["роза", "эустома"], "M", is_new=True, badge="Новинка", showcase=True),
    product("p-07", "Букет «Набережный»", "buket-naberezhnyy", "bouquets", 3800,
            "Состав: хризантема, статица, зелень. Компактный букет на каждый день.",
            ["хризантема", "статица"], "S",
            discount={"type": "percent", "value": 10, "start": "2025-12-01", "end": "2025-12-31"}),
    product("p-08", "Розы кустовые, 15 шт.", "kuстовые-розы-15", "fresh", 2900,
            "Кустовые розы, 15 стеблей в упаковке. Цвет и оттенок уточняйте при заказе.",
            ["роза"], "15 шт.", prefix="от", showcase=True),
    product("p-09", "Роза «Прима», 51 шт.", "roza-prima-51", "fresh", 11900,
            "Розы сорта «Прима», 51 стебель. Классический букет на длинном стебле.",
            ["роза"], "51 шт.", featured=True),
    product("p-10", "Тюльпаны, 25 шт.", "tyulpany-25", "fresh", 3400,
            "Тюльпаны, 25 стеблей. Сезонный цветок, наличие уточняйте по телефону.",
            ["тюльпан"], "25 шт.", is_new=True, badge="Новинка"),
    product("p-11", "Эустома, 10 веток", "eustoma-10", "fresh", 4500,
            "Эустома, 10 веток в упаковке. Нежный оттенок, тонкий аромат.",
            ["эустома"], "10 веток",
            discount={"type": "amount", "value": 300, "start": "2026-11-15", "end": "2026-12-15"}),
    product("p-12", "Гортензия, 1 ветка", "gortenziya-1", "fresh", 900,
            "Гортензия, одна ветка. Цена указана за минимальный объём.",
            ["гортензия"], "1 ветка", prefix="от"),
    product("p-13", "Хризантема кустовая, 5 шт.", "hrizantema-5", "fresh", 2200,
            "Кустовая хризантема, 5 стеблей. Оттенок уточняйте при заказе.",
            ["хризантема"], "5 шт."),
    product("p-14", "Сухоцветы «Поле»", "suhocvety-pole", "dried", 3200,
            "Состав: лагурус, статица, пшеница. Сборка из сухоцветов, не требует воды.",
            ["лагурус", "статица", "пшеница"], "M", showcase=True),
    product("p-15", "Лагурус, пучок", "lagurus-puchok", "dried", 900,
            "Пучок лагуруса. Цена указана за минимальный объём.",
            ["лагурус"], "1 пучок", prefix="от"),
    product("p-16", "Стабилизированная роза в колбе", "stabilizirovannaya-roza", "dried", 4700,
            "Стабилизированная роза в стеклянной колбе. Только самовывоз из студии.",
            ["роза"], "1 шт.", no_delivery=True),
    product("p-17", "Композиция «Дом»", "kompoziciya-dom", "dried", 5600,
            "Состав: сухоцветы, ветки, керамическая ваза. Скрытый товар для проверки админки.",
            ["сухоцветы", "ветки"], "L", hidden=True),
]

CATEGORIES = [
    {
        "id": "bouquets",
        "slug": "bouquets",
        "name": "Букеты",
        "description": "Собранные флористом букеты — можно забрать из студии или заказать к дате.",
        "image_url": "assets/photos/cat-bouquets.svg",
        "image_alt": "Категория «Букеты»",
        "position": 1,
        "seo_h1": "Букеты в Сургуте",
        "seo_title": "Букеты — цветочная студия Milagro, Сургут",
        "seo_description": "Букеты от цветочной студии Milagro в Сургуте: состав, размер и цена на странице товара.",
        "seo_text": "Букеты собираются в студии на Набережном, 2. В карточке товара указан состав и размер, цену видно сразу.\n\nЕсли нужен другой состав или оттенок, позвоните — обсудим сборку и время.",
    },
    {
        "id": "fresh",
        "slug": "fresh-flowers",
        "name": "Свежие цветы",
        "description": "Цветы поштучно и небольшими объёмами: розы, тюльпаны, эустома, хризантема.",
        "image_url": "assets/photos/cat-fresh.svg",
        "image_alt": "Категория «Свежие цветы»",
        "position": 2,
        "seo_h1": "Свежие цветы в Сургуте",
        "seo_title": "Свежие цветы — Milagro, Сургут",
        "seo_description": "Свежие цветы в Сургуте: розы, тюльпаны, эустома, хризантема. Цветочная студия Milagro.",
        "seo_text": "Цветы продаются поштучно и пучками. Наличие отдельных позиций уточняйте по телефону — количество меняется каждый день.",
    },
    {
        "id": "dried",
        "slug": "dried-flowers",
        "name": "Сухоцветы",
        "description": "Сухоцветы и стабилизированные цветы: не требуют воды и стоят без вазы.",
        "image_url": "assets/photos/cat-dried.svg",
        "image_alt": "Категория «Сухоцветы»",
        "position": 3,
        "seo_h1": "Сухоцветы в Сургуте",
        "seo_title": "Сухоцветы — Milagro, Сургут",
        "seo_description": "Сухоцветы и стабилизированные цветы в Сургуте. Цветочная студия Milagro, пр-т Набережный, 2.",
        "seo_text": "Сухоцветы не требуют воды. Композиции можно забрать из студии или оформить доставкой по городу.",
    },
]

DELIVERY = {
    "zones": [
        {"id": "z-city", "name": "По городу", "price": None, "price_note": "стоимость уточняется"},
    ],
    "surprise_zones": [
        {"id": "s-city", "name": "Сюрприз по городу", "price": None, "price_note": "стоимость уточняется"},
    ],
    "free_from": None,
    "free_from_note": "порог бесплатной доставки уточняется у владельца",
    "pickup": [
        {
            "id": "b1",
            "name": "Студия на Набережном",
            "short": "пр-т Набережный, 2",
            "address": "г. Сургут, пр-т Набережный, 2",
            "details": "1 этаж",
            "hours": "Ежедневно 10:00–20:00",
            "phone": "+7 922 446-10-68",
        }
    ],
    "payment_mode": "test",
    "slots": [{"start": "{:02d}:30".format(h), "minutes": 60, "label": "{:02d}:30–{:02d}:30".format(h, h + 1)} for h in range(9, 20)],
    "pickup_slots": [{"start": "{:02d}:00".format(h), "minutes": 60, "label": "{:02d}:00–{:02d}:00".format(h, h + 1)} for h in range(9, 20)],
    "booking_days": 60,
    "lead_minutes": 60,
    "timezone": "Asia/Yekaterinburg",
}

SITE = {
    "brand": "Milagro",
    "brand_sub": "цветочная студия, Сургут",
    "hero_slides": [
        {"image_url": "assets/photos/hero-1.svg", "mobile_image_url": "assets/photos/hero-1-mobile.svg", "alt": "Букеты в студии Milagro"},
        {"image_url": "assets/photos/hero-2.svg", "mobile_image_url": "assets/photos/hero-2-mobile.svg", "alt": "Стол флориста в студии"},
        {"image_url": "assets/photos/hero-3.svg", "mobile_image_url": "assets/photos/hero-3-mobile.svg", "alt": "Букет в упаковке на светлом фоне"},
    ],
    "offers_image_url": "assets/photos/offers.svg",
}


def item(pid, qty):
    prod = next(p for p in PRODUCTS if p["id"] == pid)
    price = prod["sale_price"] if prod["discount_active"] else prod["price"]
    return {
        "product_id": prod["id"],
        "title": prod["title"],
        "quantity": qty,
        "price": price,
        "image_url": prod["image_url"],
        "image_alt": prod["image_alt"],
    }


def order(order_id, created, payment_status, method, items, **extra):
    goods = sum(i["price"] * i["quantity"] for i in items)
    delivery_price = extra.get("delivery_price")
    total = goods + (delivery_price or 0)
    base = {
        "id": order_id,
        "number": order_id,
        "created_at": created,
        "payment_status": payment_status,
        "delivery_method": method,
        "customer": {"name": "Тестовый покупатель", "phone": "+7 900 000-00-00", "email": "test@example.com"},
        "items": items,
        "goods_total": goods,
        "delivery_price": delivery_price,
        "total": total,
        "comment": extra.get("comment", ""),
        "consents": {
            "data_consent": True,
            "offer_accepted": True,
            "data_consent_at": created,
            "offer_accepted_at": created,
            "consent_version": "draft",
            "privacy_version": "draft",
            "offer_version": "draft",
        },
        "archived": False,
    }
    base.update(extra)
    return base


ORDERS = [
    order("T-1001", "2026-11-24T10:12:00+05:00", "succeeded", "delivery", [item("p-01", 1)],
          delivery_zone="z-city", delivery_price=None,
          address="г. Сургут, ул. Тестовая, 1, кв. 1 (тестовый адрес)",
          delivery_date="2026-11-25", delivery_slot="12:30–13:30",
          same_recipient=True, recipient_phone="+7 900 000-00-00"),
    order("T-1002", "2026-11-24T12:40:00+05:00", "pending", "surprise", [item("p-02", 1), item("p-14", 1)],
          delivery_zone="s-city", delivery_price=None,
          address="", delivery_date="2026-11-26", delivery_slot="17:30–18:30",
          same_recipient=False, recipient_phone="+7 900 000-00-01",
          comment="Тестовая подсказка: домофон 12, позвонить заранее"),
    order("T-1003", "2026-11-23T16:05:00+05:00", "canceled", "pickup", [item("p-09", 1)],
          pickup_branch="b1", delivery_date="2026-11-24", delivery_slot="13:00–14:00"),
    order("T-1004", "2026-11-22T09:20:00+05:00", "mismatch", "pickup", [item("p-16", 1)],
          pickup_branch="b1", delivery_date="2026-11-23", delivery_slot="11:00–12:00"),
]


def write_json(name, payload):
    path = os.path.join(MOCK, name)
    with open(path, "w", encoding="utf-8", newline="\n") as fh:
        json.dump(payload, fh, ensure_ascii=False, indent=2)
        fh.write("\n")
    return path


write_json("catalog.json", {"categories": CATEGORIES, "products": PRODUCTS})
write_json("delivery.json", DELIVERY)
write_json("branches.json", {"branches": [BRANCH]})
write_json("site.json", SITE)
write_json("orders.json", {"orders": ORDERS})


# ------------------------------------------------------------------ SVG photos
PALETTES = [
    ("#F2EEEB", "#E7DCD8", "#6E1F33", "#C9A3AE"),
    ("#F5F1EE", "#E9E1DB", "#2F4A44", "#A8B7A5"),
    ("#F6F2EF", "#EADFD9", "#9A6418", "#E2C48F"),
]


def placeholder(width, height, title, seed, dense=5, inset=0.14):
    rnd = random.Random(seed)
    bg, bg2, ink, soft = PALETTES[seed % len(PALETTES)]
    pad_x = int(width * inset)
    pad_y = int(height * inset)
    parts = [
        '<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}" role="img">'.format(w=width, h=height),
        "<defs>",
        '<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">'
        '<stop offset="0" stop-color="{bg}"/><stop offset="1" stop-color="{bg2}"/></linearGradient>'.format(bg=bg, bg2=bg2),
        "</defs>",
        '<rect width="{w}" height="{h}" fill="url(#bg)"/>'.format(w=width, h=height),
        '<g fill="none" stroke="{ink}" stroke-opacity="0.28" stroke-width="{sw}">'.format(ink=ink, sw=max(1, round(width / 500))),
    ]
    for i in range(dense):
        x0 = rnd.randint(-int(width * 0.1), int(width * 0.9))
        y0 = height + rnd.randint(0, int(height * 0.2))
        cx = x0 + rnd.randint(-int(width * 0.2), int(width * 0.2))
        cy = rnd.randint(int(height * 0.1), int(height * 0.6))
        parts.append('<path d="M{x0} {y0} Q{cx} {cy} {x1} {y1}"/>'.format(
            x0=x0, y0=y0, cx=cx, cy=cy,
            x1=cx + rnd.randint(-int(width * 0.25), int(width * 0.25)),
            y1=max(0, cy - rnd.randint(int(height * 0.2), int(height * 0.5)))))
    parts.append("</g>")
    parts.append('<g fill="{soft}" fill-opacity="0.75">'.format(soft=soft))
    for _ in range(dense * 3):
        parts.append('<circle cx="{cx}" cy="{cy}" r="{r}"/>'.format(
            cx=rnd.randint(pad_x, max(pad_x, width - pad_x)),
            cy=rnd.randint(pad_y, max(pad_y, height - pad_y)),
            r=rnd.randint(max(2, int(width / 220)), max(3, int(width / 90)))))
    parts.append("</g>")
    parts.append("</svg>")
    return "\n".join(parts)


def save_svg(name, content):
    with open(os.path.join(PHOTOS, name), "w", encoding="utf-8", newline="\n") as fh:
        fh.write(content)


for idx, prod in enumerate(PRODUCTS, start=1):
    save_svg("{}.svg".format(prod["id"]), placeholder(1000, 750, "фото · заглушка", idx))
    save_svg("{}-thumb.svg".format(prod["id"]), placeholder(400, 300, "фото", idx, dense=3))

for i, name in enumerate(["cat-bouquets", "cat-fresh", "cat-dried"], start=1):
    save_svg("{}.svg".format(name), placeholder(900, 700, "категория · заглушка", i + 5, dense=4))

save_svg("offers.svg", placeholder(900, 700, "предложения · заглушка", 9, dense=4))

for i, name in enumerate(["hero-1", "hero-2", "hero-3"], start=1):
    save_svg("{}.svg".format(name), placeholder(1600, 900, "hero · заглушка", i + 11, dense=7, inset=0.2))
    save_svg("{}-mobile.svg".format(name), placeholder(900, 1200, "hero · заглушка", i + 21, dense=6, inset=0.16))

# ---------------------------------------------------------------------- icons
ICONS = {
    "icon-phone": '<path d="M6 3h3l2 5-2 1a11 11 0 0 0 6 6l1-2 5 2v3a2 2 0 0 1-2 2A17 17 0 0 1 4 5a2 2 0 0 1 2-2z"/>',
    "icon-cart": '<path d="M3 4h2l2 11h11l2-8H6"/><circle cx="9" cy="19" r="1.5"/><circle cx="17" cy="19" r="1.5"/>',
    "icon-pin": '<path d="M12 21s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>',
    "icon-clock": '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    "icon-clock-small": '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    "icon-flower": '<path d="M12 3a3 3 0 0 1 3 3 3 3 0 0 1 3 3 3 3 0 0 1-1 5 3 3 0 0 1-5 4 3 3 0 0 1-5-4 3 3 0 0 1-1-5 3 3 0 0 1 3-3 3 3 0 0 1 3-3z"/>',
    "icon-truck": '<path d="M3 6h10v9H3z"/><path d="M13 9h4l3 3v3h-7z"/><circle cx="7" cy="18" r="1.6"/><circle cx="17" cy="18" r="1.6"/>',
    "icon-gift": '<path d="M4 9h16v11H4z"/><path d="M4 9V6h16v3"/><path d="M12 6v14"/><path d="M12 6c-3 0-4-3-2-4s3 2 2 4zM12 6c3 0 4-3 2-4s-3 2-2 4z"/>',
    "icon-tg": '<path d="M21 4 3 11l5 2 2 5 3-3 5 3z"/>',
    "icon-vk": '<path d="M4 8h3c0 4 2 6 4 6V8h3v4c2 0 3-2 4-4h3c-1 3-3 5-4 5 1 0 3 2 5 5h-3c-1-2-3-3-4-3v3H4z"/>',
    "icon-wa": '<path d="M12 3a9 9 0 0 0-7.7 13.6L3 21l4.5-1.2A9 9 0 1 0 12 3z"/><path d="M8.5 9c.5 2.5 2 4 4.5 4.5"/>',
    "icon-max": '<rect x="4" y="4" width="16" height="16" rx="4"/><path d="M8 15V9l4 4 4-4v6"/>',
    "icon-search": '<circle cx="11" cy="11" r="6"/><path d="M16 16l4 4"/>',
    "icon-menu": '<path d="M4 7h16M4 12h16M4 17h16"/>',
    "icon-close": '<path d="M6 6l12 12M18 6L6 18"/>',
    "icon-check": '<path d="M5 13l4 4L19 7"/>',
    "icon-leaf": '<path d="M4 20c0-8 6-14 16-14 0 10-6 14-16 14z"/><path d="M4 20C8 16 12 12 20 6"/>',
    "icon-question": '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.6.3-1 .9-1 1.7"/><circle cx="12" cy="17" r="0.6" fill="currentColor"/>',
}
ICON_DIR = os.path.join(FRONT, "assets", "icons")
os.makedirs(ICON_DIR, exist_ok=True)
for name, body in ICONS.items():
    content = (
        '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" '
        'fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" '
        'stroke-linejoin="round" aria-hidden="true">' + body + "</svg>\n"
    )
    with open(os.path.join(ICON_DIR, name + ".svg"), "w", encoding="utf-8", newline="\n") as fh:
        fh.write(content)

# -------------------------------------------------------------------- favicons
MASTER = 512
img = Image.new("RGBA", (MASTER, MASTER), (0, 0, 0, 0))
draw = ImageDraw.Draw(img)
draw.rounded_rectangle([0, 0, MASTER - 1, MASTER - 1], radius=int(MASTER * 0.22), fill=(110, 31, 51, 255))
cx = cy = MASTER // 2
petal_r = int(MASTER * 0.13)
for angle_point in [(0, -1), (1, -0.55), (1, 0.55), (0, 1), (-1, 0.55), (-1, -0.55)]:
    px = cx + int(angle_point[0] * MASTER * 0.17)
    py = cy + int(angle_point[1] * MASTER * 0.17)
    draw.ellipse([px - petal_r, py - petal_r, px + petal_r, py + petal_r], fill=(251, 248, 246, 255))
draw.ellipse([cx - int(MASTER * 0.055), cy - int(MASTER * 0.055), cx + int(MASTER * 0.055), cy + int(MASTER * 0.055)],
             fill=(217, 154, 62, 255))

img.save(os.path.join(ASSETS, "favicon.ico"), sizes=[(16, 16), (32, 32), (48, 48), (64, 64)])
img.resize((32, 32), Image.LANCZOS).save(os.path.join(ASSETS, "favicon-32.png"))
img.resize((192, 192), Image.LANCZOS).save(os.path.join(ASSETS, "favicon-192.png"))
img.resize((180, 180), Image.LANCZOS).save(os.path.join(ASSETS, "apple-touch-icon-180.png"))

with open(os.path.join(ASSETS, "favicon.svg"), "w", encoding="utf-8", newline="\n") as fh:
    fh.write(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="64" height="64">'
        '<rect width="64" height="64" rx="14" fill="#6E1F33"/>'
        '<g fill="#FBF8F6"><circle cx="32" cy="23" r="8"/><circle cx="43" cy="31" r="8"/>'
        '<circle cx="39" cy="43" r="8"/><circle cx="25" cy="43" r="8"/><circle cx="21" cy="31" r="8"/></g>'
        '<circle cx="32" cy="34" r="4" fill="#D99A3E"/></svg>\n'
    )

print("mocks:", len(PRODUCTS), "products,", len(CATEGORIES), "categories,", len(ORDERS), "orders")
print("photos:", len(os.listdir(PHOTOS)))
print("icons:", len(os.listdir(ICON_DIR)))
