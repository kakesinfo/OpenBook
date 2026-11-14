package fr.openbook.scraper.sources;

import fr.openbook.scraper.config.ScraperProperties;
import org.springframework.stereotype.Component;

/**
 * Scraper source for Carlos Ruiz Zafón via Leslibraires.fr (https://www.leslibraires.fr/personne/carlos-ruiz-zafon/1720863/).
 */
@Component
public class CarlosRuizZafonSource extends AbstractLesLibrairesSource {

    public static final String PERSON_URL = BASE_URL + "/personne/carlos-ruiz-zafon/1720863/";

    public CarlosRuizZafonSource(ScraperProperties properties) {
        super(properties);
    }

    @Override
    public String getId() {
        return "carlos_ruiz_zafon";
    }

    @Override
    public String getName() {
        return "Carlos Ruiz Zafón";
    }

    @Override
    public String getDescription() {
        return "Bibliographie de Carlos Ruiz Zafón via Leslibraires.fr";
    }

    @Override
    public String getColor() {
        return "#6366f1";
    }

    @Override
    protected String getSourceUrl() {
        return PERSON_URL;
    }

    @Override
    protected String getPersonId() {
        return "1720863";
    }
}
