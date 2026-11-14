package fr.openbook.scraper.sources;

import fr.openbook.scraper.config.ScraperProperties;
import org.springframework.stereotype.Component;

/**
 * Scraper source for Jane Austen via Leslibraires.fr (https://www.leslibraires.fr/personne/jane-austen/51020/).
 */
@Component
public class JaneAustenSource extends AbstractLesLibrairesSource {

    public static final String PERSON_URL = BASE_URL + "/personne/jane-austen/51020/";

    public JaneAustenSource(ScraperProperties properties) {
        super(properties);
    }

    @Override
    public String getId() {
        return "jane_austen";
    }

    @Override
    public String getName() {
        return "Jane Austen";
    }

    @Override
    public String getDescription() {
        return "Bibliographie de Jane Austen via Leslibraires.fr";
    }

    @Override
    public String getColor() {
        return "#10b981";
    }

    @Override
    protected String getSourceUrl() {
        return PERSON_URL;
    }

    @Override
    protected String getPersonId() {
        return "51020";
    }
}
