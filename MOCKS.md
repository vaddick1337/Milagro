# MOCKS.md — контракт данных этапа 1

Фронт общается с данными только через `js/api.js` — функция `api(path, options)`.
Пока `const MOCK = true`, она читает `mock/*.json` и эмулирует запись в памяти;
правки админки складываются в `sessionStorage` (ключ `milagro.mock.state.v1`) и
исчезают после закрытия вкладки. На этапе 2 меняются `MOCK = false` и `BASE`,
остальной код страниц не трогается.

Общие правила: цены — целые числа в рублях; даты — `YYYY-MM-DD`; время —
по Екатеринбургу (UTC+5); slug назначается один раз и не меняется; `hidden`
товар не показывается в витрине, но виден в админке.

## Эндпоинты

| Метод и путь | Что делает | Ответ |
| --- | --- | --- |
| `GET /api/catalog` | категории и товары для витрины | `{categories[], products[]}` |
| `GET /api/site` | данные главной | `{brand, brand_sub, hero_slides[], offers_image_url}` |
| `GET /api/delivery` | зоны, слоты, самовывоз | объект `delivery.json` |
| `GET /api/branches` | студии с координатами | `{branches[]}` |
| `POST /api/orders` | создать заказ | `201 {success, order_id, order}` |
| `GET /api/admin/orders` | заказы для админки | `{orders[]}` |
| `PATCH /api/admin/orders/:id` | архив заказа: `{archived: true/false}` | `{ok, order}` |
| `GET /api/admin/products` | все товары, включая скрытые | `{products[]}` |
| `POST /api/admin/products` | создать: `{product}` | `{ok, product}` |
| `PUT /api/admin/products/:id` | сохранить: `{product}` | `{ok, product}` |
| `DELETE /api/admin/products/:id` | удалить навсегда | `{ok}` |
| `PATCH /api/admin/products/:id/flags` | `{hidden?, showcase?, featured?}` | `{ok, product}` |
| `GET/POST /api/admin/categories` | список / создать `{category}` | `{categories[]}` / `{ok, category}` |
| `PUT/DELETE /api/admin/categories/:id` | изменить / удалить пустую (409, если есть товары) | `{ok, category}` / `{ok}` |
| `GET/PUT /api/admin/site` | данные главной | объект `site` |
| `POST /api/admin/site/reset` | «Вернуть стандартные» | `{ok, site}` |
| `GET/PUT /api/admin/search-codes` | `{yandex, google}` | `{yandex, google, updated_at}` |
| `GET/PUT /api/admin/telegram` | `{ids[]}` (только цифры, ≤ 10) | `{ids, updated_at}` |
| `POST /api/admin/telegram/test` | тестовая отправка | `{ok, results[]}` |
| `GET /api/admin/uploads` | медиатека | `{uploads[]}` |
| `POST /api/admin/upload` | `{name, data_url}` → сохранить файл | `{ok, upload}` |

Все `/api/admin/*` требуют `options.token` → заголовок
`Authorization: Bearer <token>`. В моке принимается любой непустой ключ;
пустой токен выключен (вход в админку не выполняется).

Ошибки: `ApiError` с `status` и `payload.errors` (объект «поле → текст»).
Валидация заказа — 422 и тот же формат, что и на сервере этапа 2.

## catalog.json

`categories[]`: `id, slug, name, description, image_url, image_alt, position,
seo_h1, seo_title, seo_description, seo_text`.

`products[]`:

| Поле | Тип | Смысл |
| --- | --- | --- |
| `id` | string | `p-01…p-17` |
| `slug` | string | адрес страницы товара |
| `title` | string | название |
| `category` | string | `id` категории |
| `price` | int | цена, ₽ (без скидки) |
| `price_prefix` | string \| null | `"от"` для «от … ₽» |
| `description` | string | описание и состав словами |
| `image_url`, `image_thumb_url` | string | локальные пути |
| `image_alt` | string | подпись к фото |
| `is_new`, `badge` | bool, string \| null | бейдж «Новинка» |
| `flower_types[]` | string[] | состав для фильтра |
| `size` | string | размер (`S`, `M`, `L`, `XL`, `15 шт.` …) |
| `featured` | bool | блок «Предложения» |
| `showcase` | bool | «Готов прямо сейчас» на главной |
| `hidden` | bool | скрыт из витрины (но не удалён) |
| `no_delivery` | bool | только самовывоз |
| `pickup_branches[]` | string[] | в каких студиях есть товар |
| `discount_enabled` | bool | скидка включена |
| `discount_type` | `percent` \| `amount` | процент или сумма |
| `discount_value` | int | 15 или 300 |
| `discount_start`, `discount_end` | `YYYY-MM-DD` | включительно |
| `sale_price` | int \| null | цена со скидкой (считает сервер) |
| `discount_active` | bool | скидка действует сейчас |
| `discount_label` | string \| null | `-15%`, `−300 ₽` |
| `seo_title`, `seo_description` | string | мета для поиска |
| `created_at` | ISO | для сортировки «сначала новые» |

