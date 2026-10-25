-- CINE-10a: el catálogo pasa a venir de Notion ("🎬 Películas & Series").
-- Agrega títulos por idioma, estado vista/pendiente y el criterio personal.

ALTER TABLE movies
    ADD COLUMN IF NOT EXISTS title_en          VARCHAR(255),
    ADD COLUMN IF NOT EXISTS title_es          VARCHAR(255),
    ADD COLUMN IF NOT EXISTS original_title    VARCHAR(255),
    ADD COLUMN IF NOT EXISTS original_language VARCHAR(10),
    ADD COLUMN IF NOT EXISTS display_title     VARCHAR(255),
    ADD COLUMN IF NOT EXISTS status    VARCHAR(10) NOT NULL DEFAULT 'seen'
        CHECK (status IN ('seen', 'pending')),
    ADD COLUMN IF NOT EXISTS recommend SMALLINT CHECK (recommend IN (-1, 0, 1)),  -- 🔴 / 🟡 / 🟢
    ADD COLUMN IF NOT EXISTS rating    SMALLINT CHECK (rating BETWEEN 1 AND 5),   -- ⭐ 1-5
    ADD COLUMN IF NOT EXISTS review    TEXT,
    ADD COLUMN IF NOT EXISTS notion_page_id   UUID UNIQUE,
    ADD COLUMN IF NOT EXISTS notion_edited_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS movies_status_idx ON movies (status);