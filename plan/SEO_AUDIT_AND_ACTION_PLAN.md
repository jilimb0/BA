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

- [ ] **Шаг 1 (P0): Полная замена заголовков и метаданных в `public/index.html`**
  ```html
  <title>Business Analyzer — Location Intelligence & Catchment Area Scoring</title>
  <meta name="description" content="Интерактивная платформа пространственного анализа бизнеса на базе OpenStreetMap. Оценка пешеходного трафика, индекса конкуренции и коммерческого потенциала локаций." />
  <meta name="keywords" content="location intelligence, geomarketing, openstreetmap business, catchment area, foot traffic analytics" />
  <link rel="canonical" href="https://business-analyzer.app/" />

  <!-- Open Graph -->
  <meta property="og:type" content="website" />
  <meta property="og:title" content="Business Analyzer — Location Intelligence & Catchment Scoring" />
  <meta property="og:description" content="Анализ локаций, конкурентов и плотности торговых точек для открытия успешного бизнеса." />
  <meta property="og:image" content="https://business-analyzer.app/og-map.png" />
  <meta name="twitter:card" content="summary_large_image" />
  ```

- [ ] **Шаг 2 (P1): Создание `public/robots.txt` и `public/sitemap.xml`**
  - Разрешить индексацию главной витрины и виджета (`/widget.html`).
  - Закрыть сырые выгрузки данных (`/raw.geojson`, `businesses.csv`, `/uploads/`).

- [ ] **Шаг 3 (P2): Внедрение Schema.org `SoftwareApplication`**
  - Указать категорию `BusinessApplication`.