## delivery.json

```
zones[]           {id, name, price|null, price_note?}
surprise_zones[]  {id, name, price|null, price_note?}
free_from         int|null        // порог бесплатной доставки
pickup[]          {id, name, short, address, details, hours, phone}
payment_mode      "test"
slots[]           {start: "09:30", minutes: 60, label: "09:30–10:30"}   // 11 шт.
pickup_slots[]    {start: "09:00", minutes: 60, label: "09:00–10:00"}   // 11 шт.
booking_days      60
lead_minutes      60
timezone          "Asia/Yekaterinburg"
```

`price: null` означает «стоимость уточняется» — интерфейс показывает это
словами, а не нулём. `null` в `free_from` — «порог уточняется».

## branches.json

`branches[]`: `id, slug, name, short, address, details, hours, phone, phone_href,
lat, lng`. Координаты — строго своей студии: `61.249210, 73.377869`.

## site.json

```
brand            "Milagro"
brand_sub        "цветочная студия, Сургут"
hero_slides[]    {image_url, mobile_image_url, alt}
offers_image_url string
```

Пустой `hero_slides` — hero показывает фото студии по умолчанию (сейчас это
первый слайд из мока). Слайды редактируются в админке.

## orders.json и POST /api/orders

Заказ содержит: `id, number, created_at, payment_status
(pending|succeeded|canceled|mismatch), delivery_method
(delivery|surprise|pickup), customer{name, phone, email}, items[]
{product_id, title, quantity, price, image_url, image_alt},
goods_total, delivery_price, total, comment, delivery_date, delivery_slot,
delivery_zone, pickup_branch, address, recipient_phone, same_recipient,
consents{data_consent, offer_accepted, *_at, consent_version, privacy_version,
offer_version}, archived`.

Тело `POST /api/orders`:

```
name, phone, email, address, delivery_method, delivery_zone, pickup_branch,
delivery_date, delivery_slot, recipient_phone, same_recipient, comment,
items[] {product_id, quantity},
data_consent, offer_accepted,
consent_version, privacy_version, offer_version
```

Сервер сам пересчитывает цены по `product_id`, проверяет дату и слот
(`checkWhen`) и возвращает `201 {success, order_id}`. Фронт сумму не диктует —
только показывает предварительную.

## Правила проверки (одинаковые на фронте и в моке)

- телефон — не меньше 10 цифр; имя — не меньше 2 символов;
- доставка: выбран район и адрес; «получу сам» → телефон получателя = телефон
  заказчика, иначе отдельное поле ≥ 10 цифр;
- сюрприз: телефон получателя обязателен, «что знаете об адресе» — нет;
- самовывоз: выбрана студия, где есть все товары корзины;
- дата — в пределах 60 дней, слот — из своего списка, и до старта слота не
  меньше 60 минут по времени Екатеринбурга (UTC+5);
- обе галочки согласий — отмечены пользователем (не предзаполнены);
- в заказ попадают версии документов (`draft` на этапе 1).

## Что появится на этапе 2

- настоящие `GET /api/*` с этим же JSON;
- серверные `checkWhen`, пересчёт сумм, `201` и сохранение заказа в БД;
- `Authorization: Bearer` и сравнение токена за постоянное время;
- загрузка файлов: лимит 9,5 МиБ, тип по сигнатуре, 80 Мп, EXIF, HEIC, WebP
  2000 px + миниатюра 640 px;
- `robots.txt` и `sitemap.xml` генерируются по каталогу;
- SEO-страницы `/catalog/<slug>` и `/product/<slug>` отдаются готовым HTML.
