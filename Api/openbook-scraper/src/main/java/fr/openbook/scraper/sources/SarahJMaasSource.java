package fr.openbook.scraper.sources;

import fr.openbook.scraper.config.ScraperProperties;
import org.springframework.stereotype.Component;

/**
 * Scraper source for Sarah J. Maas via Leslibraires.fr (https://www.leslibraires.fr/personne/sarah-j-maas/1805611/).
 */
@Component
public class SarahJMaasSource extends AbstractLesLibrairesSource {

    public static final String PERSON_URL = BASE_URL + "/personne/sarah-j-maas/1805611/";

    public SarahJMaasSource(ScraperProperties properties) {
        super(properties);
    }

    @Override
    public String getId() {
        return "sarah_j_maas";
    }

    @Override
    public String getName() {
        return "Sarah J. Maas";
    }

    @Override
    public String getDescription() {
        return "Bibliographie de Sarah J. Maas via Leslibraires.fr";
    }

    @Override
    public String getColor() {
        return "#f59e0b";
    }

    @Override
    protected String getSourceUrl() {
        return PERSON_URL;
    }

    @Override
    protected String getPersonId() {
        return "1805611";
    }
}
