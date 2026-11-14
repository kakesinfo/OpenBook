package fr.openbook.scraper.sources;

import fr.openbook.scraper.config.ScraperProperties;
import org.springframework.stereotype.Component;

/**
 * Scraper source for Éditions Astrolabe via Leslibraires.fr (https://www.leslibraires.fr/editeur/astrolabe/).
 */
@Component
public class AstrolabeSource extends AbstractLesLibrairesSource {

    public static final String CATALOG_URL = BASE_URL + "/editeur/astrolabe/";

    public AstrolabeSource(ScraperProperties properties) {
        super(properties);
    }

    @Override
    public String getId() {
        return "astrolabe";
    }

    @Override
    public String getName() {
        return "Astrolabe";
    }

    @Override
    public String getDescription() {
        return "Catalogue et nouveautés des éditions Astrolabe via Leslibraires.fr";
    }

    @Override
    public String getColor() {
        return "#14b8a6";
    }

    @Override
    protected String getSourceUrl() {
        return CATALOG_URL;
    }

    @Override
    protected String getDefaultEditorName() {
        return "Astrolabe";
    }

    @Override
    protected String getDefaultCategoryName() {
        return "Bande dessinée";
    }
}
