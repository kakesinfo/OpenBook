package fr.openbook.scraper.sources;

import fr.openbook.scraper.config.ScraperProperties;
import org.springframework.stereotype.Component;

/**
 * Scraper source for Éditions Hauteville via Leslibraires.fr (https://www.leslibraires.fr/editeur/hauteville/).
 */
@Component
public class HautevilleSource extends AbstractLesLibrairesSource {

    public static final String CATALOG_URL = BASE_URL + "/editeur/hauteville/";

    public HautevilleSource(ScraperProperties properties) {
        super(properties);
    }

    @Override
    public String getId() {
        return "hauteville";
    }

    @Override
    public String getName() {
        return "Hauteville";
    }

    @Override
    public String getDescription() {
        return "Catalogue et nouveautés des éditions Hauteville (romans, romance, imaginaire) via Leslibraires.fr";
    }

    @Override
    public String getColor() {
        return "#a855f7";
    }

    @Override
    protected String getSourceUrl() {
        return CATALOG_URL;
    }

    @Override
    protected String getDefaultEditorName() {
        return "Hauteville";
    }
}
