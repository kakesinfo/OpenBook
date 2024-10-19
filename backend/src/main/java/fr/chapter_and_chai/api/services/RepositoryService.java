package fr.chapter_and_chai.api.services;

import fr.chapter_and_chai.api.repositories.AuthorRepository;
import fr.chapter_and_chai.api.repositories.AuthorTypeRepository;
import fr.chapter_and_chai.api.repositories.BookHasAuthorRepository;
import fr.chapter_and_chai.api.repositories.BookRepository;
import fr.chapter_and_chai.api.repositories.CategoryRepository;
import fr.chapter_and_chai.api.repositories.EditorRepository;
import fr.chapter_and_chai.api.repositories.SeriesHasThemeRepository;
import fr.chapter_and_chai.api.repositories.SeriesRepository;
import fr.chapter_and_chai.api.repositories.ThemeRepository;
import lombok.Getter;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

@Service
@Getter
@RequiredArgsConstructor(onConstructor = @__(@Autowired))
public class RepositoryService
{
    private final AuthorRepository authorRepository;
    private final AuthorTypeRepository authorTypeRepository;
    private final BookRepository bookRepository;
    private final BookHasAuthorRepository bookHasAuthorRepository;
    private final CategoryRepository categoryRepository;
    private final EditorRepository editorRepository;
    private final SeriesHasThemeRepository seriesHasThemeRepository;
    private final SeriesRepository seriesRepository;
    private final ThemeRepository themeRepository;
}
