# Шрифты

Сюда кладутся локальные WOFF2. Никаких Google Fonts.

## Файлы

| Файл | Гарнитура | Начертание |
| --- | --- | --- |
| `cormorant-garamond-500.woff2` | Cormorant Garamond | 500 (Medium) |
| `cormorant-garamond-600.woff2` | Cormorant Garamond | 600 (SemiBold) |
| `montserrat-300.woff2` | Montserrat | 300 (Light) |
| `montserrat-400.woff2` | Montserrat | 400 (Regular) |
| `montserrat-500.woff2` | Montserrat | 500 (Medium) |
| `montserrat-600.woff2` | Montserrat | 600 (SemiBold) |
| `caveat-400.woff2` | Caveat | 400 (Regular) |

## Как включить

1. Положить файлы в эту папку под указанными именами.
2. В `frontend/css/fonts.css` в каждом блоке `@font-face` раскомментировать
   строку с `url("../assets/fonts/…") format("woff2")`.
3. Поднять `?v=` у `css/fonts.css` в HTML.

Пока файлов нет, `@font-face` использует `local(...)`, а дальше в стеке стоят
метрически близкие системные шрифты — вёрстка не ломается и 404 в консоли нет.
