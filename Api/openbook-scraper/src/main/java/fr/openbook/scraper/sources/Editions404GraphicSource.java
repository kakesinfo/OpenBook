package fr.openbook.scraper.sources;

import fr.openbook.scraper.config.ScraperProperties;
import org.springframework.stereotype.Component;

@Component
public class Editions404GraphicSource extends AbstractLesLibrairesSource {

    public static final String CATALOG_URL = BASE_URL + "/editeur/404-editions--/collection/404-graphic--/?tri=nouveautes";

    public Editions404GraphicSource(ScraperProperties properties) {
        super(properties);
    }

    @Override
    public String getId() {
        return "404_graphic";
    }

    @Override
    public String getName() {
        return "404 Graphic";
    }

    @Override
    public String getDescription() {
        return "Collection 404 Graphic - 404 Editions (via Leslibraires.fr)";
    }

    @Override
    public String getColor() {
        return "#6c5ce7";
    }

    @Override
    public String getSourceUrl() {
        return CATALOG_URL;
    }

    @Override
    protected String getDefaultEditorName() {
        return "404 Graphic";
    }

    @Override
    protected String getDefaultCategoryName() {
        return "Comics";
    }

    @Override
    protected boolean isForceDefaultCategory() {
        return true;
    }
}
