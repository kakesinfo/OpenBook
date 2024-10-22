package fr.chapter_and_chai.api.services;

import fr.chapter_and_chai.api.entities.EditorEntity;
import fr.chapter_and_chai.api.repositories.EditorRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class EditorService {

    @Autowired
    private EditorRepository editorRepository;

    public List<EditorEntity> getAllEditors() {
        return editorRepository.findAll();
    }

    public EditorEntity getEditorById(Long id) {
        return editorRepository.findById(id).orElse(null);
    }

    public EditorEntity saveEditor(EditorEntity user) {
        return editorRepository.save(user);
    }

    public void deleteEditor(Long id) {
        editorRepository.deleteById(id);
    }
}