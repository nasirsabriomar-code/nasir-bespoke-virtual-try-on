"use client";

import type { Level1CatalogueView } from "@/lib/catalog/level1-types";

type Level1CatalogueProps = {
  catalogue: Level1CatalogueView;
  categoryId: string;
  designId: string | null;
  onCategoryChange: (categoryId: string) => void;
  onDesignChange: (designId: string) => void;
};

export function Level1Catalogue({
  catalogue,
  categoryId,
  designId,
  onCategoryChange,
  onDesignChange,
}: Level1CatalogueProps) {
  const activeCategory = catalogue.categories.find((category) => category.id === categoryId) ?? catalogue.categories[0];
  const designs = catalogue.designs.filter((design) => design.categoryId === activeCategory?.id);

  return (
    <div className="level1-catalogue">
      <div className="level1-category-tabs" role="tablist" aria-label="Outfit categories">
        {catalogue.categories.map((category) => {
          const selected = category.id === activeCategory?.id;

          return (
            <button
              className={`level1-category-tab${selected ? " is-selected" : ""}`}
              type="button"
              role="tab"
              key={category.id}
              aria-selected={selected}
              onClick={() => onCategoryChange(category.id)}
            >
              <span>{category.name}</span>
            </button>
          );
        })}
      </div>

      {activeCategory ? (
        <div className="level1-catalogue-heading">
          <div>
            <h3>{activeCategory.name}</h3>
            <p>{activeCategory.description}</p>
          </div>
          <span>{designs.length} curated designs</span>
        </div>
      ) : null}

      <div className="level1-design-grid" role="list" aria-label="Curated Suit designs">
        {designs.map((design) => {
          const selected = design.id === designId;
          const ready = design.generation.state === "ready";

          return (
            <button
              className={`level1-design-card${selected ? " is-selected" : ""}`}
              type="button"
              key={design.id}
              aria-pressed={selected}
              onClick={() => onDesignChange(design.id)}
            >
              {design.cardImage.state === "ready" && design.cardImage.url ? (
                // The URL is a protected application route, never a storage URL.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={design.cardImage.url} alt="" className="level1-card-image" />
              ) : (
                <div className="level1-card-placeholder" aria-hidden="true">
                  <span>NB</span>
                  <small>Catalogue image awaiting approval</small>
                </div>
              )}
              <span className="level1-card-body">
                <span className="level1-card-title-row">
                  <strong>{design.name}</strong>
                  {selected ? <span className="level1-selected-mark">Selected</span> : null}
                </span>
                <span className="level1-card-description">{design.description}</span>
                <span className="level1-card-intent">{design.intent}</span>
                {!ready ? <span className="level1-card-state">Awaiting approved reference</span> : null}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
