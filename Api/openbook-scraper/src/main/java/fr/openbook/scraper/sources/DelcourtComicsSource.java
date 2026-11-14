package fr.openbook.scraper.sources;

import fr.openbook.scraper.config.ScraperProperties;
import org.springframework.stereotype.Component;

@Component
public class DelcourtComicsSource extends AbstractLesLibrairesSource {

    public static final String CATALOG_URL = BASE_URL + "/recherche/?q=Delcourt&f_dpt=25&f_dpt_25_cat=113885&tri=nouveautes";

    public DelcourtComicsSource(ScraperProperties properties) {
        super(properties);
    }

    @Override
    public String getId() {
        return "delcourt_comics";
    }

    @Override
    public String getName() {
        return "Delcourt Comics";
    }

    @Override
    public String getDescription() {
        return "Delcourt Comics (via Leslibraires.fr)";
    }

    @Override
    public String getColor() {
        return "#0077b6";
    }

    @Override
    public String getSourceUrl() {
        return CATALOG_URL;
    }

    @Override
    protected String getDefaultEditorName() {
        return "Delcourt";
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
