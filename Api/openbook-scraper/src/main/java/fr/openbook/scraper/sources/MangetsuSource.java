package fr.openbook.scraper.sources;

import fr.openbook.scraper.config.ScraperProperties;
import org.springframework.stereotype.Component;

/**
 * Scraper source for Mangetsu via Leslibraires.fr (https://www.leslibraires.fr/editeur/mangetsu/?tri=nouveautes).
 */
@Component
public class MangetsuSource extends AbstractLesLibrairesSource {

    public static final String CATALOG_URL = BASE_URL + "/editeur/mangetsu/?tri=nouveautes";

    public MangetsuSource(ScraperProperties properties) {
        super(properties);
    }

    @Override
    public String getId() {
        return "mangetsu";
    }

    @Override
    public String getName() {
        return "Mangetsu";
    }

    @Override
    public String getDescription() {
        return "Mangas seinen, shonen & nouveautés japonaises";
    }

    @Override
    public String getColor() {
        return "#f59e0b";
    }

    @Override
    protected String getSourceUrl() {
        return CATALOG_URL;
    }

    @Override
    protected String getDefaultEditorName() {
        return "Mangetsu";
    }

    @Override
    protected String getDefaultCategoryName() {
        return "Manga";
    }

    @Override
    protected boolean isForceDefaultCategory() {
        return true;
    }
}
