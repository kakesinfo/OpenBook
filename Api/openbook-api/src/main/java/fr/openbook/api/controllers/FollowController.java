package fr.openbook.api.controllers;

import fr.openbook.api.entities.*;
import fr.openbook.api.services.RepositoryService;
import jakarta.servlet.http.HttpSession;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.*;

@RestController
@RequestMapping("/user/follows")
@RequiredArgsConstructor
public class FollowController {

    private final RepositoryService repositoryService;

    private UserEntity getAuthenticatedUser(HttpSession session) {
        Authentication authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !authentication.isAuthenticated()) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "User not authenticated");
        }

        String username = authentication.getName();
        return repositoryService.getUserRepository()
                .findByUsername(username)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "User not found"));
    }

    @GetMapping("/{type}/{id}")
    public Map<String, Boolean> isFollowing(
            HttpSession session,
            @PathVariable String type,
            @PathVariable Long id
    ) {
        UserEntity user = getAuthenticatedUser(session);
        boolean following = checkIsFollowing(user.getId(), type, id);
        return Map.of("following", following);
    }

    @PostMapping("/{type}/{id}")
    public Map<String, Boolean> follow(
            HttpSession session,
            @PathVariable String type,
            @PathVariable Long id
    ) {
        UserEntity user = getAuthenticatedUser(session);
        setFollow(user, type, id, true);
        return Map.of("following", true);
    }

    @DeleteMapping("/{type}/{id}")
    public Map<String, Boolean> unfollow(
            HttpSession session,
            @PathVariable String type,
            @PathVariable Long id
    ) {
        UserEntity user = getAuthenticatedUser(session);
        setFollow(user, type, id, false);
        return Map.of("following", false);
    }

    @PostMapping("/{type}/{id}/toggle")
    public Map<String, Boolean> toggleFollow(
            HttpSession session,
            @PathVariable String type,
            @PathVariable Long id
    ) {
        UserEntity user = getAuthenticatedUser(session);
        boolean currentlyFollowing = checkIsFollowing(user.getId(), type, id);
        boolean newState = !currentlyFollowing;
        setFollow(user, type, id, newState);
        return Map.of("following", newState);
    }

    @GetMapping("/batch")
    public Map<String, Object> getBatchFollowStatus(
            HttpSession session,
            @RequestParam(required = false) Long seriesId,
            @RequestParam(required = false) Long editorId,
            @RequestParam(required = false) Long collectionId,
            @RequestParam(required = false) List<Long> authorIds
    ) {
        UserEntity user = getAuthenticatedUser(session);
        Long userId = user.getId();

        Map<String, Object> result = new HashMap<>();

        if (seriesId != null) {
            result.put("series", repositoryService.getUserFollowsSeriesRepository().existsByUserIdAndSeriesId(userId, seriesId.intValue()));
        }
        if (editorId != null) {
            result.put("editor", repositoryService.getUserFollowsEditorRepository().existsByUserIdAndEditorId(userId, editorId));
        }
        if (collectionId != null) {
            result.put("collection", repositoryService.getUserFollowsCollectionRepository().existsByUserIdAndCollectionId(userId, collectionId.intValue()));
        }
        if (authorIds != null && !authorIds.isEmpty()) {
            Map<String, Boolean> authorFollows = new HashMap<>();
            for (Long authorId : authorIds) {
                if (authorId != null) {
                    authorFollows.put(String.valueOf(authorId),
                            repositoryService.getUserFollowsAuthorRepository().existsByUserIdAndAuthorId(userId, authorId.intValue()));
                }
            }
            result.put("authors", authorFollows);
        }

        return result;
    }

    private boolean checkIsFollowing(Long userId, String type, Long id) {
        return switch (type.toLowerCase()) {
            case "series" -> repositoryService.getUserFollowsSeriesRepository().existsByUserIdAndSeriesId(userId, id.intValue());
            case "author" -> {
                AuthorEntity author = repositoryService.getAuthorRepository().findById(id).orElse(null);
                if (author != null && author.isCollectif()) {
                    yield false;
                }
                yield repositoryService.getUserFollowsAuthorRepository().existsByUserIdAndAuthorId(userId, id.intValue());
            }
            case "editor" -> repositoryService.getUserFollowsEditorRepository().existsByUserIdAndEditorId(userId, id);
            case "collection" -> repositoryService.getUserFollowsCollectionRepository().existsByUserIdAndCollectionId(userId, id.intValue());
            default -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown type: " + type);
        };
    }

    private void setFollow(UserEntity user, String type, Long id, boolean follow) {
        Long userId = user.getId();
        switch (type.toLowerCase()) {
            case "series" -> {
                int sId = id.intValue();
                if (follow) {
                    if (!repositoryService.getUserFollowsSeriesRepository().existsByUserIdAndSeriesId(userId, sId)) {
                        SeriesEntity series = repositoryService.getSeriesRepository().findById(id)
                                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Series not found"));
                        UserFollowsSeriesEntity entity = new UserFollowsSeriesEntity();
                        entity.setUser(user);
                        entity.setSeries(series);
                        repositoryService.getUserFollowsSeriesRepository().save(entity);
                    }
                } else {
                    repositoryService.getUserFollowsSeriesRepository().deleteByUserIdAndSeriesId(userId, sId);
                }
            }
            case "author" -> {
                int aId = id.intValue();
                if (follow) {
                    AuthorEntity author = repositoryService.getAuthorRepository().findById(id)
                            .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Author not found"));
                    if (author.isCollectif()) {
                        throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Cannot follow placeholder author 'Collectif'");
                    }
                    if (!repositoryService.getUserFollowsAuthorRepository().existsByUserIdAndAuthorId(userId, aId)) {
                        UserFollowsAuthorEntity entity = new UserFollowsAuthorEntity();
                        entity.setUser(user);
                        entity.setAuthor(author);
                        repositoryService.getUserFollowsAuthorRepository().save(entity);
                    }
                } else {
                    repositoryService.getUserFollowsAuthorRepository().deleteByUserIdAndAuthorId(userId, aId);
                }
            }
            case "editor" -> {
                if (follow) {
                    if (!repositoryService.getUserFollowsEditorRepository().existsByUserIdAndEditorId(userId, id)) {
                        EditorEntity editor = repositoryService.getEditorRepository().findById(id)
                                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Editor not found"));
                        UserFollowsEditorEntity entity = new UserFollowsEditorEntity();
                        entity.setUser(user);
                        entity.setEditor(editor);
                        repositoryService.getUserFollowsEditorRepository().save(entity);
                    }
                } else {
                    repositoryService.getUserFollowsEditorRepository().deleteByUserIdAndEditorId(userId, id);
                }
            }
            case "collection" -> {
                int cId = id.intValue();
                if (follow) {
                    if (!repositoryService.getUserFollowsCollectionRepository().existsByUserIdAndCollectionId(userId, cId)) {
                        CollectionEntity collection = repositoryService.getCollectionRepository().findById(id)
                                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Collection not found"));
                        UserFollowsCollectionEntity entity = new UserFollowsCollectionEntity();
                        entity.setUser(user);
                        entity.setCollection(collection);
                        repositoryService.getUserFollowsCollectionRepository().save(entity);
                    }
                } else {
                    repositoryService.getUserFollowsCollectionRepository().deleteByUserIdAndCollectionId(userId, cId);
                }
            }
            default -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Unknown type: " + type);
        }
    }
}
