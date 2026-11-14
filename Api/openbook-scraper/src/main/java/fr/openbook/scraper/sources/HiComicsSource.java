package fr.openbook.scraper.sources;

import fr.openbook.scraper.config.ScraperProperties;
import org.springframework.stereotype.Component;

@Component
public class HiComicsSource extends AbstractLesLibrairesSource {

    public static final String CATALOG_URL = BASE_URL + "/editeur/hicomics---/?tri=nouveautes";

    public HiComicsSource(ScraperProperties properties) {
        super(properties);
    }

    @Override
    public String getId() {
        return "hicomics";
    }

    @Override
    public String getName() {
        return "HiComics";
    }

    @Override
    public String getDescription() {
        return "Editions HiComics (via Leslibraires.fr)";
    }

    @Override
    public String getColor() {
        return "#e63946";
    }

    @Override
    public String getSourceUrl() {
        return CATALOG_URL;
    }

    @Override
    protected String getDefaultEditorName() {
        return "HiComics";
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
