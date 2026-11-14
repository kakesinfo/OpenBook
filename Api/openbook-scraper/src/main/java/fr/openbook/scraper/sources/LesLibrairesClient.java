package fr.openbook.scraper.sources;

import fr.openbook.scraper.config.ScraperProperties;

/**
 * Non-bean {@link AbstractLesLibrairesSource} helper used by existing scrapers
 * (such as Label 619 and Morgen BD) to pull additional releases from Leslibraires.fr.
 */
public class LesLibrairesClient extends AbstractLesLibrairesSource {

    private final String id;
    private final String name;
    private final String description;
    private final String color;
    private final String sourceUrl;
    private final String defaultEditorName;
    private final String defaultCategoryName;
    private final boolean forceDefaultCategory;

    public LesLibrairesClient(
            ScraperProperties properties,
            String id,
            String name,
            String description,
            String color,
            String sourceUrl,
            String defaultEditorName,
            String defaultCategoryName,
            boolean forceDefaultCategory
    ) {
        super(properties);
        this.id = id;
        this.name = name;
        this.description = description;
        this.color = color;
        this.sourceUrl = sourceUrl;
        this.defaultEditorName = defaultEditorName;
        this.defaultCategoryName = defaultCategoryName;
        this.forceDefaultCategory = forceDefaultCategory;
    }

    @Override
    public String getId() {
        return id;
    }

    @Override
    public String getName() {
        return name;
    }

    @Override
    public String getDescription() {
        return description;
    }

    @Override
    public String getColor() {
        return color;
    }

    @Override
    public String getSourceUrl() {
        return sourceUrl;
    }

    @Override
    protected String getDefaultEditorName() {
        return defaultEditorName;
    }

    @Override
    protected String getDefaultCategoryName() {
        return defaultCategoryName;
    }

    @Override
    protected boolean isForceDefaultCategory() {
        return forceDefaultCategory;
    }
}
