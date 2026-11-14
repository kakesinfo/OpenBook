package fr.openbook.scraper.sources;

import fr.openbook.scraper.config.ScraperProperties;
import org.springframework.stereotype.Component;

@Component
public class BlissSource extends AbstractLesLibrairesSource {

    public static final String CATALOG_URL = BASE_URL + "/editeur/bliss--/?tri=nouveautes";

    public BlissSource(ScraperProperties properties) {
        super(properties);
    }

    @Override
    public String getId() {
        return "bliss";
    }

    @Override
    public String getName() {
        return "Bliss";
    }

    @Override
    public String getDescription() {
        return "Bliss Editions (via Leslibraires.fr)";
    }

    @Override
    public String getColor() {
        return "#f4a261";
    }

    @Override
    public String getSourceUrl() {
        return CATALOG_URL;
    }

    @Override
    protected String getDefaultEditorName() {
        return "Bliss";
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
