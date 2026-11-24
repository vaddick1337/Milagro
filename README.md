# Milagro — фронтенд этапа 1

Статический сайт цветочной студии в Сургуте: чистые HTML / CSS / JavaScript,
без сборки, всё на моках. Дизайн и поведение — как у VΛΖΛ, палитра
«Брусника и снег», бренд — Milagro.

## Как открыть локально

```bash
cd frontend
python3 -m http.server 8000
# Windows, если python3 не найден:
py -m http.server 8000
```

Открыть <http://localhost:8000/>.

Важно: страницы ходят за моками через `fetch`, поэтому открывать файлы
двойным кликом (`file://`) нельзя — нужен любой локальный HTTP-сервер.

## Что уже работает

- **Главная** — hero-слайдер, полоса из четырёх пунктов, «Готовы прямо сейчас»,
  коллекции, студия с картой по клику, блок доставки, подвал со знаком Бинка.
- **Магазин** (`shop.html`) — фильтры (категория, цена, состав, размер,
  получение), поиск, сортировка, карточка товара в диалоге, корзина,
  оформление заказа тремя способами, календарь на 60 дней и часовые слоты,
  проверки формы, экран успеха с пометкой «Тестовый режим».
- **SEO-шаблоны** — `catalog.html?slug=…` и `product.html?slug=…`
  (на этапе 2 сервер отдаёт их готовым HTML).
- **Админка** — `shop.html#admin`: вход по ключу, вкладки «Товары · Заказы ·
  Категории · Фото главной · Поиск», загрузка фото с превью.
- **Документы** — `privacy.html`, `consent.html`, `offer.html`,
  `requisites.html` с плашкой «Документ готовится».
- **Плавающий док** контактов на главной и в магазине.

## Структура

```
frontend/
  index.html  shop.html  catalog.html  product.html
  privacy.html  consent.html  offer.html  requisites.html
  robots.txt  sitemap.xml
  css/   fonts.css styles.css home-catalog.css market.css
         legal.css contact-dock.css sunlight.css
  js/    api.js app.js home-catalog.js market.js admin.js contact-dock.js
  mock/  catalog.json delivery.json branches.json site.json orders.json
  assets/ fonts/ icons/ photos/ favicon* floral-background(-mobile).svg
```

Документы проекта лежат на уровень выше: `REPORT.md` (отчёт этапа 1: что сделано,
чем проверено, что решает владелец), `DESIGN.md` (токены, фото, движение, знак
Бинка), `MOCKS.md` (контракт данных), `OWNER-QUESTIONS.md` (открытые вопросы),
`.env.example` (шаблон для этапа 2), `screenshots/` (снимки после проверки).

## Где что редактировать

- Цены, состав, категории — `frontend/mock/catalog.json`.
- Зоны доставки, слоты, студии — `frontend/mock/delivery.json`,
  `frontend/mock/branches.json`.
- Слайды главной — `frontend/mock/site.json` (или админка → «Фото главной»).
- Адрес, часы, телефон на сайте — `js/app.js` (константы `PHONE`, `ADDRESS`,
  `HOURS`) и моки; на этапе 2 придут из `/api/branches`.

После правок CSS/JS увеличьте `?v=` в HTML — кэш браузера сравнивает версии.

## Ограничения этапа 1 (намеренные)

- Оплата, Telegram и аналитика не подключены: заказ уходит в мок и показывает
  «Тестовый режим».
- Шрифты подключаются локально; пока WOFF2 нет в `assets/fonts/`, работают
  системные fallback (см. `assets/fonts/README.md`).
- Фотографии: все 22 товара, 5 кадров баннера и 3 обложки категорий — реальные
  снимки студии;
  остальные позиции — SVG-заглушки, меняются через `tools/apply_photos.py`
  (файл кладётся в `assets/photos/incoming/` с именем `p-01`, `hero-1` и т. п.).
- WhatsApp и MAX не подключены: у студии подтверждены только Telegram и VK,
  остальное — вопрос владельцу.
- Порог бесплатной доставки и точные цены зон показываются словами
  «уточняется» — цифр в брифе нет.

## Проверки

```bash
# синтаксис JS (node не в PATH — полный путь к node.exe)
"C:\Users\Vlad\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe" --check frontend/js/api.js

# структура: ссылки, id, ассеты, контракт моков
python tools/check_frontend.py

# сценарии мок-API без браузера: заказ, валидация, админка
node tools/test_api.mjs
```

Что проверялось: синтаксис всех шести скриптов, структура страниц (дубли id,
битые ссылки, alt у фото), контракт моков (22 товара, 3 категории, 11+11
слотов, 4 статуса оплаты), 39 сценариев мок-API (заказ всеми способами,
валидация полей, архив заказов, флаги товаров, загрузка, коды поиска).
Вёрстка проверяется в браузере по брейкпоинтам из `DESIGN.md`.
