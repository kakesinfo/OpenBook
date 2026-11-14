package fr.openbook.scraper.sources;

import fr.openbook.scraper.config.ScraperProperties;
import org.springframework.stereotype.Component;

/**
 * Scraper source for Michael McDowell via Leslibraires.fr (https://www.leslibraires.fr/personne/michael-mcdowell/217934/).
 */
@Component
public class MichaelMcDowellSource extends AbstractLesLibrairesSource {

    public static final String PERSON_URL = BASE_URL + "/personne/michael-mcdowell/217934/";

    public MichaelMcDowellSource(ScraperProperties properties) {
        super(properties);
    }

    @Override
    public String getId() {
        return "michael_mcdowell";
    }

    @Override
    public String getName() {
        return "Michael McDowell";
    }

    @Override
    public String getDescription() {
        return "Bibliographie de Michael McDowell via Leslibraires.fr";
    }

    @Override
    public String getColor() {
        return "#475569";
    }

    @Override
    protected String getSourceUrl() {
        return PERSON_URL;
    }

    @Override
    protected String getPersonId() {
        return "217934";
    }
}
