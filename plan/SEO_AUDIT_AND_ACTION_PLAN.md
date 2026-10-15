# План SEO-модернизации и позиционирования: Business Analyzer (BA)

> **Текущий SEO-скор:** 25 / 100 (🔴 Критический уровень, отсутствие базовых тегов)  
> **Дата аудита:** Октябрь 2026  
> **Роль в экосистеме:** Геоаналитическая BI-платформа оценки локаций, плотности бизнеса и конкуренции (OSM / Catchment Scoring)  
> **Стек:** Node.js + TypeScript + Leaflet + Express  
> **Глобальный план:** [GLOBAL_SEO_OPTIMIZATION_PLAN.md](file:///Users/jilimbo/Documents/Personal/GLOBAL_SEO_OPTIMIZATION_PLAN.md)

---

## 1. Обнаруженные проблемы и уязвимости

### [P0] Неинформативный Title и полное отсутствие Meta Description
* **Файл:** `public/index.html` (строки 7–8)
* **Проблема:** Текущий тег: `<title>Businesses</title>`. Тег `<meta name="description">` **полностью отсутствует**.
* **Влияние:** Нулевая видимость в поисковых системах. Поисковик не понимает сути продукта (геоаналитика для бизнеса).

### [P0] Полное отсутствие Open Graph, Twitter Cards и Favicon
* При отправке ссылки инвесторам или B2B-партнерам отображается пустой серый прямоугольник без описания.

### [P1] Отсутствие `robots.txt` и `sitemap.xml`
* Нет карты сайта и инструкций для роботов.

---

## 2. Пошаговый план внедрения (Action Plan)

- [x] **Шаг 1 (P0): Полная замена заголовков и метаданных в `public/index.html`**
  - Добавлены `title` ("Location Intelligence"), `meta description`, `keywords`, `canonical`, Open Graph и Twitter Cards.
  - Создан брендированный растровый баннер `public/og-map.png` (1200×630).

- [x] **Шаг 2 (P1): Создание `public/robots.txt` и `public/sitemap.xml`**
  - Разрешена индексация главной и виджета (`/widget.html`), закрыты тяжелые гео-файлы (`/raw.geojson`, `businesses.csv`).
  - Создан `sitemap.xml`.

- [x] **Шаг 3 (P2): Внедрение Schema.org `SoftwareApplication`**
  - Добавлена микроразметка `BusinessApplication`.
