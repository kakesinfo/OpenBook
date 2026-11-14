package fr.openbook.scraper.sources;

import fr.openbook.scraper.config.ScraperProperties;
import org.springframework.stereotype.Component;

/**
 * Scraper source for Ali Hazelwood via Leslibraires.fr (https://www.leslibraires.fr/personne/ali-hazelwood/2346681/).
 */
@Component
public class AliHazelwoodSource extends AbstractLesLibrairesSource {

    public static final String PERSON_URL = BASE_URL + "/personne/ali-hazelwood/2346681/";

    public AliHazelwoodSource(ScraperProperties properties) {
        super(properties);
    }

    @Override
    public String getId() {
        return "ali_hazelwood";
    }

    @Override
    public String getName() {
        return "Ali Hazelwood";
    }

    @Override
    public String getDescription() {
        return "Bibliographie d'Ali Hazelwood via Leslibraires.fr";
    }

    @Override
    public String getColor() {
        return "#ec4899";
    }

    @Override
    protected String getSourceUrl() {
        return PERSON_URL;
    }

    @Override
    protected String getPersonId() {
        return "2346681";
    }
}
