package fr.openbook.api.services;

import fr.openbook.api.repositories.AuthorRepository;
import fr.openbook.api.repositories.AuthorTypeRepository;
import fr.openbook.api.repositories.BookHasAuthorRepository;
import fr.openbook.api.repositories.BookRepository;
import fr.openbook.api.repositories.BookStatusRepository;
import fr.openbook.api.repositories.CategoryRepository;
import fr.openbook.api.repositories.CollectionRepository;
import fr.openbook.api.repositories.EditorRepository;
import fr.openbook.api.repositories.ReadingSessionRepository;
import fr.openbook.api.repositories.SeriesHasThemeRepository;
import fr.openbook.api.repositories.SeriesRepository;
import fr.openbook.api.repositories.ThemeRepository;
import fr.openbook.api.repositories.UserFollowsAuthorRepository;
import fr.openbook.api.repositories.UserFollowsCollectionRepository;
import fr.openbook.api.repositories.UserFollowsEditorRepository;
import fr.openbook.api.repositories.UserFollowsSeriesRepository;
import fr.openbook.api.repositories.UserOwnsBooksRepository;
import fr.openbook.api.repositories.UserSellsBookRepository;
import fr.openbook.api.repositories.UserBookTransactionRepository;
import fr.openbook.api.repositories.UserRepository;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
@Getter
@RequiredArgsConstructor(onConstructor = @__(@Autowired))
public class RepositoryService
{
    private final UserRepository userRepository;
    private final AuthorRepository authorRepository;
    private final AuthorTypeRepository authorTypeRepository;
    private final BookRepository bookRepository;
    private final BookHasAuthorRepository bookHasAuthorRepository;
    private final BookStatusRepository bookStatusRepository;
    private final CategoryRepository categoryRepository;
    private final CollectionRepository collectionRepository;
    private final EditorRepository editorRepository;
    private final ReadingSessionRepository readingSessionRepository;
    private final SeriesHasThemeRepository seriesHasThemeRepository;
    private final SeriesRepository seriesRepository;
    private final ThemeRepository themeRepository;
    private final UserOwnsBooksRepository userOwnsBooksRepository;
    private final UserSellsBookRepository userSellsBookRepository;
    private final UserBookTransactionRepository userBookTransactionRepository;
    private final UserFollowsSeriesRepository userFollowsSeriesRepository;
    private final UserFollowsAuthorRepository userFollowsAuthorRepository;
    private final UserFollowsEditorRepository userFollowsEditorRepository;
    private final UserFollowsCollectionRepository userFollowsCollectionRepository;
}
