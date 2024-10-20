package fr.chapter_and_chai.api.services;

import fr.chapter_and_chai.api.entities.EditorEntity;
import fr.chapter_and_chai.api.repositories.EditorRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class EditorService {

    @Autowired
    private EditorRepository userRepository;

    public List<EditorEntity> getAllEditors() {
        return userRepository.findAll();
    }

    public EditorEntity getEditorById(Long id) {
        return userRepository.findById(id).orElse(null);
    }

    public EditorEntity saveEditor(EditorEntity user) {
        return userRepository.save(user);
    }

    public void deleteEditor(Long id) {
        userRepository.deleteById(id);
    }
}