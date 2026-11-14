package fr.openbook.scraper.sources;

import fr.openbook.scraper.config.ScraperProperties;
import org.springframework.stereotype.Component;

/**
 * Scraper source for Agatha Christie via Leslibraires.fr (https://www.leslibraires.fr/personne/agatha-christie/58189/).
 */
@Component
public class AgathaChristieSource extends AbstractLesLibrairesSource {

    public static final String PERSON_URL = BASE_URL + "/personne/agatha-christie/58189/";

    public AgathaChristieSource(ScraperProperties properties) {
        super(properties);
    }

    @Override
    public String getId() {
        return "agatha_christie";
    }

    @Override
    public String getName() {
        return "Agatha Christie";
    }

    @Override
    public String getDescription() {
        return "Bibliographie d'Agatha Christie via Leslibraires.fr";
    }

    @Override
    public String getColor() {
        return "#be123c";
    }

    @Override
    protected String getSourceUrl() {
        return PERSON_URL;
    }

    @Override
    protected String getPersonId() {
        return "58189";
    }
}
